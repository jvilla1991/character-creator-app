import { isPlaceholderSpell, refreshStaleSpell, toGrantedSpell, toPcSpell } from './spell-mapping';
import { PcSpell } from '../models/pc';
import { DndSpell } from '../models/dnd-api.types';

function dndSpell(overrides: Partial<DndSpell> = {}): DndSpell {
  return {
    name: 'Hold Person',
    level: 2,
    school: 'enchantment',
    classes: ['bard', 'cleric'],
    actionType: '1 action',
    concentration: true,
    ritual: false,
    range: '60 feet',
    components: ['v', 's', 'm'],
    duration: 'Concentration, up to 1 minute',
    description: 'Choose a humanoid...',
    material: 'a small, straight piece of iron',
    higherLevelSlot: 'you can target one additional humanoid...',
    ...overrides,
  };
}

describe('spell-mapping', () => {

  describe('toPcSpell', () => {
    it('maps every field, field-for-field', () => {
      const s = dndSpell();

      expect(toPcSpell(s)).toEqual({
        lvl: 2,
        name: 'Hold Person',
        school: 'enchantment',
        time: '1 action',
        prepared: true,
        concentration: true,
        ritual: false,
        range: '60 feet',
        components: ['v', 's', 'm'],
        duration: 'Concentration, up to 1 minute',
        description: 'Choose a humanoid...',
        material: 'a small, straight piece of iron',
        higherLevelSlot: 'you can target one additional humanoid...',
      });
    });

    it('always marks the spell prepared, regardless of source data', () => {
      const s = dndSpell();
      expect(toPcSpell(s).prepared).toBeTrue();
    });

    it('maps a cantrip (level 0) with its actionType as time', () => {
      const s = dndSpell({ name: 'Light', level: 0, actionType: '1 action', concentration: false, ritual: false });
      const pc = toPcSpell(s);
      expect(pc.lvl).toBe(0);
      expect(pc.time).toBe('1 action');
    });

    it('carries through undefined optional fields as-is', () => {
      const s = dndSpell({ material: undefined, higherLevelSlot: undefined });
      const pc = toPcSpell(s);
      expect(pc.material).toBeUndefined();
      expect(pc.higherLevelSlot).toBeUndefined();
    });
  });

  describe('refreshStaleSpell', () => {
    const TBD = 'TBD — full text coming in the World of Warcraft spells update.';

    /** A spell saved while its catalog entry was still a placeholder stub. */
    const stale = (o: Partial<PcSpell> = {}): PcSpell => ({
      lvl: 1, name: 'Rune Strike', school: 'necromancy', time: 'action', prepared: false,
      concentration: false, ritual: false, range: 'TBD', components: ['v', 's'],
      duration: 'TBD', description: TBD, ...o,
    });

    const finished = dndSpell({
      name: 'Rune Strike', level: 1, school: 'evocation', actionType: 'bonus action',
      concentration: true, ritual: true, range: 'Self', components: ['v', 's', 'm'],
      duration: 'up to 1 minute', description: 'Your weapon flares with runes.',
      material: 'a rune-etched stone', higherLevelSlot: 'The damage increases by 1d6.',
    });

    const catalogOf = (...spells: DndSpell[]): ReadonlyMap<string, DndSpell> =>
      new Map(spells.map(s => [s.name.toLowerCase(), s]));

    it('treats a description starting with TBD as a placeholder', () => {
      expect(isPlaceholderSpell({ description: TBD })).toBeTrue();
      expect(isPlaceholderSpell({ description: 'Real text.' })).toBeFalse();
      expect(isPlaceholderSpell({})).toBeFalse();
    });

    it('swaps a stale placeholder for the catalog text, keeping prepared, without mutating the input', () => {
      const saved = stale();
      const before = JSON.parse(JSON.stringify(saved));

      const shown = refreshStaleSpell(saved, catalogOf(finished));

      expect(shown).not.toBe(saved);
      expect(shown).toEqual({
        lvl: 1,
        name: 'Rune Strike',
        school: 'evocation',
        time: 'bonus action',
        prepared: false,
        concentration: true,
        ritual: true,
        range: 'Self',
        components: ['v', 's', 'm'],
        duration: 'up to 1 minute',
        description: 'Your weapon flares with runes.',
        material: 'a rune-etched stone',
        higherLevelSlot: 'The damage increases by 1d6.',
      });
      expect(saved).toEqual(before);
    });

    it('keeps an absent prepared flag absent-valued (pre-feature data still reads as prepared)', () => {
      const saved = stale();
      delete (saved as Partial<PcSpell>).prepared;
      expect(refreshStaleSpell(saved, catalogOf(finished)).prepared).toBeUndefined();
    });

    it('matches the catalog by name case-insensitively and through spell-name aliases', () => {
      const tentacles = dndSpell({ name: 'Black Tentacles', level: 4, description: 'Squirming tentacles fill the ground.' });
      const catalog = catalogOf(finished, tentacles);

      const upper = refreshStaleSpell(stale({ name: 'RUNE STRIKE' }), catalog);
      expect(upper.description).toBe('Your weapon flares with runes.');
      expect(upper.name).toBe('RUNE STRIKE'); // the character's own wording stays

      const alias = refreshStaleSpell(stale({ name: "Evard's Black Tentacles", lvl: 4 }), catalog);
      expect(alias.description).toBe('Squirming tentacles fill the ground.');
      expect(alias.name).toBe("Evard's Black Tentacles");
    });

    it('returns the same reference for a spell the catalog does not have (homebrew)', () => {
      const saved = stale({ name: 'Homebrew Zap' });
      expect(refreshStaleSpell(saved, catalogOf(finished))).toBe(saved);
    });

    it('returns the same reference while the catalog entry is itself still a placeholder', () => {
      const saved = stale();
      const stub = dndSpell({ name: 'Rune Strike', description: TBD, range: 'TBD', duration: 'TBD' });
      expect(refreshStaleSpell(saved, catalogOf(stub))).toBe(saved);
    });

    it('never touches a real snapshot, even when its text differs from the catalog', () => {
      const edited = stale({ description: 'The DM rewrote this.', range: '30 feet', duration: '1 round' });
      expect(refreshStaleSpell(edited, catalogOf(finished))).toBe(edited);
    });

    it('keeps the saved level when the catalog level changed (Breath of Eons 5 -> 4): casts are checked against it', () => {
      const breath = dndSpell({ name: 'Breath of Eons', level: 4, school: 'abjuration', range: 'Self',
        duration: 'up to 1 minute', description: 'You call on the magic of the bronze dragonflight.' });
      const saved = stale({ name: 'Breath of Eons', lvl: 5, prepared: true });

      const shown = refreshStaleSpell(saved, catalogOf(breath));

      expect(shown.description).toBe('You call on the magic of the bronze dragonflight.');
      expect(shown.range).toBe('Self');
      expect(shown.lvl).toBe(5);
    });
  });

});

