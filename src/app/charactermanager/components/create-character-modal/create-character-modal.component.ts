import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { Subject } from 'rxjs';
import { catchError, switchMap, takeUntil } from 'rxjs/operators';
import { of } from 'rxjs';
import { PC, PcSpell } from '../../models/pc';
import { BackgroundGroup, ClassEquipment, DndBackground, DndClass, DndSpell, DndSpecies } from '../../models/dnd-api.types';
import { ALL_SKILLS, CLASS_SKILL_CHOICES, DndResourcesService, SPELL_COUNTS, SPELLCASTING_CLASSES, STANDARD_LANGUAGES } from '../../services/dnd-resources.service';
// FEAT_DESCRIPTIONS is accessed via dndResources.getFeatDescription()
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

  get isSpellcastingClass(): boolean {
    return SPELLCASTING_CLASSES.has(this.clazz.toLowerCase());
  }

  get totalSteps(): number {
    return this.isSpellcastingClass ? 8 : 7;
  }

  /** The step number for equipment — always the last step. */
  get equipmentStep(): number {
    return this.isSpellcastingClass ? 8 : 7;
  }

  get stepRange(): number[] {
    return Array.from({ length: this.totalSteps }, (_, i) => i + 1);
  }

  // ── Step 1: Identity ─────────────────────────────────────────────────────
  name   = '';
  player = '';
  party  = '';
  partyList: string[] = [];

  // ── Step 2: Species ──────────────────────────────────────────────────────
  speciesList: string[] = [];
  species     = '';
  loadingSpecies = true;
  speciesDetail: DndSpecies | null = null;
  loadingSpeciesDetail = false;
  private speciesTrigger$ = new Subject<string>();

  get speciesSubspeciesNames(): string {
    return (this.speciesDetail?.subspecies ?? []).map(s => s.name).join(', ');
  }

  getTraitDescription(traitName: string): string {
    return this.dndResources.getTraitDescription(traitName);
  }

  onSpeciesChange(): void {
    this.speciesDetail = null;
    if (this.species) this.speciesTrigger$.next(this.species);
  }

  // ── Step 3: Class ────────────────────────────────────────────────────────
  classList:    string[]   = [];
  clazz        = '';
  classDetail:  DndClass | null = null;
  loadingClassList   = true;
  loadingClassDetail = false;
  selectedSubclass = '';
  // switchMap subject — cancels in-flight requests when class changes
  private classTrigger$ = new Subject<string>();

  /** True if the chosen class receives its subclass at level 1 (2024 PHB). */
  get requiresLevel1Subclass(): boolean {
    return ['sorcerer', 'warlock'].includes(this.clazz.toLowerCase());
  }

  get availableSubclasses(): { name: string; desc: string }[] {
    return this.dndResources.getSubclassesForClass(this.clazz);
  }

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

  // ── Step 5: Proficiencies & Languages ───────────────────────────────────
  /** Skills chosen by the player from the class list (excludes locked background skills) */
  selectedSkills: string[] = [];
  languageChoice = '';
  readonly standardLanguages = STANDARD_LANGUAGES;

  get classSkillConfig(): { choose: number; from: string[] } {
    return this.dndResources.getClassSkillChoices(this.clazz);
  }

  /** Background-granted skills (normalized to canonical SKILL_DEFS names) */
  get backgroundSkillProfs(): string[] {
    const skillSet = new Set(ALL_SKILLS);
    return (this.backgroundDetail?.proficiencies ?? [])
      .map(p => p.name === 'Sleight of Hand' ? 'Sleight' : p.name)
      .filter(n => skillSet.has(n));
  }

  /** Background-granted tool proficiencies (non-skill entries) */
  get backgroundToolProfs(): string[] {
    const skillSet = new Set([...ALL_SKILLS, 'Sleight of Hand']);
    return (this.backgroundDetail?.proficiencies ?? [])
      .map(p => p.name)
      .filter(n => !skillSet.has(n));
  }

  /** True when the player has chosen all the class skills they're entitled to */
  get classSkillsFull(): boolean {
    return this.selectedSkills.length >= this.classSkillConfig.choose;
  }

  isSkillChosen(skill: string): boolean {
    return this.selectedSkills.includes(skill) || this.backgroundSkillProfs.includes(skill);
  }

  isSkillLocked(skill: string): boolean {
    return this.backgroundSkillProfs.includes(skill);
  }

  toggleSkillProf(skill: string): void {
    if (this.isSkillLocked(skill)) return;
    if (this.selectedSkills.includes(skill)) {
      this.selectedSkills = this.selectedSkills.filter(s => s !== skill);
    } else {
      if (this.classSkillsFull) return;
      this.selectedSkills = [...this.selectedSkills, skill];
    }
  }

  // ── Step 6: Ability Scores ───────────────────────────────────────────────
  readonly abilities     = ABILITIES;
  readonly standardArray = [...STANDARD_ARRAY] as number[];

  // ── Step 6: Spells (spellcasting classes only) ───────────────────────────
  spellList:      DndSpell[] = [];
  loadingSpells   = false;
  selectedSpells: DndSpell[] = [];
  spellLevelFilter: number | 'all' = 'all';
  spellSearch     = '';

  get maxCantrips(): number   { return SPELL_COUNTS[this.clazz.toLowerCase()]?.cantrips ?? 0; }
  get maxKnownSpells(): number { return SPELL_COUNTS[this.clazz.toLowerCase()]?.spells ?? 0; }

  get selectedCantrips(): number  { return this.selectedSpells.filter(s => s.level === 0).length; }
  get selectedLeveled(): number   { return this.selectedSpells.filter(s => s.level > 0).length; }

  get filteredSpellList(): DndSpell[] {
    return this.spellList.filter(s => {
      const levelOk = this.spellLevelFilter === 'all'
        ? s.level <= 1
        : s.level === this.spellLevelFilter;
      const searchOk = !this.spellSearch ||
        s.name.toLowerCase().includes(this.spellSearch.toLowerCase());
      return levelOk && searchOk;
    });
  }

  isSpellSelected(spell: DndSpell): boolean {
    return this.selectedSpells.some(s => s.name === spell.name);
  }

  toggleSpell(spell: DndSpell): void {
    if (this.isSpellSelected(spell)) {
      this.selectedSpells = this.selectedSpells.filter(s => s.name !== spell.name);
      return;
    }
    const isCantrip = spell.level === 0;
    if (isCantrip && this.selectedCantrips >= this.maxCantrips) return;
    if (!isCantrip && this.selectedLeveled >= this.maxKnownSpells) return;
    this.selectedSpells = [...this.selectedSpells, spell];
  }
  assignments: Record<Ability, number | null> = {
    STR: null, DEX: null, CON: null, INT: null, WIS: null, CHA: null,
  };
  bonusPlus2: Ability | '' = '';
  bonusPlus1: Ability | '' = '';

  // ── Step 7/8: Starting Equipment ─────────────────────────────────────────
  equipmentChoice: 'A' | 'B' | '' = '';
  classEquipmentData: Record<string, ClassEquipment> | null = null;
  loadingEquipment = false;

  get currentClassEquipment(): ClassEquipment | null {
    return this.classEquipmentData?.[this.clazz.toLowerCase()] ?? null;
  }

  get backgroundStartingGold(): number {
    return this.dndResources.getBackgroundGold(this.background);
  }

  @Output() confirm = new EventEmitter<Partial<PC>>();
  @Output() close   = new EventEmitter<void>();

  constructor(private dndResources: DndResourcesService) {}

  ngOnInit(): void {
    // ── switchMap pipelines — automatically cancels stale requests ──────────
    this.speciesTrigger$.pipe(
      switchMap(name => {
        this.loadingSpeciesDetail = true;
        return this.dndResources.getSpeciesDetail(name).pipe(
          catchError(() => of(null))  // graceful 404 fallback (e.g. legacy species)
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe(detail => {
      this.speciesDetail        = detail;
      this.loadingSpeciesDetail = false;
    });

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
      if (this.species) this.speciesTrigger$.next(this.species);
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
    // Equipment is always the final step regardless of class
    if (this.step === this.equipmentStep) return !!this.equipmentChoice;

    switch (this.step) {
      case 1: return this.name.trim().length > 0;
      case 2: return !!this.species;
      case 3: return !!this.clazz
                  && (!this.requiresLevel1Subclass || !!this.selectedSubclass);
      case 4: return !!this.background;
      case 5: return this.selectedSkills.length === this.classSkillConfig.choose;
      case 6: return this.isArrayComplete
                  && !!this.bonusPlus2
                  && !!this.bonusPlus1
                  && this.bonusPlus2 !== this.bonusPlus1;
      case 7: return true; // spells — optional for casters (non-casters never reach here via switch)
      default: return false;
    }
  }

  next(): void {
    if (!this.canAdvance) return;
    this.step++;
    // Safety: fire triggers if detail not yet loaded when entering a step
    if (this.step === 3 && !this.classDetail      && !this.loadingClassDetail      && this.clazz)      this.classTrigger$.next(this.clazz);
    if (this.step === 4 && !this.backgroundDetail && !this.loadingBackgroundDetail && this.background) this.backgroundTrigger$.next(this.background);
    // Load spells when entering step 7 (casters only)
    if (this.step === 7 && this.isSpellcastingClass && !this.spellList.length) {
      this.loadingSpells = true;
      this.dndResources.getSpellsForClass(this.clazz)
        .pipe(takeUntil(this.destroy$))
        .subscribe(spells => {
          this.spellList    = spells;
          this.loadingSpells = false;
        });
    }
    // Load equipment data when entering the equipment step
    if (this.step === this.equipmentStep && !this.classEquipmentData) {
      this.loadingEquipment = true;
      this.dndResources.getClassEquipment()
        .pipe(takeUntil(this.destroy$))
        .subscribe(data => {
          this.classEquipmentData = data;
          this.loadingEquipment   = false;
        });
    }
  }

  back(): void { if (this.step > 1) this.step--; }

  // ── Class detail ─────────────────────────────────────────────────────────

  // ── trackBy helpers (prevents full *ngFor DOM reconstruction) ───────────

  trackByName(_: number, name: string): string { return name; }
  trackBySource(_: number, group: BackgroundGroup): string { return group.source; }
  trackBySpellName(_: number, spell: DndSpell): string { return spell.name; }

  // ── Starting coins ───────────────────────────────────────────────────────

  private buildStartingCoins(): { cp: number; sp: number; ep: number; gp: number; pp: number } {
    const bgGold = this.backgroundStartingGold;
    const classGold = this.equipmentChoice === 'A'
      ? (this.currentClassEquipment?.optionA.gp ?? 0)
      : (this.currentClassEquipment?.optionB.gp ?? 0);
    return { cp: 0, sp: 0, ep: 0, gp: bgGold + classGold, pp: 0 };
  }

  // ── Starting spell slots (level 1) ───────────────────────────────────────

  private buildStartingSlots(clazz: string): { [level: number]: { max: number; used: number } } {
    const key = clazz.toLowerCase();
    const slotMap: Record<string, { [level: number]: { max: number; used: number } }> = {
      bard:     { 1: { max: 2, used: 0 } },
      cleric:   { 1: { max: 2, used: 0 } },
      druid:    { 1: { max: 2, used: 0 } },
      sorcerer: { 1: { max: 2, used: 0 } },
      warlock:  { 1: { max: 1, used: 0 } },
      wizard:   { 1: { max: 2, used: 0 } },
    };
    return slotMap[key] ?? {};
  }

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
    this.selectedSkills  = [];
    this.selectedSubclass = '';
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
    this.selectedSkills = [];
    if (this.background) this.backgroundTrigger$.next(this.background);
  }

  get backgroundAbilityNames(): string {
    return this.backgroundDetail?.ability_scores.map(s => s.name).join(', ') ?? '…';
  }

  get backgroundProficiencyNames(): string {
    return this.backgroundDetail?.proficiencies.map(s => s.name).join(', ') ?? '';
  }

  get backgroundFeatName(): string {
    return this.backgroundDetail?.feat?.name ?? '';
  }

  get backgroundFeatDescription(): string {
    return this.dndResources.getFeatDescription(this.backgroundFeatName);
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
      subclass:         this.selectedSubclass || undefined,
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
      feat:             this.backgroundFeatName || undefined,
      skills:           [...this.backgroundSkillProfs, ...this.selectedSkills]
                          .reduce((acc, s) => ({ ...acc, [s]: 'prof' as const }), {}),
      languages:        ['Common', ...(this.languageChoice ? [this.languageChoice] : [])],
      coins:            this.buildStartingCoins(),
      weapons:          this.equipmentChoice === 'A'
                          ? (this.currentClassEquipment?.optionA.weapons ?? [])
                          : [],
      gear:             this.equipmentChoice === 'A'
                          ? (this.currentClassEquipment?.optionA.gear ?? [])
                          : [],
      features:         this.backgroundFeatName
                          ? [{
                              name:   this.backgroundFeatName,
                              source: `${this.background} · Origin Feat`,
                              desc:   this.backgroundFeatDescription
                                        || 'See the 2024 Player\'s Handbook for full details.',
                            }]
                          : [],
      spells: this.selectedSpells.map((s): PcSpell => ({
        lvl:            s.level,
        name:           s.name,
        school:         s.school,
        time:           s.actionType,
        prepared:       true,
        concentration:  s.concentration,
        ritual:         s.ritual,
        range:          s.range,
        components:     s.components,
        duration:       s.duration,
        description:    s.description,
        material:       s.material,
        higherLevelSlot: s.higherLevelSlot,
      })),
      spellSlots: this.buildStartingSlots(this.clazz),
    };

    this.confirm.emit(draft);
  }

  cancel(): void { this.close.emit(); }
}
