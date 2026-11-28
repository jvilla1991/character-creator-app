import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { PC } from '../models/pc';
import { ADJUSTMENT_LINES_MAX, AbilityStat } from '../models/stat-adjustment';
import { PcNote } from '../models/pc-note';
import { PcActivityLogEntry } from '../models/pc-activity-log';
import { LevelUpPreview, LevelUpChoices, SubclassSpellcasting } from '../models/level-up';
import { MysticFocusAction, applyMysticFocus } from '../models/mystic-focus';
import { featNamesOn } from '../models/character-feats';
import { featSpellsOwed, featSpellsOwedByFeat } from '../models/granted-spells';
import { vestigeSpellsOwed, vestigeSpellsOwedByDomain } from '../models/vestige-spells';
import { spellKey } from '../models/spell-names';
import {
  SUBCLASS_CHOICE_KEYS, SubclassChoices, cleanSubclassChoices, mergeSubclassChoices, subclassChoiceShort,
  subclassChoicesProblem, subclassSpellPickRule, subclassSpellPicksProblem, withSubclassSkills,
} from '../models/arcana-subclasses';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay, map, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { hitDieFor, modFromScore } from '../utils/character-math';
import { SpellSlots, restoreAllSlots, restoreSlot, slotLevels, spendSlot } from '../utils/spell-slots';
import { SLOT_STATS, adjustmentSum, adjustmentsFor } from '../models/stat-adjustment';
import {
  DEMO_PCS,
  DEMO_ACTIVITY_LOGS,
  demoFeatOptions,
  demoFightingStyleDue,
  demoFightingStyleOptions,
  demoProfBonus,
  demoLevelUpFields,
  demoSlotsFor,
  demoCurrentMaxSlots,
  demoSubclassLevel,
  demoSubclassOptions,
  demoIsAsiLevel,
  demoCantripsKnown,
  demoPreparedSpells,
} from './pc.demo-data';

@Injectable({
  providedIn: 'root',
})
export class PCService {
  /** @internal Use pcs$ or service methods; direct mutation breaks reactivity. */
  private pcs: PC[] = environment.demoMode ? [...DEMO_PCS] : [];

  private pcsSubject = new BehaviorSubject<PC[]>(environment.demoMode ? [...DEMO_PCS] : []);
  pcs$ = this.pcsSubject.asObservable();

  private activePCSubject = new BehaviorSubject<PC | null>(null);
  activePC$ = this.activePCSubject.asObservable();

  /** True while the last roster fetch has failed. An empty roster and a failed
   *  load both arrive as `[]`, so the roster needs this to tell them apart. */
  readonly loadFailed = signal(false);

  constructor(private http: HttpClient) {}

  readonly pcUrl = `${environment.characterApiUrl}/api/v1/pc/`;

  // Pushes a known list into the reactive stream (used by external loaders)
  setPCs(pcs: PC[]) {
    this.pcs = pcs;
    this.pcsSubject.next(pcs);
  }

  // Fetches PCs from the backend and pushes the result into pcs$
  refreshPCs(): void {
    if (environment.demoMode) {
      this.pcsSubject.next(this.pcs);
      return;
    }
    this.http.get<PC[]>(this.pcUrl + 'all').subscribe({
      next: (pcs) => {
        const parsed = pcs.map(raw => this.deserializePC(raw));
        this.pcs = parsed;
        this.pcsSubject.next(parsed);
        this.loadFailed.set(false);
      },
      error: (err) => {
        console.error('Failed to load PCs', err);
        this.loadFailed.set(true);
      }
    });
  }

  /**
   * Refetch one PC from the backend and mirror it into pcs$/activePC$ — used by
   * the standalone sheet to pick up server-side changes made from another
   * client (e.g. the DM granting a pending level-up), which otherwise stay
   * invisible until a full page reload. Demo mode is single-client, so the
   * local store is already authoritative and this is a no-op.
   */
  refreshPC(pcId: number): void {
    if (environment.demoMode) return;
    this.http.get<PC>(this.pcUrl + 'find/' + pcId).subscribe({
      next: raw => {
        const updated = this.deserializePC(raw);
        this.pcs = this.pcs.map(p => p.id === updated.id ? updated : p);
        this.pcsSubject.next(this.pcs);
        const active = this.activePCSubject.getValue();
        if (active && active.id === updated.id) {
          this.activePCSubject.next(updated);
        }
      },
      // Offline or not authorized (e.g. a DM cross-link view) — keep the local copy.
      error: () => { /* intentional no-op */ },
    });
  }

  /**
   * Check the server for a level change made from another client — the DM
   * granting or revoking a level-up, an XP award, the player spending a grant —
   * and show it. Nothing is pushed when the level, XP and grant all match the
   * local copy, so a quiet check doesn't re-render the sheet. A copy BEHIND the
   * local one on level (a request that left before a level-up committed here)
   * is dropped.
   *
   * Only a new level replaces the whole character (HP, features and spells
   * moved with it). A grant or XP change patches just those two fields, so a
   * check that crosses one of the player's own saves can't undo it.
   *
   * `asDm` reads through the campaign-DM path, for a DM watching a member's
   * sheet. Demo mode is single-client: there is nothing to fetch.
   */
  syncLevelState(pcId: number, asDm = false): Observable<void> {
    if (environment.demoMode) return of(undefined);
    const url = asDm ? `${this.pcUrl}${pcId}/as-dm` : `${this.pcUrl}find/${pcId}`;
    return this.http.get<PC>(url).pipe(
      map(raw => {
        const fresh = this.deserializePC(raw);
        const active = this.activePCSubject.getValue();
        const local = active?.id === pcId ? active : this.getPCById(pcId);
        if (!local) return;
        const localLevel = local.level ?? 1;
        const freshLevel = fresh.level ?? 1;
        if (freshLevel < localLevel) return;
        if (freshLevel === localLevel
            && (fresh.xp ?? 0) === (local.xp ?? 0)
            && (fresh.pendingLevelGrant === true) === (local.pendingLevelGrant === true)) {
          return;
        }
        this.mirrorPC(freshLevel > localLevel
          ? fresh
          : { ...local, xp: fresh.xp, pendingLevelGrant: fresh.pendingLevelGrant });
      }),
    );
  }

  getPCs() {
    if (environment.demoMode) {
      return of(this.pcs).pipe(delay(300));
    }
    return this.http.get<PC[]>(this.pcUrl + 'all').pipe(
      map(pcs => pcs.map(raw => this.deserializePC(raw)))
    );
  }

  PCById(params: HttpParams) {
    if (environment.demoMode) {
      const idParam = params.get('id');
      if (idParam) {
        const pc = this.pcs.find(p => p.id === parseInt(idParam, 10));
        return of(pc || {} as PC).pipe(delay(300));
      }
      return of({} as PC).pipe(delay(300));
    }
    const id = params.get('id');
    return this.http.get<PC>(this.pcUrl + 'find/' + id).pipe(
      map(raw => this.deserializePC(raw))
    );
  }

