import type { SubclassSpellRow } from './hero-class';
import type { PC } from './pc';
import { VESTIGE_DOMAINS, VestigeDomain } from './arcana-subclasses';
import type { SpellGrant } from './granted-spells';
import { spellKey } from './spell-names';
import { isVestigePatron } from './vestige-companion';

/**
 * A Vestige Patron's Vestige Spells (Arcana Unleashed, Warlock 3): the warlock
 * picks one Cleric domain and always has that domain's spells prepared, each
 * row from the Warlock level equal to the Cleric level the domain lists it at.
 *
 * The server owns the grants (its VestigeSpells reads the domain's own list)
 * and names what a character is owed in the level-up preview. This table is
 * the client's copy for demo mode, which has no server to ask; the spec holds
 * it to the server's lists.
 */

/** The feature that grants them: the `grantedBy` of every Vestige Spell. */
export const VESTIGE_SPELLS = 'Vestige Spells';

/** Each domain's spells by Warlock level (2024 PHB domain spell lists). */
export const VESTIGE_DOMAIN_SPELLS: Readonly<Record<VestigeDomain, readonly SubclassSpellRow[]>> = {
  Life: [
    { classLevel: 3, spells: ['Aid', 'Bless', 'Cure Wounds', 'Lesser Restoration'] },
    { classLevel: 5, spells: ['Mass Healing Word', 'Revivify'] },
    { classLevel: 7, spells: ['Aura of Life', 'Death Ward'] },
    { classLevel: 9, spells: ['Greater Restoration', 'Mass Cure Wounds'] },
  ],
  Light: [
    { classLevel: 3, spells: ['Burning Hands', 'Faerie Fire', 'Scorching Ray', 'See Invisibility'] },
    { classLevel: 5, spells: ['Daylight', 'Fireball'] },
    { classLevel: 7, spells: ['Arcane Eye', 'Wall of Fire'] },
    { classLevel: 9, spells: ['Flame Strike', 'Scrying'] },
  ],
  Trickery: [
    { classLevel: 3, spells: ['Charm Person', 'Disguise Self', 'Invisibility', 'Pass without Trace'] },
    { classLevel: 5, spells: ['Hypnotic Pattern', 'Nondetection'] },
    { classLevel: 7, spells: ['Confusion', 'Dimension Door'] },
    { classLevel: 9, spells: ['Dominate Person', 'Modify Memory'] },
  ],
  War: [
    { classLevel: 3, spells: ['Guiding Bolt', 'Magic Weapon', 'Shield of Faith', 'Spiritual Weapon'] },
    { classLevel: 5, spells: ["Crusader's Mantle", 'Spirit Guardians'] },
    { classLevel: 7, spells: ['Fire Shield', 'Freedom of Movement'] },
    { classLevel: 9, spells: ['Hold Monster', 'Steel Wind Strike'] },
  ],
};

type Caster = Pick<PC, 'clazz' | 'subclass'> & Partial<Pick<PC, 'spells' | 'subclassChoices'>>;

/**
 * Every Vestige Spell a Vestige Patron of `level` with this domain should
 * have, earliest row first; empty for anyone else, without a domain, and
 * below Warlock 3.
 */
export function vestigeSpellsThrough(
  pc: Pick<PC, 'clazz' | 'subclass'>, domain: string | null | undefined, level: number,
): SpellGrant[] {
  const chosen = VESTIGE_DOMAINS.find(d => d.toLowerCase() === (domain ?? '').trim().toLowerCase());
  if (!chosen || !isVestigePatron(pc)) return [];
  return VESTIGE_DOMAIN_SPELLS[chosen]
    .filter(row => row.classLevel <= level)
    .flatMap(row => row.spells.map(name => ({ name, grantedBy: VESTIGE_SPELLS })));
}

const heldAlwaysPrepared = (pc: Caster): Set<string> =>
  new Set((pc.spells ?? []).filter(s => s.alwaysPrepared).map(s => spellKey(s.name)));

/**
 * The Vestige Spells the character is owed at `level` for the domain it has
 * stored: the ones it should have and does not hold always prepared yet.
 */
export function vestigeSpellsOwed(pc: Caster, level: number): SpellGrant[] {
  const held = heldAlwaysPrepared(pc);
  return vestigeSpellsThrough(pc, pc.subclassChoices?.vestigeDomain, level).filter(g => !held.has(spellKey(g.name)));
}

/**
 * For a Vestige Patron that has not chosen its domain: what each domain would
 * hand over at `level`, keyed by domain. Empty once the domain is stored (its
 * spells are then part of {@link vestigeSpellsOwed}) and for everyone else.
 */
export function vestigeSpellsOwedByDomain(pc: Caster, level: number): { [domain: string]: SpellGrant[] } {
  const byDomain: { [domain: string]: SpellGrant[] } = {};
  if (pc.subclassChoices?.vestigeDomain) return byDomain;
  const held = heldAlwaysPrepared(pc);
  for (const domain of VESTIGE_DOMAINS) {
    const owed = vestigeSpellsThrough(pc, domain, level).filter(g => !held.has(spellKey(g.name)));
    if (owed.length) byDomain[domain] = owed;
  }
  return byDomain;
}
