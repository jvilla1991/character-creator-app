import { CuratedShop, parseImportPayload, toImportPayload } from './curated-shop';

describe('curated-shop import format', () => {
  const shop: CuratedShop = {
    id: 5, campaignId: 1, name: 'The Gilded Flask', settlement: 'Phandalin',
    items: [
      { id: 1, catalogItemKey: 'longsword', name: 'Longsword', category: 'WEAPON',
        priceOverrideCp: 1200, effectiveCostCp: 1200, details: {} },
      { id: 2, catalogItemKey: 'rations', name: 'Rations (1 day)', category: 'GEAR',
        priceOverrideCp: null, effectiveCostCp: 50, details: {} },
    ],
  };

  it('round-trips: an exported shop parses back to the same payload', () => {
    const exported = toImportPayload(shop);
    expect(exported).toEqual({
      name: 'The Gilded Flask', settlement: 'Phandalin',
      items: [{ key: 'longsword', priceGp: 12 }, { key: 'rations' }],
    });

    const { payload, error } = parseImportPayload(JSON.stringify(exported));
    expect(error).toBeUndefined();
    expect(payload).toEqual({
      name: 'The Gilded Flask', settlement: 'Phandalin',
      items: [{ key: 'longsword', priceGp: 12 }, { key: 'rations', priceGp: null }],
    });
  });

  it('rejects malformed JSON and missing shape parts with readable errors', () => {
    expect(parseImportPayload('{not json').error).toContain('Not valid JSON');
    expect(parseImportPayload('{"items":[]}').error).toContain('"name"');
    expect(parseImportPayload('{"name":"X"}').error).toContain('"items"');
    expect(parseImportPayload('{"name":"X","items":[{}]}').error).toContain('"key"');
    expect(parseImportPayload('{"name":"X","items":[{"key":"dagger","priceGp":-2}]}').error)
      .toContain('priceGp');
  });

  it('round-trips a custom item with its own price and stats', () => {
    const curios: CuratedShop = {
      id: 6, campaignId: 1, name: 'Curios', settlement: null,
      items: [
        { id: 3, catalogItemKey: null, name: 'Flametongue', category: 'WEAPON', custom: true,
          priceOverrideCp: 500000, effectiveCostCp: 500000, weight: 3, bulk: 2,
          notes: 'Requires: attunement. Ignites on command.',
          details: { damage: '1d8 slashing + 2d6 fire', notes: 'Requires: attunement. Ignites on command.' } },
        { id: 4, catalogItemKey: null, name: 'Mithral Shirt', category: 'ARMOR', custom: true,
          priceOverrideCp: 80000, effectiveCostCp: 80000, weight: 20,
          details: { armorClass: '13 + Dex modifier (max 2)' } },
        { id: 5, catalogItemKey: null, name: 'Spell Ink', category: 'MATERIAL_COMPONENT', custom: true,
          priceOverrideCp: 50, effectiveCostCp: 50, details: {} },
      ],
    };

    const exported = toImportPayload(curios);
    expect(exported.items).toEqual([
      { name: 'Flametongue', category: 'weapon', priceGp: 5000, weight: 3, bulk: 2,
        damage: '1d8 slashing + 2d6 fire', notes: 'Requires: attunement. Ignites on command.' },
      { name: 'Mithral Shirt', category: 'armor', priceGp: 800, weight: 20,
        armorClass: '13 + Dex modifier (max 2)' },
      { name: 'Spell Ink', category: 'material-component', priceGp: 0.5 },
    ]);

    const { payload, error } = parseImportPayload(JSON.stringify(exported));
    expect(error).toBeUndefined();
    expect(payload?.items).toEqual([
      { name: 'Flametongue', priceGp: 5000, category: 'weapon', weight: 3, bulk: 2,
        damage: '1d8 slashing + 2d6 fire', notes: 'Requires: attunement. Ignites on command.' },
      { name: 'Mithral Shirt', priceGp: 800, category: 'armor', weight: 20,
        armorClass: '13 + Dex modifier (max 2)' },
      { name: 'Spell Ink', priceGp: 0.5, category: 'material-component' },
    ]);
  });

  it('rejects a custom line that is not a sound item', () => {
    const error = (line: object) =>
      parseImportPayload(JSON.stringify({ name: 'X', items: [line] })).error;
    expect(error({ name: 'Lucky Coin' })).toContain('needs a priceGp');
    expect(error({ key: 'dagger', name: 'Dagger', priceGp: 2 })).toContain('not both');
    expect(error({ key: 'dagger', notes: 'Sharp' })).toContain('custom items only');
    expect(error({ key: 'dagger', weight: 1 })).toContain('custom items only');
    expect(error({ name: 'Rock', priceGp: 1, category: 'gear', damage: '1d4' })).toContain('weapon items only');
    expect(error({ name: 'Rock', priceGp: 1, bulk: -1 })).toContain('bulk');
  });

  it('trims strings and tolerates an empty items list', () => {
    const { payload } = parseImportPayload('{"name":"  Flask  ","items":[]}');
    expect(payload).toEqual({ name: 'Flask', settlement: null, items: [] });
  });
});