  getPCById(id: number) {
    return this.pcs.find((x) => x.id == id);
  }

  setActivePC(pc: PC): void {
    this.activePCSubject.next(pc);
  }

  clearActivePC(): void {
    this.activePCSubject.next(null);
  }

  getActivePC(): Observable<PC | null> {
    return this.activePC$;
  }

  /**
   * Merge a partial update into a PC already in the local store and push to
   * subscribers — no backend call. Used when the server has already persisted
   * the change (e.g. a shop purchase returns the new coins/inventory), so a full
   * PUT would be a redundant double-write.
   */
  patchLocalPC(pcId: number, patch: Partial<PC>): void {
    let patched: PC | null = null;
    this.pcs = this.pcs.map(p => {
      if (p.id !== pcId) return p;
      patched = { ...p, ...patch };
      return patched;
    });
    this.pcsSubject.next(this.pcs);
    const active = this.activePCSubject.getValue();
    if (patched && active && active.id === pcId) {
      this.activePCSubject.next(patched);
    }
  }

  /**
   * Optimistically update a PC in the local store and push to all subscribers.
   * In non-demo mode, also persists to the backend.
   */
  updatePC(pc: PC): Observable<PC> {
    if (environment.demoMode) {
      pc = this.demoKeepSubclassChoices(pc);
      this.pcs = this.pcs.map(p => p.id === pc.id ? pc : p);
      this.pcsSubject.next(this.pcs);
      // If this PC is currently active, refresh the active stream too
      const active = this.activePCSubject.getValue();
      if (active && active.id === pc.id) {
        this.activePCSubject.next(pc);
      }
      return of(pc).pipe(delay(50));
    }
    // Non-demo: persist to backend, then mirror the same optimistic update locally
    // so activePC$ and pcs$ stay in sync without a full refresh.
    return this.http.put<PC>(this.pcUrl + pc.id, this.serializePC(pc)).pipe(
      map(raw => this.deserializePC(raw)),
      tap(updated => {
        this.pcs = this.pcs.map(p => p.id === updated.id ? updated : p);
        this.pcsSubject.next(this.pcs);
        const active = this.activePCSubject.getValue();
        if (active && active.id === updated.id) {
          this.activePCSubject.next(updated);
        }
      })
    );
  }

  /**
   * Load a campaign member's full PC as the campaign's DM. The dashboard only
   * holds the privacy-limited member projection for other players' characters;
   * this fetches the complete sheet so a DM can edit it without losing the
   * fields the projection omits (spells, gear, notes, …). Demo mode reads the
   * local store (where the full PC is already present).
   */
  getPCByIdAsDm(id: number): Observable<PC> {
    if (environment.demoMode) {
      const pc = this.pcs.find(p => p.id === id);
      return of((pc ?? {}) as PC).pipe(delay(150));
    }
    return this.http.get<PC>(`${this.pcUrl}${id}/as-dm`).pipe(
      map(raw => this.deserializePC(raw))
    );
  }

  // ── Per-character session notes ────────────────────────────────────────────
  // Written by the owning player; readable also by the campaign's DM. Demo
  // mode keeps an in-memory log per PC (same lifetime as the demo PC store).

  private demoNotes: { [pcId: number]: PcNote[] } = {};

  getNotes(pcId: number): Observable<PcNote[]> {
    if (environment.demoMode) {
      return of([...(this.demoNotes[pcId] ?? [])]).pipe(delay(50));
    }
    return this.http.get<PcNote[]>(`${this.pcUrl}${pcId}/notes`);
  }

  // ── Per-character activity log ─────────────────────────────────────────────
  // Read-only: written by backend mutations (level-up, shop, XP, long rest, DM
  // edit), never by the client. Demo mode seeds a per-PC log from
  // DEMO_ACTIVITY_LOGS and appends a LEVEL_UP entry on demo level-up.

  private demoLog: { [pcId: number]: PcActivityLogEntry[] } =
    JSON.parse(JSON.stringify(DEMO_ACTIVITY_LOGS));

  getLog(pcId: number): Observable<PcActivityLogEntry[]> {
    if (environment.demoMode) {
      return of([...(this.demoLog[pcId] ?? [])]).pipe(delay(50));
    }
    return this.http.get<PcActivityLogEntry[]>(`${this.pcUrl}${pcId}/log`);
  }

  addNote(pcId: number, body: string, sessionId?: number | string | null): Observable<PcNote> {
    if (environment.demoMode) {
      const note: PcNote = {
        id: 'n-' + Date.now(), pcId, body: body.trim(),
        createdAt: new Date().toISOString(), sessionId: sessionId ?? null,
      };
      this.demoNotes[pcId] = [note, ...(this.demoNotes[pcId] ?? [])];
      return of(note).pipe(delay(50));
    }
    return this.http.post<PcNote>(`${this.pcUrl}${pcId}/notes`, { body, sessionId: sessionId ?? null });
  }

  /**
   * Persist a DM's edit of a campaign member's PC. Same optimistic local mirror
   * as {@link updatePC}, but hits the DM-authorized backend path (authorized by
   * campaign-DM ownership, not PC ownership). `description`, when given, is a
   * DM-authored log line that replaces the backend's automatic before/after
   * diff (see PcActivityLogService#logDmEdit on the backend) — omitted or blank
   * falls back to the auto-diff, which is what GrantService wants. Demo mode has
   * no backend diff to fall back to, so it mirrors a DM_EDIT entry into the demo
   * log itself when a description is given, then behaves like updatePC.
   */
  updatePCAsDm(pc: PC, description: string | null = null): Observable<PC> {
    if (environment.demoMode) {
      const trimmed = description?.trim();
      if (trimmed) {
        const entry: PcActivityLogEntry = {
          id: 'demo-dmedit-' + Date.now(), pcId: pc.id, actionType: 'DM_EDIT',
          description: trimmed, createdAt: new Date().toISOString(),
        };
        this.demoLog[pc.id] = [entry, ...(this.demoLog[pc.id] ?? [])].slice(0, 10);
      }
      return this.updatePC(pc);
    }
    return this.http.put<PC>(`${this.pcUrl}${pc.id}/as-dm`,
      { pc: this.serializePC(pc), description: description?.trim() || null }
    ).pipe(
      map(raw => this.deserializePC(raw)),
      tap(updated => {
        this.pcs = this.pcs.map(p => p.id === updated.id ? updated : p);
        this.pcsSubject.next(this.pcs);
        const active = this.activePCSubject.getValue();
        if (active && active.id === updated.id) {
          this.activePCSubject.next(updated);
        }
      })
    );
  }

