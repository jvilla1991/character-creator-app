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
}

/** The choices a player makes when taking the species. */
export interface SpeciesChoices {
  /** Pick this many skills from the list, or from every skill. */
  skill?: { count: number; from: readonly string[] | 'any' };
  /** Pick this many tool proficiencies. */
  tools?: number;
  /** Pick an Origin feat. */
  originFeat?: boolean;
  /** Pick one ability, and what it is used for. */
  ability?: { use: 'spellcasting' | 'save DC'; from: readonly SpeciesAbility[] };
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

/** The source line on a species trait's feature card: 'Elf (World of Warcraft) · Species Trait'. */
export function speciesTraitSource(species: CatalogSpecies): string {
  return `${species.key} · Species Trait`;
}

/**
 * The feature cards a catalog species adds to a new character: one per trait,
 * filed under Other Features. The lineage trait lists every lineage until the
 * wizard records which one was chosen.
 */
export function speciesTraitFeatures(
  species: CatalogSpecies,
): Array<{ name: string; source: string; desc: string; category: 'other' }> {
  const source = speciesTraitSource(species);
  return species.traits.map(trait => ({
    name: trait.name,
    source,
    desc: trait.name === species.lineageTrait && species.lineages?.length
      ? `${trait.desc} ${species.lineages.map(l => `${l.name}: ${l.desc}`).join(' ')}`
      : trait.desc,
    category: 'other' as const,
  }));
}
