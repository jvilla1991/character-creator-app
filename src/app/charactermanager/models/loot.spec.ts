import { parseLootImportPayload, toLootImportPayload } from './loot';
import { Encounter } from './encounter';

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

  it('accepts a mixed payload, trimming and defaulting', () => {
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
});

describe('toLootImportPayload', () => {
  it('serializes catalog and custom lines round-trippably', () => {
    const encounter: Encounter = {
      id: 5, campaignId: 1, name: 'Goblin Ambush', notes: null, creatures: [],
      lootCoinCp: 12550,
      lootItems: [
        { id: 1, catalogItemKey: 'longsword', name: 'Longsword', custom: false, customNotes: null, qty: 2 },
        { id: 2, catalogItemKey: null, name: 'Cloak of Elvenkind', custom: true,
          customNotes: 'Advantage on Stealth.', qty: 1 },
      ],
    };
    expect(toLootImportPayload(encounter)).toEqual({
      coinGp: 125.5,
      items: [
        { key: 'longsword', qty: 2 },
        { name: 'Cloak of Elvenkind', notes: 'Advantage on Stealth.' },
      ],
    });
  });

  it('omits coinGp when the pile is empty', () => {
    const encounter: Encounter = {
      id: 5, campaignId: 1, name: 'X', notes: null, creatures: [], lootCoinCp: 0, lootItems: [],
    };
    expect(toLootImportPayload(encounter)).toEqual({ items: [] });
  });
});
