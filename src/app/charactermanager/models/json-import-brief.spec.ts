import { CatalogItem } from './shop';
import { buildAiBrief } from './json-import-brief';
import { JsonImportKind, checkImportJson } from './json-import-check';

const item = (itemKey: string, name: string, category: string, costCp: number): CatalogItem =>
  ({ itemKey, name, category, costCp, bulk: 1, details: {} });

const CATALOG: CatalogItem[] = [
  item('shortsword', 'Shortsword', 'WEAPON', 1000),
  item('longsword', 'Longsword', 'WEAPON', 1500),
  item('chain-mail', 'Chain Mail', 'ARMOR', 7500),
  item('rations', 'Rations (1 day)', 'GEAR', 50),
  item('pony', 'Pony', 'TRANSPORT', 3000),
];

/** The example JSON printed in a brief — the block after the EXAMPLE heading. */
function exampleIn(brief: string): string {
  const after = brief.slice(brief.indexOf('EXAMPLE\n') + 'EXAMPLE\n'.length);
  const end = after.indexOf('\n}\n');
  return after.slice(0, end + 2);
}

describe('buildAiBrief', () => {
  it('lists every catalog key under its category, sorted, with name and price', () => {
    const brief = buildAiBrief('grant', CATALOG);
    expect(brief).toContain('CATALOG KEYS');
    expect(brief).toContain('Weapons:\n  longsword — Longsword, 15 gp\n  shortsword — Shortsword, 10 gp');
    expect(brief).toContain('Armor:\n  chain-mail — Chain Mail, 75 gp');
    expect(brief).toContain('Transport:\n  pony — Pony, 30 gp');
    for (const entry of CATALOG) expect(brief).toContain(`  ${entry.itemKey} — `);
  });

  it('lists an item from a category it has no heading for', () => {
    const brief = buildAiBrief('grant', [...CATALOG, item('odd-thing', 'Odd Thing', 'RELIC', 100)]);
    expect(brief).toContain('Other:\n  odd-thing — Odd Thing, 1 gp');
  });

  it('spells out the field names an AI tends to get wrong', () => {
    const brief = buildAiBrief('loot', CATALOG);
    expect(brief).toContain('"qty" (not "quantity")');
    expect(brief).toContain('"valueGp" (not "price"');
    expect(brief).toContain('Never invent a key');
    expect(brief).toContain('"coinGp"');
  });

  it('keeps coins out of the grant instructions', () => {
    expect(buildAiBrief('grant', CATALOG)).not.toContain('coinGp');
  });

  it('tells a shop to use catalog keys only, each once, with no quantity', () => {
    const brief = buildAiBrief('shop', CATALOG);
    expect(brief).toContain('"name" is required');
    expect(brief).toContain('"priceGp"');
    expect(brief).toContain('there are no custom items');
    expect(brief).toContain('List each key once');
    expect(brief).not.toContain('valueGp');
  });

  it('gives custom-item-only instructions when there is no catalog', () => {
    const brief = buildAiBrief('grant', []);
    expect(brief).toContain('do not use a "key" field');
    expect(brief).not.toContain('CATALOG KEYS');
    expect(checkImportJson('grant', exampleIn(brief), null).ok).toBeTrue();
  });

  // The instructions and the check must never drift apart: whatever example
  // the AI is shown has to be something the box accepts.
  (['grant', 'loot', 'shop'] as JsonImportKind[]).forEach(kind => {
    it(`shows a ${kind} example that passes the check`, () => {
      const check = checkImportJson(kind, exampleIn(buildAiBrief(kind, CATALOG)), CATALOG);
      expect(check.problems).toEqual([]);
      expect(check.lines.filter(l => l.problem)).toEqual([]);
      expect(check.ok).toBeTrue();
    });
  });

  it('builds its example from keys the catalog really has', () => {
    const small = [item('dagger', 'Dagger', 'WEAPON', 200), item('torch', 'Torch', 'GEAR', 1)];
    const check = checkImportJson('shop', exampleIn(buildAiBrief('shop', small)), small);
    expect(check.ok).toBeTrue();
    expect(check.shop?.items.map(i => i.key)).toEqual(['dagger', 'torch']);
  });
});
