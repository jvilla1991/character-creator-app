import { DndSpell } from './dnd-api.types';

/**
 * Guards the shipped spell data (the real assets, served by the Karma builder):
 * every spell with real rules text carries a one-sentence ELI5 summary, written
 * to the house rules for them. Add a spell without one and this fails.
 */
describe('ELI5 spell summaries (spell JSON assets)', () => {
  const FILES = ['srd-5.2-spells.json', 'phb-2024-supplement.json', 'wow-spells.json', 'arcana-unleashed-spells.json'];
  let spells: DndSpell[];

  beforeAll(async () => {
    const lists = await Promise.all(FILES.map(async file => {
      const res = await fetch(`/assets/data/spells/${file}`);
      return await res.json() as DndSpell[];
    }));
    spells = lists.flat();
  });

  /** Placeholder entries ("TBD …") have no rules text to summarize yet. */
  const isPlaceholder = (s: DndSpell): boolean => s.description.startsWith('TBD');

  it('gives every spell with real rules text a summary', () => {
    const missing = spells.filter(s => !isPlaceholder(s) && !s.eli5).map(s => s.name);

    expect(missing).toEqual([]);
  });

  it('writes no summary for placeholder spells (they fall back to the description)', () => {
    const invented = spells.filter(s => isPlaceholder(s) && s.eli5).map(s => s.name);

    expect(invented).toEqual([]);
  });

  it('keeps each summary to one short sentence with no em or en dashes', () => {
    const problems: string[] = [];
    for (const s of spells) {
      const text = s.eli5;
      if (!text) continue;
      if (/[‒-―]/.test(text)) problems.push(`${s.name}: contains a dash character`);
      if (!text.endsWith('.')) problems.push(`${s.name}: does not end with a period`);
      if (/[.?!]\s+\S/.test(text) || text.includes(';')) problems.push(`${s.name}: more than one sentence`);
      if (text.length > 200) problems.push(`${s.name}: ${text.length} characters (max 200)`);
    }

    expect(problems).toEqual([]);
  });
});