  /**
   * DM grants (or revokes) a pending level-up for a campaign member — the
   * campaign-DM-authorized endpoint (like updatePCAsDm). The updated PC is
   * mirrored into pcs$/activePC$ so the open sheet reflects the flag at once.
   * Demo mode flips the flag on the in-memory character.
   */
  grantLevelUp(pcId: number, granted: boolean): Observable<PC> {
    if (environment.demoMode) {
      this.patchLocalPC(pcId, { pendingLevelGrant: granted });
      return of(this.getPCById(pcId) as PC).pipe(delay(50));
    }
    return this.http.put<PC>(`${this.pcUrl}${pcId}/level-grant`, { granted }).pipe(
      map(raw => this.deserializePC(raw)),
      tap(updated => {
        this.pcs = this.pcs.map(p => p.id === updated.id ? updated : p);
        this.pcsSubject.next(this.pcs);
        const active = this.activePCSubject.getValue();
        if (active && active.id === updated.id) {
          this.activePCSubject.next(updated);
        }
      })
    );
  }

  // ── Heroic Inspiration meter ───────────────────────────────────────────────

  /**
   * DM sets a campaign member's inspiration meter (campaign-DM-authorized, like
   * grantLevelUp). The sheet's pips are clickable, so this both raises and
   * lowers the meter; asking for a full meter converts into Heroic Inspiration
   * server-side (meter empties, badge lights). The updated PC is mirrored into
   * pcs$/activePC$ so the open sheet shows the meter at once.
   */
  setInspirationPips(pcId: number, pips: number): Observable<PC> {
    if (environment.demoMode) {
      const value = Math.max(0, Math.min(5, pips));
      this.patchLocalPC(pcId, value >= 5
        ? { inspirationPips: 0, heroicInspiration: true }
        : { inspirationPips: value });
      return of(this.getPCById(pcId) as PC).pipe(delay(50));
    }
    return this.http.put<PC>(`${this.pcUrl}${pcId}/inspiration`, { pips }).pipe(
      map(raw => this.deserializePC(raw)),
      tap(updated => this.mirrorPC(updated)),
    );
  }

  /**
   * Spend Heroic Inspiration — the owner (or the campaign's DM) clears the
   * badge after using the reroll. The server 409s when there is none.
   */
  useInspiration(pcId: number): Observable<PC> {
    if (environment.demoMode) {
      this.patchLocalPC(pcId, { heroicInspiration: false });
      return of(this.getPCById(pcId) as PC).pipe(delay(50));
    }
    return this.http.post<PC>(`${this.pcUrl}${pcId}/inspiration/use`, {}).pipe(
      map(raw => this.deserializePC(raw)),
      tap(updated => this.mirrorPC(updated)),
    );
  }

  /**
   * Set (a family name) or clear (null) a WoW Hunter's pet family — the owner or the
   * campaign's DM. This is the only way to change it: the server's generic update
   * ignores `petFamily`, so a null there can never be mistaken for "no pet".
   */
  setPetFamily(pcId: number, family: string | null): Observable<PC> {
    if (environment.demoMode) {
      this.patchLocalPC(pcId, { petFamily: family });
      return of(this.getPCById(pcId) as PC).pipe(delay(50));
    }
    return this.http.put<PC>(`${this.pcUrl}${pcId}/pet`, { family }).pipe(
      map(raw => this.deserializePC(raw)),
      tap(updated => this.mirrorPC(updated)),
    );
  }

  // ── Subclass choices ───────────────────────────────────────────────────────

  /**
   * Write some of a character's subclass choices (`pc.subclassChoices`): the
   * keys present replace the stored ones, and choosing `skills` also marks
   * those skills proficient. This and a level-up are the only ways to change
   * them: the server's generic update ignores the field.
   *
   * The campaign's DM may write any key, and so may the owner of a character in
   * no campaign. The owner of a character in a campaign may always change
   * `vestigeType`, and any other key only while it is missing or short of what
   * the level asks for; otherwise the server answers 403. `asDm` only matters in
   * demo mode, which has no login to tell the DM's view from the player's.
   */
  setSubclassChoices(pcId: number, choices: SubclassChoices, asDm = false): Observable<PC> {
    if (environment.demoMode) return this.demoSetSubclassChoices(pcId, choices, asDm);
    return this.http.put<PC>(`${this.pcUrl}${pcId}/subclass-choices`, choices).pipe(
      map(raw => this.deserializePC(raw)),
      tap(updated => this.mirrorPC(updated)),
    );
  }

  /**
   * Demo mirror of the server's rule for a generic save: the stored subclass
   * choices are kept whatever the caller sends, and cleaned against the class,
   * subclass and level being saved. A character that has none is left as it is.
   */
  private demoKeepSubclassChoices(pc: PC): PC {
    const stored = this.pcs.find(p => p.id === pc.id)?.subclassChoices ?? null;
    if (stored == null && pc.subclassChoices == null) return pc;
    return { ...pc, subclassChoices: cleanSubclassChoices(stored, pc, pc.subclass, pc.level ?? 1) };
  }

  /** Demo mirror of the subclass-choices endpoint: the same people, the same checks, the same refusals. */
  private demoSetSubclassChoices(pcId: number, choices: SubclassChoices, asDm: boolean): Observable<PC> {
    const refuse = (status: number, message: string) =>
      throwError(() => new HttpErrorResponse({ status, error: { message } }));
    const active = this.activePCSubject.getValue();
    const pc = this.pcs.find(p => p.id === pcId) ?? (active?.id === pcId ? active : null);
    if (!pc) return refuse(404, 'PC not found with id ' + pcId);
    const level = pc.level ?? 1;
    if (!asDm && pc.campaignId != null) {
      const locked = SUBCLASS_CHOICE_KEYS
        .some(key => choices?.[key] != null && key !== 'vestigeType' && !subclassChoiceShort(pc, level, key));
      if (locked) return refuse(403, 'In a campaign, only your Dungeon Master can change this choice');
    }
    const problem = subclassChoicesProblem(pc, pc.subclass, level, choices);
    if (problem) return refuse(400, problem);

    const subclassChoices = mergeSubclassChoices(pc, pc.subclass, level, choices);
    const skills = choices?.skills != null && subclassChoices?.skills
      ? withSubclassSkills(pc, pc.subclass, level, subclassChoices.skills)
      : pc.skills;
    this.patchShownPC(pcId, skills === pc.skills ? { subclassChoices } : { subclassChoices, skills });
    const entry: PcActivityLogEntry = {
      id: 'demo-subclass-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), pcId,
      actionType: 'SUBCLASS_CHOICE', description: (asDm ? 'DM changed' : 'Changed') + ' subclass choices',
      createdAt: new Date().toISOString(),
    };
    this.demoLog[pcId] = [entry, ...(this.demoLog[pcId] ?? [])].slice(0, 10);
    const saved = this.pcs.find(p => p.id === pcId) ?? this.activePCSubject.getValue();
    return of(saved as PC).pipe(delay(50));
  }

  // ── Mystic Focus (Warrior of the Mystic Arts, Monk 6) ──────────────────────

