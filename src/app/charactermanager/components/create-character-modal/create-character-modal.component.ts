import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { PC } from '../../models/pc';
import { BackgroundGroup, DndBackground, DndClass } from '../../models/dnd-api.types';
import { DndResourcesService } from '../../services/dnd-resources.service';
import { fmtMod, modFromScore } from '../../utils/character-math';

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;
const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
type Ability = typeof ABILITIES[number];

@Component({
  selector: 'app-create-character-modal',
  templateUrl: './create-character-modal.component.html',
  styleUrls: ['./create-character-modal.component.scss']
})
export class CreateCharacterModalComponent implements OnInit, OnDestroy {

  // ── Wizard state ─────────────────────────────────────────────────────────
  step = 1;
  readonly totalSteps = 5;

  // ── Step 1: Identity ─────────────────────────────────────────────────────
  name   = '';
  player = '';
  party  = '';
  partyList: string[] = [];

  // ── Step 2: Species ──────────────────────────────────────────────────────
  speciesList: string[] = [];
  species     = '';
  loadingSpecies = true;

  // ── Step 3: Class ────────────────────────────────────────────────────────
  classList:    string[]   = [];
  clazz        = '';
  classDetail:  DndClass | null = null;
  loadingClassList   = true;
  loadingClassDetail = false;
  // switchMap subject — cancels in-flight requests when class changes
  private classTrigger$ = new Subject<string>();

  // ── Step 4: Background ───────────────────────────────────────────────────
  backgroundGroups: BackgroundGroup[] = [];
  /** Which source books are currently enabled (all on by default) */
  enabledSources: Record<string, boolean> = {};
  background        = '';
  backgroundDetail: DndBackground | null = null;
  loadingBackgroundDetail = false;
  // switchMap subject — cancels in-flight requests when background changes
  private backgroundTrigger$ = new Subject<string>();

  private destroy$ = new Subject<void>();

  // ── Step 5: Ability Scores ───────────────────────────────────────────────
  readonly abilities     = ABILITIES;
  readonly standardArray = [...STANDARD_ARRAY] as number[];
  assignments: Record<Ability, number | null> = {
    STR: null, DEX: null, CON: null, INT: null, WIS: null, CHA: null,
  };
  bonusPlus2: Ability | '' = '';
  bonusPlus1: Ability | '' = '';

  @Output() confirm = new EventEmitter<Partial<PC>>();
  @Output() close   = new EventEmitter<void>();

  constructor(private dndResources: DndResourcesService) {}

