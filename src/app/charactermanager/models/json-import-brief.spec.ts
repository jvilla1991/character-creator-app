import { CatalogItem } from './shop';
import { buildAiBrief } from './json-import-brief';
import { JsonImportKind, checkImportJson } from './json-import-check';

/** The example JSON printed in a brief — everything after the EXAMPLE heading. */
function exampleIn(brief: string): string {
  return brief.slice(brief.indexOf('EXAMPLE\n') + 'EXAMPLE\n'.length);
}

const KINDS: JsonImportKind[] = ['grant', 'loot', 'shop'];

describe('buildAiBrief', () => {
  // The whole point of the rewrite: the AI formats the DM's items, it does not
  // go shopping in a list. No catalog, no keys, and an explicit "do not swap".
  KINDS.forEach(kind => {
    it(`tells the AI to write every ${kind} item out in full and never to swap one`, () => {
      const brief = buildAiBrief(kind);
      expect(brief).toContain('Write out EVERY item I give you');
      expect(brief).toContain('Do not swap an item for a similar or more standard one');
      expect(brief).toContain('do not leave one out');
      expect(brief).not.toContain('CATALOG');
      expect(brief).not.toContain('"key"');
    });

    it(`asks for the stats the table needs on a ${kind} item`, () => {
      const brief = buildAiBrief(kind);
      expect(brief).toContain('"name" — required');
      expect(brief).toContain('"weight" — always include it');
      expect(brief).toContain('"bulk" — always include it');
      expect(brief).toContain('"damage" — required when "category" is "weapon"');
      expect(brief).toContain('the damage type');
      expect(brief).toContain('"armorClass" — required when "category" is "armor"');
      expect(brief).toContain('"14 + Dex modifier (max 2)"');
      expect(brief).toContain('START with it');
      expect(brief).toContain('Requires:');
    });

    // The instructions and the check must never drift apart: whatever example
    // the AI is shown has to be something the box accepts, with or without a
    // catalog to hand.
    it(`shows a ${kind} example that passes the check`, () => {
      const catalog: CatalogItem[] = [
        { itemKey: 'longsword', name: 'Longsword', category: 'WEAPON', costCp: 1500, bulk: 2, details: {} },
      ];
      for (const available of [catalog, null]) {
        const check = checkImportJson(kind, exampleIn(buildAiBrief(kind)), available);
        expect(check.problems).toEqual([]);
        expect(check.lines.filter(l => l.problem)).toEqual([]);
        expect(check.ok).toBeTrue();
        expect(check.lines.length).toBe(5);
      }
    });
  });

  it('gives the bulk scale so the AI can rate an item', () => {
    const brief = buildAiBrief('grant');
    for (const step of ['0.2 = tiny', '1   = small', '2   = medium', '3   = large', '6   = very large', '9   = huge']) {
      expect(brief).toContain(step);
    }
  });

  it('uses a value and a quantity for items handed out, and coins only for loot', () => {
    const grant = buildAiBrief('grant');
    expect(grant).toContain('"valueGp" — always include it');
    expect(grant).toContain('"qty" — how many');
    expect(grant).toContain('"qty" (not "quantity")');
    expect(grant).not.toContain('coinGp');
    expect(grant).not.toContain('priceGp');

    expect(buildAiBrief('loot')).toContain('"coinGp" is optional');
  });

  it('uses a price and no quantity for a shop', () => {
    const brief = buildAiBrief('shop');
    expect(brief).toContain('"name" — required: the shop\'s name');
    expect(brief).toContain('"priceGp" — required');
    expect(brief).toContain('"priceGp" (not "price", "cost" or "valueGp")');
    expect(brief).toContain('an item has no quantity');
    expect(brief).not.toContain('"qty"');
    expect(brief).not.toContain('"valueGp" —');

    const check = checkImportJson('shop', exampleIn(brief), null);
    expect(check.shop?.name).toBe('The Gilded Flask');
    expect(check.shop?.items[0]).toEqual(jasmine.objectContaining({
      name: 'Flametongue Longsword', category: 'weapon', priceGp: 5000, weight: 3, bulk: 2,
      damage: '1d8 slashing + 2d6 fire',
    }));
    expect(check.shop?.items[0].notes).toContain('Requires: attunement.');
  });
});
