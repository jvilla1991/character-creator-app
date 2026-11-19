import { Injectable, signal } from '@angular/core';
import { PC } from '../models/pc';
import { MAX_LEVEL, isReadyToLevel } from '../models/xp-thresholds';

/** localStorage key: { [pcId]: the target level whose prompt was answered }. */
export const LEVEL_UP_ANSWERED_KEY = 'tm_levelup_answered';

/** Why the character can level: the DM granted it, or XP crossed the threshold. */
export type LevelUpReason = 'grant' | 'xp';

export interface LevelUpPrompt {
  pcId: number;
  name: string;
  /** The level the character would advance TO. */
  targetLevel: number;
  reason: LevelUpReason;
  /** The character as last observed — handed to the level-up modal on "Level Up Now". */
  pc: PC;
}

export interface LevelUpModalTarget {
  pc: PC;
  /** DM cross-link: preview/commit through the campaign-DM-authorized endpoints. */
  asDm: boolean;
}

/**
 * The "you can level up" prompt and the app's single level-up modal.
 *
 * Callers feed it whatever they already observe — the standalone sheet's
 * active PC, or a live session snapshot — through {@link evaluate}; nothing
 * here polls. The prompt opens once per character per level: answering it
 * ("Later" or "Level Up Now") is remembered in localStorage against the level
 * the character would reach, so it never nags again for that level. Seeing the
 * character NOT ready (e.g. the DM revoked the grant) forgets the answer, so a
 * fresh grant prompts again. The sheet's own Level Up button is unaffected —
 * it opens the same modal through {@link openLevelUp}.
 */
@Injectable({ providedIn: 'root' })
export class LevelUpPromptService {
  private readonly _prompt = signal<LevelUpPrompt | null>(null);
  /** The open prompt (null = none). Drives the gold glow and the dialog. */
  readonly prompt = this._prompt.asReadonly();

  private readonly _levelUp = signal<LevelUpModalTarget | null>(null);
  /** The level-up modal, when open, and for which character. */
  readonly levelUp = this._levelUp.asReadonly();

  /** pcId → answered target level. Mirrors storage; survives a storage failure in memory. */
  private answered: Record<string, number> = this.load();

  /**
   * A character that came due while the level-up modal was open (e.g. enough
   * XP for a second level). Offered when the modal closes, so level-ups chain
   * without waiting for something else to change.
   */
  private deferred: PC | null = null;

  /**
   * Look at a character the player owns and open the prompt if it can level
   * and the player hasn't already answered for that level. Only call this for
   * the player's OWN character — never the DM cross-link view.
   */
  evaluate(pc: PC | null | undefined): void {
    if (!pc) return;
    const level = pc.level ?? 1;
    const grant = pc.pendingLevelGrant === true;
    const ready = level < MAX_LEVEL && (grant || isReadyToLevel(level, pc.xp ?? 0));

    if (!ready) {
      this.forget(pc.id);
      if (this._prompt()?.pcId === pc.id) this._prompt.set(null);
      if (this.deferred?.id === pc.id) this.deferred = null;
      return;
    }

    const targetLevel = level + 1;
    if (this.answered[pc.id] === targetLevel) return;
    // The player is already in the level-up flow; don't stack a prompt on it.
    // Hold the character instead and offer it once the modal closes.
    if (this._levelUp()) {
      this.deferred = pc;
      return;
    }

    const reason: LevelUpReason = grant ? 'grant' : 'xp';
    const open = this._prompt();
    if (open && open.pcId === pc.id && open.targetLevel === targetLevel && open.reason === reason) {
      return;
    }
    this._prompt.set({ pcId: pc.id, name: pc.name, targetLevel, reason, pc });
  }

  /** "Later" (also Escape / backdrop): close and don't ask again for this level. */
  later(): void {
    const open = this._prompt();
    if (!open) return;
    this.remember(open.pcId, open.targetLevel);
    this._prompt.set(null);
  }

  /** "Level Up Now": answer the prompt for this level and open the level-up modal. */
  levelUpNow(): void {
    const open = this._prompt();
    if (!open) return;
    this.remember(open.pcId, open.targetLevel);
    this._prompt.set(null);
    this._levelUp.set({ pc: open.pc, asDm: false });
  }

  /** Open the level-up modal directly (the sheet's Level Up button). */
  openLevelUp(pc: PC, asDm = false): void {
    this._levelUp.set({ pc, asDm });
  }

  /** Close the level-up modal, then offer anything that came due while it was open. */
  closeLevelUp(): void {
    this._levelUp.set(null);
    const held = this.deferred;
    this.deferred = null;
    if (held) this.evaluate(held);
  }

  /** Drop any open prompt/modal (the shell is going away, e.g. sign-out). Keeps answers. */
  reset(): void {
    this._prompt.set(null);
    this._levelUp.set(null);
    this.deferred = null;
  }

  // ── Answered-level bookkeeping ─────────────────────────────────────────────

  private remember(pcId: number, targetLevel: number): void {
    this.answered = { ...this.answered, [pcId]: targetLevel };
    this.save();
  }

  private forget(pcId: number): void {
    if (!(pcId in this.answered)) return;
    const rest = { ...this.answered };
    delete rest[pcId];
    this.answered = rest;
    this.save();
  }

  private load(): Record<string, number> {
    try {
      const raw = localStorage.getItem(LEVEL_UP_ANSWERED_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const out: Record<string, number> = {};
      for (const [id, level] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof level === 'number') out[id] = level;
      }
      return out;
    } catch {
      return {}; // storage unavailable or corrupt — prompt as if never answered
    }
  }

  private save(): void {
    try {
      if (Object.keys(this.answered).length) {
        localStorage.setItem(LEVEL_UP_ANSWERED_KEY, JSON.stringify(this.answered));
      } else {
        localStorage.removeItem(LEVEL_UP_ANSWERED_KEY);
      }
    } catch { /* best-effort — the in-memory map still answers for this page */ }
  }
}
