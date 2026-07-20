import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ParticipantView, SessionStatus } from '../../../models/session';
import { SessionService, TURN_SOUNDS } from '../../../services/session.service';
import { NotificationService } from '../../../services/notification.service';
import { tintFor } from '../../../utils/character-math';
import { SURVIVAL_KEYS, SURVIVAL_LABELS, clampStage } from '../../../utils/survival';

/**
 * Initiative order — one row per combatant in server-computed turn order, with
 * an Init column, HP bar, AC and conditions. Reuses the Party Vitals Board
 * markup/classes (party-board.component).
 *
 * Turn indication renders the snapshot's per-viewer glow targets verbatim:
 * green on `activeParticipantId`, yellow on `onDeckParticipantId`. Hidden
 * enemies never reach a player's `participants` at all, so no filtering happens
 * here.
 *
 * Initiative entry: the DM edits anyone anytime; a player edits their own row
 * freely in the lobby, and once the encounter is active only while theirs is
 * still unset (late joiner). The DM also gets an encounter bar: add enemy
 * (name + optional AC + optional HP), the enemy-visibility checkbox,
 * and the turn-sound picker. Everyone gets a local mute toggle.
 */
@Component({
    selector: 'app-initiative-panel',
    templateUrl: './initiative-panel.component.html',
    styleUrls: ['./initiative-panel.component.scss'],
    standalone: false
})
export class InitiativePanelComponent {
  @Input() participants: ParticipantView[] = [];
  @Input() sessionId!: number | string;
  @Input() dm = false;
  @Input() status: SessionStatus = 'LOBBY';
  @Input() activeParticipantId: number | null = null;
  @Input() onDeckParticipantId: number | null = null;
  @Input() enemiesHidden = true;
  /** Enemies visible but their health withheld (server nulls player-side HP). */
  @Input() enemyHpHidden = false;
  @Input() turnSound: string | null = null;
  /** True when the campaign runs the survival-conditions variant — the DM's
   *  rows then show compact hunger/thirst/fatigue chips so time can be
   *  advanced with the party's state in view. */
  @Input() survivalConditions = false;

  /**
   * A DM clicked a PC row's hero cell to open that character's full sheet.
   * DM-only, PC-only (players' own sheet is already embedded in session mode,
   * and NPCs have no sheet to open). SessionModeComponent owns the actual open.
   */
  @Output() openPc = new EventEmitter<ParticipantView>();

  /** Per-row amount typed into the DM's damage/heal box, keyed by participant id. */
  amounts: { [participantId: number]: number | null } = {};

  /** Per-row XP amount typed into the DM's award box, keyed by participant id. */
  xpAmounts: { [participantId: number]: number | null } = {};

  /** Amount typed into the panel-level "award XP to all" box. */
  xpAll: number | null = null;

  // Add-enemy form (DM encounter bar). AC is optional reference info.
  enemyName = '';
  enemyAc: number | null = null;
  enemyHp: number | null = null;
  addingEnemy = false;

  soundOptions = TURN_SOUNDS;

  /** Local (per-device) turn-cue mute — mirrored from localStorage. */
  muted = false;

  constructor(
    private sessionService: SessionService,
    private notifications: NotificationService,
  ) {
    this.muted = this.sessionService.isMuted();
  }

  /**
   * Compact survival chips for a PC row (DM view, survival campaigns): "H3"
   * with the stage label in the tooltip; stage 5–6 chips are flagged dire.
   * NPCs render nothing; a never-tracked PC shows the neutral Ok default.
   */
  survivalChips(p: ParticipantView): Array<{ text: string; title: string; dire: boolean }> {
    if (p.npc) return [];
    return SURVIVAL_KEYS.map(key => {
      // Never-tracked PCs sit at the neutral Ok default, same as the panel.
      const stage = clampStage(p.survival?.[key] ?? 2);
      return {
        text: `${key.charAt(0).toUpperCase()}${stage}`,
        title: `${key}: ${SURVIVAL_LABELS[key][stage]} (${stage}/6)`,
        dire: stage >= 5,
      };
    });
  }

