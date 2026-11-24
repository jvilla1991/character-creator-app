/**
 * Where a piece of game content comes from. Everything in the 2024 PHB / SRD data
 * is the base game; the World of Warcraft tabletop module adds hero classes (e.g.
 * Death Knight (Paladin)) and their spells; the Arcana Unleashed book adds spells,
 * feats, backgrounds, subclasses and magic items. Content without an explicit
 * source is always the base game — use {@link spellSource} rather than repeating
 * that default.
 */
export type ContentSource = 'Base Game' | 'World of Warcraft' | 'Arcana Unleashed';

/** Every source, in display order (the filter checkboxes render in this order). */
export const CONTENT_SOURCES: readonly ContentSource[] = ['Base Game', 'World of Warcraft', 'Arcana Unleashed'];

/** Which sources a filter currently shows. */
export type ContentSourceSelection = Record<ContentSource, boolean>;

/** A selection with exactly the named sources enabled and every other source off. */
export function onlyContentSources(...enabled: ContentSource[]): ContentSourceSelection {
  const selection = {} as ContentSourceSelection;
  for (const source of CONTENT_SOURCES) selection[source] = enabled.includes(source);
  return selection;
}

/** A fresh selection with every source enabled — the default for every filter. */
export function allContentSources(): ContentSourceSelection {
  return onlyContentSources(...CONTENT_SOURCES);
}

/** True when at least one source is checked; false means a list is empty by choice. */
export function anySourceEnabled(selection: ContentSourceSelection): boolean {
  return CONTENT_SOURCES.some(source => !!selection[source]);
}

/** The source of a spell (or anything spell-shaped); absent means the base game. */
export function spellSource(item: { source?: ContentSource | null }): ContentSource {
  return item.source ?? 'Base Game';
}

/** True when content from `source` is shown under `selection`. */
export function isSourceEnabled(selection: ContentSourceSelection, source: ContentSource | null | undefined): boolean {
  return !!selection[source ?? 'Base Game'];
}

/** Keep only the items whose source is enabled. Every source off → empty list. */
export function filterBySource<T extends { source?: ContentSource | null }>(
  items: readonly T[], selection: ContentSourceSelection,
): T[] {
  return items.filter(i => isSourceEnabled(selection, spellSource(i)));
}
