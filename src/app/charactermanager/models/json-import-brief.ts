/**
 * The "Copy AI instructions" text for each paste box: the exact format, the
 * rules the live check enforces, and an example. A DM pastes it into an AI
 * chat together with the items they want — usually lifted from the adventure
 * they are running — so the reply comes back in a shape the box accepts.
 *
 * The AI is told to write every item out in full and never to look one up:
 * an earlier version listed the catalog and let the AI prefer it, and it
 * swapped the adventure's own items for look-alikes from the list. The
 * standard catalog is still there for the DM (the Catalog tab, "Import a
 * standard category", and a "key" line in a paste) — it is just not something
 * the AI is asked to choose from.
 *
 * Kept next to the check on purpose — a rule added there belongs in the
 * wording here too, and a test holds the example to the check.
 */

import { JsonImportKind } from './json-import-check';

const REPLY_RULES =
  'Reply with ONE JSON object in a code block and nothing else: no commentary, no comments inside '
  + 'the JSON, no trailing commas, straight double quotes only.';

const FAITHFUL_RULES = [
  'I will give you the items — from the adventure I am running, or described in my own words.',
  'Write out EVERY item I give you, in the order I give them, exactly as it is: keep its name, its',
  'numbers and what it does. Do not swap an item for a similar or more standard one, do not rename',
  'it, do not merge two items, do not leave one out, and do not add items I did not ask for.',
  'If the source leaves out something a field needs (a weight, a price), use the usual D&D 5e value',
  'for that kind of item and carry on — never drop the item.',
];

/** The field rules shared by every box; `price` is the one field whose name differs. */
function itemFields(price: 'valueGp' | 'priceGp', withQty: boolean): string[] {
  const priceLine = price === 'valueGp'
    ? '- "valueGp" — always include it: what ONE is worth in gold, 0 or more. Fractions are fine '
      + '(0.5 = 5 silver, 0.01 = 1 copper).'
    : '- "priceGp" — required: what this shop charges for ONE in gold, 0 or more. Fractions are fine '
      + '(0.5 = 5 silver, 0.01 = 1 copper).';
  return [
    '- "name" — required: the item\'s name, exactly as given.',
    '- "category" — required: one of "weapon", "armor", "material-component", "gear", "transport", '
      + '"treasure". Shields are "armor". Potions, wondrous items, tools and anything that fits '
      + 'nowhere else are "gear". Gems, art and valuables are "treasure".',
    ...(withQty ? ['- "qty" — how many: a whole number, 1 or more. Leave it out for one.'] : []),
    priceLine,
    '- "weight" — always include it: the weight of ONE in pounds, 0 or more. Use 0 for something '
      + 'with no real weight (a ring, a gem, a scroll).',
    '- "bulk" — always include it: how much room ONE takes up in a pack. Use this scale, picking by '
      + 'size and weight, and go one step up for something long or awkward to carry:',
    '    0.2 = tiny, next to no weight (a ring, a coin, a gem, a scroll)',
    '    1   = small, up to about 2 lb (a dagger, a potion, a wand)',
    '    2   = medium, up to about 5 lb (a longsword, a shortbow, a spellbook)',
    '    3   = large, up to about 10 lb (a greatsword, a shield, a longbow)',
    '    6   = very large, up to about 35 lb (a suit of light or medium armor, a tent)',
    '    9   = huge, heavier than that (a suit of heavy armor, a chest)',
    '- "damage" — required when "category" is "weapon", and not allowed otherwise: the damage dice '
      + 'AND the damage type, with any bonus, e.g. "1d8 slashing", "1d8 + 1 piercing", '
      + '"1d8 slashing + 2d6 fire".',
    '- "armorClass" — required when "category" is "armor", and not allowed otherwise. Write it in '
      + 'exactly one of these four forms, with the item\'s own number: "11 + Dex modifier" (light '
      + 'armor), "14 + Dex modifier (max 2)" (medium armor), "18" (heavy armor: a plain number), '
      + '"+2" (a shield: a plus sign and its bonus). Include a magic bonus in the number '
      + '(+1 chain mail is "17").',
    '- "notes" — the description. If the item has any requirement to use it, START with it: '
      + '"Requires: attunement by a paladin." or "Requires: Strength 15." Then say what the item '
      + 'does in plain sentences: weapon properties (finesse, versatile 1d10, range), charges, '
      + 'magical effects, anything a player needs at the table. Leave "notes" out only when there '
      + 'is truly nothing to say.',
  ];
}

