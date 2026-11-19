import type { ContentSource } from './content-source';

/**
 * Feats added by the World of Warcraft tabletop module. They are ordinary
 * General feats (level 4+, the ASI alternative): the server decides who is
 * offered them and validates the name; this table only lets the SPA tag them
 * (✦ / "World of Warcraft") and show any prerequisite beyond the level. Their
 * descriptions live with the rest in FEAT_DESCRIPTIONS.
 */
export interface WowFeat {
  name: string;
  /** A prerequisite beyond General feats' level 4+, as shown to people; absent when there is none. */
  prerequisite?: string;
}

/** The WoW mage feats — each also raises Intelligence by 1. */
export const WOW_MAGE_FEATS: readonly WowFeat[] = [
  { name: 'Clearcasting' },
  { name: 'Fingers of Frost' },
  { name: 'Hot Streak' },
];

/** The prerequisite every WoW monk feat carries on top of level 4+. */
export const MONK_FEAT_PREREQUISITE = 'DEX 13+, WIS 13+';

/**
 * The WoW monk feats — each also raises Dexterity or Wisdom by 1. The server only
 * offers them (in the level-up preview's featOptions) to a character with DEX 13+
 * and WIS 13+, so the SPA just shows the prerequisite.
 */
export const WOW_MONK_FEATS: readonly WowFeat[] = [
  { name: 'Elusive Brawler', prerequisite: MONK_FEAT_PREREQUISITE },
  { name: 'Enveloping Mist', prerequisite: MONK_FEAT_PREREQUISITE },
  { name: 'Fists of Fury', prerequisite: MONK_FEAT_PREREQUISITE },
  { name: 'Stagger and Sway', prerequisite: MONK_FEAT_PREREQUISITE },
];

/** Every World of Warcraft feat, in table order. */
export const WOW_FEATS: readonly WowFeat[] = [...WOW_MAGE_FEATS, ...WOW_MONK_FEATS];

/** Hover text for a ✦ World of Warcraft feat. */
export const WOW_FEAT_NOTE = 'World of Warcraft feat';

function wowFeat(name: string | null | undefined): WowFeat | undefined {
  const n = (name ?? '').trim().toLowerCase();
  return n ? WOW_FEATS.find(f => f.name.toLowerCase() === n) : undefined;
}

/** True when a feat name is a World of Warcraft feat (case-insensitive). */
export function isWowFeat(name: string | null | undefined): boolean {
  return !!wowFeat(name);
}

/** A feat's content source: 'World of Warcraft' for the module's feats, else the base game. */
export function featSource(name: string | null | undefined): ContentSource {
  return isWowFeat(name) ? 'World of Warcraft' : 'Base Game';
}

/** A WoW feat's prerequisite beyond level 4 ('DEX 13+, WIS 13+'); undefined when it has none. */
export function featPrerequisite(name: string | null | undefined): string | undefined {
  return wowFeat(name)?.prerequisite;
}
