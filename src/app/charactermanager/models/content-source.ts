/**
 * Where a piece of game content comes from. Everything in the 2024 PHB / SRD data
 * is the base game; the World of Warcraft tabletop module adds hero classes (e.g.
 * Death Knight (Paladin)) and their spells. Content without an explicit source is
 * always the base game — use {@link spellSource} rather than repeating that default.
 */
export type ContentSource = 'Base Game' | 'World of Warcraft';

/** Every source, in display order (the filter checkboxes render in this order). */
export const CONTENT_SOURCES: readonly ContentSource[] = ['Base Game', 'World of Warcraft'];

/** Which sources a filter currently shows. */
export type ContentSourceSelection = Record<ContentSource, boolean>;

/** A fresh selection with every source enabled — the default for every filter. */
export function allContentSources(): ContentSourceSelection {
  return { 'Base Game': true, 'World of Warcraft': true };
}

/** The source of a spell (or anything spell-shaped); absent means the base game. */
export function spellSource(item: { source?: ContentSource | null }): ContentSource {
  return item.source ?? 'Base Game';
}

/** True when content from `source` is shown under `selection`. */
export function isSourceEnabled(selection: ContentSourceSelection, source: ContentSource | null | undefined): boolean {
  return !!selection[source ?? 'Base Game'];
}

/** Keep only the items whose source is enabled. Both sources off → empty list. */
export function filterBySource<T extends { source?: ContentSource | null }>(
  items: readonly T[], selection: ContentSourceSelection,
): T[] {
  return items.filter(i => isSourceEnabled(selection, spellSource(i)));
}