  /**
   * One Mystic Focus conversion: a spell slot into Focus Points
   * (`SLOT_TO_FOCUS`) or Focus Points into a spell slot (`FOCUS_TO_SLOT`), for
   * the slot of `slotLevel` (1-4). The owner, in a campaign or not, or the
   * campaign's DM. The server answers with the saved character, which replaces
   * the one on the sheet; 400 for a character without the feature or a slot
   * level it cannot recover yet, 409 when there is nothing to spend or regain.
   * `asDm` only matters in demo mode, which has no login to tell the DM's view
   * from the player's.
   */
  mysticFocus(pcId: number, action: MysticFocusAction, slotLevel: number, asDm = false): Observable<PC> {
    if (environment.demoMode) return this.demoMysticFocus(pcId, action, slotLevel, asDm);
    return this.http.post<PC>(`${this.pcUrl}${pcId}/mystic-focus`, { action, slotLevel }).pipe(
      map(raw => this.deserializePC(raw)),
      tap(updated => this.mirrorPC(updated)),
    );
  }

  /** Demo mirror of the Mystic Focus endpoint: the same rule, refusals and activity-log line. */
  private demoMysticFocus(pcId: number, action: MysticFocusAction, slotLevel: number, asDm: boolean): Observable<PC> {
    const refuse = (status: number, message: string) =>
      throwError(() => new HttpErrorResponse({ status, error: { message } }));
    const active = this.activePCSubject.getValue();
    const pc = this.pcs.find(p => p.id === pcId) ?? (active?.id === pcId ? active : null);
    if (!pc) return refuse(404, 'PC not found with id ' + pcId);
    const outcome = applyMysticFocus(pc, action, slotLevel);
    if (!outcome.ok) return refuse(outcome.status, outcome.message);

    this.patchShownPC(pcId, { spellSlots: outcome.spellSlots, classResources: outcome.classResources });
    const entry: PcActivityLogEntry = {
      id: 'demo-mystic-focus-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), pcId,
      actionType: 'SPELL_SLOT', description: (asDm ? 'DM used Mystic Focus: ' : 'Mystic Focus: ') + outcome.description,
      createdAt: new Date().toISOString(),
    };
    this.demoLog[pcId] = [entry, ...(this.demoLog[pcId] ?? [])].slice(0, 10);
    const saved = this.pcs.find(p => p.id === pcId) ?? this.activePCSubject.getValue();
    return of(saved as PC).pipe(delay(50));
  }

  // ── Spell slots: spend by hand, restore ────────────────────────────────────
  // The slot count lives on the server (the maximum is the class table plus the
  // DM's bonus lines; only `used` is state). These endpoints answer with the
  // character's slots afterwards, which replace the ones on the sheet. Nothing
  // is applied before the server answers, so a refusal leaves the sheet as it was.

  /**
   * Spend one slot of a spell level by hand: the campaign's DM on the player's
   * behalf, or the owner of a character in no campaign (a campaign player gets
   * 403: they spend a slot by casting in a live session). The server answers
   * 409 when no slot of that level is free. `asDm` only matters in demo mode,
   * which has no login to tell the DM's view from the player's; the server
   * works that out itself.
   */
  spendSpellSlot(pcId: number, spellLevel: number, asDm = false): Observable<SpellSlots> {
    if (environment.demoMode) return this.demoSlotChange(pcId, asDm, 'spend', spellLevel);
    return this.slotRequest(pcId, 'spend', { level: spellLevel });
  }

  /**
   * Give one spent slot of a spell level back: the campaign's DM, or the owner
   * of a character in no campaign (a campaign player gets 403: slots come back
   * with a rest or from the DM). 409 when nothing is spent at that level.
   */
  restoreSpellSlot(pcId: number, spellLevel: number, asDm = false): Observable<SpellSlots> {
    if (environment.demoMode) return this.demoSlotChange(pcId, asDm, 'restore', spellLevel);
    return this.slotRequest(pcId, 'restore', { level: spellLevel });
  }

  /** Give every spent slot back; same people as {@link restoreSpellSlot}. Never refused for a rested character. */
  restoreAllSpellSlots(pcId: number, asDm = false): Observable<SpellSlots> {
    if (environment.demoMode) return this.demoSlotChange(pcId, asDm, 'restoreAll', null);
    return this.slotRequest(pcId, 'restore', { all: true });
  }

  /**
   * Read the character's slots again and show them, after a spend or restore
   * the server refused: a refusal means the sheet was behind (someone else
   * spent or restored in the meantime). The DM's view reads through the DM
   * path. Quiet on failure, and nothing to do in demo mode.
   */
  refreshSpellSlots(pcId: number, asDm = false): void {
    if (environment.demoMode) return;
    const url = asDm ? `${this.pcUrl}${pcId}/as-dm` : `${this.pcUrl}find/${pcId}`;
    this.http.get<PC>(url).subscribe({
      next: raw => this.patchSpellSlots(pcId, this.deserializePC(raw).spellSlots ?? {}),
      error: () => { /* keep what the sheet has */ },
    });
  }

  private slotRequest(pcId: number, action: 'spend' | 'restore', body: { level?: number; all?: boolean }):
      Observable<SpellSlots> {
    return this.http.post<{ pcId: number; spellSlots: unknown }>(`${this.pcUrl}${pcId}/spell-slots/${action}`, body).pipe(
      map(result => this.parseJsonField<SpellSlots>(result?.spellSlots, {})),
      tap(spellSlots => this.patchSpellSlots(pcId, spellSlots)),
    );
  }

  /**
   * Put new slots on the character wherever it is showing. Unlike
   * {@link patchLocalPC} this also reaches a character that is on screen but
   * not in the viewer's own roster: the member a DM has open.
   */
  private patchSpellSlots(pcId: number, spellSlots: SpellSlots): void {
    this.patchShownPC(pcId, { spellSlots });
  }

  /**
   * The portrait endpoints answered with the character's new portrait version
   * (null once it is removed). Put it on the character wherever it is showing —
   * the roster and the open sheet, including a member a DM has open — so the
   * header and the roster change at once. PortraitService calls this.
   */
  applyPortraitVersion(pcId: number, portraitVersion: number | null): void {
    this.patchShownPC(pcId, { portraitVersion });
  }

  /** Patch a character in the roster and, when it is the one on screen, the active PC. */
  private patchShownPC(pcId: number, patch: Partial<PC>): void {
    this.pcs = this.pcs.map(p => p.id === pcId ? { ...p, ...patch } : p);
    this.pcsSubject.next(this.pcs);
    const active = this.activePCSubject.getValue();
    if (active && active.id === pcId) {
      this.activePCSubject.next({ ...active, ...patch });
    }
  }