  /**
   * Compact spell-slot chips for a caster row (DM glance): "L1 2/4" per level
   * with a remaining slot, dire when fully spent. NPCs and non-casters render
   * nothing. Casting during the session bumps the version, so these stay live.
   */
  slotChips(p: ParticipantView): Array<{ text: string; title: string; dire: boolean }> {
    if (p.npc || !p.spellSlots) return [];
    return Object.keys(p.spellSlots)
      .map(Number)
      .sort((a, b) => a - b)
      .map(lvl => {
        const slot = p.spellSlots![lvl];
        const remaining = slot.max - slot.used;
        return {
          text: `L${lvl} ${remaining}/${slot.max}`,
          title: `Level ${lvl} slots: ${remaining} of ${slot.max} remaining`,
          dire: remaining === 0,
        };
      });
  }

  /**
   * Whether the viewer may type into this row's Init cell. DM: always (until
   * the session ends). Player: own row only — freely in the lobby, and while
   * active only to enter a still-missing value, mirroring the server rule.
   */
  canEditInitiative(p: ParticipantView): boolean {
    if (this.status === 'ENDED') return false;
    if (this.dm) return true;
    if (!p.ownedByMe) return false;
    return this.status === 'LOBBY' || !p.initRolled;
  }

  /** DM-only, PC-only: whether clicking this row's hero cell should open the sheet. */
  canOpenSheet(p: ParticipantView): boolean {
    return this.dm && !p.npc && p.pcId != null;
  }

  onHeroClick(p: ParticipantView): void {
    if (this.canOpenSheet(p)) this.openPc.emit(p);
  }

  isActive(p: ParticipantView): boolean {
    return p.participantId === this.activeParticipantId;
  }

  isOnDeck(p: ParticipantView): boolean {
    return p.participantId === this.onDeckParticipantId;
  }

  /** DM adds an enemy; it parks at the bottom until it gets an initiative. */
  addEnemy(): void {
    const name = this.enemyName.trim();
    if (!name || this.addingEnemy) return;
    this.addingEnemy = true;
    this.sessionService.addEnemy(this.sessionId, name, this.enemyAc, this.enemyHp).subscribe({
      next: () => {
        this.enemyName = '';
        this.enemyAc = null;
        this.enemyHp = null;
        this.addingEnemy = false;
      },
      error: err => {
        console.error('Failed to add enemy', err);
        this.addingEnemy = false;
      },
    });
  }

  /** The DM's three-way enemy visibility, derived from the two session flags. */
  get visibilityMode(): 'hidden' | 'no-hp' | 'full' {
    if (this.enemiesHidden) return 'hidden';
    return this.enemyHpHidden ? 'no-hp' : 'full';
  }

  /** DM picked a visibility mode — mapped back onto the two session flags. */
  onVisibilityChange(mode: string): void {
    const enemiesHidden = mode === 'hidden';
    const enemyHpHidden = mode === 'no-hp';
    this.sessionService.setVisibility(this.sessionId, enemiesHidden, enemyHpHidden).subscribe({
      error: err => console.error('Failed to set enemy visibility', err),
    });
  }

  /** True when this row's health should render as withheld (an enemy row whose
   *  HP the server nulled — the "see enemies, hide health" state — or an enemy
   *  the DM never gave HP). PCs always show their bar. */
  hpWithheld(p: ParticipantView): boolean {
    return p.npc && p.hpMax == null;
  }

  /** DM picks the encounter cue; preview it immediately so they hear the choice. */
  onSoundChange(key: string): void {
    const sound = key || null;
    this.sessionService.setSound(this.sessionId, sound).subscribe({
      error: err => console.error('Failed to set turn sound', err),
    });
    if (sound) this.sessionService.playCue(sound);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.sessionService.setMuted(this.muted);
  }

  // 5 columns read-only; a 6th DM "Adjust" column appears for the DM.
  get columns(): string {
    const base = '44px minmax(140px, 1.6fr) 150px 56px minmax(110px, 1.2fr)';
    return this.dm ? `${base} 184px` : base;
  }

