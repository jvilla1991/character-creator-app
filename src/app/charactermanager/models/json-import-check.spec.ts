import { CatalogItem } from './shop';
import { applyKeySuggestion, checkImportJson, closestCatalogItem } from './json-import-check';

const item = (itemKey: string, name: string, category: string, costCp: number): CatalogItem =>
  ({ itemKey, name, category, costCp, bulk: 1, details: {} });

const CATALOG: CatalogItem[] = [
  item('longsword', 'Longsword', 'WEAPON', 1500),
  item('shortsword', 'Shortsword', 'WEAPON', 1000),
  item('longbow', 'Longbow', 'WEAPON', 5000),
  item('chain-mail', 'Chain Mail', 'ARMOR', 7500),
  item('rations', 'Rations (1 day)', 'GEAR', 50),
  item('potion-of-healing', 'Potion of Healing', 'GEAR', 5000),
  item('rope-hempen', 'Rope, Hempen (50 feet)', 'GEAR', 100),
];

const json = (value: unknown) => JSON.stringify(value);

describe('checkImportJson', () => {

  // ── Reading the text ──────────────────────────────────────────────────────

  describe('reading the text', () => {
    it('says nothing about an empty box', () => {
      const check = checkImportJson('grant', '   \n ', CATALOG);
      expect(check.state).toBe('empty');
      expect(check.ok).toBeFalse();
      expect(check.problems).toEqual([]);
    });

    it('reports text that is not JSON, with the line when the browser gives one', () => {
      const check = checkImportJson('grant', '{\n  "items": [\n    { "key": "longsword" \n  ]\n}', CATALOG);
      expect(check.state).toBe('syntax');
      expect(check.ok).toBeFalse();
      expect(check.problems.length).toBe(1);
      expect(check.problems[0]).toContain('Not valid JSON');
    });

    it('names a trailing comma', () => {
      const check = checkImportJson('grant', '{ "items": [ { "key": "longsword" }, ] }', CATALOG);
      expect(check.problems[0]).toContain('comma right before a closing bracket');
    });

    it('names curly quotes copied from a chat window', () => {
      const check = checkImportJson('grant', '{ “items”: [] }', CATALOG);
      expect(check.problems[0]).toContain('curly');
    });

    it('names a reply that was cut off', () => {
      const check = checkImportJson('grant', '{ "items": [ { "key": "longsword" }', CATALOG);
      expect(check.problems[0]).toContain('stops early');
    });

    it('reads the JSON out of a whole AI reply with a code fence', () => {
      const reply = 'Here is your loot:\n\n```json\n{ "items": [ { "key": "longsword" } ] }\n```\nEnjoy!';
      const check = checkImportJson('grant', reply, CATALOG);
      expect(check.ok).toBeTrue();
      expect(check.loot?.items.map(i => i.key)).toEqual(['longsword']);
    });

    it('takes a bare list as the items for a grant or a loot list', () => {
      const check = checkImportJson('loot', json([{ key: 'longsword' }, { name: 'Ruby' }]), CATALOG);
      expect(check.ok).toBeTrue();
      expect(check.loot?.items.length).toBe(2);
    });

    it('refuses a bare list for a shop, which needs a name', () => {
      const check = checkImportJson('shop', json([{ key: 'longsword' }]), CATALOG);
      expect(check.ok).toBeFalse();
      expect(check.problems[0]).toContain('bare list');
    });

    it('refuses JSON that is not an object', () => {
      expect(checkImportJson('grant', '"longsword"', CATALOG).problems[0]).toContain('not an object');
    });

    it('asks for an "items" list when there is none', () => {
      const check = checkImportJson('grant', json({ loot: [] }), CATALOG);
      expect(check.ok).toBeFalse();
      expect(check.problems.some(p => p.includes('"items" list'))).toBeTrue();
    });
  });

  // ── Grant and loot lines ──────────────────────────────────────────────────

  describe('item lines (grant and loot)', () => {
    it('describes a good paste line by line and hands back the normalized payload', () => {
      const check = checkImportJson('grant', json({ items: [
        { key: 'longsword' },
        { key: 'rations', qty: 10 },
        { name: ' Flametongue ', category: 'weapon', valueGp: 5000, weight: 3,
          damage: '1d8 slashing + 2d6 fire', notes: 'Ignites on command.' },
        { name: 'Ruby', category: 'treasure', qty: 3, valueGp: 50 },
      ] }), CATALOG);

      expect(check.state).toBe('checked');
      expect(check.ok).toBeTrue();
      expect(check.problems).toEqual([]);
      expect(check.lines.map(l => [l.n, l.label, l.detail])).toEqual([
        [1, 'Longsword', 'Weapon · 15 gp'],
        [2, 'Rations (1 day)', '×10 · Gear · 5 sp'],
        [3, 'Flametongue', 'Custom weapon · 1d8 slashing + 2d6 fire · 3 lb · 5000 gp'],
        [4, 'Ruby', '×3 · Custom treasure · 50 gp'],
      ]);
      expect(check.lines.every(l => !l.problem && !l.unverified)).toBeTrue();
      expect(check.loot?.items[2]).toEqual({
        key: null, name: 'Flametongue', notes: 'Ignites on command.', qty: null,
        category: 'weapon', valueGp: 5000, weight: 3, damage: '1d8 slashing + 2d6 fire',
      });
      expect(check.shop).toBeNull();
    });

    it('reports every bad line at once, not just the first', () => {
      const check = checkImportJson('grant', json({ items: [
        { key: 'longsword' },
        { key: 'vorpal-blade' },
        { name: 'Rope', quantity: 2 },
        { key: 'rations', name: 'Rations' },
        {},
        'longsword',
      ] }), CATALOG);

      expect(check.ok).toBeFalse();
      expect(check.loot).toBeNull();
      expect(check.lines.filter(l => l.problem).map(l => l.n)).toEqual([2, 3, 4, 5, 6]);
      expect(check.lines[0].problem).toBeNull();
      expect(check.lines[1].problem).toBe('Unknown catalog key.');
      expect(check.lines[2].problem).toBe('Unknown field "quantity" — use "qty".');
      expect(check.lines[3].problem).toContain('both "key" and "name"');
      expect(check.lines[4].problem).toContain('Needs a "key"');
      expect(check.lines[5].problem).toContain('not a bare value');
    });

    it('offers the closest real item for an unknown key', () => {
      const check = checkImportJson('grant', json({ items: [
        { key: 'longsord' }, { key: 'Potion of Healing' }, { key: 'healing-potion' }, { key: 'bag-of-holding' },
      ] }), CATALOG);
      expect(check.lines.map(l => l.suggestion?.key ?? null))
        .toEqual(['longsword', 'potion-of-healing', 'potion-of-healing', null]);
      expect(check.lines[0].suggestion?.name).toBe('Longsword');
    });

    it('offers a key for a bare string line', () => {
      const check = checkImportJson('grant', json({ items: ['Longsword'] }), CATALOG);
      expect(check.lines[0].label).toBe('Longsword');
      expect(check.lines[0].suggestion?.key).toBe('longsword');
    });

    it('points a misnamed field at the real one, whatever its capitals', () => {
      const problem = (line: object) =>
        checkImportJson('grant', json({ items: [line] }), CATALOG).lines[0].problem;
      expect(problem({ name: 'Gem', price: 50 })).toBe('Unknown field "price" — use "valueGp".');
      expect(problem({ name: 'Gem', description: 'Shiny' })).toBe('Unknown field "description" — use "notes".');
      expect(problem({ name: 'Gem', ValueGP: 50 })).toBe('Unknown field "ValueGP" — use "valueGp".');
      expect(problem({ name: 'Gem', rarity: 'rare' })).toContain('Unknown field "rarity" — remove it. Allowed:');
    });

    it('ignores a field that is present but null', () => {
      const check = checkImportJson('grant', json({ items: [{ name: 'Gem', rarity: null, notes: null }] }), CATALOG);
      expect(check.ok).toBeTrue();
    });

    it('lets a catalog item carry only "key" and "qty"', () => {
      const check = checkImportJson('loot', json({ items: [
        { key: 'longsword', valueGp: 10, notes: 'Shiny' }, { key: 'longsword', quantity: 2 },
      ] }), CATALOG);
      expect(check.lines[0].problem).toContain('remove "valueGp", "notes"');
      // A misspelt quantity is pointed at "qty", not thrown away.
      expect(check.lines[1].problem).toBe('Unknown field "quantity" — use "qty".');
    });

    it('applies the same field rules as the loot parser', () => {
      const problem = (line: object) =>
        checkImportJson('loot', json({ items: [line] }), CATALOG).lines[0].problem;
      expect(problem({ name: 'Thing', qty: 0 })).toContain('qty must be a positive number');
      expect(problem({ name: 'Thing', qty: '2' })).toContain('qty must be a positive number');
      expect(problem({ name: 'Thing', category: 'artifact' })).toContain('category must be one of');
      expect(problem({ name: 'Thing', valueGp: -1 })).toContain('valueGp must be a non-negative number');
      expect(problem({ name: 'Thing', weight: '3 lb' })).toContain('weight must be a non-negative number');
      expect(problem({ name: 'Thing', damage: '1d6' })).toContain('damage applies to weapon items only');
      expect(problem({ name: 'Thing', category: 'gear', armorClass: '14' }))
        .toContain('armorClass applies to armor items only');
    });

    it('requires damage on a weapon and an armor class on armor', () => {
      const problem = (line: object) =>
        checkImportJson('grant', json({ items: [line] }), CATALOG).lines[0].problem;
      expect(problem({ name: 'Blade', category: 'weapon' }))
        .toBe('A weapon needs "damage" — the dice and the damage type, like "1d8 slashing".');
      expect(problem({ name: 'Blade', category: 'weapon', damage: '  ' })).toContain('A weapon needs "damage"');
      expect(problem({ name: 'Vest', category: 'armor' })).toContain('Armor needs an "armorClass"');
      expect(problem({ name: 'Blade', category: 'weapon', damage: '1d8 slashing' })).toBeNull();
      expect(problem({ name: 'Shield', category: 'armor', armorClass: '+2' })).toBeNull();
      // Anything else needs neither.
      expect(problem({ name: 'Rope' })).toBeNull();
      expect(problem({ name: 'Ruby', category: 'treasure' })).toBeNull();
    });

    it('takes an explicit bulk on a custom item and shows it', () => {
      const check = checkImportJson('grant', json({ items: [
        { name: 'Ten-foot Pole', weight: 7, bulk: 6, valueGp: 0.05 },
        { name: 'Feather', weight: 0, bulk: 0.2 },
      ] }), CATALOG);
      expect(check.ok).toBeTrue();
      expect(check.lines.map(l => l.detail)).toEqual([
        'Custom gear · 7 lb · 6 bulk · 5 cp',
        'Custom gear · 0 lb · 0.2 bulk',
      ]);
      expect(check.loot?.items[0]).toEqual(jasmine.objectContaining({ name: 'Ten-foot Pole', weight: 7, bulk: 6 }));
    });

    it('refuses a bad bulk, and any bulk on a catalog item', () => {
      const problem = (line: object) =>
        checkImportJson('grant', json({ items: [line] }), CATALOG).lines[0].problem;
      expect(problem({ name: 'Rock', bulk: -1 })).toContain('bulk must be a non-negative number');
      expect(problem({ name: 'Rock', bulk: 'small' })).toContain('bulk must be a non-negative number');
      expect(problem({ key: 'longsword', bulk: 2 })).toContain('remove "bulk"');
    });

    it('refuses a fractional quantity, which the server cannot store', () => {
      const check = checkImportJson('loot', json({ items: [{ key: 'rations', qty: 2.5 }] }), CATALOG);
      expect(check.lines[0].problem).toBe('qty must be a whole number.');
    });

    it('refuses an empty grant', () => {
      const check = checkImportJson('grant', json({ items: [] }), CATALOG);
      expect(check.ok).toBeFalse();
      expect(check.problems[0]).toContain('empty');
    });

    it('flags an unknown field at the top', () => {
      const check = checkImportJson('loot', json({ gold: 5, items: [{ key: 'longsword' }] }), CATALOG);
      expect(check.ok).toBeFalse();
      expect(check.problems[0]).toContain('Unknown field "gold" at the top');
    });
  });

  // ── Coins ─────────────────────────────────────────────────────────────────

  describe('coins', () => {
    it('refuses coins in a grant, which hands over items only', () => {
      const check = checkImportJson('grant', json({ coinGp: 10, items: [{ name: 'Rope' }] }), CATALOG);
      expect(check.ok).toBeFalse();
      expect(check.problems).toEqual(['"coinGp" is for loot lists — remove it. This grants items only.']);
      expect(check.lines[0].problem).toBeNull(); // the line itself is fine
    });

    it('shows the coin pile for a loot list and keeps it in the payload', () => {
      const check = checkImportJson('loot', json({ coinGp: 125.5, items: [{ key: 'longsword' }] }), CATALOG);
      expect(check.ok).toBeTrue();
      expect(check.header).toBe('125 gp 5 sp to the coin pile');
      expect(check.loot?.coinGp).toBe(125.5);
    });

    it('accepts a loot list of coins only, and refuses one with nothing at all', () => {
      expect(checkImportJson('loot', json({ coinGp: 10, items: [] }), CATALOG).ok).toBeTrue();
      const nothing = checkImportJson('loot', json({ items: [] }), CATALOG);
      expect(nothing.ok).toBeFalse();
      expect(nothing.problems[0]).toContain('Nothing to import');
    });

    it('refuses a negative coin pile', () => {
      const check = checkImportJson('loot', json({ coinGp: -1, items: [] }), CATALOG);
      expect(check.problems.some(p => p.includes('"coinGp" must be a non-negative number'))).toBeTrue();
    });
  });

  // ── No catalog (the demo, or a failed load) ───────────────────────────────

  describe('without a catalog', () => {
    it('cannot take a key in a grant, but still takes custom items', () => {
      const check = checkImportJson('grant', json({ items: [{ key: 'longsword' }, { name: 'Rope' }] }), null);
      expect(check.ok).toBeFalse();
      expect(check.lines[0].problem).toContain('catalog is not available');
      expect(check.lines[1].problem).toBeNull();
    });

    it('leaves a loot or shop key for the server to check', () => {
      const loot = checkImportJson('loot', json({ items: [{ key: 'anything', qty: 2 }] }), null);
      expect(loot.ok).toBeTrue();
      expect(loot.lines[0].unverified).toBeTrue();
      expect(loot.lines[0].label).toBe('anything');
      expect(loot.lines[0].detail).toContain('checked when you import');

      const shop = checkImportJson('shop', json({ name: 'Smithy', items: [{ key: 'anything' }] }), null);
      expect(shop.ok).toBeTrue();
      expect(shop.lines[0].unverified).toBeTrue();
    });
  });

  // ── Shops ─────────────────────────────────────────────────────────────────

  describe('shop', () => {
    it('describes a good shop and hands back the normalized payload', () => {
      const check = checkImportJson('shop', json({
        name: ' The Gilded Flask ', settlement: 'Phandalin',
        items: [{ key: 'longsword', priceGp: 12 }, { key: 'rations' }],
      }), CATALOG);

      expect(check.ok).toBeTrue();
      expect(check.header).toBe('The Gilded Flask · Phandalin');
      expect(check.lines.map(l => [l.label, l.detail])).toEqual([
        ['Longsword', 'Weapon · 12 gp (catalog 15 gp)'],
        ['Rations (1 day)', 'Gear · 5 sp'],
      ]);
      expect(check.shop).toEqual({
        name: 'The Gilded Flask', settlement: 'Phandalin',
        items: [{ key: 'longsword', priceGp: 12 }, { key: 'rations', priceGp: null }],
      });
      expect(check.loot).toBeNull();
    });

    it('needs a name', () => {
      const check = checkImportJson('shop', json({ items: [{ key: 'longsword' }] }), CATALOG);
      expect(check.ok).toBeFalse();
      expect(check.problems).toEqual(['The shop needs a "name".']);
    });

    it('accepts an empty shop', () => {
      expect(checkImportJson('shop', json({ name: 'Smithy', items: [] }), CATALOG).ok).toBeTrue();
    });

    it('sells a custom item written out in full, next to catalog items', () => {
      const check = checkImportJson('shop', json({
        name: 'Curios',
        items: [
          { name: ' Flametongue ', category: 'weapon', priceGp: 5000, weight: 3, bulk: 2,
            damage: '1d8 slashing + 2d6 fire', notes: 'Requires: attunement. Ignites on command.' },
          { name: 'Mithral Shirt', category: 'armor', priceGp: 800, weight: 20, bulk: 6,
            armorClass: '13 + Dex modifier (max 2)' },
          { name: 'Lucky Coin', priceGp: 0.5 },
          { key: 'rations' },
        ],
      }), CATALOG);

      expect(check.problems).toEqual([]);
      expect(check.ok).toBeTrue();
      expect(check.lines.map(l => [l.label, l.detail])).toEqual([
        ['Flametongue', 'Custom weapon · 1d8 slashing + 2d6 fire · 3 lb · 2 bulk · 5000 gp'],
        ['Mithral Shirt', 'Custom armor · AC 13 + Dex modifier (max 2) · 20 lb · 6 bulk · 800 gp'],
        ['Lucky Coin', 'Custom gear · 5 sp'],
        ['Rations (1 day)', 'Gear · 5 sp'],
      ]);
      expect(check.shop?.items).toEqual([
        { name: 'Flametongue', priceGp: 5000, category: 'weapon', weight: 3, bulk: 2,
          damage: '1d8 slashing + 2d6 fire', notes: 'Requires: attunement. Ignites on command.' },
        { name: 'Mithral Shirt', priceGp: 800, category: 'armor', weight: 20, bulk: 6,
          armorClass: '13 + Dex modifier (max 2)' },
        { name: 'Lucky Coin', priceGp: 0.5 },
        { key: 'rations', priceGp: null },
      ]);
    });

    it('needs a price on a custom item, and a name or a key on every line', () => {
      const problem = (line: object) =>
        checkImportJson('shop', json({ name: 'Smithy', items: [line] }), CATALOG).lines[0].problem;
      expect(problem({ name: 'Lucky Coin' })).toContain('needs a "priceGp"');
      expect(problem({ name: 'Lucky Coin', valueGp: 5 })).toBe('Unknown field "valueGp" — use "priceGp".');
      expect(problem({ name: 'Lucky Coin', priceGp: 1, description: 'Shiny' }))
        .toBe('Unknown field "description" — use "notes".');
      expect(problem({})).toContain('Needs a "name"');
      expect(problem({ key: 'longsword', name: 'Longsword', priceGp: 1 })).toContain('both "key" and "name"');
      expect(problem({ name: 'Lucky Coin', priceGp: 1, qty: 3 })).toContain('unlimited stock');
    });

    it('holds a custom shop item to the same stat rules as any custom item', () => {
      const problem = (line: object) =>
        checkImportJson('shop', json({ name: 'Smithy', items: [line] }), CATALOG).lines[0].problem;
      expect(problem({ name: 'Blade', category: 'weapon', priceGp: 10 })).toContain('A weapon needs "damage"');
      expect(problem({ name: 'Vest', category: 'armor', priceGp: 10 })).toContain('Armor needs an "armorClass"');
      expect(problem({ name: 'Rock', category: 'gear', priceGp: 1, damage: '1d4' }))
        .toContain('damage applies to weapon items only');
      expect(problem({ name: 'Rock', category: 'relic', priceGp: 1 })).toContain('category must be one of');
      expect(problem({ name: 'Rock', priceGp: 1, bulk: -1 })).toContain('bulk must be a non-negative number');
    });

    it('lets a catalog line carry only its key and a price', () => {
      const check = checkImportJson('shop', json({
        name: 'Smithy', items: [{ key: 'longsword', priceGp: 12, weight: 3 }],
      }), CATALOG);
      expect(check.lines[0].problem).toContain('remove "weight"');
    });

    it('lets two custom lines share a name — only catalog items are listed once', () => {
      const check = checkImportJson('shop', json({
        name: 'Apothecary',
        items: [{ name: 'Healing Draught', priceGp: 50 }, { name: 'Healing Draught', priceGp: 75 }],
      }), CATALOG);
      expect(check.ok).toBeTrue();
    });

    it('refuses a quantity, a misnamed price and a bad price', () => {
      const problem = (line: object) =>
        checkImportJson('shop', json({ name: 'Smithy', items: [line] }), CATALOG).lines[0].problem;
      expect(problem({ key: 'longsword', qty: 3 })).toContain('unlimited stock');
      expect(problem({ key: 'longsword', price: 12 })).toBe('Unknown field "price" — use "priceGp".');
      expect(problem({ key: 'longsword', priceGp: -1 })).toContain('priceGp must be a non-negative number');
      expect(problem({ key: 'longsword', priceGp: '12' })).toContain('priceGp must be a non-negative number');
    });

    it('flags the second copy of an item, which the server would reject', () => {
      const check = checkImportJson('shop', json({
        name: 'Smithy', items: [{ key: 'longsword' }, { key: 'rations' }, { key: 'longsword' }],
      }), CATALOG);
      expect(check.ok).toBeFalse();
      expect(check.lines[0].problem).toBeNull();
      expect(check.lines[2].problem).toBe('Same item as line 1 — a shop lists each item once.');
    });

    it('flags an unknown key with a suggestion', () => {
      const check = checkImportJson('shop', json({ name: 'Smithy', items: [{ key: 'chainmail' }] }), CATALOG);
      expect(check.lines[0].problem).toBe('Unknown catalog key.');
      expect(check.lines[0].suggestion?.key).toBe('chain-mail');
    });
  });
});