  /**
   * Demo mirror of the spend and restore endpoints: the same rules, the same
   * refusals (as the HTTP errors the server would send, so callers handle one
   * shape), and the same activity-log lines.
   */
  private demoSlotChange(
    pcId: number, asDm: boolean, action: 'spend' | 'restore' | 'restoreAll', spellLevel: number | null,
  ): Observable<SpellSlots> {
    const refuse = (status: number, message: string) =>
      throwError(() => new HttpErrorResponse({ status, error: { message } }));
    const active = this.activePCSubject.getValue();
    const pc = this.pcs.find(p => p.id === pcId) ?? (active?.id === pcId ? active : null);
    if (!pc) return refuse(404, 'PC not found with id ' + pcId);
    const level = spellLevel ?? 0;
    if (action !== 'restoreAll' && (!Number.isInteger(level) || level < 1 || level > 9)) {
      return refuse(400, 'level must be a spell level from 1 to 9');
    }
    if (!asDm && pc.campaignId != null) {
      return refuse(403, action === 'spend'
        ? 'In a campaign, spell slots are spent by casting in a session'
        : 'In a campaign, spell slots come back with a rest or from your Dungeon Master');
    }

    // "1 of 3 left": how the server's log line words a spell level.
    const left = (slots: SpellSlots) => `${slots[level].max - slots[level].used} of ${slots[level].max} left`;
    let next: SpellSlots | null;
    let description: string;
    if (action === 'restoreAll') {
      next = restoreAllSlots(pc.spellSlots);
      // Already rested: nothing changes and nothing is logged.
      if (!slotLevels(pc.spellSlots).some(l => l.used > 0)) return of(next).pipe(delay(50));
      description = (asDm ? 'DM restored' : 'Restored') + ' all spell slots';
    } else if (action === 'spend') {
      next = spendSlot(pc.spellSlots, level);
      if (!next) return refuse(409, `No level ${level} slot available`);
      description = `${asDm ? 'DM spent' : 'Spent'} a level ${level} spell slot (${left(next)})`;
    } else {
      next = restoreSlot(pc.spellSlots, level);
      if (!next) return refuse(409, `No spent level ${level} slot to restore`);
      description = `${asDm ? 'DM restored' : 'Restored'} a level ${level} spell slot (${left(next)})`;
    }

    this.patchSpellSlots(pcId, next);
    const entry: PcActivityLogEntry = {
      id: 'demo-slot-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), pcId,
      actionType: 'SPELL_SLOT', description, createdAt: new Date().toISOString(),
    };
    this.demoLog[pcId] = [entry, ...(this.demoLog[pcId] ?? [])].slice(0, 10);
    return of(next).pipe(delay(50));
  }

  /** Mirror a server-returned PC into pcs$ and (when active) activePC$. */
  private mirrorPC(updated: PC): void {
    this.pcs = this.pcs.map(p => p.id === updated.id ? updated : p);
    this.pcsSubject.next(this.pcs);
    const active = this.activePCSubject.getValue();
    if (active && active.id === updated.id) {
      this.activePCSubject.next(updated);
    }
  }

  // ── Level-up (server-authoritative) ────────────────────────────────────────
  // The D&D rules engine lives in the backend (manager-service LevelUpService). These
  // methods are a thin client: preview fetches the computed deltas to show before the
  // user commits; levelUp commits and mirrors the returned PC into the reactive streams.

  /** Fetch the server-computed gains of advancing this PC one level (no mutation). */
  levelUpPreview(id: number): Observable<LevelUpPreview> {
    if (environment.demoMode) {
      return of(this.computeDemoPreview(id)).pipe(delay(200));
    }
    return this.http.get<LevelUpPreview>(`${this.pcUrl}${id}/level-up/preview`);
  }

  /**
   * Same preview via the campaign-DM-authorized path (like updatePCAsDm) — used
   * by the level-up modal in DM cross-link mode, where the owner-scoped preview
   * endpoint would 403. Demo mode reads the same local store either way.
   */
  levelUpPreviewAsDm(id: number): Observable<LevelUpPreview> {
    if (environment.demoMode) {
      return of(this.computeDemoPreview(id)).pipe(delay(200));
    }
    return this.http.get<LevelUpPreview>(`${this.pcUrl}${id}/level-up/preview/as-dm`);
  }

  /**
   * Commit a one-level advance server-side, then sync the updated PC into pcs$/activePC$.
   * `choices` carries the only client-supplied inputs (subclass, ASI allocation); the server
   * computes and validates everything else.
   */
  levelUp(id: number, choices?: LevelUpChoices): Observable<PC> {
    return this.commitLevelUp(id, choices, `${this.pcUrl}${id}/level-up`);
  }

  /**
   * Commit a level-up via the campaign-DM-authorized path (like updatePCAsDm) —
   * the DM performs the level-up on a member directly; the server skips the
   * XP/grant gate and consumes any pending grant. Same local mirroring as
   * levelUp; demo mode applies the same in-memory advance.
   */
  levelUpAsDm(id: number, choices?: LevelUpChoices): Observable<PC> {
    return this.commitLevelUp(id, choices, `${this.pcUrl}${id}/level-up/as-dm`);
  }

  /** Shared tail of levelUp/levelUpAsDm: build the body, POST, mirror the result. */
  private commitLevelUp(id: number, choices: LevelUpChoices | undefined, url: string): Observable<PC> {
    if (environment.demoMode) {
      return this.applyDemoLevelUp(id, choices).pipe(delay(150));
    }
    const body: LevelUpChoices = {};
    if (choices?.subclass) body.subclass = choices.subclass;
    // Hero-class respec — the modal only sets it when the player picked a different specialization.
    if (choices?.specialization) body.specialization = choices.specialization;
    if (choices?.abilityIncreases) body.abilityIncreases = choices.abilityIncreases;
    if (choices?.feat) body.feat = choices.feat;
    if (choices?.fightingStyle) body.fightingStyle = choices.fightingStyle;
    if (choices?.newSpells?.length) body.newSpells = choices.newSpells;
    // Subclass choices made this level (an Arcana Domain cleric's skill) and the subclass picks
    // swapped out; the replacements ride in newSpells with the feature as their `grantedBy`.
    if (choices?.subclassChoices && Object.keys(choices.subclassChoices).length) {
      body.subclassChoices = choices.subclassChoices;
    }
    if (choices?.forgetSpells?.length) body.forgetSpells = choices.forgetSpells;
    // Only forward ROLL — the server treats an absent mode as AVERAGE (and does the rolling).
    if (choices?.hpMode === 'ROLL') body.hpMode = 'ROLL';
    return this.http.post<PC>(url, body).pipe(
      map(raw => this.deserializePC(raw)),
      tap(updated => {
        this.pcs = this.pcs.map(p => p.id === updated.id ? updated : p);
        this.pcsSubject.next(this.pcs);
        const active = this.activePCSubject.getValue();
        if (active && active.id === updated.id) {
          this.activePCSubject.next(updated);
        }
      })
    );
  }

