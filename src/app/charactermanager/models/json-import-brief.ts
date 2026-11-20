/**
 * The "Copy AI instructions" text for each paste box: the exact format, the
 * rules the live check enforces, an example, and every valid catalog key. A DM
 * pastes it into an AI chat before asking for items, so the reply comes back
 * in a shape the box accepts first time. Kept next to the check on purpose —
 * a rule added there belongs in the wording here too.
 */

import { CatalogItem, formatCp } from './shop';
import { JsonImportKind } from './json-import-check';

const CATEGORY_HEADINGS: ReadonlyArray<[string, string]> = [
  ['WEAPON', 'Weapons'],
  ['ARMOR', 'Armor'],
  ['GEAR', 'Gear'],
  ['MATERIAL_COMPONENT', 'Material components'],
  ['TRANSPORT', 'Transport'],
];

const REPLY_RULES =
  'Reply with ONE JSON object in a code block and nothing else: no commentary, no comments inside '
  + 'the JSON, no trailing commas, straight double quotes only.';

const CATALOG_ITEM_RULES = [
  '   - "key" must be copied exactly from the CATALOG KEYS list at the end. Never invent a key.',
  '   - "qty" is optional (default 1): a whole number, 1 or more.',
  '   - No other fields. A catalog item takes its name, price and stats from the catalog.',
];

const CUSTOM_ITEM_RULES = [
  '   - "name" is required. Use a custom item for anything that is not in the catalog.',
  '   - "qty" is optional (default 1): a whole number, 1 or more.',
  '   - "category" is optional (default "gear"): one of "weapon", "armor", "material-component", '
    + '"gear", "transport", "treasure".',
  '   - "valueGp" is optional: the value of ONE item in gold, 0 or more. Fractions are fine (0.5 = 5 silver).',
  '   - "weight" is optional: the weight of ONE item in pounds, 0 or more.',
  '   - "damage" is optional text, allowed only when "category" is "weapon" (e.g. "1d8 slashing").',
  '   - "armorClass" is optional text, allowed only when "category" is "armor" '
    + '(e.g. "14 + Dex modifier (max 2)").',
  '   - "notes" is optional text: what the item does, in a sentence or two.',
];

const FIELD_NAME_RULE =
  'Use only the field names above, spelled exactly: "qty" (not "quantity"), "valueGp" (not "price" '
  + 'or "value"), "notes" (not "description"). Any other field is rejected.';

/** Two keys for the example that really are in this catalog (the usual pair when present). */
function exampleKeys(catalog: CatalogItem[]): [string, string] {
  const pick = (preferred: string, category: string, fallback: string): string =>
    catalog.some(i => i.itemKey === preferred)
      ? preferred
      : catalog.find(i => i.category === category && i.itemKey !== fallback)?.itemKey ?? fallback;
  const first = pick('longsword', 'WEAPON', catalog[0]?.itemKey ?? 'longsword');
  return [first, pick('rations', 'GEAR', first)];
}

function catalogSection(catalog: CatalogItem[]): string[] {
  const lines = ['CATALOG KEYS (key — name, catalog price)'];
  for (const [category, heading] of CATEGORY_HEADINGS) {
    const items = catalog.filter(i => i.category === category)
      .sort((a, b) => a.itemKey.localeCompare(b.itemKey));
    if (!items.length) continue;
    lines.push('', `${heading}:`);
    for (const item of items) lines.push(`  ${item.itemKey} — ${item.name}, ${formatCp(item.costCp)}`);
  }
  // Anything in a category this file does not know yet still gets listed.
  const known = new Set(CATEGORY_HEADINGS.map(([category]) => category));
  const other = catalog.filter(i => !known.has(i.category));
  if (other.length) {
    lines.push('', 'Other:');
    for (const item of other) lines.push(`  ${item.itemKey} — ${item.name}, ${formatCp(item.costCp)}`);
  }
  return lines;
}

