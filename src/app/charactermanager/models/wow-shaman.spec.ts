import { FeatureCardInput } from './hero-class';
import {
  PATH_OF_THE_ELEMENTS, PATH_OF_THE_SPIRITUAL_GUARDIAN, rageDamageBonus, ragingElementsCard, shamanFeatureCards,
  spiritualGuardianCard, totemsCard,
} from './wow-shaman';

const STATS = { STR: 16, DEX: 14, CON: 16, INT: 8, WIS: 14, CHA: 10 };

function input(level: number, subclass: string | null = PATH_OF_THE_ELEMENTS, prof?: number): FeatureCardInput {
  return { level, subclass, stats: STATS, prof };
}

describe('wow-shaman', () => {
  it('scales the Rage Damage bonus +2 / +3 from 9 / +4 from 16', () => {
    expect(rageDamageBonus(1)).toBe(2);
    expect(rageDamageBonus(8)).toBe(2);
    expect(rageDamageBonus(9)).toBe(3);
    expect(rageDamageBonus(15)).toBe(3);
    expect(rageDamageBonus(16)).toBe(4);
    expect(rageDamageBonus(20)).toBe(4);
  });

  describe('Totems', () => {
    it('appears from Barbarian level 3, whatever the path', () => {
      expect(totemsCard(input(2, null))).toBeNull();
      expect(totemsCard(input(3, null))).not.toBeNull();
      expect(totemsCard(input(3, 'Path of the Berserker'))?.name).toBe('Totems');
    });

    it('describes planting a totem and lists the four totems', () => {
      const card = totemsCard(input(3, null))!;
      expect(card.source).toBe('Barbarian 3');
      for (const part of ['Bonus Action', 'within 10 ft', 'AC 10', '1 HP', '1 minute', '30-ft. emanation', 'end of each of your turns']) {
        expect(card.summary).toContain(part);
      }
      expect(card.rows.map(r => r.name)).toEqual(['Earthbind', 'Primal Knowledge', 'Tremor', 'Wind Rush']);
      const primal = card.rows.find(r => r.name === 'Primal Knowledge')!;
      expect(primal.text).toContain('Once per Long Rest');
      expect(primal.text).toContain('spend a Rage');
    });
  });

  describe('Raging Elements', () => {
    const row = (level: number, name: string, prof?: number) =>
      ragingElementsCard(input(level, PATH_OF_THE_ELEMENTS, prof))!.rows.find(r => r.name === name);
    const stat = (level: number, label: string) =>
      ragingElementsCard(input(level))!.stats!.find(s => s.label === label)?.value;

    it('only shows for the Path of the Elements from level 3', () => {
      expect(ragingElementsCard(input(2))).toBeNull();
      expect(ragingElementsCard(input(3, PATH_OF_THE_SPIRITUAL_GUARDIAN))).toBeNull();
      expect(ragingElementsCard(input(3, 'path of the elements'))?.name).toBe('Raging Elements');
    });

    it('computes the DC (8 + CON + PB), attack (CON + PB) and dice at level 3', () => {
      expect(stat(3, 'Save DC')).toBe('13');
      expect(stat(3, 'Spell attack')).toBe('+5');
      expect(stat(3, 'Rage Damage')).toBe('+2');
      expect(row(3, 'Icefury')?.kind).toBe('2d8 Cold');
      expect(row(3, 'Icefury')?.text).toContain('Spell attack (+5), range 30 ft.');
      expect(row(3, 'Icefury')?.text).toContain('next Fire damage deals an extra 1d10');
      expect(row(3, 'Lava Burst')?.kind).toBe('2d4 Fire');
      expect(row(3, 'Lava Burst')?.text).toContain('DC 13 Dexterity save, half damage on a success');
      expect(row(3, 'Lava Burst')?.text).toContain('next Lightning damage deals an extra 1d8');
      expect(row(3, 'Lightning Bolt')?.kind).toBe('2d6 Lightning');
      expect(row(3, 'Lightning Bolt')?.text).toContain('next Cold damage deals an extra 1d6');
      expect(row(3, 'Icefury')?.text).not.toContain('Elemental Overload');
    });

    it('uses the stored proficiency bonus when there is one', () => {
      expect(row(3, 'Lava Burst', 3)?.text).toContain('DC 14');
    });

    it('steps up at level 9 (PB +4, Rage +3)', () => {
      expect(stat(9, 'Save DC')).toBe('15');
      expect(stat(9, 'Spell attack')).toBe('+7');
      expect(row(9, 'Icefury')?.kind).toBe('3d8 Cold');
      expect(row(9, 'Lava Burst')?.kind).toBe('3d4 Fire');
      expect(row(9, 'Lightning Bolt')?.kind).toBe('3d6 Lightning');
    });

    it('adds each Elemental Overload rider from level 14', () => {
      expect(stat(14, 'Save DC')).toBe('16');
      expect(row(13, 'Icefury')?.text).not.toContain('Elemental Overload');
      expect(row(14, 'Icefury')?.kind).toBe('3d8 Cold');
      expect(row(14, 'Icefury')?.text).toContain('Elemental Overload: the target subtracts half');
      expect(row(14, 'Lava Burst')?.text).toContain('Elemental Overload: the target and enemies within 10 ft.');
      expect(row(14, 'Lava Burst')?.text).toContain('burning');
      expect(row(14, 'Lightning Bolt')?.text).toContain('chains to a second target within 30 ft. (DC 16 Dexterity save');
    });

    it('reaches Rage +4 dice at level 16', () => {
      expect(stat(16, 'Rage Damage')).toBe('+4');
      expect(row(16, 'Icefury')?.kind).toBe('4d8 Cold');
      expect(row(16, 'Lava Burst')?.kind).toBe('4d4 Fire');
      expect(row(16, 'Lightning Bolt')?.kind).toBe('4d6 Lightning');
      expect(row(16, 'Lightning Bolt')?.text).toContain('Elemental Overload');
    });

    it('gates Echo of the Elements at 6 and Primordial Bond at 10', () => {
      const names = (level: number) => ragingElementsCard(input(level))!.rows.map(r => r.name);
      expect(names(5)).toEqual(['Icefury', 'Lava Burst', 'Lightning Bolt']);
      expect(names(6)).toEqual(['Icefury', 'Lava Burst', 'Lightning Bolt', 'Echo of the Elements']);
      expect(names(10)).toEqual(['Icefury', 'Lava Burst', 'Lightning Bolt', 'Echo of the Elements', 'Primordial Bond']);
      expect(row(6, 'Echo of the Elements')?.spells).toEqual(['Elementalism', 'Daylight', 'Water Walk', 'Wind Wall']);
      expect(row(6, 'Echo of the Elements')?.text).toContain('Wisdom');
      expect(row(10, 'Primordial Bond')?.text).toContain('Resistance to Cold, Fire, and Lightning');
    });
  });

  describe('Spiritual Guardian', () => {
    const card = (level: number) => spiritualGuardianCard(input(level, PATH_OF_THE_SPIRITUAL_GUARDIAN))!;
    const row = (level: number, name: string) => card(level).rows.find(r => r.name === name);

    it('only shows for the Path of the Spiritual Guardian from level 3', () => {
      expect(spiritualGuardianCard(input(2, PATH_OF_THE_SPIRITUAL_GUARDIAN))).toBeNull();
      expect(spiritualGuardianCard(input(3, PATH_OF_THE_ELEMENTS))).toBeNull();
      expect(card(3).name).toBe('Spiritual Guardian');
    });

    it('lists the Spiritual Protectors options at level 3', () => {
      expect(card(3).rows.map(r => r.name)).toEqual(['Distract', 'Hinder', 'Strike']);
      expect(row(3, 'Strike')?.text).toContain('1d4 Cold, Fire, or Lightning');
    });

    it('sizes Spirit Shield at Rage Damage d6s from level 6', () => {
      expect(row(5, 'Spirit Shield')).toBeUndefined();
      expect(row(6, 'Spirit Shield')?.text).toContain('reduce that damage by 2d6');
      expect(row(6, 'Spirit Shield')?.text).toContain('within 30 ft.');
      expect(row(6, 'Spirit Shield')?.kind).toContain('Reaction');
      expect(row(9, 'Spirit Shield')?.text).toContain('3d6');
      expect(row(16, 'Spirit Shield')?.text).toContain('4d6');
    });

    it('gates Consult the Spirits at 10 and Spirits\' Fury at 14', () => {
      expect(card(9).rows.map(r => r.name)).toEqual(['Distract', 'Hinder', 'Strike', 'Spirit Shield']);
      expect(card(10).rows.map(r => r.name)).toEqual(['Distract', 'Hinder', 'Strike', 'Spirit Shield', 'Consult the Spirits']);
      expect(row(10, 'Consult the Spirits')?.spells).toEqual(['Augury', 'Clairvoyance']);
      expect(row(10, 'Consult the Spirits')?.text).toContain('Once per Short or Long Rest');
      expect(row(13, "Spirits' Fury")).toBeUndefined();
      expect(row(14, "Spirits' Fury")?.text).toContain('18–20');
      expect(row(14, "Spirits' Fury")?.text).toContain('Once per turn');
    });
  });

  it('collects the cards in panel order', () => {
    expect(shamanFeatureCards(input(2)).map(c => c.name)).toEqual([]);
    expect(shamanFeatureCards(input(3, null)).map(c => c.name)).toEqual(['Totems']);
    expect(shamanFeatureCards(input(3)).map(c => c.name)).toEqual(['Totems', 'Raging Elements']);
    expect(shamanFeatureCards(input(3, PATH_OF_THE_SPIRITUAL_GUARDIAN)).map(c => c.name))
      .toEqual(['Totems', 'Spiritual Guardian']);
    expect(shamanFeatureCards(input(5, 'Path of the World Tree')).map(c => c.name)).toEqual(['Totems']);
  });
});
