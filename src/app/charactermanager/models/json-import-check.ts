/**
 * The live check behind every "paste JSON" box — the DM item grant, a curated
 * loot list and a curated shop. It reads the pasted text and reports, line by
 * line, what each entry will become or what is wrong with it. Unlike the
 * parsers it sits on top of (which stop at the first error), it reports every
 * problem at once, so a paste with four mistakes is fixed in one pass.
 *
 * It is stricter than the server in one deliberate way: a field it does not
 * know ("quantity" for "qty", "price" for "valueGp") is a problem, not
 * something to skip. The server would ignore such a field without a word, and
 * the item would arrive with a quantity of 1 or no value — the quiet kind of
 * wrong this check exists to catch.
 *
 * Pure functions, no Angular: the component only wires them to a text box.
 */

import { PcItem } from './pc';
import { CatalogItem, categoryLabelFor, formatCp } from './shop';
import { LootImportPayload, lootImportItemProblem, parseLootImportPayload } from './loot';
import { ShopImportPayload, parseImportPayload } from './curated-shop';

/** Which paste box: items into an inventory, a loot list, or a whole shop. */
export type JsonImportKind = 'grant' | 'loot' | 'shop';

export interface CheckedLine {
  /** 1-based position in "items" — what the DM counts to find the line. */
  n: number;
  /** The catalog name, the custom name, or whatever was written when unknown. */
  label: string;
  /** For a good line: quantity, category and price, ready to show. */
  detail: string;
  /** What is wrong with the line, or null when it is fine. */
  problem: string | null;
  /** For a key the catalog does not have: the closest real item. */
  suggestion: { key: string; name: string } | null;
  /** The key could not be looked up here; the server checks it on save. */
  unverified: boolean;
}

export interface ImportCheck {
  /** 'empty' — nothing pasted; 'syntax' — not JSON yet; 'checked' — read and inspected. */
  state: 'empty' | 'syntax' | 'checked';
  /** Problems with the paste as a whole (not one line). */
  problems: string[];
  /** A one-line note about the whole paste: the shop's name, the coin pile. */
  header: string | null;
  lines: CheckedLine[];
  /** True when the paste can be saved as it stands. */
  ok: boolean;
  /** The normalized payload for a grant or a loot list; null unless `ok`. */
  loot: LootImportPayload | null;
  /** The normalized payload for a shop; null unless `ok`. */
  shop: ShopImportPayload | null;
}

export const EMPTY_IMPORT_CHECK: ImportCheck = {
  state: 'empty', problems: [], header: null, lines: [], ok: false, loot: null, shop: null,
};

const ITEM_FIELDS = ['key', 'name', 'qty', 'category', 'valueGp', 'weight', 'damage', 'armorClass', 'notes'];
const SHOP_ITEM_FIELDS = ['key', 'priceGp'];

/** What an AI tends to write instead of the real field name (lowercase, no separators). */
const ITEM_ALIASES: Record<string, string> = {
  quantity: 'qty', count: 'qty', amount: 'qty', number: 'qty',
  id: 'key', itemkey: 'key', catalogkey: 'key', slug: 'key', item: 'key',
  title: 'name', itemname: 'name',
  description: 'notes', desc: 'notes', note: 'notes', effect: 'notes',
  type: 'category',
  value: 'valueGp', price: 'valueGp', cost: 'valueGp', pricegp: 'valueGp', costgp: 'valueGp', gp: 'valueGp',
  weightlb: 'weight', lb: 'weight', lbs: 'weight',
  dmg: 'damage', ac: 'armorClass',
};
const SHOP_ALIASES: Record<string, string> = {
  id: 'key', itemkey: 'key', catalogkey: 'key', slug: 'key', item: 'key',
  price: 'priceGp', cost: 'priceGp', value: 'priceGp', valuegp: 'priceGp', costgp: 'priceGp', gp: 'priceGp',
};

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function filled(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim();
}

function quoted(names: string[]): string {
  return names.map(n => `"${n}"`).join(', ');
}

function gp(valueGp: number): string {
  return formatCp(Math.round(valueGp * 100));
}

