import { Component, DestroyRef, HostListener, OnDestroy, OnInit, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { PC, PcSpell, Coins } from '../../models/pc';
import { BackgroundGroup, ClassEquipment, DndBackground, DndClass, DndSpell, DndSpecies } from '../../models/dnd-api.types';
import {
  ALL_SKILLS, CLASS_SKILL_CHOICES, DndResourcesService, ORIGIN_FEAT_OPTIONS, OriginFeatOption, SPELL_COUNTS,
  SPELLCASTING_CLASSES, TOOL_NAMES, languageNames, originFeatsFor,
} from '../../services/dnd-resources.service';
import { AuthService } from '../../services/auth.service';
// FEAT_DESCRIPTIONS is accessed via dndResources.getFeatDescription()
import { fmtMod, modFromScore } from '../../utils/character-math';
import { DialogDirective } from '../modal/dialog.directive';
import { MatTooltip } from '@angular/material/tooltip';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { IdentityStepComponent } from './steps/identity-step/identity-step.component';
import { SpeciesStepComponent } from './steps/species-step/species-step.component';
import { ClassStepComponent } from './steps/class-step/class-step.component';
import { BackgroundStepComponent } from './steps/background-step/background-step.component';
import { ProficienciesStepComponent } from './steps/proficiencies-step/proficiencies-step.component';
import { AbilityScoresStepComponent } from './steps/ability-scores-step/ability-scores-step.component';
import { SpellsStepComponent } from './steps/spells-step/spells-step.component';
import { EquipmentStepComponent } from './steps/equipment-step/equipment-step.component';
import { ReviewStepComponent } from './steps/review-step/review-step.component';
import { ContentSourceFilterComponent } from '../content-source-filter/content-source-filter.component';
import { ContentSource, ContentSourceSelection, allContentSources, filterBySource } from '../../models/content-source';
import {
  ClassOption, HeroClassOption, SpecializationGuidance, SpecializationOption, buildClassOptions, heroClassByKey,
  recommendedStartingSpells, recommendedSubclassFor,
} from '../../models/hero-class';
import {
  CatalogSpecies, SPECIES_ABILITY_NAMES, SpeciesOption, SpeciesSelections, buildSpeciesOptions, catalogSpeciesByKey,
  chosenLineage, emptySpeciesSelections, grantedSpeciesSkills, needsAbilityChoice, speciesChoicesComplete,
  speciesTools, speciesTraitFeatures, toSpeciesDetail,
} from '../../models/species';
import {
  MAGIC_INITIATE_CANTRIPS, MAGIC_INITIATE_SPELLS, MagicInitiateFeat, SpellGrant, level1ClassSpellGrants,
  magicInitiateFeat,
} from '../../models/granted-spells';
import { SpellPickerComponent } from '../spell-picker/spell-picker.component';
import { spellKey } from '../../models/spell-names';
import { toGrantedSpell, toPcSpell } from '../../utils/spell-mapping';
import { preparedSpellCap, withPreparedCap } from '../../utils/spell-preparation';
import {
  ALLEGIANCES, Allegiance, allegianceLanguageHint, allegianceLanguageOptions, allegiancePickCount,
  suggestedAllegiance, wowStartingLanguages,
} from '../../models/wow-languages';
import { startingSlots } from '../../utils/spell-slots';

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;
const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
type Ability = typeof ABILITIES[number];

/**
 * Snapshot of the wizard's player-entered state, persisted to localStorage so a
 * player who disconnects mid-creation resumes where they left off. Loaded data
 * (lists, details) is NOT stored — it reloads from its source on restore.
 */
interface WizardDraft {
  v: 1;
  step: number;
  name: string;
  species: string;
  /** Catalog species row key (e.g. 'Elf (World of Warcraft)'); absent/'' for a base-game species. */
  catalogSpeciesKey?: string;
  /** The catalog species' choices (lineage, size, ability, skills, tools, Origin feat). */
  speciesSelections?: Partial<SpeciesSelections>;
  clazz: string;
  /**
   * Hero class row key (e.g. 'Death Knight (Paladin)', 'Druid (World of Warcraft)');
   * absent/'' for a base class. Named for the label it held before keys existed.
   */
  heroClassLabel?: string;
  /** Hero-class specialization (Death Knight rune, Demon Hunter spec). */
  specialization?: string;
  /** Pre-specialization name of the same field — read from older drafts only. */
  rune?: string;
  /** Content-source filter (Base Game / World of Warcraft). */
  contentSources?: ContentSourceSelection;
  selectedSubclass: string;
  background: string;
  enabledSources: Record<string, boolean>;
  selectedSkills: string[];
  languageChoice: string;
  languageChoice2: string;
  /** Third pick — only an unaffiliated World of Warcraft character has one. */
  languageChoice3?: string;
  /** The allegiance the player chose for a World of Warcraft species ('' = the suggested one). */
  allegiance?: Allegiance | '';
  abilityMethod: 'standard' | 'point-buy';
  pointBuyScores: Record<Ability, number>;
  assignments: Record<Ability, number | null>;
  bonusPlus2: Ability | '';
  bonusPlus1: Ability | '';
  equipmentChoice: 'A' | 'B' | '';
  selectedSpells: DndSpell[];
  /** Magic Initiate picks, by feat name. */
  featSpellPicks?: Record<string, DndSpell[]>;
}

/** Stable empty list for a feat whose spell list has not loaded, or that has no picks yet. */
const NO_SPELLS: DndSpell[] = [];

/** Stable empty list for species without an Origin feat choice. */
const NO_FEATS: readonly OriginFeatOption[] = [];

@Component({
    selector: 'app-create-character-modal',
    templateUrl: './create-character-modal.component.html',
    styleUrls: ['./create-character-modal.component.scss'],
    imports: [DialogDirective, MatTooltip, MatSlideToggle, ContentSourceFilterComponent, SpellPickerComponent, IdentityStepComponent, SpeciesStepComponent, ClassStepComponent, BackgroundStepComponent, ProficienciesStepComponent, AbilityScoresStepComponent, SpellsStepComponent, EquipmentStepComponent, ReviewStepComponent]
})
export class CreateCharacterModalComponent implements OnInit, OnDestroy {

  // ── Wizard state ─────────────────────────────────────────────────────────
  step = 1;

  get isSpellcastingClass(): boolean {
    return SPELLCASTING_CLASSES.has(this.clazz.toLowerCase());
  }

  /**
   * True when the wizard has a spells step: the class picks spells, or an Origin
   * feat does (Magic Initiate, from the background or a Human's Versatile trait).
   */
  get hasSpellsStep(): boolean {
    return this.isSpellcastingClass || this.magicInitiateFeats.length > 0;
  }

  get totalSteps(): number {
    return this.hasSpellsStep ? 9 : 8;
  }

  /** The step number for equipment — one before the review step. */
  get equipmentStep(): number {
    return this.hasSpellsStep ? 8 : 7;
  }

  /** The final review step — always the last step. */
  get reviewStep(): number {
    return this.hasSpellsStep ? 9 : 8;
  }

  /** Spoken with the step count; mirrors each step's heading. */
  get stepName(): string {
    if (this.step === this.reviewStep) return 'Review';
    if (this.step === this.equipmentStep) return 'Starting Equipment';
    return ['Identity', 'Species', 'Class', 'Background', 'Proficiencies and Languages',
      'Ability Scores', 'Spells'][this.step - 1] ?? '';
  }

  get stepRange(): number[] {
    return Array.from({ length: this.totalSteps }, (_, i) => i + 1);
  }

  // ── Step 1: Identity ─────────────────────────────────────────────────────
  name   = '';
  // The player is always the signed-in user — sourced from their username, not editable.
  player = '';

  // ── Step 2: Species ──────────────────────────────────────────────────────
  /** Base-game species names from the 2024 API, in API order. */
  speciesList: string[] = [];
  /**
   * The species NAME (e.g. 'Elf') — what is stored on the PC. A World of
   * Warcraft species sets this to its name and records itself in
   * `catalogSpeciesKey`, because five names exist in both sources.
   */
  species     = '';
  /** Chosen catalog species row key ('Elf (World of Warcraft)'), or '' for a base-game species. */
  catalogSpeciesKey = '';
  loadingSpecies = true;
  speciesDetail: DndSpecies | null = null;
  loadingSpeciesDetail = false;
  private speciesTrigger$ = new Subject<string>();

  get speciesSubspeciesNames(): string {
    return (this.speciesDetail?.subspecies ?? []).map(s => s.name).join(', ');
  }

  /** The chosen World of Warcraft species, or undefined for a base-game one. */
  get catalogSpecies(): CatalogSpecies | undefined {
    return catalogSpeciesByKey(this.catalogSpeciesKey);
  }

  /** The key of the chosen species row — the catalog key, else the species name. */
  get selectedSpeciesKey(): string {
    return this.catalogSpecies?.key ?? this.species;
  }

  /** Every species row: base-game species (API order) then the World of Warcraft ones. */
  get speciesOptions(): SpeciesOption[] {
    return buildSpeciesOptions(this.speciesList);
  }

  /** Species rows allowed by the content-source filter. */
  get visibleSpeciesOptions(): SpeciesOption[] {
    // Memoized on its inputs: a fresh array per change-detection pass would trip
    // dev-mode's ExpressionChanged check on the [options] binding.
    const key = `${JSON.stringify(this.contentSources)}|${this.speciesList.join(',')}`;
    if (key !== this.speciesOptionsKey) {
      this.speciesOptionsCache = filterBySource(this.speciesOptions, this.contentSources);
      this.speciesOptionsKey = key;
    }
    return this.speciesOptionsCache;
  }
  private speciesOptionsKey = '';
  private speciesOptionsCache: SpeciesOption[] = [];

  /** True when the chosen species is hidden by the content-source filter (it stays chosen). */
  get selectedSpeciesHidden(): boolean {
    const key = this.selectedSpeciesKey;
    return !!key && !this.loadingSpecies && !this.visibleSpeciesOptions.some(o => o.key === key);
  }

  /** What the player picked for the chosen catalog species; all empty for a base-game species. */
  speciesSelections: SpeciesSelections = emptySpeciesSelections();

  onSpeciesChange(): void {
    this.speciesDetail = null;
    // A different species means different choices — start them over.
    this.speciesSelections = emptySpeciesSelections(this.catalogSpecies);
    this.dropNowGrantedClassSkills();
    if (this.species) this.speciesTrigger$.next(this.species);
  }

  /** A species-step choice changed (lineage, size, ability, Origin feat). */
  patchSpeciesSelections(patch: Partial<SpeciesSelections>): void {
    this.speciesSelections = { ...this.speciesSelections, ...patch };
    const catalog = this.catalogSpecies;
    // An ability picked for one lineage means nothing for a lineage that has no use for it.
    if (catalog && !needsAbilityChoice(catalog, this.speciesSelections)) {
      this.speciesSelections = { ...this.speciesSelections, ability: '' };
    }
    this.dropNowGrantedClassSkills();
    // A new lineage can change the species' usual allegiance, and with it the language table.
    this.pruneLanguagePicks();
  }

  /** A class skill the species now grants outright (Night Elf: Stealth) frees its class pick. */
  private dropNowGrantedClassSkills(): void {
    const granted = this.speciesGrantedSkills;
    if (granted.length) this.selectedSkills = this.selectedSkills.filter(s => !granted.includes(s));
  }

  /** True when every species-step choice of the chosen catalog species is made. */
  get speciesChoicesComplete(): boolean {
    const catalog = this.catalogSpecies;
    return !catalog || speciesChoicesComplete(catalog, this.speciesSelections);
  }

  /** Origin feats a Human may pick for Versatile; empty when the species has no such choice. */
  get speciesOriginFeats(): readonly OriginFeatOption[] {
    const catalog = this.catalogSpecies;
    if (!catalog?.choices?.originFeat) return NO_FEATS;
    return this.originFeatsCache[catalog.name] ??= originFeatsFor(catalog.name);
  }
  private originFeatsCache: Record<string, OriginFeatOption[]> = {};

  get speciesFeatDescription(): string {
    return this.speciesSelections.originFeat
      ? this.dndResources.getFeatDescription(this.speciesSelections.originFeat)
      : '';
  }

  /**
   * True when the Human's Origin feat is the one the background also grants and
   * the feat can't be taken twice — the background step blocks Next until one changes.
   */
  get speciesFeatConflict(): boolean {
    const feat = this.catalogSpecies?.choices?.originFeat ? this.speciesSelections.originFeat : '';
    if (!feat || feat !== this.backgroundFeatName) return false;
    return !ORIGIN_FEAT_OPTIONS.find(f => f.name === feat)?.repeatable;
  }

  /** Skills the chosen species grants with no choice (its own plus the lineage's). */
  get speciesGrantedSkills(): string[] {
    const catalog = this.catalogSpecies;
    return catalog ? grantedSpeciesSkills(catalog, this.speciesSelections) : [];
  }

  /** The species' skill choice with its options spelled out; null when it has none. */
  get speciesSkillChoice(): { count: number; from: readonly string[] } | null {
    const choice = this.catalogSpecies?.choices?.skill;
    if (!choice) return null;
    return { count: choice.count, from: choice.from === 'any' ? ALL_SKILLS : choice.from };
  }

  /**
   * The species skill picks that still count: a pick the background or the
   * lineage has since granted outright no longer does, and must be made again.
   */
  get speciesSkillPicks(): string[] {
    const taken = new Set([...this.backgroundSkillProfs, ...this.speciesGrantedSkills]);
    const options = this.speciesSkillChoice?.from ?? [];
    return this.speciesSelections.skills.filter(s => options.includes(s) && !taken.has(s));
  }

  /** Every skill the species makes the character proficient in: granted, then picked. */
  get speciesSkillProfs(): string[] {
    return [...new Set([...this.speciesGrantedSkills, ...this.speciesSkillPicks])];
  }

  /** Click a species skill chip: pick it, or unpick it. Skills held elsewhere are not pickable. */
  toggleSpeciesSkill(skill: string): void {
    const choice = this.speciesSkillChoice;
    if (!choice || !choice.from.includes(skill)) return;
    const picks = this.speciesSkillPicks;
    if (picks.includes(skill)) {
      this.speciesSelections = { ...this.speciesSelections, skills: picks.filter(s => s !== skill) };
      return;
    }
    const held = [...this.backgroundSkillProfs, ...this.speciesGrantedSkills, ...this.selectedSkills];
    if (held.includes(skill) || picks.length >= choice.count) return;
    this.speciesSelections = { ...this.speciesSelections, skills: [...picks, skill] };
  }

  /** How many tool proficiencies the species lets the player pick. */
  get speciesToolCount(): number {
    return this.catalogSpecies?.choices?.tools ?? 0;
  }

  /** Tools the species can still add: every tool the background has not already given. */
  get speciesToolOptions(): readonly string[] {
    const key = this.backgroundToolProfs.join('|');
    if (key !== this.toolOptionsKey) {
      const held = new Set(this.backgroundToolProfs);
      this.toolOptionsCache = TOOL_NAMES.filter(t => !held.has(t));
      this.toolOptionsKey = key;
    }
    return this.toolOptionsCache;
  }
  private toolOptionsKey = '\u0000';
  private toolOptionsCache: readonly string[] = [];

  /** The species tool picks that still count (a tool the background now gives does not). */
  get speciesToolPicks(): string[] {
    const options = this.speciesToolOptions;
    return [...new Set(speciesTools(this.speciesSelections).filter(t => options.includes(t)))];
  }

  setSpeciesTool(change: { index: number; tool: string }): void {
    const tools = Array.from({ length: this.speciesToolCount }, (_, i) => this.speciesSelections.tools[i] ?? '');
    tools[change.index] = change.tool;
    this.speciesSelections = { ...this.speciesSelections, tools };
  }

  /** True when the species' skill and tool picks are all made. */
  get speciesProficienciesComplete(): boolean {
    return this.speciesSkillPicks.length === (this.speciesSkillChoice?.count ?? 0)
      && this.speciesToolPicks.length === this.speciesToolCount;
  }

  /** Background tools then species tool picks, for the review step. */
  get reviewToolProfs(): string[] {
    const key = `${this.backgroundToolProfs.join('|')}#${this.speciesToolPicks.join('|')}`;
    if (key !== this.reviewToolsKey) {
      this.reviewToolsCache = [...this.backgroundToolProfs, ...this.speciesToolPicks];
      this.reviewToolsKey = key;
    }
    return this.reviewToolsCache;
  }
  private reviewToolsKey = '\u0000';
  private reviewToolsCache: string[] = [];

  /** The species detail for the review step, with the chosen size in place of 'Small or Medium'. */
  get reviewSpeciesDetail(): DndSpecies | null {
    const size = this.catalogSpecies ? this.speciesSelections.size : '';
    return this.speciesDetail && size ? { ...this.speciesDetail, size } : this.speciesDetail;
  }

  /** One line for the review step: 'Night Elf · Wisdom · Feat: Alert'; '' when there is nothing to say. */
  get reviewSpeciesChoices(): string {
    const catalog = this.catalogSpecies;
    if (!catalog) return '';
    const sel = this.speciesSelections;
    return [
      chosenLineage(catalog, sel)?.name,
      sel.ability && needsAbilityChoice(catalog, sel) ? SPECIES_ABILITY_NAMES[sel.ability] : '',
      catalog.choices?.originFeat && sel.originFeat ? `Feat: ${sel.originFeat}` : '',
    ].filter(part => !!part).join(' · ');
  }

  /** Click a species row to choose+expand it; click the chosen one again to clear it. */
  toggleSpecies(key: string): void {
    const hadWowLanguages = this.usesWowLanguages;
    this.applySpeciesToggle(key);
    // Moving to or from a World of Warcraft species swaps the whole language
    // list (PHB languages vs. an allegiance's table), so those picks start over.
    if (hadWowLanguages || this.usesWowLanguages) {
      this.allegiance = '';
      this.languageChoice = '';
      this.languageChoice2 = '';
      this.languageChoice3 = '';
    }
  }

  private applySpeciesToggle(key: string): void {
    if (this.selectedSpeciesKey === key) {
      this.species = '';
      this.catalogSpeciesKey = '';
    } else {
      const catalog = catalogSpeciesByKey(key);
      this.species = catalog?.name ?? key;
      this.catalogSpeciesKey = catalog?.key ?? '';
    }
    this.onSpeciesChange();
  }

  // ── Content-source filter (top of the wizard; filters species, classes and spells) ─
  contentSources: ContentSourceSelection = allContentSources();

  toggleContentSource(source: ContentSource): void {
    this.contentSources = { ...this.contentSources, [source]: !this.contentSources[source] };
    // A selected species, class or spells hidden by the filter stay selected: the
    // filter narrows what's offered, it never discards a choice the player made.
    // The species and class steps say so when the chosen row is hidden.
  }

  // ── Step 3: Class ────────────────────────────────────────────────────────
  /** Base class names from the 2024 API, in API order. */
  classList:    string[]   = [];
  /**
   * The BASE class (e.g. 'Paladin') — what is stored on the PC and what every
   * rules lookup keys on. A hero class sets this to its base class and records
   * itself in `heroClassKey`.
   */
  clazz        = '';
  /** Chosen hero class row key ('Death Knight (Paladin)', 'Druid (World of Warcraft)'), or '' for a base class. */
  heroClassKey = '';
  /** Hero-class specialization (e.g. a Death Knight rune) — required for every hero class. */
  specialization = '';
  classDetail:  DndClass | null = null;
  loadingClassList   = true;
  loadingClassDetail = false;
  selectedSubclass = '';
  // switchMap subject — cancels in-flight requests when class changes
  private classTrigger$ = new Subject<string>();

  /**
   * True if the player must pick the chosen class's subclass at level 1 (2024 PHB:
   * Sorcerer and Warlock). False for a hero class that locks it in — the Evoker's
   * Draconic Sorcery is set by onClassChange and shown "(fixed)" instead of a picker.
   */
  get requiresLevel1Subclass(): boolean {
    return ['sorcerer', 'warlock'].includes(this.clazz.toLowerCase()) && !this.heroClass?.subclass;
  }

  get availableSubclasses(): { name: string; desc: string }[] {
    return this.dndResources.getSubclassesForClass(this.clazz);
  }

  /** The chosen hero class, or undefined for a base class. */
  get heroClass(): HeroClassOption | undefined {
    return heroClassByKey(this.heroClassKey);
  }

  /** "Recommended for <spec>" picks for the chosen hero class + specialization; null otherwise. */
  get specializationGuidance(): SpecializationGuidance | null {
    return (this.specialization && this.heroClass?.guidance?.[this.specialization]) || null;
  }

  /**
   * The level-1 subclass the chosen specialization recommends (a WoW Warlock's
   * patron), when it is one of the picker's options; '' otherwise. Badged in the
   * class step's subclass picker — never auto-selected.
   */
  get recommendedLevel1Subclass(): string {
    if (!this.requiresLevel1Subclass) return '';
    const name = recommendedSubclassFor(this.heroClass, this.specialization);
    return name && this.availableSubclasses.some(s => s.name === name) ? name : '';
  }

  /** Spells the spells step highlights as "Recommended" (stable array — never auto-selected). */
  get recommendedSpells(): readonly string[] {
    return recommendedStartingSpells(this.heroClass, this.specialization);
  }

  /** The chosen hero class's specialization options; empty for a base class. */
  get specializationOptions(): readonly SpecializationOption[] {
    return this.heroClass?.specializations ?? [];
  }

  /** True when the chosen class needs a specialization before the class step can advance. */
  get specializationRequired(): boolean {
    return this.specializationOptions.length > 0;
  }

  /** The key of the chosen class row — the hero key, else the base class. */
  get selectedClassKey(): string {
    return this.heroClass?.key ?? this.clazz;
  }

  /** The label of the chosen class row — the hero label, else the base class. */
  get selectedClassLabel(): string {
    return this.heroClass?.label ?? this.clazz;
  }

  /** Every class row: base classes (API order) then WoW hero classes. */
  get classOptions(): ClassOption[] {
    return buildClassOptions(this.classList);
  }

  /** Class rows allowed by the content-source filter. */
  get visibleClassOptions(): ClassOption[] {
    return filterBySource(this.classOptions, this.contentSources);
  }

  /** True when the chosen class is hidden by the content-source filter (it stays chosen). */
  get selectedClassHidden(): boolean {
    const key = this.selectedClassKey;
    return !!key && !this.visibleClassOptions.some(o => o.key === key);
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

  // ── Step 5: Proficiencies & Languages ───────────────────────────────────
  /** Skills chosen by the player from the class list (excludes locked background skills) */
  selectedSkills: string[] = [];
  // 2024 PHB: every character knows Common plus TWO chosen standard languages
  languageChoice = '';
  languageChoice2 = '';
  /** Third pick — used only by an unaffiliated World of Warcraft character. */
  languageChoice3 = '';

  // World of Warcraft species choose languages by allegiance instead: Common or
  // Orcish plus two from that side's table, or any three for the unaffiliated.
  readonly allegiances = ALLEGIANCES;
  /** The allegiance the player picked; '' until they do (the species' usual side then applies). */
  allegiance: Allegiance | '' = '';

  /** True when the chosen species uses the World of Warcraft language tables. */
  get usesWowLanguages(): boolean {
    return !!this.catalogSpecies;
  }

  /** The allegiance in force: the player's pick, else the species' usual side, else none yet. */
  get effectiveAllegiance(): Allegiance | '' {
    const catalog = this.catalogSpecies;
    if (!catalog) return '';
    return this.allegiance || suggestedAllegiance(catalog.name, this.speciesSelections.lineage);
  }

  setAllegiance(allegiance: Allegiance): void {
    this.allegiance = allegiance;
    this.pruneLanguagePicks();
  }

  /** How many language dropdowns the step shows: three for the unaffiliated, else two. */
  get languagePickCount(): number {
    return this.usesWowLanguages ? allegiancePickCount(this.effectiveAllegiance) : 2;
  }

  /** The line under the language pickers; '' for a base-game species. */
  get languageHint(): string {
    return this.usesWowLanguages ? allegianceLanguageHint(this.effectiveAllegiance) : '';
  }

  /** Drop picks the current allegiance does not offer, and a third pick it has no room for. */
  private pruneLanguagePicks(): void {
    if (!this.usesWowLanguages) return;
    const options = allegianceLanguageOptions(this.effectiveAllegiance);
    if (!options.includes(this.languageChoice)) this.languageChoice = '';
    if (!options.includes(this.languageChoice2)) this.languageChoice2 = '';
    if (!options.includes(this.languageChoice3) || this.languagePickCount < 3) this.languageChoice3 = '';
  }

  /** The languages the character will start with, in order. */
  get startingLanguages(): string[] {
    const picks = [this.languageChoice, this.languageChoice2, this.languageChoice3];
    const key = `${this.usesWowLanguages}|${this.effectiveAllegiance}|${picks.join('|')}`;
    if (key !== this.startingLanguagesKey) {
      this.startingLanguagesCache = this.usesWowLanguages
        ? wowStartingLanguages(this.effectiveAllegiance, picks)
        : ['Common', ...new Set([this.languageChoice, this.languageChoice2].filter(l => !!l))];
      this.startingLanguagesKey = key;
    }
    return this.startingLanguagesCache;
  }
  private startingLanguagesKey = '\u0000';
  private startingLanguagesCache: string[] = [];
  /**
   * Languages offered for the background bonus, narrowed by the content-source
   * filter (Eredun/Nathrezim are World of Warcraft). Like a hidden class, an
   * already-picked language stays offered so the filter never discards a choice.
   *
   * A World of Warcraft species is offered its allegiance's table instead; the
   * content-source filter plays no part there.
   */
  get standardLanguages(): string[] {
    // Memoized on its inputs: a fresh array per change-detection pass would trip
    // dev-mode's ExpressionChanged check on the [standardLanguages] binding.
    const wow = this.usesWowLanguages;
    const key = wow
      ? `wow|${this.effectiveAllegiance}`
      : `${JSON.stringify(this.contentSources)}|${this.languageChoice}|${this.languageChoice2}`;
    if (key !== this.languagesKey) {
      if (wow) {
        this.languagesCache = [...allegianceLanguageOptions(this.effectiveAllegiance)];
      } else {
        const visible = languageNames(this.contentSources);
        const kept = [this.languageChoice, this.languageChoice2].filter(l => !!l && !visible.includes(l));
        this.languagesCache = [...visible, ...kept];
      }
      this.languagesKey = key;
    }
    return this.languagesCache;
  }
  private languagesKey = '';
  private languagesCache: string[] = [];

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
    return this.selectedSkills.includes(skill) || this.isSkillLocked(skill);
  }

  /** A skill the background or the species already gives can't be spent as a class pick. */
  isSkillLocked(skill: string): boolean {
    return this.backgroundSkillProfs.includes(skill) || this.speciesSkillProfs.includes(skill);
  }

  /** Background and species skills together — the class chips show these as already held. */
  get lockedSkills(): string[] {
    const key = `${this.backgroundSkillProfs.join('|')}#${this.speciesSkillProfs.join('|')}`;
    if (key !== this.lockedSkillsKey) {
      this.lockedSkillsCache = [...new Set([...this.backgroundSkillProfs, ...this.speciesSkillProfs])];
      this.lockedSkillsKey = key;
    }
    return this.lockedSkillsCache;
  }
  private lockedSkillsKey = '\u0000';
  private lockedSkillsCache: string[] = [];

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

  // Method selector — 'standard' | 'point-buy' ('dice' is disabled / coming soon)
  abilityMethod: 'standard' | 'point-buy' = 'standard';

  // ── Point Buy constants (2024 PHB) ───────────────────────────────────────
  readonly POINT_BUY_BUDGET = 27;
  readonly POINT_BUY_MIN    = 8;
  readonly POINT_BUY_MAX    = 15;
  /** Cumulative point cost to reach each score from 8. */
  readonly POINT_BUY_COSTS: Record<number, number> = {
    8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
  };

  pointBuyScores: Record<Ability, number> = {
    STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8,
  };

  get pointBuySpent(): number {
    return (Object.values(this.pointBuyScores) as number[])
      .reduce((sum, s) => sum + (this.POINT_BUY_COSTS[s] ?? 0), 0);
  }

  get pointBuyRemaining(): number {
    return this.POINT_BUY_BUDGET - this.pointBuySpent;
  }

  // Arrow properties (not methods) so they can be passed to the ability-scores
  // step child as bound function inputs without losing `this`.
  canIncreaseScore = (ability: Ability): boolean => {
    const cur      = this.pointBuyScores[ability];
    const nextCost = (this.POINT_BUY_COSTS[cur + 1] ?? 99)
                   - (this.POINT_BUY_COSTS[cur]     ?? 0);
    return cur < this.POINT_BUY_MAX && this.pointBuyRemaining >= nextCost;
  };

  canDecreaseScore = (ability: Ability): boolean => {
    return this.pointBuyScores[ability] > this.POINT_BUY_MIN;
  };

  increaseScore(ability: Ability): void {
    if (!this.canIncreaseScore(ability)) return;
    this.pointBuyScores = { ...this.pointBuyScores, [ability]: this.pointBuyScores[ability] + 1 };
  }

  decreaseScore(ability: Ability): void {
    if (!this.canDecreaseScore(ability)) return;
    this.pointBuyScores = { ...this.pointBuyScores, [ability]: this.pointBuyScores[ability] - 1 };
  }

  // ── Step 6: Spells (spellcasting classes only) ───────────────────────────
  spellList:      DndSpell[] = [];
  /** The class row `spellList` was loaded for; null until a list is loaded. */
  private spellListKey: string | null = null;
  loadingSpells   = false;
  selectedSpells: DndSpell[] = [];
  spellLevelFilter: number | 'all' = 'all';
  spellSearch     = '';

  get maxCantrips(): number   { return SPELL_COUNTS[this.clazz.toLowerCase()]?.cantrips ?? 0; }
  get maxKnownSpells(): number { return SPELL_COUNTS[this.clazz.toLowerCase()]?.spells ?? 0; }

  /**
   * Spells the class's level-1 features always keep prepared (a Ranger's Hunter's
   * Mark, a Druid's Speak with Animals). Saved on top of the picks, so the pick
   * list leaves them out.
   */
  get alwaysPreparedGrants(): readonly SpellGrant[] {
    return level1ClassSpellGrants(this.clazz);
  }

  /**
   * How many of the picked spells start prepared when the class picks more than
   * it prepares (a Wizard's six spellbook spells against four); null otherwise.
   */
  get preparedAtStart(): number | null {
    const cap = preparedSpellCap(this.clazz, 1);
    return cap != null && cap < this.maxKnownSpells ? cap : null;
  }

  // ── Step 7: Magic Initiate (Origin feat spells) ──────────────────────────
  readonly magicInitiateCantrips = MAGIC_INITIATE_CANTRIPS;
  readonly magicInitiateSpells = MAGIC_INITIATE_SPELLS;

  /**
   * The Magic Initiate feats the character has: the background's Origin feat
   * and, for a Human, the one picked for Versatile. Each brings two cantrips and
   * one always-prepared level-1 spell, picked in the spells step.
   */
  get magicInitiateFeats(): readonly MagicInitiateFeat[] {
    const speciesFeat = this.catalogSpecies?.choices?.originFeat ? this.speciesSelections.originFeat : '';
    const key = `${this.backgroundFeatName}|${speciesFeat}`;
    if (key !== this.magicInitiateKey) {
      this.magicInitiateKey = key;
      this.magicInitiateCache = [...new Set([this.backgroundFeatName, speciesFeat])].flatMap(name => {
        const feat = magicInitiateFeat(name);
        return feat ? [feat] : [];
      });
    }
    return this.magicInitiateCache;
  }
  private magicInitiateKey = '\u0000';
  private magicInitiateCache: MagicInitiateFeat[] = [];

  /** Cantrips and level-1 spells of each class list a feat draws from, once loaded ('cleric' → spells). */
  featSpellLists: Record<string, DndSpell[]> = {};
  private featSpellListsRequested = new Set<string>();
  /** What the player picked for each Magic Initiate feat, by feat name. */
  featSpellPicks: Record<string, DndSpell[]> = {};

  featSpellOptions(feat: MagicInitiateFeat): DndSpell[] {
    return this.featSpellLists[feat.spellList] ?? NO_SPELLS;
  }

  featPicks(feat: MagicInitiateFeat): DndSpell[] {
    return this.featSpellPicks[feat.feat] ?? NO_SPELLS;
  }

  setFeatPicks(feat: MagicInitiateFeat, spells: DndSpell[]): void {
    this.featSpellPicks = { ...this.featSpellPicks, [feat.feat]: spells };
  }

  /** How many cantrips (or level-1 spells) are picked for a feat. */
  featPickCount(feat: MagicInitiateFeat, cantrips: boolean): number {
    return this.featPicks(feat).filter(s => (s.level === 0) === cantrips).length;
  }

  /** Fetch the class list behind each Magic Initiate feat, once each. */
  private loadFeatSpellLists(): void {
    for (const feat of this.magicInitiateFeats) {
      if (this.featSpellListsRequested.has(feat.spellList)) continue;
      this.featSpellListsRequested.add(feat.spellList);
      this.dndResources.getSpellsForClass(feat.spellList)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: spells => {
            this.featSpellLists = { ...this.featSpellLists, [feat.spellList]: spells.filter(s => s.level <= 1) };
          },
          // Forget the request so coming back to the step tries again.
          error: () => { this.featSpellListsRequested.delete(feat.spellList); },
        });
    }
  }

  get selectedCantrips(): number  { return this.selectedSpells.filter(s => s.level === 0).length; }
  get selectedLeveled(): number   { return this.selectedSpells.filter(s => s.level > 0).length; }

  get filteredSpellList(): DndSpell[] {
    const granted = this.alwaysPreparedGrants.map(g => spellKey(g.name));
    return filterBySource(this.spellList, this.contentSources).filter(s => {
      if (granted.includes(spellKey(s.name))) return false;
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

  // Which spell's description is expanded (one at a time). Independent of
  // selection, so a player can read a spell before adding it.
  expandedSpellName: string | null = null;

  toggleSpellDesc(spell: DndSpell): void {
    this.expandedSpellName = this.expandedSpellName === spell.name ? null : spell.name;
  }

  isSpellDescOpen(spell: DndSpell): boolean {
    return this.expandedSpellName === spell.name;
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

  readonly confirm = output<Partial<PC>>();
  readonly close = output<void>();

  constructor(
    private dndResources: DndResourcesService,
    private auth: AuthService,
    private destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    // The character's player is the signed-in user; display their username.
    this.player = this.auth.getUsername() ?? '';

    // ── switchMap pipelines — automatically cancels stale requests ──────────
    this.speciesTrigger$.pipe(
      switchMap(name => {
        // A World of Warcraft species is local data — no request to wait for.
        const catalog = this.catalogSpecies;
        if (catalog) return of(toSpeciesDetail(catalog));
        this.loadingSpeciesDetail = true;
        return this.dndResources.getSpeciesDetail(name).pipe(
          catchError(() => of(null))  // graceful 404 fallback (e.g. legacy species)
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(detail => {
      this.speciesDetail        = detail;
      this.loadingSpeciesDetail = false;
    });

    this.classTrigger$.pipe(
      switchMap(name => {
        this.loadingClassDetail = true;
        return this.dndResources.getClassDetail(name);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(detail => {
      this.classDetail        = detail;
      this.loadingClassDetail = false;
    });

    this.backgroundTrigger$.pipe(
      switchMap(name => {
        this.loadingBackgroundDetail = true;
        return this.dndResources.getBackgroundDetail(name);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(detail => {
      this.backgroundDetail        = detail;
      this.loadingBackgroundDetail = false;
    });

    // ── Load lists ───────────────────────────────────────────────────────────
    this.dndResources.getSpeciesList().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(list => {
      this.speciesList    = list;
      this.loadingSpecies = false;
      // No default — the player must choose a species (gates Next).
    });

    this.dndResources.getClassNames2024().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(list => {
      this.classList        = list;
      this.loadingClassList = false;
      // No default — the player must choose a class (gates Next).
    });

    this.dndResources.getBackgroundGroups().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(groups => {
      this.backgroundGroups = groups;
      // Enable Player's Handbook by default; a restored draft's source picks win.
      this.enabledSources = {
        ...Object.fromEntries(groups.map(g => [g.source, g.source === "Player's Handbook"])),
        ...(this.restoredEnabledSources ?? {}),
      };
      // No default — the player must choose a background (gates Next).
    });

    this.restoreDraft();
  }

  ngOnDestroy(): void {
    // The modal can be destroyed without an explicit Cancel (SPA navigation,
    // logout) — treat that like a disconnect and keep the draft.
    this.saveDraft();
  }

  /** Tab/window closing mid-creation — the disconnect case the draft exists for. */
  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    this.saveDraft();
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  get canAdvance(): boolean {
    // Review step: Create is always available once you reach it
    if (this.step === this.reviewStep) return true;
    // Equipment step gate
    if (this.step === this.equipmentStep) return !!this.equipmentChoice;

    switch (this.step) {
      case 1: return this.name.trim().length > 0;
      case 2: return !!this.species && this.speciesChoicesComplete;
      case 3: return !!this.clazz
                  && (!this.requiresLevel1Subclass || !!this.selectedSubclass)
                  && (!this.specializationRequired || !!this.specialization);
      case 4: return !!this.background && !this.speciesFeatConflict;
      case 5: return this.selectedSkills.length === this.classSkillConfig.choose
                  && this.speciesProficienciesComplete
                  && (!this.usesWowLanguages || !!this.effectiveAllegiance);
      case 6: {
        const bonusesOk = !!this.bonusPlus2
                       && !!this.bonusPlus1
                       && this.bonusPlus2 !== this.bonusPlus1;
        if (this.abilityMethod === 'point-buy') return bonusesOk;
        return this.isArrayComplete && bonusesOk;
      }
      case 7: return true; // spells — optional (reached only when the class or a feat picks spells)
      default: return false;
    }
  }

  next(): void {
    if (!this.canAdvance) return;
    this.step++;
    this.ensureStepData();
    this.saveDraft();
  }

  back(): void {
    if (this.step > 1) this.step--;
    this.saveDraft();
  }

  /** Jump directly to any step — used by Edit buttons in the review step. */
  goToStep(n: number): void {
    this.step = n;
    this.saveDraft();
  }

  /** Lazy loads owed to the current (or any earlier) step — used on advance and on draft restore. */
  private ensureStepData(): void {
    // Safety: fire triggers if detail not yet loaded when entering a step
    if (this.step === 3 && !this.classDetail      && !this.loadingClassDetail      && this.clazz)      this.classTrigger$.next(this.clazz);
    if (this.step === 4 && !this.backgroundDetail && !this.loadingBackgroundDetail && this.background) this.backgroundTrigger$.next(this.background);
    // Load spells when entering step 7 (casters only)
    // A WoW variant can add spells to its base class's list (e.g. the Priest's Blur
    // and Levitate), so the loaded list is keyed by class row and reloaded if that changes.
    // Loaded from the spells step on (not only on it): a draft restored on a later
    // step still needs the list, to save the class's always-prepared spells.
    const spellListKey = this.selectedClassKey;
    if (this.step >= 7 && this.isSpellcastingClass && this.spellListKey !== spellListKey) {
      this.loadingSpells = true;
      this.spellListKey = spellListKey;
      const extras = this.heroClass?.extraSpellList;
      const spells$ = extras?.length
        ? this.dndResources.getSpellsForClass(this.clazz, extras)
        : this.dndResources.getSpellsForClass(this.clazz);
      spells$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: spells => { this.spellList = spells; this.loadingSpells = false; },
          // Forget the key so coming back to the step tries again.
          error: () => { this.loadingSpells = false; this.spellListKey = null; },
        });
    }
    if (this.step >= 7) this.loadFeatSpellLists();
    // Load equipment data when entering (or restoring past) the equipment step
    if (this.step >= this.equipmentStep && !this.classEquipmentData && !this.loadingEquipment) {
      this.loadingEquipment = true;
      this.dndResources.getClassEquipment()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(data => {
          this.classEquipmentData = data;
          this.loadingEquipment   = false;
        });
    }
  }

  // ── Review step computed properties ──────────────────────────────────────

  get reviewHp(): number {
    const hitDie = this.classDetail?.hit_die ?? 8;
    return hitDie + this.modNum(this.finalScore('CON'));
  }

  get reviewAc(): number {
    return 10 + this.modNum(this.finalScore('DEX'));
  }

  get reviewInitiative(): string {
    return fmtMod(this.modNum(this.finalScore('DEX')));
  }

  /** Combined skill proficiencies: background (locked) + class choices */
  get reviewAllSkills(): string[] {
    const seen = new Set<string>();
    return [...this.backgroundSkillProfs, ...this.speciesSkillProfs, ...this.selectedSkills].filter(s => {
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    });
  }

  get reviewSpeciesTraitNames(): string {
    return (this.speciesDetail?.traits ?? []).map(t => t.name).join(', ');
  }

  get reviewCantripNames(): string {
    return this.selectedSpells.filter(s => s.level === 0).map(s => s.name).join(', ');
  }

  get reviewLeveledSpellNames(): string {
    return this.selectedSpells.filter(s => s.level > 0).map(s => s.name).join(', ');
  }

  /** "Hunter's Mark (Favored Enemy)" — the always-prepared spells the class starts with. */
  get reviewAlwaysPreparedNames(): string {
    return this.alwaysPreparedGrants.map(g => `${g.name} (${g.grantedBy})`).join(', ');
  }

  /** 'Guidance, Light, Bless (Magic Initiate (Cleric))' — the spells picked for each Origin feat. */
  get reviewFeatSpellNames(): string {
    return this.magicInitiateFeats
      .filter(feat => this.featPicks(feat).length > 0)
      .map(feat => `${this.featPicks(feat).map(s => s.name).join(', ')} (${feat.feat})`)
      .join('; ');
  }

  /**
   * The spells a new character is saved with: the class picks, with no more of
   * them prepared than the class prepares at level 1; then the spells its
   * level-1 features always keep prepared; then each Magic Initiate feat's two
   * cantrips and its level-1 spell. Feature and feat spells are marked always
   * prepared, so they never count against that cap. A spell is saved once: one
   * already on the list is skipped.
   */
  private buildStartingSpells(): PcSpell[] {
    const grants = this.isSpellcastingClass ? this.alwaysPreparedGrants : [];
    const grantedKeys = grants.map(g => spellKey(g.name));
    const picks = (this.isSpellcastingClass ? this.selectedSpells : [])
      .filter(s => !grantedKeys.includes(spellKey(s.name)))
      .map(toPcSpell);
    const granted = grants.flatMap(g => {
      const spell = this.spellList.find(s => spellKey(s.name) === spellKey(g.name));
      return spell ? [toGrantedSpell(spell, g.grantedBy)] : [];
    });
    const spells = [...withPreparedCap(picks, preparedSpellCap(this.clazz, 1)), ...granted];
    const taken = new Set(spells.map(s => spellKey(s.name)));
    for (const feat of this.magicInitiateFeats) {
      for (const spell of this.featPicks(feat)) {
        if (taken.has(spellKey(spell.name))) continue;
        taken.add(spellKey(spell.name));
        spells.push(toGrantedSpell(spell, feat.feat));
      }
    }
    return spells;
  }

  get reviewWeaponNames(): string {
    return (this.currentClassEquipment?.optionA.weapons ?? []).map(w => w.name).join(', ');
  }

  get reviewGearNames(): string {
    return (this.currentClassEquipment?.optionA.gear ?? []).map(g => g.name).join(', ');
  }

  get reviewStartingGp(): number {
    return this.backgroundStartingGold
      + (this.equipmentChoice === 'A'
          ? (this.currentClassEquipment?.optionA.gp ?? 0)
          : (this.currentClassEquipment?.optionB.gp ?? 0));
  }

  // ── Class detail ─────────────────────────────────────────────────────────

  // ── Starting coins ───────────────────────────────────────────────────────

  private buildStartingCoins(): Coins {
    const bgGold = this.backgroundStartingGold;
    const classGold = this.equipmentChoice === 'A'
      ? (this.currentClassEquipment?.optionA.gp ?? 0)
      : (this.currentClassEquipment?.optionB.gp ?? 0);
    return { cp: 0, sp: 0, gp: bgGold + classGold };
  }

  // ── Starting spell slots (level 1) ───────────────────────────────────────

  // The class table at level 1, so a new character shows its slots before the first
  // save answers (and in demo mode, where there is no server). The server works the
  // maximum out again on create and ignores the one sent here.
  private buildStartingSlots(clazz: string): { [level: number]: { max: number; used: number } } {
    return startingSlots(clazz, 1);
  }

  // ── Source filter (step 4) ────────────────────────────────────────────────

  /** Only the groups whose source is currently ticked */
  get activeBackgroundGroups(): BackgroundGroup[] {
    return this.backgroundGroups.filter(g => this.enabledSources[g.source]);
  }

  toggleSource(source: string): void {
    this.enabledSources = { ...this.enabledSources, [source]: !this.enabledSources[source] };

    // If the chosen background just became hidden, clear it (no auto-pick — the
    // player chooses).
    const selectedStillVisible = !!this.background && this.activeBackgroundGroups
      .some(g => g.backgrounds.includes(this.background));
    if (this.background && !selectedStillVisible) {
      this.background = '';
      this.onBackgroundChange();
    }
  }

  // ── Class detail ─────────────────────────────────────────────────────────

  onClassChange(): void {
    this.selectedSkills  = [];
    // A hero class locks its subclass in; a base class starts with none.
    this.selectedSubclass = this.heroClass?.subclass ?? '';
    this.specialization = '';
    if (this.clazz) this.classTrigger$.next(this.clazz);
  }

  /**
   * Click a class row (by its key) to choose+expand it; click the chosen one
   * again to clear it. A hero-class row stores its BASE class in `clazz` (so all
   * lookups stay keyed on e.g. 'Paladin') and remembers itself in heroClassKey.
   */
  toggleClass(key: string): void {
    if (this.selectedClassKey === key) {
      this.clazz = '';
      this.heroClassKey = '';
    } else {
      const option = this.classOptions.find(o => o.key === key);
      this.clazz = option?.baseClass ?? key;
      this.heroClassKey = option?.hero ? option.key : '';
    }
    // Spells picked for another class row are not this one's to keep.
    this.selectedSpells = [];
    this.classDetail = null;
    this.onClassChange();
  }

  /** Pick the hero-class specialization (class step). */
  selectSpecialization(name: string): void {
    this.specialization = name;
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

  /** Click a background to choose+expand it; click the chosen one again to clear it. */
  toggleBackground(b: string): void {
    this.background = this.background === b ? '' : b;
    this.onBackgroundChange();
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
  availableFor = (ability: Ability): number[] => {
    return STANDARD_ARRAY.filter(v =>
      !Object.entries(this.assignments).some(
        ([ab, assigned]) => ab !== ability && assigned === v
      )
    ) as number[];
  };

  get isArrayComplete(): boolean {
    return Object.values(this.assignments).every(v => v !== null);
  }

  // ── Background bonus helpers ─────────────────────────────────────────────

  /** Abilities eligible for the background's +2/+1 bonus */
  get bonusAbilities(): Ability[] {
    return (this.backgroundDetail?.ability_scores ?? []).map(s => s.name as Ability);
  }

  // ── Derived stats ────────────────────────────────────────────────────────

  finalScore = (ability: Ability): number => {
    const base  = this.abilityMethod === 'point-buy'
                    ? this.pointBuyScores[ability]
                    : (this.assignments[ability] ?? 0);
    const bonus = (this.bonusPlus2 === ability ? 2 : 0)
                + (this.bonusPlus1 === ability ? 1 : 0);
    return base + bonus;
  };

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
    const catalog = this.catalogSpecies;
    const speciesFeat = catalog?.choices?.originFeat ? this.speciesSelections.originFeat : '';
    const draft: Partial<PC> = {
      name:             trimmedName,
      playerName:       displayPlayer,   // required by PC interface (backend compat)
      player:           displayPlayer,   // display field used by new UI
      race:             this.species,
      // A World of Warcraft species records where it came from and what was chosen;
      // a base-game species leaves all three empty.
      speciesSource:    catalog?.source ?? null,
      lineage:          (catalog && chosenLineage(catalog, this.speciesSelections)?.name) || null,
      size:             (catalog && this.speciesSelections.size) || null,
      clazz:            this.clazz,
      subclass:         this.selectedSubclass || undefined,
      specialization:   this.specializationRequired && this.specialization ? this.specialization : null,
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
      skills:           [...this.backgroundSkillProfs, ...this.speciesSkillProfs, ...this.selectedSkills]
                          .reduce((acc, s) => ({ ...acc, [s]: 'prof' as const }), {}),
      toolProfs:        [...this.backgroundToolProfs, ...this.speciesToolPicks],
      languages:        [...this.startingLanguages],
      coins:            this.buildStartingCoins(),
      weapons:          this.equipmentChoice === 'A'
                          ? (this.currentClassEquipment?.optionA.weapons ?? [])
                          : [],
      gear:             this.equipmentChoice === 'A'
                          ? (this.currentClassEquipment?.optionA.gear ?? [])
                          : [],
      features:         [
                          ...(this.backgroundFeatName
                            ? [{
                                name:   this.backgroundFeatName,
                                source: `${this.background} · Origin Feat`,
                                desc:   this.backgroundFeatDescription
                                          || 'See the 2024 Player\'s Handbook for full details.',
                              }]
                            : []),
                          // A Human's own Origin feat (Versatile), beside the background's.
                          ...(catalog && speciesFeat
                            ? [{
                                name:   speciesFeat,
                                source: `${catalog.key} · Origin Feat`,
                                desc:   this.dndResources.getFeatDescription(speciesFeat),
                              }]
                            : []),
                          // A World of Warcraft species brings its trait cards (Other Features).
                          ...(catalog ? speciesTraitFeatures(catalog, this.speciesSelections) : []),
                        ],
      spells: this.buildStartingSpells(),
      spellSlots: this.buildStartingSlots(this.clazz),
    };

    this.confirm.emit(draft);
    this.clearDraft();
  }

  cancel(): void {
    // An explicit Cancel is a deliberate abandon — discard the draft. Only a
    // silent exit (disconnect, tab close, navigation) keeps it.
    this.clearDraft();
    this.close.emit();
  }

  // ── Draft persistence ────────────────────────────────────────────────────
  // A player who disconnects mid-creation should not lose their progress: the
  // wizard's entered state is snapshotted to localStorage on every step change
  // and on unload/destroy, and restored when the wizard next opens. Inscribing
  // or explicitly cancelling discards the draft.

  /** Set once the wizard concludes (create/cancel) — stops the unload/destroy saves. */
  private draftFinished = false;
  /** Draft source-book toggles, applied over the defaults when the groups load. */
  private restoredEnabledSources: Record<string, boolean> | null = null;

  private get draftKey(): string {
    return `tm_pc_draft:${this.auth.getUsername() ?? 'anon'}`;
  }

  /** An untouched wizard (nothing chosen yet) is not worth a draft. */
  private get draftDirty(): boolean {
    return !!(this.name.trim() || this.species || this.clazz || this.background);
  }

  private saveDraft(): void {
    if (this.draftFinished || !this.draftDirty) return;
    const draft: WizardDraft = {
      v: 1,
      step: this.step,
      name: this.name,
      species: this.species,
      catalogSpeciesKey: this.catalogSpeciesKey,
      speciesSelections: this.speciesSelections,
      clazz: this.clazz,
      heroClassLabel: this.heroClassKey,
      specialization: this.specialization,
      contentSources: this.contentSources,
      selectedSubclass: this.selectedSubclass,
      background: this.background,
      enabledSources: this.enabledSources,
      selectedSkills: this.selectedSkills,
      languageChoice: this.languageChoice,
      languageChoice2: this.languageChoice2,
      languageChoice3: this.languageChoice3,
      allegiance: this.allegiance,
      abilityMethod: this.abilityMethod,
      pointBuyScores: this.pointBuyScores,
      assignments: this.assignments,
      bonusPlus2: this.bonusPlus2,
      bonusPlus1: this.bonusPlus1,
      equipmentChoice: this.equipmentChoice,
      selectedSpells: this.selectedSpells,
      featSpellPicks: this.featSpellPicks,
    };
    try {
      localStorage.setItem(this.draftKey, JSON.stringify(draft));
    } catch { /* storage unavailable/full — the draft is best-effort */ }
  }

  private restoreDraft(): void {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(this.draftKey);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const d = JSON.parse(raw) as Partial<WizardDraft>;
      if (d?.v !== 1) return;
      this.step             = d.step ?? 1;
      this.name             = d.name ?? '';
      this.species          = d.species ?? '';
      // Only a key that still names this species counts — otherwise it's a base-game pick.
      this.catalogSpeciesKey = catalogSpeciesByKey(d.catalogSpeciesKey)?.name === this.species
        ? d.catalogSpeciesKey! : '';
      this.speciesSelections = { ...emptySpeciesSelections(this.catalogSpecies), ...(d.speciesSelections ?? {}) };
      this.clazz            = d.clazz ?? '';
      this.heroClassKey     = heroClassByKey(d.heroClassLabel) ? d.heroClassLabel! : '';
      this.specialization   = d.specialization ?? d.rune ?? '';
      this.contentSources   = { ...allContentSources(), ...(d.contentSources ?? {}) };
      this.selectedSubclass = d.selectedSubclass ?? '';
      this.background       = d.background ?? '';
      this.selectedSkills   = d.selectedSkills ?? [];
      this.languageChoice   = d.languageChoice ?? '';
      this.languageChoice2  = d.languageChoice2 ?? '';
      this.languageChoice3  = d.languageChoice3 ?? '';
      this.allegiance       = ALLEGIANCES.includes(d.allegiance as Allegiance) ? d.allegiance as Allegiance : '';
      this.abilityMethod    = d.abilityMethod ?? 'standard';
      this.pointBuyScores   = { ...this.pointBuyScores, ...(d.pointBuyScores ?? {}) };
      this.assignments      = { ...this.assignments, ...(d.assignments ?? {}) };
      this.bonusPlus2       = d.bonusPlus2 ?? '';
      this.bonusPlus1       = d.bonusPlus1 ?? '';
      this.equipmentChoice  = d.equipmentChoice ?? '';
      this.selectedSpells   = d.selectedSpells ?? [];
      this.featSpellPicks   = d.featSpellPicks ?? {};
      this.restoredEnabledSources = d.enabledSources ?? null;
      if (this.restoredEnabledSources && Object.keys(this.enabledSources).length) {
        this.enabledSources = { ...this.enabledSources, ...this.restoredEnabledSources };
      }
    } catch {
      return; // corrupt draft — start fresh
    }
    // Reload the data the restored selections depend on (details are not stored).
    if (this.species)    this.speciesTrigger$.next(this.species);
    if (this.clazz)      this.classTrigger$.next(this.clazz);
    if (this.background) this.backgroundTrigger$.next(this.background);
    this.ensureStepData();
  }

  private clearDraft(): void {
    this.draftFinished = true;
    try {
      localStorage.removeItem(this.draftKey);
    } catch { /* nothing to do */ }
  }
}
