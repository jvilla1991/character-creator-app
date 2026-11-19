import { ContentSource } from './content-source';
import type { DndSpecies } from './dnd-api.types';
import { WOW_SPECIES } from './wow-species';

/**
 * Species that live in the app's own data rather than the 2024 rules API: the
 * World of Warcraft module's seventeen. Base-game species still come from the
 * API by name, so five names exist twice (Dwarf, Elf, Gnome, Human, Orc) — a
 * row is therefore identified by its {@link SpeciesOption.key}, never its name,
 * and the World of Warcraft source tag tells the two rows apart.
 *
 * Everything in a catalog entry is something the player reads. The wizard
 * records the species and its trait cards; it does not apply numbers.
 */

export type SpeciesSize = 'Small' | 'Medium';
export type CreatureType = 'Humanoid' | 'Dragon' | 'Undead' | 'Construct';
/** Abilities a species lets the player choose between (spellcasting, save DC). */
export type SpeciesAbility = 'STR' | 'CON' | 'INT' | 'WIS' | 'CHA';

export interface SpeciesTrait {
  name: string;
  desc: string;
}

/** A spell a species or lineage adds at a character level. */
export interface SpeciesSpell {
  /** Character level the spell is gained at. */
  level: number;
  name: string;
}

/** What a species or one of its lineages hands the character outright. */
export interface SpeciesGrants {
  resistances?: readonly string[];
  /** Replaces the species' own Darkvision range. */
  darkvision?: number;
  skills?: readonly string[];
  cantrips?: readonly string[];
  /** Always prepared; one free casting per Long Rest. */
  spells?: readonly SpeciesSpell[];
  /** A flat Armor Class bonus. Shown on the card; the DM adds it to the sheet. */
  acBonus?: number;
}

export interface SpeciesLineage extends SpeciesGrants {
  name: string;
  /** Everything the lineage gives, as one readable line. */
  desc: string;
  /** True when this lineage never uses the species' ability choice (the Taunka has no saving throw). */
  noAbilityChoice?: boolean;
}

/** The choices a player makes when taking the species. */
export interface SpeciesChoices {
  /** Pick this many skills from the list, or from every skill. */
  skill?: { count: number; from: readonly string[] | 'any' };
  /** Pick this many tool proficiencies. */
  tools?: number;
  /** Pick an Origin feat. */
  originFeat?: boolean;
  /** Pick one ability: what it is used for, and the trait whose card records it. */
  ability?: { use: 'spellcasting' | 'save DC'; from: readonly SpeciesAbility[]; trait: string };
}

export interface CatalogSpecies extends SpeciesGrants {
  /** Unique row id, e.g. 'Elf (World of Warcraft)'. */
  key: string;
  /** The species name — what is stored on the character. */
  name: string;
  source: ContentSource;
  creatureType: CreatureType;
  /** One entry, or two when the player chooses the size. */
  sizes: readonly SpeciesSize[];
  /** Typical height, e.g. 'about 7 feet tall'. */
  height: string;
  speed: number;
  traits: readonly SpeciesTrait[];
  /** The trait that makes the player pick one of {@link lineages}. */
  lineageTrait?: string;
  lineages?: readonly SpeciesLineage[];
  /** What holds for whichever lineage is chosen (how its spells work); added to the chosen lineage's card. */
  lineageRule?: string;
  choices?: SpeciesChoices;
}

/** One row in the species step. */
export interface SpeciesOption {
  /** Unique row id: the species name for a base-game row, else the catalog key. */
  key: string;
  /** What the row shows, and what is stored on the character (not unique). */
  name: string;
  source: ContentSource;
  /** The catalog entry behind a World of Warcraft row; absent for a base-game row. */
  catalog?: CatalogSpecies;
}

/**
 * The full species list: the base-game names in their given (API) order, then
 * the catalog species in book order — the same shape as the class list, so the
 * familiar rows stay where players expect them.
 */
export function buildSpeciesOptions(baseNames: readonly string[]): SpeciesOption[] {
  return [
    ...baseNames.map((name): SpeciesOption => ({ key: name, name, source: 'Base Game' })),
    ...WOW_SPECIES.map((s): SpeciesOption => ({ key: s.key, name: s.name, source: s.source, catalog: s })),
  ];
}