function categoryName(category: PcItem['category'] | string): string {
  switch (category) {
    case 'weapon': return 'Weapon';
    case 'armor': return 'Armor';
    case 'material-component': return 'Material';
    case 'gear': return 'Gear';
    case 'transport': return 'Transport';
    case 'treasure': return 'Treasure';
    default: return String(category);
  }
}

// ── Reading the text ─────────────────────────────────────────────────────────

/**
 * An AI reply is often copied whole — a sentence, then the JSON inside a
 * ```json fence. Take the fenced part when the text does not already start
 * with JSON. `lineOffset` is how many lines sit above it, so a syntax error
 * can still name the line the DM sees in the box.
 */
function extractJson(raw: string): { text: string; lineOffset: number } {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return { text: raw, lineOffset: 0 };
  const fence = /```[a-zA-Z]*[ \t]*\r?\n?([\s\S]*?)```/.exec(raw);
  if (!fence) return { text: raw, lineOffset: 0 };
  const start = fence.index + fence[0].indexOf(fence[1]);
  return { text: fence[1], lineOffset: raw.slice(0, start).split('\n').length - 1 };
}

/** Say what is wrong with text that is not JSON, as specifically as the browser allows. */
function syntaxProblem(text: string, err: unknown, lineOffset: number): string {
  if (/[“”]/.test(text)) {
    return 'Not valid JSON — it uses curly “smart” quotes. Replace them with straight " quotes.';
  }
  const message = err instanceof Error ? err.message : '';
  const lineColumn = /line (\d+) column \d+/.exec(message);
  const position = /position (\d+)/.exec(message);
  // The browser gave up at the very end of the text: something was never closed.
  const ranOut = position != null && Number(position[1]) >= text.trimEnd().length;
  if (ranOut || /end of JSON|Unterminated/i.test(message)) {
    return 'Not valid JSON — it stops early. A closing ] or } is missing (the reply may have been cut off).';
  }
  let line: number | null = null;
  if (lineColumn) line = Number(lineColumn[1]);
  else if (position) line = text.slice(0, Number(position[1])).split('\n').length;
  const where = line != null ? ` Look near line ${line + lineOffset}.` : '';
  if (/,\s*[}\]]/.test(text)) {
    return `Not valid JSON — there is a comma right before a closing bracket. Remove that last comma.${where}`;
  }
  return `Not valid JSON — check for missing quotes, commas, or braces.${where}`;
}

// ── Catalog lookup and "did you mean" ───────────────────────────────────────

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

const FILLER_WORDS = new Set(['of', 'the', 'a', 'an']);

function words(slugged: string): string[] {
  return slugged.split('-').filter(w => w && !FILLER_WORDS.has(w));
}

/**
 * The catalog item a wrong key most likely meant, or null when nothing is
 * close. Tries, in order of confidence: the same text as a key or a name
 * ("Potion of Healing"), the same words in another order ("healing-potion"),
 * one inside the other ("potion"), then a small typo ("longsord").
 */
export function closestCatalogItem(text: string, catalog: CatalogItem[]): CatalogItem | null {
  const want = slug(text);
  if (!want) return null;
  const wantWords = words(want);
  let best: CatalogItem | null = null;
  let bestScore = Infinity;
  for (const item of catalog) {
    for (const candidate of [slug(item.itemKey), slug(item.name)]) {
      if (candidate === want) return item;
      const candidateWords = words(candidate);
      let score: number;
      if (wantWords.length && wantWords.length === candidateWords.length
          && wantWords.every(w => candidateWords.includes(w))) {
        score = 0.5;
      } else if (want.length >= 3 && (candidate.includes(want) || want.includes(candidate))) {
        score = 1 + Math.abs(candidate.length - want.length) / 100;
      } else {
        const distance = editDistance(want, candidate);
        // A typo is a letter or two, scaled to the word: "bow" must not match "box".
        const allowed = Math.min(3, Math.max(1, Math.floor(want.length / 4)));
        score = distance <= allowed ? 2 + distance : Infinity;
      }
      if (score < bestScore) { bestScore = score; best = item; }
    }
  }
  return best;
}