describe('toGrantedSpell', () => {
  const dnd = (name: string, level: number): DndSpell => ({
    name, level, school: 'divination', classes: ['ranger'], actionType: 'bonus action', concentration: true,
    ritual: false, range: '90 feet', components: ['v'], duration: '1 hour', description: `${name} text.`,
  });

  it('marks a leveled spell always prepared and records what grants it', () => {
    const granted = toGrantedSpell(dnd("Hunter's Mark", 1), 'Favored Enemy');
    expect(granted).toEqual({ ...toPcSpell(dnd("Hunter's Mark", 1)), alwaysPrepared: true, grantedBy: 'Favored Enemy' });
    expect(granted.prepared).toBeTrue();
  });

  it('records only the source on a cantrip (cantrips are never counted)', () => {
    const granted = toGrantedSpell(dnd('Guidance', 0), 'Magic Initiate (Cleric)');
    expect(granted.alwaysPrepared).toBeUndefined();
    expect(granted.grantedBy).toBe('Magic Initiate (Cleric)');
  });

  it('survives a placeholder refresh: the marker is the character\'s own state', () => {
    const saved: PcSpell = { ...toGrantedSpell({ ...dnd('Rune Strike', 1), description: 'TBD' }, 'DM grant') };
    const catalog = new Map([['rune strike', dnd('Rune Strike', 1)]]);
    const shown = refreshStaleSpell(saved, catalog);
    expect(shown.description).toBe('Rune Strike text.');
    expect(shown.alwaysPrepared).toBeTrue();
    expect(shown.grantedBy).toBe('DM grant');
  });
});
