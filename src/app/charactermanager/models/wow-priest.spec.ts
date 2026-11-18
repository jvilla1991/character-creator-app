import type { FeatureCardInput, HeroStats } from './hero-class';
import { WOW_PRIEST } from './wow-class-variants';
import {
  DISCIPLINE_DOMAIN, SHADOW_DOMAIN, devouringPlagueUses, disciplineDomainCard, luminousBarrierHp, priestFeatureCards,
  priestSpellAttack, shadowDomainCard,
} from './wow-priest';

const stats = (wis: number): HeroStats => ({ STR: 8, DEX: 14, CON: 14, INT: 10, WIS: wis, CHA: 12 });

function input(overrides: Partial<FeatureCardInput> = {}): FeatureCardInput {
  return { level: 3, subclass: DISCIPLINE_DOMAIN, stats: stats(16), ...overrides };
}

const rowNames = (card: { rows: readonly { name: string }[] } | null) => card?.rows.map(r => r.name) ?? [];
const row = (card: { rows: readonly { name: string; kind?: string; text: string }[] } | null, name: string) =>
  card!.rows.find(r => r.name === name)!;

describe('wow-priest', () => {
  it('is the WoW Priest variant\'s card hook', () => {
    expect(WOW_PRIEST.featureCards).toBe(priestFeatureCards);
  });

  describe('gating', () => {
    it('shows nothing before Cleric 3 or for any other domain', () => {
      expect(priestFeatureCards(input({ level: 2 }))).toEqual([]);
      expect(priestFeatureCards(input({ level: 2, subclass: SHADOW_DOMAIN }))).toEqual([]);
      expect(priestFeatureCards(input({ subclass: 'Life Domain' }))).toEqual([]);
      expect(priestFeatureCards(input({ subclass: null }))).toEqual([]);
    });

    it('shows one card for the chosen WoW domain from Cleric 3 (case-insensitive)', () => {
      expect(priestFeatureCards(input()).map(c => c.name)).toEqual(['Discipline Domain']);
      expect(priestFeatureCards(input({ subclass: 'shadow domain' })).map(c => c.name)).toEqual(['Shadow Domain']);
      expect(disciplineDomainCard(input({ subclass: SHADOW_DOMAIN }))).toBeNull();
      expect(shadowDomainCard(input())).toBeNull();
    });

    it('adds the level-6 and level-17 features only at those levels', () => {
      const disc = (level: number) => rowNames(disciplineDomainCard(input({ level })));
      expect(disc(3)).toEqual(['Holy Bolt', 'Atonement']);
      expect(disc(5)).toEqual(['Holy Bolt', 'Atonement']);
      expect(disc(6)).toEqual(['Holy Bolt', 'Atonement', 'Luminous Barrier']);
      expect(disc(16)).toEqual(['Holy Bolt', 'Atonement', 'Luminous Barrier']);
      expect(disc(17)).toEqual(['Holy Bolt', 'Atonement', 'Luminous Barrier', 'Ultimate Penitence']);
      const shadow = (level: number) => rowNames(shadowDomainCard(input({ level, subclass: SHADOW_DOMAIN })));
      expect(shadow(3)).toEqual(['Shadowform', 'Devouring Plague']);
      expect(shadow(5)).toEqual(['Shadowform', 'Devouring Plague']);
      expect(shadow(6)).toEqual(['Shadowform', 'Devouring Plague', 'Dispersion']);
      expect(shadow(17)).toEqual(['Shadowform', 'Devouring Plague', 'Dispersion', 'Vampiric Embrace']);
    });
  });

  describe('Discipline Domain', () => {
    it('works out Holy Bolt from the spell attack bonus and Wisdom', () => {
      // Level 3: PB 2, WIS 16 (+3) → +5.
      const card = disciplineDomainCard(input())!;
      expect(card.source).toBe('Discipline Domain 3');
      expect(card.stats).toEqual([{ label: 'Spell attack', value: '+5' }]);
      const bolt = row(card, 'Holy Bolt');
      expect(bolt.kind).toBe('Bonus Action · Channel Divinity');
      expect(bolt.text).toContain('Spell attack (+5)');
      expect(bolt.text).toContain('2d10 + 3 Radiant');
      expect(bolt.text).toContain('within 60 ft. regains 1d10 + 3 HP');
      // A stored proficiency bonus wins over the level-derived one.
      expect(priestSpellAttack(input({ level: 3, prof: 4 }))).toBe(7);
      expect(priestSpellAttack(input({ level: 9 }))).toBe(7);
    });

    it('writes a zero or negative Wisdom modifier into the dice', () => {
      expect(row(disciplineDomainCard(input({ stats: stats(10) })), 'Holy Bolt').text).toContain('2d10 Radiant');
      expect(row(disciplineDomainCard(input({ stats: stats(8) })), 'Holy Bolt').text).toContain('2d10 − 1 Radiant');
      expect(row(disciplineDomainCard(input({ stats: stats(8) })), 'Holy Bolt').text).toContain('1d10 − 1 HP');
    });

    it('describes Atonement healing by slot level', () => {
      const text = row(disciplineDomainCard(input()), 'Atonement').text;
      expect(text).toContain('until the end of your next turn');
      expect(text).toContain("equal to the slot's level");
    });

    it('sizes Luminous Barrier at Cleric level + WIS modifier', () => {
      expect(luminousBarrierHp(input({ level: 6, stats: stats(16) }))).toBe(9);
      expect(luminousBarrierHp(input({ level: 10, stats: stats(18) }))).toBe(14);
      expect(luminousBarrierHp(input({ level: 6, stats: stats(8) }))).toBe(5);
      const card = disciplineDomainCard(input({ level: 10, stats: stats(18) }))!;
      expect(row(card, 'Luminous Barrier').kind).toBe('Cleric 6');
      expect(row(card, 'Luminous Barrier').text).toContain('14 Temporary Hit Points');
      expect(row(card, 'Luminous Barrier').text).toContain('Resistance to all damage');
      expect(card.stats).toEqual([{ label: 'Spell attack', value: '+8' }, { label: 'Barrier', value: '14 Temp HP' }]);
    });

    it('names both Ultimate Penitence options at Cleric 17', () => {
      const text = row(disciplineDomainCard(input({ level: 17 })), 'Ultimate Penitence').text;
      expect(text).toContain('Ascending Step');
      expect(text).toContain('Ascending Volley');
    });
  });

  describe('Shadow Domain', () => {
    const shadow = (overrides: Partial<FeatureCardInput> = {}) =>
      shadowDomainCard(input({ subclass: SHADOW_DOMAIN, ...overrides }))!;

    it('describes Shadowform and when it ends', () => {
      const form = row(shadow(), 'Shadowform');
      expect(form.kind).toBe('Bonus Action · Channel Divinity · 1 minute');
      for (const words of ['Shadow Stealth', 'Void Empowerment adds an extra 1d6', 'dismiss', 'Incapacitated', 'Radiant damage with a spell']) {
        expect(form.text).withContext(words).toContain(words);
      }
    });

    it('gives Devouring Plague WIS-modifier uses per Long Rest, never fewer than 1', () => {
      expect(devouringPlagueUses(input({ stats: stats(17) }))).toBe(3);
      expect(devouringPlagueUses(input({ stats: stats(20) }))).toBe(5);
      expect(devouringPlagueUses(input({ stats: stats(11) }))).toBe(1);   // +0
      expect(devouringPlagueUses(input({ stats: stats(10) }))).toBe(1);   // +0
      expect(devouringPlagueUses(input({ stats: stats(7) }))).toBe(1);    // −2
      expect(devouringPlagueUses(input({ stats: undefined }))).toBe(1);
      const card = shadow({ stats: stats(17) });
      expect(card.source).toBe('Shadow Domain 3');
      expect(card.stats).toEqual([{ label: 'Devouring Plague', value: '3 / Long Rest' }]);
      expect(row(card, 'Devouring Plague').kind).toBe('3 per Long Rest');
      expect(row(card, 'Devouring Plague').text).toContain('1d10 Necrotic');
      expect(row(card, 'Devouring Plague').text).toContain('regain that many Hit Points');
      expect(row(shadow({ stats: stats(8) }), 'Devouring Plague').kind).toBe('1 per Long Rest');
    });

    it('describes Dispersion with half the Hit Dice at the current level', () => {
      const at6 = row(shadow({ level: 6 }), 'Dispersion');
      expect(at6.kind).toBe('Reaction · Cleric 6');
      expect(at6.text).toContain('Resistance to all damage');
      expect(at6.text).toContain("can't take actions");
      expect(at6.text).toContain('Fly Speed of 40 ft.');
      expect(at6.text).toContain('up to 3 Hit Dice');
      expect(at6.text).toContain('Once per Short or Long Rest');
      expect(row(shadow({ level: 11 }), 'Dispersion').text).toContain('up to 5 Hit Dice');
    });

    it('heals by the Void Empowerment roll with Vampiric Embrace at Cleric 17', () => {
      const text = row(shadow({ level: 17 }), 'Vampiric Embrace').text;
      expect(text).toContain('1d6');
      expect(text).toContain('within 30 ft.');
    });
  });
});
