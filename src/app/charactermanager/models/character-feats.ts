import { PC } from './pc';

/**
 * The feats a character has, read from where they are stored — the client
 * mirror of the server's CharacterFeats. There is no feat list: a feat is a
 * name in `pc.feat` (the background's Origin feat) or the name of an entry in
 * `pc.features`, whose source says where it came from: 'Sage · Origin Feat',
 * 'Human (World of Warcraft) · Origin Feat', 'Feat (Level 4)',
 * 'Fighting Style (Level 2)', or 'Feat' for one the DM granted.
 *
 * The source wording differs by who wrote the entry, so it is not read here:
 * this returns the Origin feat and the name of every features entry, each once
 * and in the order stored, and the rules tables pick out the names they know.
 */
export function featNamesOn(pc: Pick<PC, 'feat' | 'features'> | null | undefined): string[] {
  const names = new Map<string, string>();
  for (const name of [pc?.feat, ...(pc?.features ?? []).map(f => f?.name)]) {
    const trimmed = (name ?? '').trim();
    if (trimmed && !names.has(trimmed.toLowerCase())) names.set(trimmed.toLowerCase(), trimmed);
  }
  return [...names.values()];
}

/**
 * True when a features entry is a feat rather than a class feature or a species
 * trait, going by the source it was saved with (see above).
 */
export function isFeatEntry(feature: { source?: string | null }): boolean {
  const source = (feature.source ?? '').trim().toLowerCase();
  return source.startsWith('feat') || source.startsWith('fighting style') || source.endsWith('origin feat');
}