  // ── Demo-mode level-up orchestration ────────────────────────────────────────
  // These two methods read/mutate the local demo store (this.pcs + subjects), so they
  // stay in the service. The pure D&D-mirror math they call lives in pc.demo-data.ts.
  // Production never runs these — the authoritative rules engine is server-side.

  private computeDemoPreview(id: number): LevelUpPreview {
    const pc = this.pcs.find(p => p.id === id)!;
    const { current, newLevel, hitDie, conMod, hpGained } = demoLevelUpFields(pc);
    const featOptions = demoIsAsiLevel(pc.clazz, newLevel)
      ? demoFeatOptions(pc.clazz, newLevel, pc.stats, featNamesOn(pc), pc.subclass) : [];
    const subclassDue = newLevel === demoSubclassLevel(pc.clazz) && !pc.subclass;
    return {
      currentLevel: current,
      newLevel,
      hitDie,
      conModifier: conMod,
      hpGained,
      newHpMax: (pc.hp?.max ?? 0) + hpGained,
      currentProfBonus: demoProfBonus(current) + adjustmentSum(adjustmentsFor(pc, 'prof')),
      newProfBonus: demoProfBonus(newLevel) + adjustmentSum(adjustmentsFor(pc, 'prof')),
      currentSpellSlots: demoCurrentMaxSlots(pc),
      newSpellSlots: this.demoSlotMaxes(pc, newLevel),
      subclassDue,
      subclassOptions: subclassDue ? demoSubclassOptions(pc.clazz, pc.specialization) : [],
      asiDue: demoIsAsiLevel(pc.clazz, newLevel),
      featOptions,
      // The class and subclass grants are server-owned; the demo shim mirrors the feats' only,
      // and a Vestige Patron's Vestige Spells (the domain it stored, or each one while none is).
      alwaysPreparedSpells: [...featSpellsOwed(pc, newLevel), ...vestigeSpellsOwed(pc, newLevel)],
      alwaysPreparedSpellsByFeat: featSpellsOwedByFeat(pc, featOptions, newLevel),
      alwaysPreparedSpellsByVestigeDomain: vestigeSpellsOwedByDomain(pc, newLevel),
      // Class-feature content is server-owned; the demo shim doesn't mirror it.
      featuresGained: [],
      fightingStyleDue: demoFightingStyleDue(pc.clazz, newLevel),
      fightingStyleOptions: demoFightingStyleOptions(pc.clazz, pc.subclass, newLevel),
      currentCantripsKnown: demoCantripsKnown(pc.clazz, current, pc.subclass),
      newCantripsKnown: demoCantripsKnown(pc.clazz, newLevel, pc.subclass),
      currentSpellsKnown: demoPreparedSpells(pc.clazz, current, pc.subclass),
      newSpellsKnown: demoPreparedSpells(pc.clazz, newLevel, pc.subclass),
      spellcastingBySubclass: subclassDue ? this.demoSpellcastingBySubclass(pc, newLevel) : {},
    };
  }

  /**
   * Demo mirror of the preview's `spellcastingBySubclass`: for each subclass on
   * offer whose slots, cantrips or prepared spells differ from the character's
   * without it (a Monk's Warrior of the Mystic Arts), those three numbers.
   */
  private demoSpellcastingBySubclass(pc: PC, newLevel: number): { [subclass: string]: SubclassSpellcasting } {
    const withSubclass = (subclass: string | undefined): SubclassSpellcasting => ({
      newSpellSlots: this.demoSlotMaxes(pc, newLevel, subclass),
      newCantripsKnown: demoCantripsKnown(pc.clazz, newLevel, subclass),
      newSpellsKnown: demoPreparedSpells(pc.clazz, newLevel, subclass),
    });
    const base = JSON.stringify(withSubclass(pc.subclass));
    const out: { [subclass: string]: SubclassSpellcasting } = {};
    for (const option of demoSubclassOptions(pc.clazz, pc.specialization)) {
      const casting = withSubclass(option);
      if (JSON.stringify(casting) !== base) out[option] = casting;
    }
    return out;
  }

  /**
   * Demo mirror of the server's slot maximum at a level (SpellSlotState.maxFor): the
   * class table plus the DM's `slot1`..`slot9` bonus lines; a level that comes to
   * zero or less is left out. `subclass` is the one the table is read for: the
   * character's own, or the one being picked in a level-up.
   */
  private demoSlotMaxes(pc: PC, level: number, subclass: string | null | undefined = pc.subclass): { [lvl: number]: number } {
    const table = demoSlotsFor(pc.clazz, level, subclass);
    const out: { [lvl: number]: number } = {};
    SLOT_STATS.forEach((stat, i) => {
      const total = (table[i + 1] ?? 0) + adjustmentSum(adjustmentsFor(pc, stat));
      if (total > 0) out[i + 1] = total;
    });
    return out;
  }

