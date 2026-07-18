import { parseLootImportPayload, toLootImportPayload } from './loot';
import { CuratedLoot } from './curated-loot';

describe('parseLootImportPayload', () => {
  it('rejects malformed JSON', () => {
    expect(parseLootImportPayload('{oops').error).toContain('Not valid JSON');
  });

  it('rejects a payload without an items array', () => {
    expect(parseLootImportPayload('{"coinGp": 5}').error).toContain('"items" array');
  });

  it('rejects a negative coinGp', () => {
    expect(parseLootImportPayload('{"coinGp": -1, "items": []}').error).toContain('coinGp');
  });

  it('rejects a line with both key and name, or with neither', () => {
    expect(parseLootImportPayload('{"items": [{"key": "longsword", "name": "Also"}]}').error)
      .toContain('not both');
    expect(parseLootImportPayload('{"items": [{"notes": "orphan"}]}').error)
      .toContain('either a "key"');
  });

  it('rejects a non-positive qty', () => {
    expect(parseLootImportPayload('{"items": [{"key": "longsword", "qty": 0}]}').error)
      .toContain('qty');
  });

  it('accepts a mixed legacy payload, trimming and defaulting (normalized shape unchanged)', () => {
    const { payload, error } = parseLootImportPayload(JSON.stringify({
      coinGp: 125.5,
      items: [
        { key: '  longsword ' },
        { name: 'Cloak of Elvenkind', notes: ' Advantage on Stealth. ', qty: 2 },
      ],
    }));
    expect(error).toBeUndefined();
    expect(payload).toEqual({
      coinGp: 125.5,
      items: [
        { key: 'longsword', name: null, notes: null, qty: null },
        { key: null, name: 'Cloak of Elvenkind', notes: 'Advantage on Stealth.', qty: 2 },
      ],
    });
  });

  it('accepts an empty items array (coins-only drop)', () => {
    const { payload, error } = parseLootImportPayload('{"coinGp": 10, "items": []}');
    expect(error).toBeUndefined();
    expect(payload!.items).toEqual([]);
  });

  // --- custom-item attributes ------------------------------------------------

  it('accepts a fully attributed custom weapon', () => {
    const { payload, error } = parseLootImportPayload(JSON.stringify({
      items: [{ name: 'Flametongue', category: 'weapon', valueGp: 50.5, weight: 3,
                damage: ' 1d8 slashing + 2d6 fire ', notes: 'Ignites.' }],
    }));
    expect(error).toBeUndefined();
    expect(payload!.items[0]).toEqual({
      key: null, name: 'Flametongue', notes: 'Ignites.', qty: null,
      category: 'weapon', valueGp: 50.5, weight: 3, damage: '1d8 slashing + 2d6 fire',
    });
  });

  it('accepts a custom armor line with armorClass', () => {
    const { payload, error } = parseLootImportPayload(JSON.stringify({
      items: [{ name: 'Mithral Plate', category: 'armor', armorClass: '18' }],
    }));
    expect(error).toBeUndefined();
    expect(payload!.items[0]).toEqual({
      key: null, name: 'Mithral Plate', notes: null, qty: null,
      category: 'armor', armorClass: '18',
    });
  });

  it('rejects attributes on a catalog (key) line', () => {
    expect(parseLootImportPayload('{"items": [{"key": "longsword", "valueGp": 10}]}').error)
      .toContain('custom items only');
    expect(parseLootImportPayload('{"items": [{"key": "longsword", "category": "weapon"}]}').error)
      .toContain('custom items only');
  });

  it('rejects an unknown category', () => {
    expect(parseLootImportPayload('{"items": [{"name": "Thing", "category": "artifact"}]}').error)
      .toContain('category must be one of');
  });

  it('rejects a negative valueGp or weight', () => {
    expect(parseLootImportPayload('{"items": [{"name": "Thing", "valueGp": -1}]}').error)
      .toContain('valueGp');
    expect(parseLootImportPayload('{"items": [{"name": "Thing", "weight": -0.5}]}').error)
      .toContain('weight');
  });

  it('rejects non-string damage/armorClass', () => {
    expect(parseLootImportPayload('{"items": [{"name": "Thing", "category": "weapon", "damage": 8}]}').error)
      .toContain('damage must be a string');
    expect(parseLootImportPayload('{"items": [{"name": "Thing", "category": "armor", "armorClass": 18}]}').error)
      .toContain('armorClass must be a string');
  });

  it('rejects the category stat outside its category (no category defaults to gear)', () => {
    expect(parseLootImportPayload('{"items": [{"name": "Thing", "damage": "1d6"}]}').error)
      .toContain('damage applies to weapon items only');
    expect(parseLootImportPayload('{"items": [{"name": "Thing", "category": "gear", "armorClass": "14"}]}').error)
      .toContain('armorClass applies to armor items only');
  });
});

describe('toLootImportPayload', () => {
  it('serializes catalog and rich custom lines round-trippably', () => {
    const loot: CuratedLoot = {
      id: 5, campaignId: 1, name: 'Goblin Ambush spoils', notes: null,
      coinCp: 12550,
      items: [
        { id: 1, catalogItemKey: 'longsword', name: 'Longsword', custom: false, customNotes: null, qty: 2 },
        { id: 2, catalogItemKey: null, name: 'Flametongue', custom: true,
          customNotes: 'Ignites.', category: 'weapon', unitCostCp: 5050, weight: 3,
          damage: '1d8 slashing + 2d6 fire', qty: 1 },
      ],
    };
    expect(toLootImportPayload(loot)).toEqual({
      coinGp: 125.5,
      items: [
        { key: 'longsword', qty: 2 },
        { name: 'Flametongue', notes: 'Ignites.', category: 'weapon', valueGp: 50.5,
          weight: 3, damage: '1d8 slashing + 2d6 fire' },
      ],
    });
  });

  it('round-trips through parseLootImportPayload without loss of the attribute fields', () => {
    const loot: CuratedLoot = {
      id: 5, campaignId: 1, name: 'X', notes: null, coinCp: 0,
      items: [
        { id: 1, catalogItemKey: null, name: 'Mithral Plate', custom: true, customNotes: null,
          category: 'armor', unitCostCp: 80000, weight: 40, armorClass: '18', qty: 1 },
      ],
    };
    const json = JSON.stringify(toLootImportPayload(loot));
    const { payload, error } = parseLootImportPayload(json);
    expect(error).toBeUndefined();
    expect(payload!.items[0]).toEqual({
      key: null, name: 'Mithral Plate', notes: null, qty: null,
      category: 'armor', valueGp: 800, weight: 40, armorClass: '18',
    });
  });

  it('serializes a legacy-shaped custom line without inventing attributes', () => {
    const loot: CuratedLoot = {
      id: 5, campaignId: 1, name: 'X', notes: null, coinCp: 0,
      items: [
        { id: 2, catalogItemKey: null, name: 'Cloak of Elvenkind', custom: true,
          customNotes: 'Advantage on Stealth.', qty: 1 },
      ],
    };
    expect(toLootImportPayload(loot)).toEqual({
      items: [{ name: 'Cloak of Elvenkind', notes: 'Advantage on Stealth.' }],
    });
  });

  it('omits coinGp when the pile is empty', () => {
    const loot: CuratedLoot = {
      id: 5, campaignId: 1, name: 'X', notes: null, coinCp: 0, items: [],
    };
    expect(toLootImportPayload(loot)).toEqual({ items: [] });
  });
});
