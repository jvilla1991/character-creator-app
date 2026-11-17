import { allContentSources, CONTENT_SOURCES, filterBySource, isSourceEnabled, spellSource } from './content-source';

describe('content-source', () => {
  const items = [
    { name: 'Fireball' },                                   // no source → Base Game
    { name: 'Bless', source: 'Base Game' as const },
    { name: 'Death Grip', source: 'World of Warcraft' as const },
  ];

  it('lists the two sources in display order', () => {
    expect(CONTENT_SOURCES).toEqual(['Base Game', 'World of Warcraft']);
  });

  it('treats a missing source as Base Game', () => {
    expect(spellSource({})).toBe('Base Game');
    expect(spellSource({ source: null })).toBe('Base Game');
    expect(spellSource({ source: 'World of Warcraft' })).toBe('World of Warcraft');
  });

  it('defaults to every source enabled', () => {
    const all = allContentSources();
    expect(isSourceEnabled(all, 'Base Game')).toBeTrue();
    expect(isSourceEnabled(all, 'World of Warcraft')).toBeTrue();
    expect(isSourceEnabled(all, undefined)).toBeTrue();
  });

  it('keeps everything with both sources on', () => {
    expect(filterBySource(items, allContentSources()).map(i => i.name))
      .toEqual(['Fireball', 'Bless', 'Death Grip']);
  });

  it('drops World of Warcraft content when that source is off', () => {
    const sel = { ...allContentSources(), 'World of Warcraft': false };
    expect(filterBySource(items, sel).map(i => i.name)).toEqual(['Fireball', 'Bless']);
  });

  it('drops base content (including unsourced) when Base Game is off', () => {
    const sel = { ...allContentSources(), 'Base Game': false };
    expect(filterBySource(items, sel).map(i => i.name)).toEqual(['Death Grip']);
  });

  it('returns an empty list with both sources off', () => {
    expect(filterBySource(items, { 'Base Game': false, 'World of Warcraft': false })).toEqual([]);
  });
});