const FIELD_NAME_RULE_ITEMS =
  'Use only these field names, spelled exactly: "qty" (not "quantity"), "valueGp" (not "price" or '
  + '"value"), "notes" (not "description"), "armorClass" (not "ac"). Any other field is rejected.';

const FIELD_NAME_RULE_SHOP =
  'Use only these field names, spelled exactly: "priceGp" (not "price", "cost" or "valueGp"), '
  + '"notes" (not "description"), "armorClass" (not "ac"). Any other field is rejected. A shop has '
  + 'unlimited stock, so an item has no quantity.';

const EXAMPLE_ITEMS = [
  { name: 'Flametongue Longsword', category: 'weapon', valueGp: 5000, weight: 3, bulk: 2,
    damage: '1d8 slashing + 2d6 fire',
    notes: 'Requires: attunement. Versatile (1d10). Speak the command word as a bonus action to set '
      + 'the blade alight; it sheds bright light for 40 feet.' },
  { name: 'Mithral Chain Shirt', category: 'armor', valueGp: 800, weight: 20, bulk: 6,
    armorClass: '13 + Dex modifier (max 2)',
    notes: 'No disadvantage on Stealth checks and no Strength requirement.' },
  { name: 'Sentinel Shield', category: 'armor', valueGp: 500, weight: 6, bulk: 3,
    armorClass: '+2',
    notes: 'Advantage on initiative rolls and on Wisdom (Perception) checks while holding it.' },
  { name: 'Potion of Greater Healing', category: 'gear', qty: 3, valueGp: 150, weight: 0.5, bulk: 1,
    notes: 'Drink as a bonus action to regain 4d4 + 4 hit points.' },
  { name: 'Uncut Ruby', category: 'treasure', valueGp: 250, weight: 0, bulk: 0.2 },
];

/** The example as a shop sells it: a price instead of a value, and no quantity. */
function shopExampleItems(): object[] {
  return EXAMPLE_ITEMS.map(item => {
    const { valueGp, qty: _qty, ...rest } = item as typeof item & { qty?: number };
    const { name, category, ...stats } = rest;
    return { name, category, priceGp: valueGp, ...stats };
  });
}

function itemListBrief(kind: 'grant' | 'loot'): string[] {
  const loot = kind === 'loot';
  return [
    loot
      ? 'You are formatting a loot list for Table Mimic, a D&D 5e campaign app.'
      : 'You are formatting items for Table Mimic, a D&D 5e campaign app, so they can be handed to a character.',
    ...FAITHFUL_RULES,
    '',
    REPLY_RULES,
    '',
    'SHAPE',
    loot ? '{ "coinGp": 125.5, "items": [ <item>, <item>, … ] }' : '{ "items": [ <item>, <item>, … ] }',
    ...(loot
      ? ['"coinGp" is optional: loose coins found with the loot, in gold, 0 or more, fractions allowed. '
          + 'Leave it out when there are none.']
      : []),
    '',
    'EACH <item> HAS THESE FIELDS',
    ...itemFields('valueGp', true),
    '',
    FIELD_NAME_RULE_ITEMS,
    '',
    'EXAMPLE',
    JSON.stringify({ ...(loot ? { coinGp: 125.5 } : {}), items: EXAMPLE_ITEMS }, null, 2),
  ];
}

function shopBrief(): string[] {
  return [
    'You are formatting a shop for Table Mimic, a D&D 5e campaign app.',
    ...FAITHFUL_RULES,
    '',
    REPLY_RULES,
    '',
    'SHAPE',
    '{ "name": "The Gilded Flask", "settlement": "Phandalin", "items": [ <item>, <item>, … ] }',
    '- "name" — required: the shop\'s name.',
    '- "settlement" — optional: the town or place the shop is in.',
    '',
    'EACH <item> HAS THESE FIELDS',
    ...itemFields('priceGp', false),
    '',
    FIELD_NAME_RULE_SHOP,
    '',
    'EXAMPLE',
    JSON.stringify({ name: 'The Gilded Flask', settlement: 'Phandalin', items: shopExampleItems() }, null, 2),
  ];
}

/** The instructions for one paste box. */
export function buildAiBrief(kind: JsonImportKind): string {
  const lines = kind === 'shop' ? shopBrief() : itemListBrief(kind);
  return lines.join('\n') + '\n';
}