  ngOnInit(): void {
    // ── switchMap pipelines — automatically cancels stale requests ──────────
    this.classTrigger$.pipe(
      switchMap(name => {
        this.loadingClassDetail = true;
        return this.dndResources.getClassDetail(name);
      }),
      takeUntil(this.destroy$)
    ).subscribe(detail => {
      this.classDetail        = detail;
      this.loadingClassDetail = false;
    });

    this.backgroundTrigger$.pipe(
      switchMap(name => {
        this.loadingBackgroundDetail = true;
        return this.dndResources.getBackgroundDetail(name);
      }),
      takeUntil(this.destroy$)
    ).subscribe(detail => {
      this.backgroundDetail        = detail;
      this.loadingBackgroundDetail = false;
    });

    // ── Load lists ───────────────────────────────────────────────────────────
    this.dndResources.getPartyNames().subscribe(list => {
      this.partyList = list;
      this.party     = list[0] ?? '';
    });

    this.dndResources.getSpeciesList().pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.speciesList    = list;
      this.species        = list[0] ?? '';
      this.loadingSpecies = false;
    });

    this.dndResources.getClassNames2024().pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.classList        = list;
      this.clazz            = list[0] ?? '';
      this.loadingClassList = false;
      if (this.clazz) this.classTrigger$.next(this.clazz);
    });

    this.dndResources.getBackgroundGroups().pipe(takeUntil(this.destroy$)).subscribe(groups => {
      this.backgroundGroups = groups;
      // Enable all sources by default
      this.enabledSources = Object.fromEntries(
        groups.map(g => [g.source, g.source === "Player's Handbook"])
      );
      const first = groups[0]?.backgrounds[0] ?? '';
      this.background = first;
      if (first) this.backgroundTrigger$.next(first);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  get canAdvance(): boolean {
    switch (this.step) {
      case 1: return this.name.trim().length > 0;
      case 2: return !!this.species;
      case 3: return !!this.clazz;
      case 4: return !!this.background;
      case 5: return this.isArrayComplete
                  && !!this.bonusPlus2
                  && !!this.bonusPlus1
                  && this.bonusPlus2 !== this.bonusPlus1;
      default: return false;
    }
  }

  next(): void {
    if (!this.canAdvance) return;
    this.step++;
    // Safety: fire triggers if detail not yet loaded when entering a step
    if (this.step === 3 && !this.classDetail      && !this.loadingClassDetail      && this.clazz)      this.classTrigger$.next(this.clazz);
    if (this.step === 4 && !this.backgroundDetail && !this.loadingBackgroundDetail && this.background) this.backgroundTrigger$.next(this.background);
  }

  back(): void { if (this.step > 1) this.step--; }

  // ── Class detail ─────────────────────────────────────────────────────────

  // ── trackBy helpers (prevents full *ngFor DOM reconstruction) ───────────

  trackByName(_: number, name: string): string { return name; }
  trackBySource(_: number, group: BackgroundGroup): string { return group.source; }

  // ── Source filter (step 4) ────────────────────────────────────────────────

  /** Only the groups whose source is currently ticked */
  get activeBackgroundGroups(): BackgroundGroup[] {
    return this.backgroundGroups.filter(g => this.enabledSources[g.source]);
  }

  toggleSource(source: string): void {
    this.enabledSources = { ...this.enabledSources, [source]: !this.enabledSources[source] };

    // If the selected background just became hidden, auto-pick the first visible one
    const selectedStillVisible = this.activeBackgroundGroups
      .some(g => g.backgrounds.includes(this.background));

    if (!selectedStillVisible) {
      const first = this.activeBackgroundGroups[0]?.backgrounds[0] ?? '';
      this.background = first;
      if (first) this.onBackgroundChange();
    }
  }

  // ── Class detail ─────────────────────────────────────────────────────────

  onClassChange(): void {
    if (this.clazz) this.classTrigger$.next(this.clazz);
  }

  get classSavingThrows(): string {
    return this.classDetail?.saving_throws.map(s => s.name).join(', ') ?? '…';
  }

  // ── Background detail ────────────────────────────────────────────────────

  onBackgroundChange(): void {
    this.backgroundDetail = null;
    this.bonusPlus2 = '';
    this.bonusPlus1 = '';
    if (this.background) this.backgroundTrigger$.next(this.background);
  }

  get backgroundAbilityNames(): string {
    return this.backgroundDetail?.ability_scores.map(s => s.name).join(', ') ?? '…';
  }

  get backgroundProficiencyNames(): string {
    return this.backgroundDetail?.proficiencies.map(s => s.name).join(', ') ?? '';
  }

  // ── Standard Array helpers ───────────────────────────────────────────────

  /** Values from the Standard Array not yet assigned to another ability */
  availableFor(ability: Ability): number[] {
    return STANDARD_ARRAY.filter(v =>
      !Object.entries(this.assignments).some(
        ([ab, assigned]) => ab !== ability && assigned === v
      )
    ) as number[];
  }

  get isArrayComplete(): boolean {
    return Object.values(this.assignments).every(v => v !== null);
  }

  // ── Background bonus helpers ─────────────────────────────────────────────

  /** Abilities eligible for the background's +2/+1 bonus */
  get bonusAbilities(): Ability[] {
    return (this.backgroundDetail?.ability_scores ?? []).map(s => s.name as Ability);
  }

  // ── Derived stats ────────────────────────────────────────────────────────

  finalScore(ability: Ability): number {
    const base  = this.assignments[ability] ?? 0;
    const bonus = (this.bonusPlus2 === ability ? 2 : 0)
                + (this.bonusPlus1 === ability ? 1 : 0);
    return base + bonus;
  }

  modifier(score: number): string { return fmtMod(modFromScore(score)); }

  private modNum(score: number): number { return modFromScore(score); }

  // ── Submit ───────────────────────────────────────────────────────────────

  submit(): void {
    if (!this.canAdvance) return;

    const trimmedName = this.name.trim();
    const initials    = trimmedName
      .split(/\s+/)
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const hitDie = this.classDetail?.hit_die ?? 8;
    const conMod = this.modNum(this.finalScore('CON'));
    const dexMod = this.modNum(this.finalScore('DEX'));
    const maxHp  = hitDie + conMod;

    const stats = {
      STR: this.finalScore('STR'),
      DEX: this.finalScore('DEX'),
      CON: this.finalScore('CON'),
      INT: this.finalScore('INT'),
      WIS: this.finalScore('WIS'),
      CHA: this.finalScore('CHA'),
    };

    const saves = (this.classDetail?.saving_throws ?? [])
      .map(s => s.name) as Array<'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'>;

    const displayPlayer = this.player.trim() || '—';
    const draft: Partial<PC> = {
      name:             trimmedName,
      playerName:       displayPlayer,   // required by PC interface (backend compat)
      player:           displayPlayer,   // display field used by new UI
      party:            this.party,
      race:             this.species,
      clazz:            this.clazz,
      background:       this.background,
      level:            1,
      prof:             2,
      portraitInitials: initials,
      portraitTint:     'celestial',
      hp:               { cur: maxHp, max: maxHp, temp: 0 },
      ac:               10 + dexMod,
      init:             dexMod,
      speed:            30,
      stats,
      saves,
      conditions:       [],
      coins:            { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 },
      weapons:          [],
      gear:             [],
      features:         [],
      spells:           [],
      spellSlots:       {},
    };

    this.confirm.emit(draft);
  }

  cancel(): void { this.close.emit(); }
}
