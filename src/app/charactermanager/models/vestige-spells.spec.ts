import { PC, PcSpell } from './pc';
import { VESTIGE_DOMAINS } from './arcana-subclasses';
import { spellKey } from './spell-names';
import {
  VESTIGE_DOMAIN_SPELLS, VESTIGE_SPELLS, vestigeSpellsOwed, vestigeSpellsOwedByDomain, vestigeSpellsThrough,
} from './vestige-spells';

const warlock = (over: Partial<PC> = {}): PC => ({
  id: 7, name: 'Aelindra', clazz: 'Warlock', subclass: 'Vestige Patron', level: 5, playerName: 'Sam',
  ...over,
});

const spell = (name: string, lvl: number, alwaysPrepared = false): PcSpell =>
  ({ name, lvl, school: 'Evocation', time: '1 action', prepared: true, ...(alwaysPrepared ? { alwaysPrepared } : {}) });

const names = (grants: { name: string }[]): string[] => grants.map(g => g.name);

describe('vestige spells', () => {
  // The server reads these rows from the Cleric domains' own feature text; this is the same list.
  it('lists each domain at Warlock 3, 5, 7 and 9, as the server grants them', () => {
    const flat = (domain: keyof typeof VESTIGE_DOMAIN_SPELLS) =>
      VESTIGE_DOMAIN_SPELLS[domain].map(row => `${row.classLevel}: ${row.spells.join(', ')}`);
    expect(flat('Life')).toEqual([
      '3: Aid, Bless, Cure Wounds, Lesser Restoration', '5: Mass Healing Word, Revivify',
      '7: Aura of Life, Death Ward', '9: Greater Restoration, Mass Cure Wounds']);
    expect(flat('Light')).toEqual([
      '3: Burning Hands, Faerie Fire, Scorching Ray, See Invisibility', '5: Daylight, Fireball',
      '7: Arcane Eye, Wall of Fire', '9: Flame Strike, Scrying']);
    expect(flat('Trickery')).toEqual([
      '3: Charm Person, Disguise Self, Invisibility, Pass without Trace', '5: Hypnotic Pattern, Nondetection',
      '7: Confusion, Dimension Door', '9: Dominate Person, Modify Memory']);
    expect(flat('War')).toEqual([
      '3: Guiding Bolt, Magic Weapon, Shield of Faith, Spiritual Weapon', "5: Crusader's Mantle, Spirit Guardians",
      '7: Fire Shield, Freedom of Movement', '9: Hold Monster, Steel Wind Strike']);
    expect(Object.keys(VESTIGE_DOMAIN_SPELLS)).toEqual([...VESTIGE_DOMAINS]);
  });

  it('names no spell twice within a domain', () => {
    for (const domain of VESTIGE_DOMAINS) {
      const keys = VESTIGE_DOMAIN_SPELLS[domain].flatMap(row => row.spells).map(spellKey);
      expect(new Set(keys).size).withContext(domain).toBe(10);
    }
  });

  it('hands over every row the level has reached, each granted by Vestige Spells', () => {
    expect(vestigeSpellsThrough(warlock(), 'War', 2)).toEqual([]);
    expect(names(vestigeSpellsThrough(warlock(), 'War', 3)))
      .toEqual(['Guiding Bolt', 'Magic Weapon', 'Shield of Faith', 'Spiritual Weapon']);
    expect(names(vestigeSpellsThrough(warlock(), ' war ', 6))).toEqual(
      ['Guiding Bolt', 'Magic Weapon', 'Shield of Faith', 'Spiritual Weapon', "Crusader's Mantle", 'Spirit Guardians']);
    expect(vestigeSpellsThrough(warlock(), 'Life', 20).length).toBe(10);
    expect(vestigeSpellsThrough(warlock(), 'Life', 20).every(g => g.grantedBy === VESTIGE_SPELLS)).toBeTrue();
    expect(VESTIGE_SPELLS).toBe('Vestige Spells');
  });

  it('hands nothing to another patron, another class, or without one of the four domains', () => {
    expect(vestigeSpellsThrough(warlock({ subclass: 'Fiend Patron' }), 'Life', 20)).toEqual([]);
    expect(vestigeSpellsThrough(warlock({ clazz: 'Cleric', subclass: 'Life Domain' }), 'Life', 20)).toEqual([]);
    expect(vestigeSpellsThrough(warlock(), null, 20)).toEqual([]);
    expect(vestigeSpellsThrough(warlock(), 'Twilight', 20)).toEqual([]);
  });

  it('owes the stored domain what the character does not hold always prepared yet', () => {
    const pc = warlock({
      subclassChoices: { vestigeType: 'Fiend', vestigeDomain: 'Light' },
      spells: [spell('Burning Hands', 1, true), spell('Fireball', 3)],
    });
    expect(names(vestigeSpellsOwed(pc, 5)))
      .toEqual(['Faerie Fire', 'Scorching Ray', 'See Invisibility', 'Daylight', 'Fireball']);
    expect(vestigeSpellsOwed(warlock(), 5)).toEqual([]);
    expect(vestigeSpellsOwed(warlock({ subclass: 'Fiend Patron', subclassChoices: { vestigeDomain: 'Light' } }), 5))
      .toEqual([]);
  });

  it('lists what each domain would hand over only while none is chosen', () => {
    const byDomain = vestigeSpellsOwedByDomain(warlock({ level: 2 }), 3);
    expect(Object.keys(byDomain)).toEqual(['Life', 'Light', 'Trickery', 'War']);
    expect(names(byDomain['Trickery'])).toEqual(['Charm Person', 'Disguise Self', 'Invisibility', 'Pass without Trace']);

    expect(vestigeSpellsOwedByDomain(warlock({ level: 1 }), 2)).toEqual({});
    expect(vestigeSpellsOwedByDomain(warlock({ subclassChoices: { vestigeDomain: 'War' } }), 6)).toEqual({});
    expect(vestigeSpellsOwedByDomain(warlock({ subclass: 'Fiend Patron' }), 6)).toEqual({});

    // A spell already held always prepared is not offered again.
    const held = warlock({ level: 2, spells: [spell('Charm Person', 1, true)] });
    expect(names(vestigeSpellsOwedByDomain(held, 3)['Trickery']))
      .toEqual(['Disguise Self', 'Invisibility', 'Pass without Trace']);
  });
});