describe('closestCatalogItem', () => {
  it('finds an exact key or name whatever the capitals and punctuation', () => {
    expect(closestCatalogItem('LONGSWORD', CATALOG)?.itemKey).toBe('longsword');
    expect(closestCatalogItem('Rope, Hempen (50 feet)', CATALOG)?.itemKey).toBe('rope-hempen');
  });

  it('finds the same words in another order, a part of the name, and a small typo', () => {
    expect(closestCatalogItem('hempen rope', CATALOG)?.itemKey).toBe('rope-hempen');
    expect(closestCatalogItem('rope', CATALOG)?.itemKey).toBe('rope-hempen');
    expect(closestCatalogItem('chain male', CATALOG)?.itemKey).toBe('chain-mail');
  });

  it('prefers the nearest of two similar keys', () => {
    expect(closestCatalogItem('shortsord', CATALOG)?.itemKey).toBe('shortsword');
    expect(closestCatalogItem('longbo', CATALOG)?.itemKey).toBe('longbow');
  });

  it('gives nothing when nothing is close', () => {
    expect(closestCatalogItem('bag-of-holding', CATALOG)).toBeNull();
    expect(closestCatalogItem('axe', CATALOG)).toBeNull();
    expect(closestCatalogItem('   ', CATALOG)).toBeNull();
  });
});

