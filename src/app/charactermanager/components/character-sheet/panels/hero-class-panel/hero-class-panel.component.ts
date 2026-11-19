import { ChangeDetectionStrategy, Component, DestroyRef, Input, inject, output, signal } from '@angular/core';
import { RuneWeaponFieldComponent } from './rune-weapon-field.component';
import { ResourceCounterComponent } from '../../resource-counter/resource-counter.component';
import {
  ClassResourceState, HERO_PANEL_RESOURCES, classResourceStates, withResourceUsed,
} from '../../../../utils/class-resources';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PC } from '../../../../models/pc';
import { DndSpell } from '../../../../models/dnd-api.types';
import {
  FeatureCard, HeroClassOption, HeroResource, HeroSpellEntry, InvocationRow, SpecializationGuidance,
  WOW_INVOCATION_NOTE, WOW_MANEUVER_NOTE, fightingStyleLevelOf, heroClassFor, heroClassSpells, invocationRows,
  isExtraListSpell, isWowInvocation, isWowManeuver, orList, specializationTitle, subclassGuidanceName, subclassLevelOf,
  subclassSpellsFor,
} from '../../../../models/hero-class';
import {
  BEAST_FORM_UNCHANGED, BeastFormCard, BeastFormInput, ClassicBeastForm, bearForm, catForm, classicBeastForms,
  isMoonCircle,
} from '../../../../models/wow-beast-forms';
import { spellKey } from '../../../../models/spell-names';
import {
  HUNTER_PET_FAMILIES, PET_HP_NOTE, PET_MASTERY_NOTE, PET_SPECIALIZATION_LEVEL, PET_UNUSUAL_NOTE, PetFamily,
  PetSpecializationView, PetStatCard, keepsHunterPet, petFamilyByName, petFamilyLabel, petSpecialization, petStatCards,
} from '../../../../models/wow-hunter';
import { DndResourcesService } from '../../../../services/dnd-resources.service';
import { modFromScore, spellAttackBonus, spellSaveDc } from '../../../../utils/character-math';

/** Is this character a hero class (e.g. a Paladin with the Oath of the Ebon Blade, or a WoW Druid)? */
export function isHeroClass(pc: Pick<PC, 'clazz' | 'subclass' | 'specialization'> | null | undefined): boolean {
  return !!heroClassFor(pc);
}

/** One suggested spell, with whether the character already has it. */
export interface SuggestedSpellView {
  name: string;
  known: boolean;
  prepared: boolean;
}

export interface SuggestedSpellLevelView {
  level: number;
  spells: SuggestedSpellView[];
}

/** One always-prepared spell list on the panel (the hero subclass's table, or a WoW-only oath's). */
export interface HeroSpellSection {
  title: string;
  entries: HeroSpellEntry[];
}

/** How the character's actual subclass compares to the one recommended for its specialization. */
export type SubclassMatch = 'match' | 'different' | 'pending';

/**
 * Hero-class panel (Death Knight, Demon Hunter, WoW Druid, …) — text only,
 * driven entirely by the character's entry in HERO_CLASSES. Shows the
 * specialization, the level-1 feature, the resource line (Death Coil pool, Soul
 * Fragments) and the always-prepared spells for the character's level and
 * specialization. For a WoW Druid it adds the recommended circle, the
 * specialization's suggested spells and the beast forms (Cat/Bear stat cards
 * for Circle of the Moon, classic beasts otherwise); for a WoW Warlock, the
 * recommended patron, invocations (text only) and suggested spells; for a WoW Shaman, the
 * computed Totems and path cards (Raging Elements, Spiritual Guardian); for a WoW Warrior,
 * the level-1 fighting style, subclass and maneuvers to consider (text only); for a WoW Priest, the
 * recommended domain, suggested spells, domain spells and the Discipline / Shadow Domain cards; for a WoW Evoker,
 * the Evoker Spells table, Metamagic, spells to prepare, Elemental Affinity and suggested spells; for a WoW Hunter
 * Beast Master, the Pet card (family selector — saved through `petFamilyChange`, which the sheet sends to the pet endpoint —
 * plus the family's stat block, specialization, mastery and, for Beast Mastery at Ranger 6+, Pet Specialization).
 * Derived from the PC's
 * class/subclass/level/specialization/stats, so nothing is persisted and an
 * existing character picks up new rows as it levels. Spell text is looked up by
 * name in the shared spell data (WoW spells are stubs until their full text lands).
 */