/** The catalog species behind a row key ('Elf (World of Warcraft)'); undefined for a base-game row. */
export function catalogSpeciesByKey(key: string | null | undefined): CatalogSpecies | undefined {
  return key ? WOW_SPECIES.find(s => s.key === key) : undefined;
}

/** 'Medium', or 'Small or Medium' when the player chooses. */
export function sizeLabel(species: CatalogSpecies): string {
  return [...species.sizes].join(' or ');
}

/**
 * A catalog species in the shape the rules API returns, so the review step and
 * everything else that reads a species detail works without a second code path.
 */
export function toSpeciesDetail(species: CatalogSpecies): DndSpecies {
  const index = species.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    index,
    name: species.name,
    size: sizeLabel(species),
    speed: species.speed,
    traits: species.traits.map(t => ({ index: t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: t.name, url: '' })),
    subspecies: (species.lineages ?? []).map(l => ({ index: l.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: l.name, url: '' })),
  };
}

// ── The player's choices ─────────────────────────────────────────────────────

/** What the player picked for a catalog species. Empty strings mean "not chosen yet". */
export interface SpeciesSelections {
  lineage: string;
  size: SpeciesSize | '';
  ability: SpeciesAbility | '';
  /** Skills picked for the species' skill choice (Keen Senses, Skillful). */
  skills: string[];
  /** Tools picked for the species' tool choice, one slot per pick ('' = empty slot). */
  tools: string[];
  /** The Origin feat picked for a Human's Versatile trait. */
  originFeat: string;
}

/** Nothing chosen; a species with a single size has it filled in. */
export function emptySpeciesSelections(species?: CatalogSpecies): SpeciesSelections {
  return {
    lineage: '',
    size: species?.sizes.length === 1 ? species.sizes[0] : '',
    ability: '',
    skills: [],
    tools: Array.from({ length: species?.choices?.tools ?? 0 }, () => ''),
    originFeat: '',
  };
}

export const SPECIES_ABILITY_NAMES: Readonly<Record<SpeciesAbility, string>> = {
  STR: 'Strength', CON: 'Constitution', INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma',
};

/** The chosen lineage's catalog entry, if the species has lineages and one is chosen. */
export function chosenLineage(species: CatalogSpecies, selections: SpeciesSelections): SpeciesLineage | undefined {
  return species.lineages?.find(l => l.name === selections.lineage);
}

/** True when the species asks for an ability and the chosen lineage (if any) uses it. */
export function needsAbilityChoice(species: CatalogSpecies, selections: SpeciesSelections): boolean {
  return !!species.choices?.ability && !chosenLineage(species, selections)?.noAbilityChoice;
}

/**
 * The species-step choices are all made: a lineage where there are lineages, a
 * size where there are two, the ability, and a Human's Origin feat.
 */
export function speciesChoicesComplete(species: CatalogSpecies, selections: SpeciesSelections): boolean {
  if (species.lineages?.length && !chosenLineage(species, selections)) return false;
  if (!species.sizes.includes(selections.size as SpeciesSize)) return false;
  if (needsAbilityChoice(species, selections)
    && !species.choices!.ability!.from.includes(selections.ability as SpeciesAbility)) return false;
  if (species.choices?.originFeat && !selections.originFeat) return false;
  return true;
}

/** Skills the species gives with no choice involved: its own plus the chosen lineage's. */
export function grantedSpeciesSkills(species: CatalogSpecies, selections: SpeciesSelections): string[] {
  return [...(species.skills ?? []), ...(chosenLineage(species, selections)?.skills ?? [])];
}

/** Every skill a species makes the character proficient in: granted, then picked. */
export function speciesSkills(species: CatalogSpecies, selections: SpeciesSelections): string[] {
  return [...new Set([...grantedSpeciesSkills(species, selections), ...selections.skills])];
}

/** The tools picked so far, without the empty slots. */
export function speciesTools(selections: SpeciesSelections): string[] {
  return selections.tools.filter(t => !!t);
}

/** The proficiency-step choices are all made: every skill pick and every tool pick, no repeats. */
export function speciesProficienciesComplete(species: CatalogSpecies, selections: SpeciesSelections): boolean {
  const skillCount = species.choices?.skill?.count ?? 0;
  const toolCount = species.choices?.tools ?? 0;
  const tools = speciesTools(selections);
  return selections.skills.length === skillCount
    && tools.length === toolCount
    && new Set(tools).size === tools.length;
}