describe('applyKeySuggestion', () => {
  it('swaps the key on the chosen line and leaves the rest alone', () => {
    const raw = json({ items: [{ key: 'longsord', qty: 2 }, { name: 'Ruby' }] });
    expect(JSON.parse(applyKeySuggestion(raw, 1, 'longsword')))
      .toEqual({ items: [{ key: 'longsword', qty: 2 }, { name: 'Ruby' }] });
  });

  it('turns a shop "name" line or a bare string into a key line', () => {
    const shop = json({ name: 'Smithy', items: [{ name: 'Chain Mail', priceGp: 80 }] });
    expect(JSON.parse(applyKeySuggestion(shop, 1, 'chain-mail')))
      .toEqual({ name: 'Smithy', items: [{ key: 'chain-mail', priceGp: 80 }] });
    expect(JSON.parse(applyKeySuggestion(json({ items: ['Longsword'] }), 1, 'longsword')))
      .toEqual({ items: [{ key: 'longsword' }] });
  });

  it('gives back plain JSON for a fenced AI reply, and the fixed paste then passes', () => {
    const reply = 'Sure:\n```json\n{ "items": [ { "key": "longsord" } ] }\n```';
    const fixed = applyKeySuggestion(reply, 1, 'longsword');
    expect(fixed.startsWith('{')).toBeTrue();
    expect(checkImportJson('grant', fixed, CATALOG).ok).toBeTrue();
  });

  it('leaves the text alone when it cannot be read or the line is not there', () => {
    expect(applyKeySuggestion('{oops', 1, 'longsword')).toBe('{oops');
    const raw = json({ items: [{ key: 'longsord' }] });
    expect(applyKeySuggestion(raw, 5, 'longsword')).toBe(raw);
  });
});
