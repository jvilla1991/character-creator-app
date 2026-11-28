import { Component, Input, OnInit, inject, output } from '@angular/core';
import { PC } from '../../models/pc';
import { LevelUpPreview, LevelUpChoices, HpMode, previewWithSubclass } from '../../models/level-up';
import { DndSpell } from '../../models/dnd-api.types';
import { PCService } from '../../services/pc.service';
import { DndResourcesService } from '../../services/dnd-resources.service';
import { toGrantedSpell, toPcSpell } from '../../utils/spell-mapping';
import { spellKey } from '../../models/spell-names';
import {
  FeatSpellChoice, MagicInitiateFeat, SpellGrant, featChoiceAllows, featChoiceSatisfied, hasLevelUpFeatSpellChoices,
  levelUpFeatSpellChoices, magicInitiateFeats,
} from '../../models/granted-spells';
import { featNamesOn } from '../../models/character-feats';
import { MAGIC_CONNOISSEUR } from '../../models/arcana-feats';
import { ModalComponent } from '../modal/modal.component';
import { FormsModule } from '@angular/forms';
import { SpellPickerComponent } from '../spell-picker/spell-picker.component';
import { Eli5ToggleComponent } from '../eli5-toggle/eli5-toggle.component';
import { SpellEli5Service } from '../../services/spell-eli5.service';
import { ModifierPipe } from '../../pipes/modifier.pipe';
import {
  HeroClassOption, heroClassFor, recommendedFightingStylesFor, recommendedSubclassFor, subclassOptionLabel,
  subclassSource,
} from '../../models/hero-class';
import { CantripFightingStyle, cantripFightingStyle } from '../../models/cantrip-fighting-styles';
import { featPrerequisite, featSourceTag } from '../../models/wow-feats';
import {
  ContentSource, ContentSourceSelection, allContentSources, isSourceEnabled,
} from '../../models/content-source';
import { subclassChoicesDue } from '../../models/arcana-subclasses';
import { spellListClass } from '../../utils/spellcasting';
import { ContentSourceFilterComponent } from '../content-source-filter/content-source-filter.component';
import { SubclassChoiceResult, SubclassChoicesComponent } from './subclass-choices/subclass-choices.component';

const NO_GRANTS: readonly SpellGrant[] = [];
const NO_CHOICES: readonly FeatSpellChoice[] = [];
const NO_SPELLS: DndSpell[] = [];
const NO_OPTIONS: string[] = [];
const NO_KEYS: readonly string[] = [];

/** Where the picks made for one of a feat's choices are kept; a different class list is a different pick. */
const pickKey = (choice: FeatSpellChoice): string => `${choice.feat}|${choice.key}|${choice.spellLists.join(',')}`;

/**
 * Focused, single-level "Level Up" modal — mirrors the create wizard's pattern of applying
 * one well-scoped set of gains at a time. It is a thin presenter: it loads the server-computed
 * {@link LevelUpPreview} to show the deltas, then on confirm commits the advance via PCService
 * (the backend is the rules authority). PCService pushes the updated PC into activePC$, so the
 * character sheet refreshes itself — the modal only has to close.
 *
 * <p>Phase 1 covers HP + proficiency bonus. Later phases (spell slots, subclass, ASI/feat,
 * features) extend this with additional choice steps; the load-preview → confirm flow stays.
 */
@Component({
    selector: 'app-level-up-modal',
    templateUrl: './level-up-modal.component.html',
    styleUrls: ['./level-up-modal.component.scss'],
    imports: [
      ModalComponent, FormsModule, SpellPickerComponent, ModifierPipe, Eli5ToggleComponent, ContentSourceFilterComponent,
      SubclassChoicesComponent,
    ]
})
export class LevelUpModalComponent implements OnInit {
  @Input() pc!: PC;
  /**
   * True when a DM levels up a campaign member from the cross-link view — the
   * preview and commit then use the campaign-DM-authorized endpoints (the
   * owner-scoped ones would 403). The flow is otherwise identical.
   */
  @Input() asDm = false;
  readonly close = output<void>();

  preview: LevelUpPreview | null = null;
  loading = true;
  submitting = false;
  error: string | null = null;

  /** The subclass picked this level; picking another one starts its choices over. */
  get selectedSubclass(): string | null {
    return this.pickedSubclass;
  }
  set selectedSubclass(value: string | null) {
    if (value === this.pickedSubclass) return;
    this.pickedSubclass = value;
    this.subclassChoiceResult = null;
    this.applySubclassSpellcasting();
  }
  private pickedSubclass: string | null = null;

  /** The preview as the server sent it; `preview` is this with the picked subclass's spellcasting. */
  private serverPreview: LevelUpPreview | null = null;