function suggest(text: string, catalog: CatalogItem[] | null): CheckedLine['suggestion'] {
  const match = catalog ? closestCatalogItem(text, catalog) : null;
  return match ? { key: match.itemKey, name: match.name } : null;
}

// ── Field names ──────────────────────────────────────────────────────────────

function unknownFieldProblem(field: string, allowed: string[], aliases: Record<string, string>): string {
  const sameLetters = allowed.find(a => a.toLowerCase() === field.toLowerCase());
  const meant = sameLetters ?? aliases[field.toLowerCase().replace(/[^a-z0-9]/g, '')];
  return meant && allowed.includes(meant)
    ? `Unknown field "${field}" — use "${meant}".`
    : `Unknown field "${field}" — remove it. Allowed: ${quoted(allowed)}.`;
}

// ── One line ─────────────────────────────────────────────────────────────────

const BARE_VALUE = 'Must be an object in braces, like {"key": "longsword"} — not a bare value.';
const NO_CATALOG = 'The catalog is not available here, so a "key" cannot be looked up — use a "name" item instead.';

function line(n: number, label: string, rest: Partial<CheckedLine> = {}): CheckedLine {
  return { n, label, detail: '', problem: null, suggestion: null, unverified: false, ...rest };
}

/** A grant or loot line: a catalog "key" or a custom "name". */
function checkItemLine(kind: 'grant' | 'loot', item: unknown, n: number,
                       catalog: CatalogItem[] | null, byKey: Map<string, CatalogItem>): CheckedLine {
  if (!isRecord(item)) {
    return typeof item === 'string' && item.trim()
      ? line(n, item.trim(), { problem: BARE_VALUE, suggestion: suggest(item, catalog) })
      : line(n, '(not an item)', { problem: BARE_VALUE });
  }
  const hasKey = filled(item['key']);
  const hasName = filled(item['name']);
  if (hasKey && hasName) {
    return line(n, String(item['name']).trim(),
      { problem: 'Has both "key" and "name" — keep "key" for a catalog item or "name" for a custom one.' });
  }
  if (!hasKey && !hasName) {
    return line(n, '(no key or name)',
      { problem: 'Needs a "key" (a catalog item) or a "name" (a custom item).' });
  }
  const label = String(hasKey ? item['key'] : item['name']).trim();
  const typed = item as LootImportPayload['items'][number];
  const qty = typed.qty ?? 1;
  const fields = Object.keys(item).filter(f => item[f] != null);

  if (hasKey) {
    const extra = fields.filter(f => f !== 'key' && f !== 'qty');
    // "quantity" on a catalog line is a misspelt "qty", not a stat to remove.
    const misnamedQty = extra.find(f => unknownFieldProblem(f, ['key', 'qty'], ITEM_ALIASES).endsWith('use "qty".'));
    if (misnamedQty) {
      return line(n, label, { problem: unknownFieldProblem(misnamedQty, ['key', 'qty'], ITEM_ALIASES) });
    }
    if (extra.length) {
      return line(n, label, {
        problem: `A catalog item takes only "key" and "qty" — remove ${quoted(extra)}. Its stats come from the catalog.`,
      });
    }
  } else {
    const unknown = fields.find(f => !ITEM_FIELDS.includes(f));
    if (unknown) return line(n, label, { problem: unknownFieldProblem(unknown, ITEM_FIELDS, ITEM_ALIASES) });
  }

  const ruleBroken = lootImportItemProblem(typed);
  if (ruleBroken) return line(n, label, { problem: ruleBroken });
  if (!Number.isInteger(qty)) return line(n, label, { problem: 'qty must be a whole number.' });
  const count = qty > 1 ? `×${qty}` : null;

  if (!hasKey) {
    const category = typed.category ?? 'gear';
    return line(n, label, {
      detail: [
        count,
        `Custom ${categoryName(category).toLowerCase()}`,
        typed.damage?.trim() || null,
        typed.armorClass?.trim() ? `AC ${typed.armorClass.trim()}` : null,
        typed.weight != null ? `${typed.weight} lb` : null,
        typed.valueGp != null ? gp(typed.valueGp) : null,
      ].filter(Boolean).join(' · '),
    });
  }

  if (!catalog) {
    return kind === 'grant'
      ? line(n, label, { problem: NO_CATALOG })
      : line(n, label, { unverified: true, detail: [count, 'key is checked when you import'].filter(Boolean).join(' · ') });
  }
  const found = byKey.get(label);
  if (!found) return line(n, label, { problem: 'Unknown catalog key.', suggestion: suggest(label, catalog) });
  return line(n, found.name, {
    detail: [count, categoryName(categoryLabelFor(found.category)), formatCp(found.costCp)].filter(Boolean).join(' · '),
  });
}

