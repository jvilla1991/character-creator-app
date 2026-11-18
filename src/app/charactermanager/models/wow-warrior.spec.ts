import { FeatureCardInput } from './hero-class';
import {
  BATTLE_MASTER, battleMasterCard, maneuverSaveDc, superiorityDiceCount, superiorityDieSize, warriorFeatureCards,
  wowManeuverRows,
} from './wow-warrior';

const STATS = { STR: 17, DEX: 12, CON: 15, INT: 8, WIS: 12, CHA: 10 };

function input(level: number, subclass: string | null = BATTLE_MASTER, prof?: number, stats = STATS): FeatureCardInput {
  return { level, subclass, stats, prof };
}

describe('wow-warrior', () => {
  it('counts Superiority Dice: 4 from level 3, 5 from 7, 6 from 15 (none before 3)', () => {
    expect(superiorityDiceCount(2)).toBe(0);
    expect(superiorityDiceCount(3)).toBe(4);
    expect(superiorityDiceCount(6)).toBe(4);
    expect(superiorityDiceCount(7)).toBe(5);
    expect(superiorityDiceCount(10)).toBe(5);
    expect(superiorityDiceCount(14)).toBe(5);
    expect(superiorityDiceCount(15)).toBe(6);
    expect(superiorityDiceCount(18)).toBe(6);
    expect(superiorityDiceCount(20)).toBe(6);
  });

  it('sizes the Superiority Die d8, d10 from level 10, d12 from 18', () => {
    expect(superiorityDieSize(3)).toBe(8);
    expect(superiorityDieSize(7)).toBe(8);
    expect(superiorityDieSize(9)).toBe(8);
    expect(superiorityDieSize(10)).toBe(10);
    expect(superiorityDieSize(15)).toBe(10);
    expect(superiorityDieSize(17)).toBe(10);
    expect(superiorityDieSize(18)).toBe(12);
    expect(superiorityDieSize(20)).toBe(12);
  });

  it('computes the maneuver save DC as 8 + PB + the higher of STR and DEX', () => {
    expect(maneuverSaveDc(input(3))).toBe(13);                 // 8 + 2 + STR 3
    expect(maneuverSaveDc(input(7))).toBe(14);                 // PB 3
    expect(maneuverSaveDc(input(10))).toBe(15);                // PB 4
    expect(maneuverSaveDc(input(15))).toBe(16);                // PB 5
    expect(maneuverSaveDc(input(18))).toBe(17);                // PB 6
    expect(maneuverSaveDc(input(7, BATTLE_MASTER, 4))).toBe(15); // the stored PB wins
    // A Dexterity fighter uses DEX when it's higher.
    expect(maneuverSaveDc(input(3, BATTLE_MASTER, undefined, { ...STATS, STR: 10, DEX: 18 }))).toBe(14);
    expect(maneuverSaveDc({ level: 3 })).toBe(10);
  });

  describe('Battle Master card', () => {
    const stat = (card: ReturnType<typeof battleMasterCard>, label: string) =>
      card!.stats!.find(s => s.label === label)?.value;

    it('only shows for a Battle Master from Fighter level 3', () => {
      expect(battleMasterCard(input(2))).toBeNull();
      expect(battleMasterCard(input(3, 'Champion'))).toBeNull();
      expect(battleMasterCard(input(10, null))).toBeNull();
      expect(battleMasterCard(input(3, 'battle master'))?.name).toBe('Battle Master');
      expect(warriorFeatureCards(input(3)).map(c => c.name)).toEqual(['Battle Master']);
      expect(warriorFeatureCards(input(3, 'Eldritch Knight'))).toEqual([]);
      expect(warriorFeatureCards(input(2))).toEqual([]);
    });

    it('shows the dice, die size, save DC and Short-or-Long-Rest regain', () => {
      const at = (level: number) => battleMasterCard(input(level));
      expect(at(3)!.source).toBe('Battle Master 3');
      expect([stat(at(3), 'Superiority Dice'), stat(at(3), 'Die'), stat(at(3), 'Maneuver DC')]).toEqual(['4', 'd8', '13']);
      expect([stat(at(7), 'Superiority Dice'), stat(at(7), 'Die'), stat(at(7), 'Maneuver DC')]).toEqual(['5', 'd8', '14']);
      expect([stat(at(10), 'Superiority Dice'), stat(at(10), 'Die')]).toEqual(['5', 'd10']);
      expect([stat(at(15), 'Superiority Dice'), stat(at(15), 'Die')]).toEqual(['6', 'd10']);
      expect([stat(at(18), 'Superiority Dice'), stat(at(18), 'Die')]).toEqual(['6', 'd12']);
      expect(stat(at(3), 'Regain')).toBe('Short or Long Rest');
      expect(at(3)!.summary).toContain('Short or Long Rest');
      expect(at(3)!.summary).toContain('Strength or Dexterity');
    });

    it('lists the five World of Warcraft maneuvers and notes that maneuvers are not tracked', () => {
      const card = battleMasterCard(input(3))!;
      expect(card.rowsTitle).toBe('World of Warcraft maneuvers');
      expect(card.rows.map(r => r.name))
        .toEqual(['Battle Shout', 'Demoralizing Shout', 'Heroic Leap', 'Mortal Strike', 'Warding Maneuver']);
      expect(card.rows.map(r => r.kind)).toEqual(['Bonus Action', 'Bonus Action', 'Bonus Action', 'On a hit', 'Reaction']);
      expect(card.note).toContain("aren't tracked by the app");
      expect(card.note).toContain('DM');
    });
  });

  describe('World of Warcraft maneuver text', () => {
    const text = (level: number, name: string) => wowManeuverRows(level, 13, 17).find(r => r.name === name)!.text;

    it('inserts the current die size into every maneuver', () => {
      for (const row of wowManeuverRows(3, 13, 17)) expect(row.text).withContext(row.name).toContain('(d8)');
      for (const row of wowManeuverRows(10, 13, 17)) expect(row.text).withContext(row.name).toContain('(d10)');
      for (const row of wowManeuverRows(18, 13, 17)) expect(row.text).withContext(row.name).toContain('(d12)');
    });

    it('paraphrases each maneuver', () => {
      expect(text(3, 'Battle Shout')).toContain('within 30 ft. who can hear you');
      expect(text(3, 'Battle Shout')).toContain('start of your next turn');
      expect(text(3, 'Battle Shout')).toContain('hits with a melee attack');
      expect(text(3, 'Demoralizing Shout')).toContain('end of your next turn');
      expect(text(3, 'Demoralizing Shout')).toContain('subtracts the roll from its damage');
      expect(text(3, 'Demoralizing Shout')).toContain('target other than you');
      expect(text(3, 'Heroic Leap')).toContain('up to 17 ft., your Strength score');
      expect(text(3, 'Heroic Leap')).toContain('within 5 ft. of where you land');
      expect(text(3, 'Heroic Leap')).toContain('DC 13 Strength saving throw');
      expect(text(3, 'Heroic Leap')).toContain('Bludgeoning damage equal to the die roll');
      expect(text(3, 'Heroic Leap')).toContain('half as much on a success');
      expect(text(3, 'Mortal Strike')).toContain('hit a creature with an attack roll');
      expect(text(3, 'Mortal Strike')).toContain("can't regain Hit Points until the end of your next turn");
      expect(text(3, 'Warding Maneuver')).toContain('within 5 ft. of you is hit by an attack roll');
      expect(text(3, 'Warding Maneuver')).toContain('melee weapon or a Shield');
      expect(text(3, 'Warding Maneuver')).toContain("to the target's AC against that attack");
      expect(text(3, 'Warding Maneuver')).toContain('Resistance to its damage');
      expect(wowManeuverRows(3, 13, undefined).find(r => r.name === 'Heroic Leap')!.text)
        .toContain('your Strength score in feet');
    });

    it('uses the card\'s save DC for Heroic Leap', () => {
      const leap = battleMasterCard(input(7))!.rows.find(r => r.name === 'Heroic Leap')!;
      expect(leap.text).toContain('DC 14 Strength saving throw');
    });
  });
});
