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

  it('trims strings and tolerates an empty items list', () => {
    const { payload } = parseImportPayload('{"name":"  Flask  ","items":[]}');
    expect(payload).toEqual({ name: 'Flask', settlement: null, items: [] });
  });
});