/** A shop line: a catalog "key", with an optional price override. */
function checkShopLine(item: unknown, n: number, catalog: CatalogItem[] | null,
                       byKey: Map<string, CatalogItem>, firstSeen: Map<string, number>): CheckedLine {
  if (!isRecord(item)) {
    return typeof item === 'string' && item.trim()
      ? line(n, item.trim(), { problem: BARE_VALUE, suggestion: suggest(item, catalog) })
      : line(n, '(not an item)', { problem: BARE_VALUE });
  }
  if (!filled(item['key'])) {
    return filled(item['name'])
      ? line(n, item['name'].trim(), {
          problem: 'A shop sells catalog items only — use a "key" instead of "name".',
          suggestion: suggest(item['name'], catalog),
        })
      : line(n, '(no key)', { problem: 'Needs a "key" (a catalog key like "longsword").' });
  }
  const label = item['key'].trim();
  const fields = Object.keys(item).filter(f => item[f] != null);
  if (fields.some(f => ['qty', 'quantity', 'stock', 'count'].includes(f.toLowerCase()))) {
    return line(n, label, { problem: 'A shop has unlimited stock — remove the quantity.' });
  }
  const unknown = fields.find(f => !SHOP_ITEM_FIELDS.includes(f));
  if (unknown) return line(n, label, { problem: unknownFieldProblem(unknown, SHOP_ITEM_FIELDS, SHOP_ALIASES) });
  const priceGp = item['priceGp'];
  if (priceGp != null && (typeof priceGp !== 'number' || priceGp < 0)) {
    return line(n, label, { problem: 'priceGp must be a non-negative number when present.' });
  }
  const earlier = firstSeen.get(label);
  if (earlier != null) {
    return line(n, label, { problem: `Same item as line ${earlier} — a shop lists each item once.` });
  }
  firstSeen.set(label, n);

  if (!catalog) return line(n, label, { unverified: true, detail: 'key is checked when you import' });
  const found = byKey.get(label);
  if (!found) return line(n, label, { problem: 'Unknown catalog key.', suggestion: suggest(label, catalog) });
  const price = typeof priceGp === 'number'
    ? `${gp(priceGp)} (catalog ${formatCp(found.costCp)})`
    : formatCp(found.costCp);
  return line(n, found.name, {
    detail: [categoryName(categoryLabelFor(found.category)), price].join(' · '),
  });
}

// ── The whole paste ──────────────────────────────────────────────────────────

/**
 * Check pasted JSON for one of the three boxes. `catalog` is every catalog
 * item, or null when the catalog cannot be read here (the demo, or a failed
 * load): a loot list or shop then leaves its keys for the server to check,
 * while a grant — which looks keys up in the browser — cannot take them.
 */