  private applyDemoLevelUp(id: number, choices?: LevelUpChoices): Observable<PC> {
    const existing = this.pcs.find(p => p.id === id)!;
    const current = existing.level ?? 1;
    const newLevel = current + 1;
    const hitDie = hitDieFor(existing.clazz);

    // Subclass choices and picks are checked against the character as it will be at the new
    // level, with the subclass chosen in this same request (mirrors the server).
    const subclass = choices?.subclass || existing.subclass;
    const problem = subclassChoicesProblem(existing, subclass, newLevel, choices?.subclassChoices, { levelUp: true })
      ?? subclassSpellPicksProblem(existing, subclass, newLevel, choices?.newSpells ?? [], choices?.forgetSpells ?? []);
    if (problem) return throwError(() => new HttpErrorResponse({ status: 400, error: { message: problem } }));

    // Apply the ASI to a copy of the ability scores, then recompute HP with the new CON and
    // grant retroactive HP for prior levels when CON's modifier rises (mirrors the server).
    const stats: { [k: string]: number } = {
      STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10, ...(existing.stats ?? {}),
    };
    const oldConMod = modFromScore(stats['CON']);
    const oldDexMod = modFromScore(stats['DEX']);
    // Each raised score gets a "Level N Increase" line (mirrors the server), so
    // the ability breakdown says where the points came from.
    let statAdjustments = existing.statAdjustments;
    if (choices?.abilityIncreases) {
      for (const [ability, pts] of Object.entries(choices.abilityIncreases)) {
        const raised = Math.min(20, (stats[ability] ?? 10) + pts);
        const gained = raised - (stats[ability] ?? 10);
        stats[ability] = raised;
        const key = ability as AbilityStat;
        const lines = statAdjustments?.[key] ?? [];
        if (gained > 0 && lines.length < ADJUSTMENT_LINES_MAX) {
          statAdjustments = {
            ...(statAdjustments ?? {}),
            [key]: [...lines, { value: gained, label: `Level ${newLevel} Increase` }],
          };
        }
      }
    }
    const newConMod = modFromScore(stats['CON']);
    // DEMO-ONLY: in ROLL mode roll the die client-side so the mock HP varies. Production never
    // rolls here — the server is the rules authority and performs the roll. Average otherwise.
    const dieValue = choices?.hpMode === 'ROLL'
      ? Math.floor(Math.random() * hitDie) + 1
      : Math.floor(hitDie / 2) + 1;
    const hpGained = Math.max(1, dieValue + newConMod);
    const hpDelta = hpGained + (newLevel - 1) * (newConMod - oldConMod);

    // Rebuild slots from the class table plus the DM's bonus lines, preserving `used`
    // (clamped) like the server does.
    // With the subclass chosen in this request: a Warrior of the Mystic Arts gets its slots at once.
    const targetSlots = this.demoSlotMaxes(existing, newLevel, subclass);
    let spellSlots = existing.spellSlots;
    if (Object.keys(targetSlots).length > 0) {
      spellSlots = {};
      for (const [lvlStr, max] of Object.entries(targetSlots)) {
        const lvl = Number(lvlStr);
        const priorUsed = existing.spellSlots?.[lvl]?.used ?? 0;
        spellSlots[lvl] = { max, used: Math.min(priorUsed, max) };
      }
    }
    // A chosen feat is recorded among the character's features (matches the server).
    let features = existing.features;
    if (choices?.feat) {
      features = [...(existing.features ?? []),
        { name: choices.feat, source: `Feat (Level ${newLevel})`, desc: '' }];
    }
    // A chosen level-2 Fighting Style is recorded among the features too.
    if (choices?.fightingStyle) {
      features = [...(features ?? []),
        { name: choices.fightingStyle, source: `Fighting Style (Level ${newLevel})`, desc: '' }];
    }
    // Newly-learned spells are appended to the character's spell list. A spell a feature or
    // feat grants takes the place of an entry the character already had (the server marks
    // the entry it finds instead).
    // A subclass pick being swapped out (Student of Arcana, Magical Mastery) is removed first; a
    // subclass pick is saved prepared, a leveled one always prepared.
    const forgotten = new Set((choices?.forgetSpells ?? []).map(spellKey));
    const kept = forgotten.size
      ? (existing.spells ?? []).filter(s => !(forgotten.has(spellKey(s.name)) && !!subclassSpellPickRule(s.grantedBy)))
      : existing.spells;
    const learned = (choices?.newSpells ?? []).map(s => subclassSpellPickRule(s.grantedBy)
      ? { ...s, prepared: true, ...(s.lvl > 0 ? { alwaysPrepared: true } : {}) }
      : s);
    const granted = new Set(learned.filter(s => !!s.grantedBy).map(s => spellKey(s.name)));
    const spells = learned.length
      ? [...(kept ?? []).filter(s => !granted.has(spellKey(s.name))), ...learned]
      : kept;
    // The choices this level-up carries replace the stored ones (a stored skill choice stays),
    // and a skill choice made now marks its skills proficient.
    const subclassChoices = mergeSubclassChoices(existing, subclass, newLevel, choices?.subclassChoices, { levelUp: true });
    const skills = subclassChoices?.skills && !Array.isArray(existing.subclassChoices?.skills)
      ? withSubclassSkills(existing, subclass, newLevel, subclassChoices.skills)
      : existing.skills;
    const updated: PC = {
      ...existing,
      level: newLevel,
      // The table for the new level plus the DM's proficiency lines (mirrors the server).
      prof: demoProfBonus(newLevel) + adjustmentSum(adjustmentsFor(existing, 'prof')),
      // A saved initiative moves with the Dexterity modifier (mirrors the server).
      init: existing.init == null ? existing.init : existing.init + modFromScore(stats['DEX']) - oldDexMod,
      stats: stats as PC['stats'],
      statAdjustments,
      hp: existing.hp
        ? { ...existing.hp, max: existing.hp.max + hpDelta, cur: existing.hp.cur + hpDelta }
        : { max: hpDelta, cur: hpDelta, temp: 0 },
      spellSlots,
      subclass,
      specialization: choices?.specialization ?? existing.specialization ?? null,
      features,
      spells,
      ...(skills !== existing.skills ? { skills } : {}),
      ...(subclassChoices || existing.subclassChoices ? { subclassChoices } : {}),
    };
    this.pcs = this.pcs.map(p => p.id === id ? updated : p);
    this.pcsSubject.next(this.pcs);
    const active = this.activePCSubject.getValue();
    if (active && active.id === id) {
      this.activePCSubject.next(updated);
    }

    // Mirror the server's level-up log entry so the demo Log tab reflects it too.
    const entry: PcActivityLogEntry = {
      id: 'demo-levelup-' + Date.now(), pcId: id, actionType: 'LEVEL_UP',
      description: 'Leveled up to ' + newLevel, createdAt: new Date().toISOString(),
    };
    this.demoLog[id] = [entry, ...(this.demoLog[id] ?? [])].slice(0, 10);

    return of(updated);
  }

  addPC(newPC: PC) {
    if (environment.demoMode) {
      // Subclass choices are never taken from a new character (mirrors the server).
      const { subclassChoices: ignoredChoices, ...created } = newPC;
      const mockPC: PC = { ...created, id: Date.now(), level: newPC.level ?? 1 };
      this.pcs = [...this.pcs, mockPC];
      this.pcsSubject.next(this.pcs);
      return of(mockPC).pipe(delay(300));
    }
    return this.http.post<PC>(this.pcUrl + 'add', this.serializePC(newPC)).pipe(
      map(pc => this.deserializePC(pc))
    );
  }