/**
 * How a character's species reads on the sheet: the lineage where it already
 * names the species ('Night Elf', 'Amani Troll'), 'Tauren (Taunka)' where it
 * doesn't, and the bare species when there is no lineage or it adds nothing
 * (a Draenei of the Draenei lineage).
 */
export function speciesLabel(race: string | null | undefined, lineage: string | null | undefined): string {
  const species = race ?? '';
  if (!lineage || lineage === species) return species;
  if (!species) return lineage;
  return lineage.toLowerCase().includes(species.toLowerCase()) ? lineage : `${species} (${lineage})`;
}

// ── Spells a species gives ───────────────────────────────────────────────────

/** The catalog species a saved character is, from its stored species name and source. */
export function catalogSpeciesFor(
  race: string | null | undefined, speciesSource: string | null | undefined,
): CatalogSpecies | undefined {
  return race && speciesSource ? catalogSpeciesByKey(`${race} (${speciesSource})`) : undefined;
}

/** A spell a species hands the character, and the character level it arrives at (1 = from the start). */
export interface SpeciesSpellGrant {
  name: string;
  level: number;
  /** True for a cantrip: known and cast at will, rather than once per Long Rest. */
  cantrip: boolean;
}

/**
 * Every spell the species and the chosen lineage give, earliest first: their
 * cantrips (known from level 1), then the always-prepared spells in the order
 * they are learned.
 */
export function speciesSpellGrants(
  species: CatalogSpecies, lineageName: string | null | undefined,
): SpeciesSpellGrant[] {
  const lineage = species.lineages?.find(l => l.name === lineageName);
  const cantrips = [...(species.cantrips ?? []), ...(lineage?.cantrips ?? [])]
    .map((name): SpeciesSpellGrant => ({ name, level: 1, cantrip: true }));
  const spells = [...(species.spells ?? []), ...(lineage?.spells ?? [])]
    .map((s): SpeciesSpellGrant => ({ name: s.name, level: s.level, cantrip: false }))
    .sort((a, b) => a.level - b.level);
  return [...cantrips, ...spells];
}

// ── Feature cards ────────────────────────────────────────────────────────────

/** The source line on a species trait's feature card: 'Elf (World of Warcraft) · Species Trait'. */
export function speciesTraitSource(species: CatalogSpecies): string {
  return `${species.key} · Species Trait`;
}

/** 'Spellcasting ability: Wisdom.' / 'Save DC: 8 + Proficiency Bonus + Constitution modifier.' */
function abilityLine(species: CatalogSpecies, selections: SpeciesSelections): string {
  const choice = species.choices?.ability;
  if (!choice || !selections.ability || !needsAbilityChoice(species, selections)) return '';
  const name = SPECIES_ABILITY_NAMES[selections.ability];
  return choice.use === 'spellcasting'
    ? `Spellcasting ability: ${name}.`
    : `Save DC: 8 + Proficiency Bonus + ${name} modifier.`;
}

/**
 * The feature cards a catalog species adds to a new character: one per trait,
 * filed under Other Features. With a lineage chosen, the lineage trait becomes
 * that lineage's own card ('Tauren Lineage: Taunka'); until then it lists every
 * lineage. The chosen ability is written onto the card of the trait it belongs to.
 */
export function speciesTraitFeatures(
  species: CatalogSpecies,
  selections: SpeciesSelections = emptySpeciesSelections(species),
): Array<{ name: string; source: string; desc: string; category: 'other' }> {
  const source = speciesTraitSource(species);
  const lineage = chosenLineage(species, selections);
  const ability = abilityLine(species, selections);
  const join = (...parts: Array<string | undefined>) => parts.filter(p => !!p).join(' ');
  return species.traits.map(trait => {
    const isLineageTrait = trait.name === species.lineageTrait && !!species.lineages?.length;
    const abilityHere = species.choices?.ability?.trait === trait.name ? ability : '';
    if (isLineageTrait && lineage) {
      return {
        name: `${trait.name}: ${lineage.name}`,
        source,
        desc: join(lineage.desc, lineage.spells?.length ? species.lineageRule : undefined, abilityHere),
        category: 'other' as const,
      };
    }
    return {
      name: trait.name,
      source,
      desc: isLineageTrait
        ? join(trait.desc, ...species.lineages!.map(l => `${l.name}: ${l.desc}`))
        : join(trait.desc, abilityHere),
      category: 'other' as const,
    };
  });
}