export function checkImportJson(kind: JsonImportKind, raw: string, catalog: CatalogItem[] | null): ImportCheck {
  if (!raw.trim()) return EMPTY_IMPORT_CHECK;
  const { text, lineOffset } = extractJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ...EMPTY_IMPORT_CHECK, state: 'syntax', problems: [syntaxProblem(text, err, lineOffset)] };
  }

  const problems: string[] = [];
  const shape = kind === 'shop' ? '{"name": "Shop name", "items": [ … ]}' : '{"items": [ … ]}';
  let root: Json;
  if (Array.isArray(parsed) && kind !== 'shop') {
    root = { items: parsed };          // a bare list is clear enough — take it as the items
  } else if (isRecord(parsed)) {
    root = parsed;
  } else {
    const what = Array.isArray(parsed) ? 'This is a bare list' : 'This is not an object';
    return { ...EMPTY_IMPORT_CHECK, state: 'checked', problems: [`${what} — it must look like ${shape}.`] };
  }

  const topFields = kind === 'shop' ? ['name', 'settlement', 'items'] : kind === 'loot' ? ['coinGp', 'items'] : ['items'];
  for (const field of Object.keys(root)) {
    if (topFields.includes(field) || (kind === 'grant' && field === 'coinGp')) continue;
    problems.push(`Unknown field "${field}" at the top — remove it. Allowed: ${quoted(topFields)}.`);
  }

  let header: string | null = null;
  const coinGp = root['coinGp'];
  if (kind === 'grant' && coinGp != null && coinGp !== 0) {
    problems.push('"coinGp" is for loot lists — remove it. This grants items only.');
  }
  if (kind === 'loot' && coinGp != null) {
    if (typeof coinGp !== 'number' || coinGp < 0) problems.push('"coinGp" must be a non-negative number when present.');
    else if (coinGp > 0) header = `${gp(coinGp)} to the coin pile`;
  }
  if (kind === 'shop') {
    if (!filled(root['name'])) problems.push('The shop needs a "name".');
    else header = root['name'].trim();
    const settlement = root['settlement'];
    if (settlement != null && typeof settlement !== 'string') problems.push('"settlement" must be text when present.');
    else if (header && filled(settlement)) header += ` · ${settlement.trim()}`;
  }

  const items = root['items'];
  if (!Array.isArray(items)) {
    problems.push(`Needs an "items" list — it must look like ${shape}.`);
    return { ...EMPTY_IMPORT_CHECK, state: 'checked', problems, header };
  }
  if (!items.length) {
    if (kind === 'grant') problems.push('The "items" list is empty — add at least one item.');
    if (kind === 'loot' && !(typeof coinGp === 'number' && coinGp > 0)) {
      problems.push('Nothing to import — add items, or a "coinGp" for the coin pile.');
    }
  }

  const byKey = new Map((catalog ?? []).map(i => [i.itemKey, i] as [string, CatalogItem]));
  const firstSeen = new Map<string, number>();
  const lines = items.map((item, i) => kind === 'shop'
    ? checkShopLine(item, i + 1, catalog, byKey, firstSeen)
    : checkItemLine(kind, item, i + 1, catalog, byKey));

  const check: ImportCheck = {
    state: 'checked', problems, header, lines,
    ok: !problems.length && lines.every(l => !l.problem), loot: null, shop: null,
  };
  if (!check.ok) return check;

  // Normalize through the same parser the box used before this check existed,
  // so "the check passed" can never mean something the parser would refuse.
  const normalized = JSON.stringify(root);
  if (kind === 'shop') {
    const { payload, error } = parseImportPayload(normalized);
    if (payload) return { ...check, shop: payload };
    return { ...check, ok: false, problems: [error ?? 'Could not read that JSON.'] };
  }
  const { payload, error } = parseLootImportPayload(normalized);
  if (payload) return { ...check, loot: payload };
  return { ...check, ok: false, problems: [error ?? 'Could not read that JSON.'] };
}

/**
 * Rewrite the paste with line `n` pointing at the suggested catalog key (the
 * "did you mean" button). A line that named the item some other way — a bare
 * string, or a "name" in a shop — becomes a proper key line. Returns the text
 * unchanged when it cannot be read.
 */
export function applyKeySuggestion(raw: string, n: number, key: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw).text);
  } catch {
    return raw;
  }
  const items = Array.isArray(parsed) ? parsed : isRecord(parsed) ? parsed['items'] : null;
  if (!Array.isArray(items) || n < 1 || n > items.length) return raw;
  const current = items[n - 1];
  if (isRecord(current) && filled(current['key'])) {
    current['key'] = key;
  } else if (isRecord(current)) {
    const { name: _name, key: _key, ...rest } = current;
    items[n - 1] = { key, ...rest };
  } else {
    items[n - 1] = { key };
  }
  return JSON.stringify(parsed, null, 2);
}