  onInitiative(p: ParticipantView, raw: string): void {
    const value = parseInt(raw, 10);
    if (isNaN(value)) return;
    this.sessionService.setInitiative(this.sessionId, p.participantId, value).subscribe({
      error: err => console.error('Failed to set initiative', err),
    });
  }

  /** Apply the row's typed amount as damage (sign +1) or healing (sign -1). */
  adjustHp(p: ParticipantView, sign: 1 | -1): void {
    const amt = this.amounts[p.participantId];
    if (amt == null || amt <= 0) return;
    this.sessionService.applyDamage(this.sessionId, p.participantId, sign * amt).subscribe({
      next: () => (this.amounts[p.participantId] = null),
      error: err => console.error('Failed to adjust HP', err),
    });
  }

  /** Award the row's typed XP to that PC, then toast the new total. */
  giveXp(p: ParticipantView): void {
    const amt = this.xpAmounts[p.participantId];
    if (amt == null || amt === 0) return;
    this.sessionService.awardXp(this.sessionId, p.participantId, amt).subscribe({
      next: result => {
        this.xpAmounts[p.participantId] = null;
        const e = result.awarded[0];
        if (e) this.notifications.notify(`${e.name}: ${e.xp} XP (${this.signed(e.delta)})`);
      },
      error: err => console.error('Failed to award XP', err),
    });
  }

  /** Award the same XP amount to every seated PC, then toast the count. */
  giveXpToAll(): void {
    const amt = this.xpAll;
    if (amt == null || amt === 0) return;
    this.sessionService.awardXpToAll(this.sessionId, amt).subscribe({
      next: result => {
        this.xpAll = null;
        const n = result.awarded.length;
        this.notifications.notify(`Awarded ${this.signed(amt)} XP to ${n} character${n === 1 ? '' : 's'}`);
      },
      error: err => console.error('Failed to award XP to all', err),
    });
  }

  /** Format a delta with an explicit sign for the toast (e.g. +500, -100). */
  private signed(n: number): string {
    return n >= 0 ? `+${n}` : `${n}`;
  }

  /** DM awards one inspiration pip; the fifth converts into Heroic Inspiration. */
  giveInspiration(p: ParticipantView): void {
    this.sessionService.awardInspiration(this.sessionId, p.participantId).subscribe({
      next: state => {
        const row = state.participants.find(x => x.participantId === p.participantId);
        const heroicNow = !!row?.heroicInspiration && !p.heroicInspiration;
        this.notifications.notify(heroicNow
          ? `${p.name} gains Heroic Inspiration!`
          : `${p.name}: inspiration ${row?.inspirationPips ?? 0}/5`);
      },
      error: err => console.error('Failed to award inspiration', err),
    });
  }

  /**
   * DM disconnects a combatant from the session — same endpoint a player's own
   * Leave uses (the server authorizes the DM to remove anyone). PC rows get a
   * confirm (kicking a player is disruptive); enemy rows remove immediately.
   */
  removeParticipant(p: ParticipantView): void {
    if (!p.npc && !window.confirm(`Remove ${p.name} from the session?`)) return;
    this.sessionService.leave(this.sessionId, p.participantId).subscribe({
      error: err => console.error('Failed to remove participant', err),
    });
  }

  tintFor(p: ParticipantView): string {
    return tintFor({ portraitTint: p.portraitTint });
  }

  initialsFor(p: ParticipantView): string {
    return (p.portraitInitials || p.name.slice(0, 2)).toUpperCase();
  }

  hpPct(p: ParticipantView): number {
    const max = p.hpMax ?? 0;
    const cur = p.hpCurrent ?? 0;
    return max <= 0 ? 0 : Math.max(0, Math.min(100, (cur / max) * 100));
  }

  bloodied(p: ParticipantView): boolean {
    const max = p.hpMax ?? 0;
    const cur = p.hpCurrent ?? 0;
    return max > 0 && cur <= max / 2;
  }

  trackByParticipant(_: number, p: ParticipantView): number {
    return p.participantId;
  }
}