  /**
   * A subclass that brings Spellcasting of its own (a Monk's Warrior of the
   * Mystic Arts) changes this level's slots, cantrips and prepared spells: the
   * preview then reads with that option's numbers, and the spells to learn are
   * offered from its list. Picks made under other numbers are dropped.
   */
  private applySubclassSpellcasting(): void {
    if (!this.serverPreview) return;
    const next = previewWithSubclass(this.serverPreview, this.pickedSubclass);
    if (next === this.preview) return;
    this.preview = next;
    this.selectedSpells = [];
    this.spellList = [];
    if (this.showSpellPicker) this.loadSpells();
  }

  /** The specialization picked in the optional "Change …" select (hero classes that respec). */
  selectedSpecialization: string | null = null;

  /**
   * HP mode for this level: take the fixed average (default) or roll the hit die. In 'ROLL' the
   * server does the rolling on confirm — the preview keeps showing the average, so the displayed
   * "+HP" is an estimate until committed. Only sent to the server when 'ROLL' (AVERAGE is implied).
   */
  hpMode: HpMode = 'AVERAGE';

  readonly abilities = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  /** Points allocated this ASI per ability (0/1/2); total must reach 2 to confirm. */
  asiAllocation: { [ability: string]: number } = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 };

  /** At an ASI level, whether the player is taking an ASI or a feat. */
  milestoneMode: 'asi' | 'feat' = 'asi';
  selectedFeat: string | null = null;

  /** Level-2 Fighting Style pick ('' = none chosen; the choice is optional). */
  selectedFightingStyle = '';
  /**
   * Cantrips offered / picked for a cantrip-teaching fighting style (Blessed
   * Warrior → Cleric, Druidic Warrior → Druid, Void Warrior → Warlock).
   */
  styleCantripOptions: DndSpell[] = [];
  styleCantrips: DndSpell[] = [];
  loadingStyleCantrips = false;
  /** Unknown cantrips per class spell list, fetched once each (keyed 'cleric', 'warlock', …). */
  private readonly styleCantripCache = new Map<string, DndSpell[]>();

  /** Spell selection (casters who gain cantrips/spells this level). */
  spellList: DndSpell[] = [];
  selectedSpells: DndSpell[] = [];
  loadingSpells = false;

  /** Spell data by lookup key, loaded once when the level has always-prepared spells to hand over. */
  private grantSpellIndex: ReadonlyMap<string, DndSpell> | null = null;
  /** The same spell data as a list: what a feat's spell picks are offered from. */
  private allSpells: DndSpell[] | null = null;
  /** True while that spell data is loading; `spellDataFailed` once a load has failed. */
  loadingSpellData = false;
  spellDataFailed = false;

  /** Spells picked for the choices of a feat, by {@link pickKey}. */
  private featPickState: Record<string, DndSpell[]> = {};
  /**
   * The Magic Initiate class list Magic Connoisseur draws on, for a character
   * with more than one such feat; '' means the first one it has.
   */
  connoisseurList = '';

  /** Player's ELI5 switch: when active, the spell pickers show one-sentence summaries. */
  readonly eli5 = inject(SpellEli5Service);

  constructor(private pcService: PCService, private dndResources: DndResourcesService) {}

  ngOnInit(): void {
    this.selectedSpecialization = this.pc.specialization ?? null;
    const preview$ = this.asDm
      ? this.pcService.levelUpPreviewAsDm(this.pc.id)
      : this.pcService.levelUpPreview(this.pc.id);
    preview$.subscribe({
      next: preview => {
        this.preview = preview;
        this.serverPreview = preview;
        this.loading = false;
        this.grantSpellIndex = null;
        this.allSpells = null;
        if (this.anyGrantsOnOffer || this.featOptions.some(hasLevelUpFeatSpellChoices)) this.loadGrantedSpells();
        if (this.cantripDelta > 0 || this.spellDelta > 0) this.loadSpells();
      },
      error: err => {
        this.error = this.messageFrom(err, 'Could not work out this level-up.');
        this.loading = false;
      },
    });
  }

  // ── Spell selection (learning new cantrips/spells) ──────────────────────────

  /**
   * Spells a class or subclass feature always keeps prepared that this level-up
   * hands over (a Paladin's Find Steed at 5, the spells of the oath being chosen)
   * — named by the server, shown read-only, and sent with the picks. They are not
   * picks: they sit outside both counts. With a subclass picked this level, the
   * server's list for that subclass is used. With a feat picked that gives spells
   * of its own (Warlike Familiar's Battle Familiar, a School Adept's rows), the
   * server's list for that feat is added.
   */
  get alwaysPreparedGrants(): readonly SpellGrant[] {
    const bySubclass = this.preview?.alwaysPreparedSpellsBySubclass;
    const forChoice = this.selectedSubclass ? bySubclass?.[this.selectedSubclass] : undefined;
    const base = forChoice ?? this.preview?.alwaysPreparedSpells ?? NO_GRANTS;
    const forFeat = this.takingFeat ? this.preview?.alwaysPreparedSpellsByFeat?.[this.selectedFeat!] : undefined;
    if (!forFeat?.length) return base;
    // Memoized on its two parts, so the template and the pick list see a stable array.
    if (this.grantsBase !== base || this.grantsForFeat !== forFeat) {
      this.grantsBase = base;
      this.grantsForFeat = forFeat;
      const named = base.map(g => spellKey(g.name));
      this.grantsCache = [...base, ...forFeat.filter(g => !named.includes(spellKey(g.name)))];
    }
    return this.grantsCache;
  }
  private grantsBase: readonly SpellGrant[] | null = null;
  private grantsForFeat: readonly SpellGrant[] | null = null;
  private grantsCache: readonly SpellGrant[] = NO_GRANTS;

  /** True when this level-up may hand over always-prepared spells, whichever subclass or feat is picked. */
  private get anyGrantsOnOffer(): boolean {
    return (this.preview?.alwaysPreparedSpells?.length ?? 0) > 0
      || Object.keys(this.preview?.alwaysPreparedSpellsBySubclass ?? {}).length > 0
      || Object.keys(this.preview?.alwaysPreparedSpellsByFeat ?? {}).length > 0;
  }

  /**
   * {@link alwaysPreparedGrants} found in the spell data, ready to send with the
   * picks; empty until the spell data has loaded.
   */
  get grantedSpells(): { spell: DndSpell; grantedBy: string }[] {
    const index = this.grantSpellIndex;
    if (!index) return [];
    return this.alwaysPreparedGrants.flatMap(g => {
      const spell = index.get(spellKey(g.name));
      return spell ? [{ spell, grantedBy: g.grantedBy }] : [];
    });
  }

  /**
   * Load the spell data the granted spells are looked up in (the server only
   * knows their names) and a feat's spell picks are offered from.
   */
  private loadGrantedSpells(): void {
    this.loadingSpellData = true;
    this.spellDataFailed = false;
    this.dndResources.getSpells().subscribe({
      next: spells => {
        this.grantSpellIndex = new Map(spells.map(s => [spellKey(s.name), s]));
        this.allSpells = spells;
        this.loadingSpellData = false;
      },
      // Without the spell data the level-up still goes through; a granted spell is offered again
      // at the next level-up. A feat that needs picks cannot be taken until the data loads.
      error: () => {
        this.grantSpellIndex = null;
        this.allSpells = null;
        this.loadingSpellData = false;
        this.spellDataFailed = true;
      },
    });
  }

  /**
   * The spells offered as this level's picks: the class list, less any spell the
   * level hands over as always prepared (it would waste a pick). Memoized on its
   * inputs so the picker sees a stable array.
   */
  get pickableSpells(): DndSpell[] {
    const granted = [...this.alwaysPreparedGrants.map(g => spellKey(g.name)), ...this.subclassPickKeys];
    const key = granted.join('|');
    if (this.pickableSource !== this.spellList || this.pickableKey !== key) {
      this.pickableSource = this.spellList;
      this.pickableKey = key;
      this.pickableCache = granted.length
        ? this.spellList.filter(s => !granted.includes(spellKey(s.name)))
        : this.spellList;
    }
    return this.pickableCache;
  }
  private pickableSource: DndSpell[] | null = null;
  private pickableKey = '';
  private pickableCache: DndSpell[] = [];

  private loadSpells(): void {
    this.loadingSpells = true;
    const known = new Set((this.pc.spells ?? []).map(s => s.name.toLowerCase()));
    const maxLevel = this.maxLearnableSpellLevel;
    // A WoW variant may add spells to its class list (e.g. the Priest's Blur and Levitate).
    const extras = this.heroClass?.extraSpellList;
    // The class's own list, or the Sorcerer list for a Warrior of the Mystic Arts monk.
    const listClass = spellListClass({ clazz: this.pc.clazz, subclass: this.effectiveSubclass ?? undefined });
    const spells$ = extras?.length
      ? this.dndResources.getSpellsForClass(listClass, extras)
      : this.dndResources.getSpellsForClass(listClass);
    const loadedFor = this.preview;
    spells$.subscribe({
      next: spells => {
        // The player picked another subclass while this list was loading: it is no longer the one to show.
        if (this.preview !== loadedFor) return;
        this.spellList = spells.filter(s =>
          !known.has(s.name.toLowerCase()) && (s.level === 0 || s.level <= maxLevel));
        this.loadingSpells = false;
      },
      error: () => { this.loadingSpells = false; },
    });
  }

  /**
   * Highest spell level the character can learn at the NEW level — the top of the
   * server-computed slot table (covers full casters and warlock pact slots). Per the
   * 2024 rules you may only learn spells you have slots to cast; cantrips (level 0)
   * are separate and stay count-gated. The backend enforces the same cap on commit.
   */
  get maxLearnableSpellLevel(): number {
    const slots = this.preview?.newSpellSlots ?? {};
    return Object.keys(slots).reduce((max, k) => Math.max(max, Number(k)), 0);
  }

  /** How many new cantrips / leveled spells the player may learn this level. */
  get cantripDelta(): number {
    return this.preview ? Math.max(0, this.preview.newCantripsKnown - this.preview.currentCantripsKnown) : 0;
  }

  get spellDelta(): number {
    return this.preview ? Math.max(0, this.preview.newSpellsKnown - this.preview.currentSpellsKnown) : 0;
  }

  /** Show the spell picker when this level grants any new cantrips or spells. */
  get showSpellPicker(): boolean {
    return this.cantripDelta > 0 || this.spellDelta > 0;
  }

  get selectedCantripCount(): number {
    return this.selectedSpells.filter(s => s.level === 0).length;
  }

  get selectedSpellCount(): number {
    return this.selectedSpells.filter(s => s.level > 0).length;
  }

  /** Whether the proficiency bonus changes on this level (drives a highlight). */
  get profChanged(): boolean {
    return !!this.preview && this.preview.newProfBonus !== this.preview.currentProfBonus;
  }

  /** Per-spell-level slot picture for casters: { level, current, next, gained }. Empty otherwise. */
  get slotRows(): { level: number; current: number; next: number; gained: boolean }[] {
    const p = this.preview;
    if (!p || !p.newSpellSlots) return [];
    return Object.keys(p.newSpellSlots)
      .map(k => Number(k))
      .sort((a, b) => a - b)
      .map(level => {
        const next = p.newSpellSlots[level] ?? 0;
        const current = p.currentSpellSlots?.[level] ?? 0;
        return { level, current, next, gained: next > current };
      });
  }

  /** True when this level grants new or additional spell slots (shows the slots row). */
  get hasSlotChanges(): boolean {
    return this.slotRows.some(r => r.gained);
  }

  /** Whether to show the cantrips-known row (caster). */
  get showCantrips(): boolean {
    return (this.preview?.newCantripsKnown ?? 0) > 0;
  }

  /** Whether cantrips known increases this level. */
  get cantripsChanged(): boolean {
    return !!this.preview && this.preview.newCantripsKnown > this.preview.currentCantripsKnown;
  }

  /** The character's hero class (e.g. Death Knight), or undefined for everyone else. */
  get heroClass(): HeroClassOption | undefined {
    return heroClassFor(this.pc);
  }

  /** Show the optional "Change …" select: only hero classes whose table allows a respec. */
  get canRespec(): boolean {
    return !!this.heroClass?.respecOnLevelUp;
  }

  /**
   * The specialization the recommendation is for: the one picked in the "Change …"
   * select this level, else the current one.
   */
  get recommendationSpecialization(): string | null {
    return this.selectedSpecialization ?? this.pc.specialization ?? null;
  }

  /**
   * The subclass to highlight as "Recommended for <spec>" in the subclass picker
   * (WoW Druid). The server's `recommendedSubclass` wins while the specialization
   * is unchanged; a respec this level (or no server value) derives it from the
   * hero-class table. Only returned when it is one of the offered options.
   */
  get recommendedSubclass(): string | null {
    const options = this.preview?.subclassOptions ?? [];
    const fromServer = !this.specializationChanged ? this.preview?.recommendedSubclass : null;
    const name = fromServer || recommendedSubclassFor(this.heroClass, this.recommendationSpecialization);
    return name && options.includes(name) ? name : null;
  }

  /** True when the player picked a specialization different from the current one. */
  get specializationChanged(): boolean {
    return this.canRespec && !!this.selectedSpecialization
      && this.selectedSpecialization !== (this.pc.specialization ?? null);
  }

  // ── Fighting Style (level 2) and the cantrip-teaching styles ──────────────

  /** Whether to show the Fighting Style picker: due this level AND the server offered options. */
  get needsFightingStyle(): boolean {
    return !!this.preview?.fightingStyleDue && (this.preview?.fightingStyleOptions?.length ?? 0) > 0;
  }

  get fightingStyleOptions(): string[] {
    return this.preview?.fightingStyleOptions ?? [];
  }

  /**
   * The picked style's cantrip rule (Blessed / Druidic / Void Warrior) — exactly
   * `count` cantrips from that class's list; null for an ordinary style or none.
   */
  get cantripStyle(): CantripFightingStyle | null {
    return this.needsFightingStyle ? cantripFightingStyle(this.selectedFightingStyle) ?? null : null;
  }

  /** Pick (or clear) a fighting style; switching to another style drops the cantrip picks. */
  selectFightingStyle(name: string): void {
    this.selectedFightingStyle = this.selectedFightingStyle === name ? '' : name;
    this.styleCantrips = [];
    this.styleCantripOptions = [];
    const rule = this.cantripStyle;
    if (rule) this.loadStyleCantrips(rule);
  }

  /** A cantrip style is satisfied once exactly `count` of its cantrips are picked. */
  get styleCantripsSatisfied(): boolean {
    const rule = this.cantripStyle;
    return !rule || this.styleCantrips.length === rule.count;
  }

  /**
   * Fighting styles to badge "Recommended for <spec>". The server's
   * `recommendedFightingStyles` wins while the specialization is unchanged; a
   * respec this level (or an absent field) derives them from the variant table.
   * Only styles actually on offer are returned.
   */
  get recommendedFightingStyles(): readonly string[] {
    const fromServer = !this.specializationChanged ? this.preview?.recommendedFightingStyles : undefined;
    const names = fromServer ?? recommendedFightingStylesFor(this.heroClass, this.recommendationSpecialization);
    const offered = this.fightingStyleOptions;
    return names.filter(n => offered.includes(n));
  }

  isRecommendedFightingStyle(name: string): boolean {
    return this.recommendedFightingStyles.includes(name);
  }

  /**
   * The book a subclass on offer comes from: 'World of Warcraft' for a WoW-only
   * one (Oath of the Holy), 'Arcana Unleashed' for one of that book's eight;
   * undefined for a base-game subclass.
   */
  subclassSourceTag(name: string): string | undefined {
    return subclassSource(name);
  }

  // ── Subclass picker: content-source filter ─────────────────────────────────

  /** Which books' subclasses the picker lists; all on by default, like the spell pickers. */
  subclassSources: ContentSourceSelection = allContentSources();

  toggleSubclassSource(source: ContentSource): void {
    this.subclassSources = { ...this.subclassSources, [source]: !this.subclassSources[source] };
  }

  /**
   * The subclass options allowed by the content-source filter. The one already
   * picked stays listed when its book is switched off: the filter narrows what
   * is offered, it never discards a choice. Memoized so the template sees a
   * stable array.
   */
  get visibleSubclassOptions(): string[] {
    const options = this.preview?.subclassOptions ?? NO_OPTIONS;
    const key = `${JSON.stringify(this.subclassSources)}|${this.selectedSubclass ?? ''}`;
    if (options !== this.subclassOptionsSource || key !== this.subclassOptionsKey) {
      this.subclassOptionsSource = options;
      this.subclassOptionsKey = key;
      this.subclassOptionsCache = options.filter(option =>
        option === this.selectedSubclass || isSourceEnabled(this.subclassSources, subclassSource(option)));
    }
    return this.subclassOptionsCache;
  }
  private subclassOptionsSource: string[] | null = null;
  private subclassOptionsKey = '';
  private subclassOptionsCache: string[] = NO_OPTIONS;

  // ── Choices the subclass comes with (hosted in app-subclass-choices) ────────

  /** The subclass the choices are for: the one being picked this level, else the character's own. */
  get effectiveSubclass(): string | null {
    return this.selectedSubclass ?? this.pc.subclass ?? null;
  }

  /** What the player has chosen for the subclass; null until they change something. */
  subclassChoiceResult: SubclassChoiceResult | null = null;

  onSubclassChoices(result: SubclassChoiceResult): void {
    this.subclassChoiceResult = result;
  }

  /**
   * True when the subclass asks nothing more of the player: what they have
   * chosen is complete or, before they touch anything, nothing is owed.
   */
  get subclassChoicesSatisfied(): boolean {
    if (this.subclassChoiceResult) return this.subclassChoiceResult.valid;
    return !this.preview || !subclassChoicesDue(this.pc, this.effectiveSubclass, this.preview.newLevel);
  }

  /** Lookup keys of the spells picked for subclass features. */
  private get subclassPickKeys(): string[] {
    return (this.subclassChoiceResult?.newSpells ?? []).map(s => spellKey(s.name));
  }

  /**
   * Spells this level already has spoken for, as lookup keys: the subclass
   * pickers leave them out. Memoized so the child sees a stable array.
   */
  get subclassChoiceExclusions(): readonly string[] {
    const keys = [
      ...this.alwaysPreparedGrants.map(g => g.name),
      ...this.featChoices.flatMap(choice => this.featPicksFor(choice)).map(s => s.name),
      ...this.selectedSpells.map(s => s.name),
      ...(this.cantripStyle ? this.styleCantrips : []).map(s => s.name),
    ].map(spellKey);
    const key = keys.join('|');
    if (key !== this.exclusionsKey) {
      this.exclusionsKey = key;
      this.exclusionsCache = keys.length ? keys : NO_KEYS;
    }
    return this.exclusionsCache;
  }
  private exclusionsKey = '';
  private exclusionsCache: readonly string[] = NO_KEYS;

  /** How a subclass option reads — a WoW Mage's 'Evoker' shows as 'Evoker (school of evocation)'. */
  subclassOptionLabel(name: string): string {
    return subclassOptionLabel(this.heroClass, name);
  }

  private loadStyleCantrips(rule: CantripFightingStyle): void {
    const cached = this.styleCantripCache.get(rule.spellList);
    if (cached) {
      this.styleCantripOptions = cached;
      return;
    }
    this.loadingStyleCantrips = true;
    const known = new Set((this.pc.spells ?? []).map(s => s.name.toLowerCase()));
    this.dndResources.getSpellsForClass(rule.spellList).subscribe({
      next: spells => {
        const options = spells.filter(s => s.level === 0 && !known.has(s.name.toLowerCase()));
        this.styleCantripCache.set(rule.spellList, options);
        // The player may have switched styles while this list was loading.
        if (this.cantripStyle?.spellList === rule.spellList) this.styleCantripOptions = options;
        this.loadingStyleCantrips = false;
      },
      error: () => { this.loadingStyleCantrips = false; },
    });
  }

  /** Whether to show the subclass picker: a choice is due AND the server offered options. */
  get needsSubclass(): boolean {
    return !!this.preview?.subclassDue && (this.preview?.subclassOptions?.length ?? 0) > 0;
  }

  // ── Ability Score Improvement allocator ─────────────────────────────────────

  /** Whether an ASI is due this level (server-decided). */
  get needsAsi(): boolean {
    return !!this.preview?.asiDue;
  }

  /** Points spent so far (0–2). */
  get asiUsed(): number {
    return this.abilities.reduce((sum, a) => sum + this.asiAllocation[a], 0);
  }

  get asiRemaining(): number {
    return 2 - this.asiUsed;
  }

  /** A valid ASI spends exactly 2 points (= +2 to one ability or +1 to two). */
  get asiValid(): boolean {
    return this.asiUsed === 2;
  }

  /** Whether the pending ASI raises Constitution (HP will increase further on confirm). */
  get asiRaisesCon(): boolean {
    return this.asiAllocation['CON'] > 0;
  }

  currentScore(ability: string): number {
    return (this.pc.stats as Record<string, number> | undefined)?.[ability] ?? 10;
  }

  newScore(ability: string): number {
    return this.currentScore(ability) + this.asiAllocation[ability];
  }

  canInc(ability: string): boolean {
    return this.asiRemaining > 0 && this.asiAllocation[ability] < 2 && this.newScore(ability) < 20;
  }

  canDec(ability: string): boolean {
    return this.asiAllocation[ability] > 0;
  }

  incAsi(ability: string): void {
    if (this.canInc(ability)) this.asiAllocation[ability]++;
  }

  decAsi(ability: string): void {
    if (this.canDec(ability)) this.asiAllocation[ability]--;
  }

  // ── Feat option (the ASI alternative) ───────────────────────────────────────

  get featOptions(): string[] {
    return this.preview?.featOptions ?? [];
  }

  /** Class features automatically granted at this level (read-only). */
  get featuresGained(): { name: string; desc: string }[] {
    return this.preview?.featuresGained ?? [];
  }

  featDescription(name: string): string {
    return this.dndResources.getFeatDescription(name);
  }

  /**
   * The book a feat on offer comes from ('World of Warcraft', 'Arcana Unleashed')
   * — tagged in the picker; undefined for a base-game feat.
   */
  featSourceTag(name: string): string | undefined {
    return featSourceTag(name);
  }

  /**
   * What a feat needs beyond its level (a WoW monk feat's 'DEX 13+, WIS 13+', an
   * Arcana Unleashed feat's 'Familiar Friend feat'); undefined otherwise.
   */
  featPrerequisite(name: string): string | undefined {
    return featPrerequisite(name);
  }

  // ── Spells picked for the feat being taken ──────────────────────────────────

  /** True when the player is taking a feat this level and has picked one. */
  get takingFeat(): boolean {
    return this.needsAsi && this.milestoneMode === 'feat' && !!this.selectedFeat;
  }

  /** The Magic Initiate feats the character has: the class lists Magic Connoisseur may draw on. */
  get magicInitiateOptions(): readonly MagicInitiateFeat[] {
    if (this.initiatesOf !== this.pc) {
      this.initiatesOf = this.pc;
      this.initiatesCache = magicInitiateFeats(featNamesOn(this.pc));
    }
    return this.initiatesCache;
  }
  private initiatesOf: PC | null = null;
  private initiatesCache: MagicInitiateFeat[] = [];

  /** The class list Magic Connoisseur's spells come from ('cleric'); '' without a Magic Initiate feat. */
  get connoisseurSpellList(): string {
    const options = this.magicInitiateOptions;
    return options.find(o => o.spellList === this.connoisseurList)?.spellList ?? options[0]?.spellList ?? '';
  }

  /** True when Magic Connoisseur is being taken by a character with more than one Magic Initiate feat. */
  get needsConnoisseurList(): boolean {
    return this.takingFeat && this.selectedFeat === MAGIC_CONNOISSEUR && this.magicInitiateOptions.length > 1;
  }

  /**
   * The spells the feat being taken lets the player pick (Arcane Warrior's two
   * Wizard cantrips, Magic Connoisseur's level 1 and level 2 spell, Boon of
   * Magic School Mastery's two spells of its school); empty for any other feat.
   */
  get featChoices(): readonly FeatSpellChoice[] {
    if (!this.takingFeat) return NO_CHOICES;
    const key = `${this.selectedFeat}|${this.pc.clazz}|${this.connoisseurSpellList}`;
    if (key !== this.featChoicesKey) {
      this.featChoicesKey = key;
      const choices = levelUpFeatSpellChoices(this.selectedFeat, this.pc.clazz, this.connoisseurSpellList);
      this.featChoicesCache = choices.length ? choices : NO_CHOICES;
    }
    return this.featChoicesCache;
  }
  private featChoicesKey = '\u0000';
  private featChoicesCache: readonly FeatSpellChoice[] = NO_CHOICES;

  featPicksFor(choice: FeatSpellChoice): DndSpell[] {
    return this.featPickState[pickKey(choice)] ?? NO_SPELLS;
  }

  setFeatPicks(choice: FeatSpellChoice, spells: DndSpell[]): void {
    this.featPickState = { ...this.featPickState, [pickKey(choice)]: spells };
  }

  /**
   * The spells on offer for one of the feat's choices: every spell that fits it,
   * less a cantrip the character knows, a spell it already has always prepared,
   * a spell this level hands over anyway, and a spell picked for the feat's
   * other choice. A leveled spell the character merely knows stays on offer: the
   * feat makes it always prepared. Memoized so the picker sees a stable array.
   */
  featChoiceOptions(choice: FeatSpellChoice): DndSpell[] {
    const all = this.allSpells;
    if (!all) return NO_SPELLS;
    const taken = [
      ...this.featChoices.filter(c => c !== choice).flatMap(c => this.featPicksFor(c)).map(s => spellKey(s.name)),
      ...this.alwaysPreparedGrants.map(g => spellKey(g.name)),
      ...this.subclassPickKeys,
    ];
    const key = taken.join('|');
    const id = pickKey(choice);
    const cached = this.featOptionsCache[id];
    if (cached && cached.source === all && cached.key === key) return cached.options;
    const held = new Map((this.pc.spells ?? []).map(s => [spellKey(s.name), s]));
    const options = all.filter(spell => {
      const name = spellKey(spell.name);
      if (!featChoiceAllows(choice, spell) || taken.includes(name)) return false;
      const mine = held.get(name);
      return !mine || (spell.level > 0 && !mine.alwaysPrepared);
    });
    this.featOptionsCache[id] = { source: all, key, options: options.length ? options : NO_SPELLS };
    return this.featOptionsCache[id].options;
  }
  private featOptionsCache: Record<string, { source: DndSpell[]; key: string; options: DndSpell[] }> = {};

  /** True when a choice has nothing to pick from although the spell data is loaded. */
  featChoiceEmpty(choice: FeatSpellChoice): boolean {
    return !!this.allSpells && this.featChoiceOptions(choice).length === 0 && this.featPicksFor(choice).length === 0;
  }

  /** The feat's picks are complete once every choice has exactly what it asks for. */
  get featChoicesSatisfied(): boolean {
    return this.featChoices.every(choice => featChoiceSatisfied(choice, this.featPicksFor(choice)));
  }

  /** Whether the milestone choice (ASI or feat) is satisfied. */
  get milestoneSatisfied(): boolean {
    if (!this.needsAsi) return true;
    return this.milestoneMode === 'asi' ? this.asiValid : !!this.selectedFeat;
  }

  /**
   * Confirm is blocked until any required subclass and milestone (ASI/feat) choices are made,
   * and — when a cantrip-teaching style or a feat with spells to pick is chosen — exactly its picks,
   * and until the subclass has every choice it asks for at this level.
   */
  get canConfirm(): boolean {
    return (!this.needsSubclass || !!this.selectedSubclass) && this.milestoneSatisfied
      && this.styleCantripsSatisfied && this.featChoicesSatisfied && this.subclassChoicesSatisfied;
  }

  confirm(): void {
    if (!this.preview || this.submitting || !this.canConfirm) return;
    this.submitting = true;
    this.error = null;

    const choices: LevelUpChoices = {};
    // Only send the mode when rolling — omitting it lets the server default to AVERAGE.
    if (this.hpMode === 'ROLL') choices.hpMode = 'ROLL';
    if (this.selectedSubclass) choices.subclass = this.selectedSubclass;
    // Only send a specialization when it actually changed — the server keeps the current one otherwise.
    if (this.specializationChanged) choices.specialization = this.selectedSpecialization!;
    if (this.needsAsi) {
      if (this.milestoneMode === 'asi') {
        const increases = this.allocatedAbilities();
        if (Object.keys(increases).length) choices.abilityIncreases = increases;
      } else if (this.selectedFeat) {
        choices.feat = this.selectedFeat;
      }
    }
    if (this.needsFightingStyle && this.selectedFightingStyle) {
      choices.fightingStyle = this.selectedFightingStyle;
    }
    // A cantrip style's cantrips (Blessed / Druidic / Void / Arcane Warrior) ride along with any spells learned this level.
    // A pick made before the subclass that grants the same spell was chosen is not sent twice.
    // The spells picked for the feat being taken go with the feat's name as their `grantedBy`:
    // that is how the server tells them from the class's own picks. A spell picked both ways is the feat's.
    // The subclass's own choices (an Arcana Domain cleric's skill) and the spells picked for its
    // features go the same way: each pick carries its feature as `grantedBy`, and a held pick
    // being swapped out is named in `forgetSpells`.
    const subclassChoice = this.subclassChoiceResult;
    const subclassPicks = subclassChoice?.newSpells ?? [];
    const subclassPickKeys = this.subclassPickKeys;
    const featPicks = this.featChoices.flatMap(choice => this.featPicksFor(choice));
    const featPickKeys = featPicks.map(s => spellKey(s.name));
    const grantedKeys = this.grantedSpells.map(g => spellKey(g.spell.name));
    const learned = [
      ...this.selectedSpells.filter(s => !grantedKeys.includes(spellKey(s.name))
        && !featPickKeys.includes(spellKey(s.name)) && !subclassPickKeys.includes(spellKey(s.name))),
      ...(this.cantripStyle ? this.styleCantrips : []),
    ];
    const granted = this.grantedSpells
      .filter(g => !featPickKeys.includes(spellKey(g.spell.name)) && !subclassPickKeys.includes(spellKey(g.spell.name)))
      .map(g => toGrantedSpell(g.spell, g.grantedBy));
    if (learned.length || featPicks.length || granted.length || subclassPicks.length) {
      choices.newSpells = [
        ...learned.map(toPcSpell),
        ...featPicks.map(s => toGrantedSpell(s, this.selectedFeat!)),
        ...granted,
        ...subclassPicks,
      ];
    }
    if (subclassChoice && Object.keys(subclassChoice.subclassChoices).length) {
      choices.subclassChoices = subclassChoice.subclassChoices;
    }
    if (subclassChoice?.forgetSpells.length) choices.forgetSpells = subclassChoice.forgetSpells;

    const commit$ = this.asDm
      ? this.pcService.levelUpAsDm(this.pc.id, choices)
      : this.pcService.levelUp(this.pc.id, choices);
    commit$.subscribe({
      next: () => this.close.emit(),
      error: err => {
        this.error = this.messageFrom(err, 'Level-up failed. Please try again.');
        this.submitting = false;
      },
    });
  }

  private allocatedAbilities(): { [ability: string]: number } {
    const out: { [ability: string]: number } = {};
    for (const a of this.abilities) {
      if (this.asiAllocation[a] > 0) out[a] = this.asiAllocation[a];
    }
    return out;
  }

  cancel(): void {
    if (this.submitting) return;
    this.close.emit();
  }

  private messageFrom(err: unknown, fallback: string): string {
    const maybe = err as { error?: { message?: string } };
    return maybe?.error?.message ?? fallback;
  }
}