@Component({
  selector: 'app-hero-class-panel',
  templateUrl: './hero-class-panel.component.html',
  styleUrls: ['./hero-class-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RuneWeaponFieldComponent, ResourceCounterComponent],
})
export class HeroClassPanelComponent {
  private readonly dndResources = inject(DndResourcesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly beastFormUnchanged = BEAST_FORM_UNCHANGED;
  readonly petFamilies = HUNTER_PET_FAMILIES;
  readonly petFamilyLabel = petFamilyLabel;
  readonly petUnusualNote = PET_UNUSUAL_NOTE;
  readonly petMasteryNote = PET_MASTERY_NOTE;
  readonly petHpNote = PET_HP_NOTE;

  /** True when the viewer may change the pet family or the rune weapon (the owner, or the DM's cross-link view). */
  @Input() canEdit = false;
  /** The rune weapon was changed — the sheet persists the updated PC through the normal update path. */
  readonly pcChange = output<PC>();
  /**
   * The pet family was picked (a name) or cleared (null). Not part of `pcChange`: the server's
   * generic update ignores `petFamily`, so the sheet saves it through the dedicated pet endpoint.
   */
  readonly petFamilyChange = output<string | null>();
  readonly wowInvocationNote = WOW_INVOCATION_NOTE;
  readonly wowManeuverNote = WOW_MANEUVER_NOTE;
  /** How the recommended subclass reads ('Evoker (school of evocation)' for a WoW Mage). */
  readonly subclassGuidanceName = subclassGuidanceName;

  private _pc!: PC;
  /** Spell data keyed by lower-cased name; null until loaded (loaded once, on demand). */
  readonly spellIndex = signal<Map<string, DndSpell> | null>(null);
  private spellsRequested = false;

  /** The hero class's own tracked resource — the Death Coil pool or Soul Fragments — once the character has it. */
  get heroResource(): ClassResourceState | undefined {
    return classResourceStates(this._pc).find(r => HERO_PANEL_RESOURCES.includes(r.key));
  }

  setHeroResourceUsed(resource: ClassResourceState, used: number): void {
    if (!this.canEdit) return;
    this.pcChange.emit({ ...this._pc, classResources: withResourceUsed(this._pc, resource.key, used) });
  }

  /** WoW variant derived state — recomputed whenever the character changes. */
  suggestedSpells: SuggestedSpellLevelView[] = [];
  /** The specialization's recommended spells to prepare (WoW Evoker), with what the character has. */
  extraPrepared: SuggestedSpellView[] = [];
  /** Always-prepared spell lists — the hero table, then a WoW-only subclass's (Oath of the Holy). */
  spellSections: HeroSpellSection[] = [];
  /** Cat and Bear Form stat cards — Circle of the Moon WoW Druids only. */
  formCards: BeastFormCard[] = [];
  classicForms: ClassicBeastForm[] = [];
  /** Computed feature cards (WoW Shaman: Totems, Raging Elements, Spiritual Guardian; WoW Priest: domain cards). */
  featureCards: FeatureCard[] = [];
  /** True for a WoW Hunter with the Beast Master subclass — shows the Pet card. */
  showPet = false;
  /** The chosen pet family; undefined until one is picked (or for an unknown stored value). */
  petFamily: PetFamily | undefined;
  /** The family's Primal Companion stat card(s) — two for the Serpent (Land or Sea). */
  petCards: PetStatCard[] = [];
  /** Beast Mastery spec only, from Ranger 6: the family's Pet Specialization; null otherwise. */
  petSpec: PetSpecializationView | null = null;

  @Input() set pc(value: PC) {
    this._pc = value;
    this.deriveVariant();
    const cardSpells = this.featureCards.some(card => card.rows.some(row => row.spells?.length));
    if (this.spellSections.length || this.suggestedSpells.length || this.extraPrepared.length || cardSpells) {
      this.loadSpells();
    }
  }
  get pc(): PC { return this._pc; }

  get hero(): HeroClassOption | undefined {
    return heroClassFor(this._pc);
  }

  /**
   * The panel heading: the hero subclass, or e.g. "World of Warcraft Druid" for a
   * variant — and for the Evoker, whose locked Draconic Sorcery is a base-game subclass.
   */
  get panelTitle(): string {
    const hero = this.hero;
    if (!hero) return '';
    return hero.subclass && !hero.sharedSubclass ? hero.subclass : `${hero.source} ${hero.name}`;
  }

  /** True when the hero class locks its subclass at creation (Death Knight, Evoker) — no subclass to recommend. */
  get subclassLocked(): boolean {
    return !!this.hero?.subclass;
  }

  /** "Empowered Spell and Extended Spell" — the recommended Metamagic (WoW Evoker); '' when none. */
  get metamagicText(): string {
    const picks = this.guidance?.metamagic ?? [];
    return picks.length ? picks.join(' and ') : '';
  }

  /** "Frost Rune" / "Havoc"; '' when no specialization is set. */
  get specializationTitle(): string {
    const hero = this.hero;
    const spec = this._pc?.specialization;
    return hero && spec ? specializationTitle(hero, spec) : '';
  }

  get specializationDesc(): string {
    return this.hero?.specializations.find(s => s.name === this._pc?.specialization)?.desc ?? '';
  }

  /** The resource line at this level (null before it unlocks or for classes without one). */
  get resource(): HeroResource | null {
    const hero = this.hero;
    return hero?.resource ? hero.resource(this._pc.level ?? 1, this._pc.stats) : null;
  }

  /** Always-prepared spells of a WoW-only subclass (Oath of the Holy) at this level. */
  get subclassSpells(): HeroSpellEntry[] {
    return subclassSpellsFor(this.hero, this._pc?.subclass, this._pc?.level ?? 1);
  }

  /** Always-prepared spells at this level for this specialization. */
  get spells(): HeroSpellEntry[] {
    const hero = this.hero;
    return hero ? heroClassSpells(hero, this._pc.level ?? 1, this._pc.specialization) : [];
  }

  /** The specialization's recommended picks (WoW variants); null for everyone else. */
  get guidance(): SpecializationGuidance | null {
    const spec = this._pc?.specialization;
    return (spec && this.hero?.guidance?.[spec]) || null;
  }

  /** "Interception or Protection" / "Blessed Warrior — with Sacred Flame and Spare the Dying"; '' when none. */
  get recommendedFightingStyleText(): string {
    const g = this.guidance;
    if (!g?.fightingStyles?.length) return '';
    const styles = orList(g.fightingStyles);
    const cantrips = g.fightingStyleCantrips ?? [];
    return cantrips.length ? `${styles} — with ${cantrips.join(' and ')}` : styles;
  }

  /** The specialization's recommended invocations as labelled rows (WoW Warlock); empty otherwise. */
  get invocationRows(): readonly InvocationRow[] {
    return invocationRows(this.guidance);
  }

  /** True for a ✦ World of Warcraft invocation. */
  isWowInvocation(name: string): boolean {
    return isWowInvocation(this.hero, name);
  }

  /** True for a ✦ World of Warcraft maneuver (WoW Warrior). */
  isWowManeuver(name: string): boolean {
    return isWowManeuver(this.hero, name);
  }

  /** The base-class level the recommended Fighting Style is chosen at (2; 1 for a Fighter). */
  get fightingStyleLevel(): number {
    return fightingStyleLevelOf(this.hero);
  }

  /** The base-class level the subclass is chosen at (3; 1 for a Warlock's patron). */
  get subclassLevel(): number {
    return subclassLevelOf(this.hero);
  }

  /** What the base class calls its subclass ('circle', 'oath'), for the recommendation copy. */
  get subclassTerm(): string {
    return this.hero?.subclassTerm ?? 'subclass';
  }

  /** Whether the character's subclass is the recommended one — informational only. */
  get subclassMatch(): SubclassMatch {
    const recommended = this.guidance?.subclass.name;
    const actual = this._pc?.subclass;
    if (!actual) return 'pending';
    return recommended && actual.toLowerCase() === recommended.toLowerCase() ? 'match' : 'different';
  }

  /** Feral → Cat Form, Guardian → Bear Form: the card to emphasize. */
  isEmphasized(card: BeastFormCard): boolean {
    const spec = this._pc?.specialization;
    return (spec === 'Feral' && card.name === 'Cat Form') || (spec === 'Guardian' && card.name === 'Bear Form');
  }

  /**
   * True for a World of Warcraft spell (from the loaded spell data), or a base
   * spell the variant adds to its class list (e.g. the WoW Priest's Blur and Levitate).
   */
  isWowSpell(name: string): boolean {
    return this.spellFor(name)?.source === 'World of Warcraft' || isExtraListSpell(this.hero, name);
  }

  /** Hover text for a suggested spell's ✦ mark. */
  wowSpellTitle(name: string): string {
    return isExtraListSpell(this.hero, name)
      ? `Added to the ${this.hero!.baseClass} spell list by the World of Warcraft ${this.hero!.name}`
      : 'World of Warcraft spell';
  }

  /** The spell data for a table name, aliases resolved (Evard's Black Tentacles → Black Tentacles). */
  spellFor(name: string): DndSpell | undefined {
    return this.spellIndex()?.get(spellKey(name));
  }

  /** "+5" / "−1" for an attack bonus. */
  fmtBonus(n: number): string {
    return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
  }

  private deriveVariant(): void {
    const hero = this.hero;
    const pc = this._pc;
    this.spellSections = [
      { title: hero?.spellTableTitle ?? `${hero?.subclass ?? ''} Spells`, entries: this.spells },
      { title: `${pc?.subclass ?? ''} Spells`, entries: this.subclassSpells },
    ].filter(section => section.entries.length > 0);
    const spec = pc?.specialization;
    const levels = (spec && hero?.suggestedSpells?.[spec]) || [];
    const owned = new Map((pc?.spells ?? []).map(s => [spellKey(s.name), s]));
    this.extraPrepared = ((spec && hero?.guidance?.[spec]?.extraPrepared) || []).map(name => {
      const have = owned.get(spellKey(name));
      return { name, known: !!have, prepared: !!have?.prepared };
    });
    this.suggestedSpells = levels.map(row => ({
      level: row.level,
      spells: row.spells.map(name => {
        const have = owned.get(spellKey(name));
        return { name, known: !!have, prepared: !!have?.prepared };
      }),
    }));

    this.featureCards = hero?.featureCards
      ? [...hero.featureCards({ level: pc.level ?? 1, subclass: pc.subclass, stats: pc.stats, prof: pc.prof })]
      : [];

    this.derivePet(hero, pc);

    if (!hero?.beastForms) {
      this.formCards = [];
      this.classicForms = [];
      return;
    }
    const moon = isMoonCircle(pc.subclass);
    if (moon) {
      const input = beastFormInput(pc);
      this.formCards = [catForm(input), bearForm(input)];
    } else {
      this.formCards = [];
    }
    this.classicForms = classicBeastForms(pc.level ?? 1, moon);
  }

  /** Pick a pet family ('' clears it) and hand it to the sheet to save. */
  selectPetFamily(name: string): void {
    if (!this.canEdit) return;
    const next = name || null;
    if (next === (this._pc.petFamily ?? null)) return;
    this.petFamilyChange.emit(next);
  }

  /** The Ranger level Pet Specialization arrives at (for the "from Ranger 6" note). */
  readonly petSpecializationLevel = PET_SPECIALIZATION_LEVEL;

  private derivePet(hero: HeroClassOption | undefined, pc: PC): void {
    this.showPet = !!hero?.hunterPets && keepsHunterPet(pc);
    this.petFamily = this.showPet ? petFamilyByName(pc.petFamily) : undefined;
    if (!this.petFamily) {
      this.petCards = [];
      this.petSpec = null;
      return;
    }
    const input = beastFormInput(pc);
    const wisMod = modFromScore(input.wis);
    this.petCards = petStatCards(this.petFamily, {
      level: input.level, wisMod, spellAttack: input.spellAttack, spellDc: input.spellDc,
    });
    this.petSpec = pc.specialization === 'Beast Mastery'
      ? petSpecialization(this.petFamily, input.level, wisMod)
      : null;
  }

  private loadSpells(): void {
    if (this.spellsRequested) return;
    this.spellsRequested = true;
    this.dndResources.getSpells().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: spells => {
        this.spellIndex.set(new Map(spells.map(s => [s.name.toLowerCase(), s])));
      },
      // Offline asset fetch: the list still renders names; allow a retry on the next input.
      error: () => { this.spellsRequested = false; },
    });
  }
}

/**
 * Beast-form inputs from the sheet: druid level, WIS score, and the spell attack
 * bonus / save DC from the shared spell math (falling back to proficiency + WIS
 * if the stored class name isn't the canonical 'Druid').
 */
export function beastFormInput(pc: PC): BeastFormInput {
  const level = pc.level ?? 1;
  const wis = pc.stats?.WIS ?? 10;
  const prof = pc.prof ?? Math.floor((level - 1) / 4) + 2;
  const wisMod = modFromScore(wis);
  return {
    level,
    wis,
    spellAttack: spellAttackBonus(pc) ?? prof + wisMod,
    spellDc: spellSaveDc(pc) ?? 8 + prof + wisMod,
  };
}
