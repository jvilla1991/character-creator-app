import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { PC } from '../models/pc';
import { PcNote } from '../models/pc-note';
import { PcActivityLogEntry } from '../models/pc-activity-log';
import { LevelUpPreview, LevelUpChoices } from '../models/level-up';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay, map, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { hitDieFor, modFromScore } from '../utils/character-math';
import {
  DEMO_PCS,
  DEMO_ACTIVITY_LOGS,
  DEMO_GENERAL_FEATS,
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
      },
      error: (err) => console.error('Failed to load PCs', err)
    });
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
   * Commit a one-level advance server-side, then sync the updated PC into pcs$/activePC$.
   * `choices` carries the only client-supplied inputs (subclass, ASI allocation); the server
   * computes and validates everything else.
   */
  levelUp(id: number, choices?: LevelUpChoices): Observable<PC> {
    if (environment.demoMode) {
      return this.applyDemoLevelUp(id, choices).pipe(delay(150));
    }
    const body: LevelUpChoices = {};
    if (choices?.subclass) body.subclass = choices.subclass;
    if (choices?.abilityIncreases) body.abilityIncreases = choices.abilityIncreases;
    if (choices?.feat) body.feat = choices.feat;
    if (choices?.newSpells?.length) body.newSpells = choices.newSpells;
    // Only forward ROLL — the server treats an absent mode as AVERAGE (and does the rolling).
    if (choices?.hpMode === 'ROLL') body.hpMode = 'ROLL';
    return this.http.post<PC>(`${this.pcUrl}${id}/level-up`, body).pipe(
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
    return {
      currentLevel: current,
      newLevel,
      hitDie,
      conModifier: conMod,
      hpGained,
      newHpMax: (pc.hp?.max ?? 0) + hpGained,
      currentProfBonus: demoProfBonus(current),
      newProfBonus: demoProfBonus(newLevel),
      currentSpellSlots: demoCurrentMaxSlots(pc),
      newSpellSlots: demoSlotsFor(pc.clazz, newLevel),
      subclassDue: newLevel === demoSubclassLevel(pc.clazz) && !pc.subclass,
      subclassOptions: (newLevel === demoSubclassLevel(pc.clazz) && !pc.subclass)
        ? demoSubclassOptions(pc.clazz) : [],
      asiDue: demoIsAsiLevel(pc.clazz, newLevel),
      featOptions: demoIsAsiLevel(pc.clazz, newLevel) ? [...DEMO_GENERAL_FEATS] : [],
      // Class-feature content is server-owned; the demo shim doesn't mirror it.
      featuresGained: [],
      currentCantripsKnown: demoCantripsKnown(pc.clazz, current),
      newCantripsKnown: demoCantripsKnown(pc.clazz, newLevel),
      currentSpellsKnown: demoPreparedSpells(pc.clazz, current),
      newSpellsKnown: demoPreparedSpells(pc.clazz, newLevel),
    };
  }

  private applyDemoLevelUp(id: number, choices?: LevelUpChoices): Observable<PC> {
    const existing = this.pcs.find(p => p.id === id)!;
    const current = existing.level ?? 1;
    const newLevel = current + 1;
    const hitDie = hitDieFor(existing.clazz);

    // Apply the ASI to a copy of the ability scores, then recompute HP with the new CON and
    // grant retroactive HP for prior levels when CON's modifier rises (mirrors the server).
    const stats: { [k: string]: number } = {
      STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10, ...(existing.stats ?? {}),
    };
    const oldConMod = modFromScore(stats['CON']);
    if (choices?.abilityIncreases) {
      for (const [ability, pts] of Object.entries(choices.abilityIncreases)) {
        stats[ability] = Math.min(20, (stats[ability] ?? 10) + pts);
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

    // Rebuild slots from the demo table, preserving `used` (clamped) like the server does.
    const targetSlots = demoSlotsFor(existing.clazz, newLevel);
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
    // Newly-learned spells are appended to the character's spell list.
    const spells = choices?.newSpells?.length
      ? [...(existing.spells ?? []), ...choices.newSpells]
      : existing.spells;
    const updated: PC = {
      ...existing,
      level: newLevel,
      prof: demoProfBonus(newLevel),
      stats: stats as PC['stats'],
      hp: existing.hp
        ? { ...existing.hp, max: existing.hp.max + hpDelta, cur: existing.hp.cur + hpDelta }
        : { max: hpDelta, cur: hpDelta, temp: 0 },
      spellSlots,
      subclass: choices?.subclass || existing.subclass,
      features,
      spells,
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
      const mockPC: PC = { ...newPC, id: Date.now(), level: newPC.level ?? 1 };
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
      initiative: pc.init ?? null,
      profBonus: pc.prof ?? null,
      // Scalar passthrough (rides on the spread, but kept explicit + defaulted so
      // a never-awarded PC sends 0 rather than undefined against the NOT NULL column).
      xp: pc.xp ?? 0,
      // Campaign binding — backend expects a numeric FK (or null to unbind)
      campaignId: pc.campaignId != null && !isNaN(Number(pc.campaignId))
        ? Number(pc.campaignId)
        : null,
      // JSON-stringify all arrays and objects stored as TEXT
      spells: JSON.stringify(pc.spells ?? []),
      spellSlots: JSON.stringify(pc.spellSlots ?? {}),
      saves: JSON.stringify(pc.saves ?? []),
      skills: JSON.stringify(pc.skills ?? {}),
      conditions: JSON.stringify(pc.conditions ?? []),
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
    return {
      ...pc,
      race: (pc['species'] as string) ?? pc.race,
      init: (pc['initiative'] as number) ?? pc.init,
      prof: (pc['profBonus'] as number) ?? pc.prof,
      xp: (pc['xp'] as number) ?? pc.xp ?? 0,
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
      saves: this.parseJsonField(pc['saves'], []),
      skills: this.parseJsonField(pc['skills'], {}),
      conditions: this.parseJsonField(pc['conditions'], []),
      survival: this.parseJsonField(pc['survival'], undefined),
      coins: this.parseJsonField(pc['coins'], { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }),
      weapons: this.parseJsonField(pc['weapons'], []),
      gear: this.parseJsonField(pc['gear'], []),
      inventory: this.parseJsonField(pc['inventory'], []),
      features: this.parseJsonField(pc['features'], []),
      traits: this.parseJsonField(pc['traits'], undefined),
      languages: this.parseJsonField(pc['languages'], []),
      toolProfs: this.parseJsonField(pc['toolProfs'], []),
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
