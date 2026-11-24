import {
  allContentSources, anySourceEnabled, CONTENT_SOURCES, filterBySource, isSourceEnabled, onlyContentSources,
  spellSource,
} from './content-source';

describe('content-source', () => {
  const items = [
    { name: 'Fireball' },                                   // no source → Base Game
    { name: 'Bless', source: 'Base Game' as const },
    { name: 'Death Grip', source: 'World of Warcraft' as const },
    { name: 'Catnap', source: 'Arcana Unleashed' as const },
  ];

  it('lists the three sources in display order', () => {
    expect(CONTENT_SOURCES).toEqual(['Base Game', 'World of Warcraft', 'Arcana Unleashed']);
  });

  it('treats a missing source as Base Game', () => {
    expect(spellSource({})).toBe('Base Game');
    expect(spellSource({ source: null })).toBe('Base Game');
    expect(spellSource({ source: 'World of Warcraft' })).toBe('World of Warcraft');
    expect(spellSource({ source: 'Arcana Unleashed' })).toBe('Arcana Unleashed');
  });

  it('defaults to every source enabled', () => {
    const all = allContentSources();
    expect(all).toEqual({ 'Base Game': true, 'World of Warcraft': true, 'Arcana Unleashed': true });
    expect(isSourceEnabled(all, 'Base Game')).toBeTrue();
    expect(isSourceEnabled(all, 'World of Warcraft')).toBeTrue();
    expect(isSourceEnabled(all, 'Arcana Unleashed')).toBeTrue();
    expect(isSourceEnabled(all, undefined)).toBeTrue();
  });

  it('builds a selection with only the named sources on', () => {
    expect(onlyContentSources('Arcana Unleashed'))
      .toEqual({ 'Base Game': false, 'World of Warcraft': false, 'Arcana Unleashed': true });
    expect(onlyContentSources()).toEqual({ 'Base Game': false, 'World of Warcraft': false, 'Arcana Unleashed': false });
  });

  it('keeps everything with every source on', () => {
    expect(filterBySource(items, allContentSources()).map(i => i.name))
      .toEqual(['Fireball', 'Bless', 'Death Grip', 'Catnap']);
  });

  it('drops World of Warcraft content when that source is off', () => {
    const sel = { ...allContentSources(), 'World of Warcraft': false };
    expect(filterBySource(items, sel).map(i => i.name)).toEqual(['Fireball', 'Bless', 'Catnap']);
  });

  it('drops Arcana Unleashed content when that source is off', () => {
    const sel = { ...allContentSources(), 'Arcana Unleashed': false };
    expect(filterBySource(items, sel).map(i => i.name)).toEqual(['Fireball', 'Bless', 'Death Grip']);
  });

  it('drops base content (including unsourced) when Base Game is off', () => {
    const sel = { ...allContentSources(), 'Base Game': false };
    expect(filterBySource(items, sel).map(i => i.name)).toEqual(['Death Grip', 'Catnap']);
  });

  it('returns an empty list with every source off', () => {
    expect(filterBySource(items, onlyContentSources())).toEqual([]);
  });

  it('knows whether any source is still checked', () => {
    expect(anySourceEnabled(allContentSources())).toBeTrue();
    expect(anySourceEnabled(onlyContentSources('Arcana Unleashed'))).toBeTrue();
    expect(anySourceEnabled(onlyContentSources())).toBeFalse();
  });
});