  /**
   * Flatten the PC's nested objects into the flat shape the backend entity expects.
   * Complex arrays/objects are JSON-stringified for TEXT column storage.
   */
  private serializePC(pc: PC): Record<string, unknown> {
    return {
      ...pc,
      // Flatten nested stats → individual ability score columns
      abilityStr: pc.stats?.STR ?? null,
      abilityDex: pc.stats?.DEX ?? null,
      abilityCon: pc.stats?.CON ?? null,
      abilityInt: pc.stats?.INT ?? null,
      abilityWis: pc.stats?.WIS ?? null,
      abilityCha: pc.stats?.CHA ?? null,
      // Flatten nested hp → individual HP columns
      hpMax: pc.hp?.max ?? null,
      hpCurrent: pc.hp?.cur ?? null,
      hpTemp: pc.hp?.temp ?? null,
      // Map frontend field names to backend column names
      species: pc.race ?? null,
      // Species origin (World of Warcraft species) — explicit null for everyone else.
      speciesSource: pc.speciesSource ?? null,
      lineage: pc.lineage ?? null,
      size: pc.size ?? null,
      initiative: pc.init ?? null,
      profBonus: pc.prof ?? null,
      // Scalar passthrough (rides on the spread, but kept explicit + defaulted so
      // a never-awarded PC sends 0 rather than undefined against the NOT NULL column).
      xp: pc.xp ?? 0,
      // Hero-class specialization — explicit null (not undefined) for every other character.
      specialization: pc.specialization ?? null,
      // WoW Hunter pet family — explicit null (not undefined) when none is chosen.
      petFamily: pc.petFamily ?? null,
      // Rune weapon — null lets the backend keep the stored one.
      runeWeapon: pc.runeWeapon ?? null,
      // Class resource uses: null (field never loaded) lets the backend keep the
      // stored amounts; an object — even an empty one — replaces them.
      classResources: pc.classResources == null ? null : JSON.stringify(pc.classResources),
      // Subclass choices are server-owned: always null here, which the backend reads as "keep
      // what is stored". They change only through a level-up and setSubclassChoices.
      subclassChoices: null,
      // Campaign binding — backend expects a numeric FK (or null to unbind)
      campaignId: pc.campaignId != null && !isNaN(Number(pc.campaignId))
        ? Number(pc.campaignId)
        : null,
      // null (not 0) when never tracked — the backend preserves the stored
      // value on a null (same rule as survival below), so a payload built from
      // a source without the field can't reset a real exhaustion level.
      exhaustion: pc.exhaustion ?? null,
      // JSON-stringify all arrays and objects stored as TEXT
      spells: JSON.stringify(pc.spells ?? []),
      spellSlots: JSON.stringify(pc.spellSlots ?? {}),
      saves: JSON.stringify(pc.saves ?? []),
      skills: JSON.stringify(pc.skills ?? {}),
      conditions: JSON.stringify(pc.conditions ?? []),
      // null when the character never carried the field — the backend keeps the
      // stored list on a null, so a payload built without it can't wipe it.
      conditionImmunities: pc.conditionImmunities ? JSON.stringify(pc.conditionImmunities) : null,
      // null (not a stringified default) when never tracked — the backend
      // preserves the stored value on a null, so a sheet edit can't wipe
      // survival changes made server-side during a session.
      survival: pc.survival ? JSON.stringify(pc.survival) : null,
      coins: JSON.stringify(pc.coins ?? {}),
      weapons: JSON.stringify(pc.weapons ?? []),
      gear: JSON.stringify(pc.gear ?? []),
      inventory: JSON.stringify(pc.inventory ?? []),
      features: JSON.stringify(pc.features ?? []),
      traits: JSON.stringify(pc.traits ?? {}),
      languages: JSON.stringify(pc.languages ?? []),
      toolProfs: JSON.stringify(pc.toolProfs ?? []),
      // null (not a stringified default) when the character carries none — the
      // backend keeps the stored lines on a null, so a payload built from a
      // source without the field can't wipe the DM's adjustments.
      statAdjustments: pc.statAdjustments ? JSON.stringify(pc.statAdjustments) : null,
    };
  }

  /**
   * Public hook so other services (e.g. CampaignService member projections)
   * can reuse the flat backend → nested PC mapping.
   */
  deserialize(raw: unknown): PC {
    return this.deserializePC(raw);
  }

  /** Reconstruct a full PC from the flat backend representation. */
  private deserializePC(raw: unknown): PC {
    // The wire row is PC-shaped plus the flat backend columns (species,
    // abilityStr, hpCurrent, …) folded in below via bracket access.
    const pc = raw as PC & Record<string, unknown>;
    // Drop the legacy `rune` key so it never rides back to the server on save.
    const { rune: legacyRune, ...rest } = pc;
    return {
      ...rest,
      race: (pc['species'] as string) ?? pc.race,
      init: (pc['initiative'] as number) ?? pc.init,
      prof: (pc['profBonus'] as number) ?? pc.prof,
      xp: (pc['xp'] as number) ?? pc.xp ?? 0,
      // `rune` is the pre-specialization name of the field (older payloads/rows).
      specialization: (pc['specialization'] as string | null | undefined)
        ?? (legacyRune as string | null | undefined) ?? null,
      petFamily: (pc['petFamily'] as string | null | undefined) ?? null,
      speciesSource: (pc['speciesSource'] as string | null | undefined) ?? null,
      lineage: (pc['lineage'] as string | null | undefined) ?? null,
      size: (pc['size'] as string | null | undefined) ?? null,
      stats: {
        STR: (pc['abilityStr'] as number) ?? pc.stats?.STR ?? 10,
        DEX: (pc['abilityDex'] as number) ?? pc.stats?.DEX ?? 10,
        CON: (pc['abilityCon'] as number) ?? pc.stats?.CON ?? 10,
        INT: (pc['abilityInt'] as number) ?? pc.stats?.INT ?? 10,
        WIS: (pc['abilityWis'] as number) ?? pc.stats?.WIS ?? 10,
        CHA: (pc['abilityCha'] as number) ?? pc.stats?.CHA ?? 10,
      },
      hp: {
        cur: (pc['hpCurrent'] as number) ?? pc.hp?.cur ?? 0,
        max: (pc['hpMax'] as number) ?? pc.hp?.max ?? 0,
        temp: (pc['hpTemp'] as number) ?? pc.hp?.temp ?? 0,
      },
      spells: this.parseJsonField(pc['spells'], []),
      spellSlots: this.parseJsonField(pc['spellSlots'], {}),
      classResources: this.parseJsonField(pc['classResources'], {}),
      subclassChoices: this.parseJsonField<SubclassChoices | null>(pc['subclassChoices'], null),
      saves: this.parseJsonField(pc['saves'], []),
      skills: this.parseJsonField(pc['skills'], {}),
      conditions: this.parseJsonField(pc['conditions'], []),
      // undefined (not []) when the row carries none, so a PC rebuilt from a
      // projection without the field saves null and keeps the stored list.
      conditionImmunities: this.parseJsonField(pc['conditionImmunities'], undefined),
      survival: this.parseJsonField(pc['survival'], undefined),
      coins: this.parseJsonField(pc['coins'], { cp: 0, sp: 0, gp: 0 }),
      weapons: this.parseJsonField(pc['weapons'], []),
      gear: this.parseJsonField(pc['gear'], []),
      inventory: this.parseJsonField(pc['inventory'], []),
      features: this.parseJsonField(pc['features'], []),
      traits: this.parseJsonField(pc['traits'], undefined),
      languages: this.parseJsonField(pc['languages'], []),
      toolProfs: this.parseJsonField(pc['toolProfs'], []),
      statAdjustments: this.parseJsonField(pc['statAdjustments'], null),
    } as PC;
  }

  private parseJsonField<T>(value: unknown, defaultValue: T): T {
    if (typeof value === 'string') {
      try { return JSON.parse(value) as T; } catch { return defaultValue; }
    }
    return (value as T) ?? defaultValue;
  }

  deletePC(id: number) {
    if (environment.demoMode) {
      this.pcs = this.pcs.filter(p => p.id !== id);
      this.pcsSubject.next(this.pcs);
      return of([] as PC[]).pipe(delay(300));
    }
    return this.http.delete<PC[]>(this.pcUrl + 'delete/' + id);
  }
}