function itemListBrief(kind: 'grant' | 'loot', catalog: CatalogItem[]): string[] {
  const hasCatalog = catalog.length > 0;
  const loot = kind === 'loot';
  const lines = [
    loot
      ? 'You are writing a loot list for Table Mimic, a D&D 5e campaign app.'
      : 'You are writing a list of items to hand to a character in Table Mimic, a D&D 5e campaign app.',
    REPLY_RULES,
    '',
    'SHAPE',
    loot ? '{ "coinGp": 125.5, "items": [ <item>, <item>, … ] }' : '{ "items": [ <item>, <item>, … ] }',
  ];
  if (loot) {
    lines.push('"coinGp" is optional: gold added to the coin pile, 0 or more, fractions allowed. '
      + 'Leave it out when there are no coins.');
  }
  lines.push('');
  if (hasCatalog) {
    lines.push(
      'Each <item> is exactly ONE of these two kinds:',
      '',
      '1. A catalog item — { "key": "longsword", "qty": 2 }',
      ...CATALOG_ITEM_RULES,
      '',
      '2. A custom item — { "name": "Flametongue", "category": "weapon", "valueGp": 5000 }',
      ...CUSTOM_ITEM_RULES,
      '',
      'Never give one item both "key" and "name". Prefer a catalog item whenever the list has it.',
    );
  } else {
    lines.push(
      'Each <item> is a custom item — { "name": "Flametongue", "category": "weapon", "valueGp": 5000 }',
      ...CUSTOM_ITEM_RULES,
      '',
      'There is no item catalog here, so do not use a "key" field.',
    );
  }
  lines.push(FIELD_NAME_RULE, '', 'EXAMPLE');
  const [firstKey, secondKey] = exampleKeys(catalog);
  const example = {
    ...(loot ? { coinGp: 125.5 } : {}),
    items: [
      ...(hasCatalog ? [{ key: firstKey }, { key: secondKey, qty: 10 }] : []),
      { name: 'Flametongue', category: 'weapon', valueGp: 5000, weight: 3,
        damage: '1d8 slashing + 2d6 fire', notes: 'Ignites on command.' },
      { name: 'Ruby', category: 'treasure', qty: 3, valueGp: 50 },
    ],
  };
  lines.push(JSON.stringify(example, null, 2));
  if (hasCatalog) lines.push('', ...catalogSection(catalog));
  return lines;
}

function shopBrief(catalog: CatalogItem[]): string[] {
  const [firstKey, secondKey] = exampleKeys(catalog);
  return [
    'You are writing a shop for Table Mimic, a D&D 5e campaign app.',
    REPLY_RULES,
    '',
    'SHAPE',
    '{ "name": "The Gilded Flask", "settlement": "Phandalin", "items": [ <item>, <item>, … ] }',
    '   - "name" is required: the shop\'s name.',
    '   - "settlement" is optional: where the shop is.',
    '',
    'Each <item> is a catalog item — { "key": "longsword", "priceGp": 12 }',
    '   - "key" must be copied exactly from the CATALOG KEYS list at the end. Never invent a key. '
      + 'A shop sells catalog items only: there are no custom items.',
    '   - "priceGp" is optional: this shop\'s price for the item in gold, 0 or more, fractions allowed '
      + '(0.5 = 5 silver). Leave it out to sell at the catalog price.',
    '   - List each key once. A shop has unlimited stock, so there is no quantity.',
    '',
    'Use only the field names above, spelled exactly: "priceGp" (not "price" or "cost"). '
      + 'Any other field is rejected.',
    '',
    'EXAMPLE',
    JSON.stringify({
      name: 'The Gilded Flask', settlement: 'Phandalin',
      items: [{ key: firstKey, priceGp: 12 }, { key: secondKey }],
    }, null, 2),
    '',
    ...catalogSection(catalog),
  ];
}

/**
 * The instructions for one paste box. `catalog` is every catalog item; an
 * empty list (the demo) gives item-list instructions that use custom items
 * only. A shop cannot be written without the catalog — callers do not offer
 * the button there.
 */
export function buildAiBrief(kind: JsonImportKind, catalog: CatalogItem[]): string {
  const lines = kind === 'shop' ? shopBrief(catalog) : itemListBrief(kind, catalog);
  return lines.join('\n') + '\n';
}
