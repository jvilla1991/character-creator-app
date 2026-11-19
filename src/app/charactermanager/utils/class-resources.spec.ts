import { PC } from '../models/pc';
import {
  ClassResource, applyShortRestToPc, classResourceStates, classResourcesFor, recoveryLabel,
  regainsSpellSlotsOnShortRest, restoreClassResources, withResourceUsed,
} from './class-resources';

describe('class resources', () => {
  /**
   * The contract between the client and the server: the backend's
   * ClassResourcesTest carries the SAME block of text and runs it against its
   * own table. Change a rule and both blocks must change — keep them identical,
   * line for line.
   */
  // class | subclass | level | CHA | WIS  =>  key:max:shortRest, ...   ("-" = none)
  const CASES = `
    Fighter||1|10|10 => secondWind:2:ONE
    Fighter||2|10|10 => secondWind:2:ONE,actionSurge:1:ALL
    Fighter||4|10|10 => secondWind:3:ONE,actionSurge:1:ALL
    Fighter||10|10|10 => secondWind:4:ONE,actionSurge:1:ALL
    Fighter||17|10|10 => secondWind:4:ONE,actionSurge:2:ALL
    Fighter|Battle Master|7|10|10 => secondWind:3:ONE,actionSurge:1:ALL
    Barbarian||1|10|10 => rage:2:ONE
    Barbarian||3|10|10 => rage:3:ONE
    Barbarian||6|10|10 => rage:4:ONE
    Barbarian||12|10|10 => rage:5:ONE
    Barbarian||17|10|10 => rage:6:ONE
    Barbarian|Path of the Elements|10|10|10 => rage:4:ONE
    Bard||1|16|10 => bardicInspiration:3:NONE
    Bard||4|8|10 => bardicInspiration:1:NONE
    Bard||5|18|10 => bardicInspiration:4:ALL
    Cleric||1|10|10 => -
    Cleric||2|10|10 => channelDivinity:2:ONE
    Cleric||6|10|10 => channelDivinity:3:ONE
    Cleric||18|10|10 => channelDivinity:4:ONE
    Druid||1|10|10 => -
    Druid||2|10|10 => wildShape:2:ONE
    Druid||6|10|10 => wildShape:3:ONE
    Druid||17|10|10 => wildShape:4:ONE
    Monk||1|10|10 => -
    Monk||2|10|10 => focusPoints:2:ALL
    Monk||11|10|10 => focusPoints:11:ALL
    Paladin||1|10|10 => layOnHands:5:NONE
    Paladin||3|10|10 => layOnHands:15:NONE,channelDivinity:2:ONE
    Paladin||11|10|10 => layOnHands:55:NONE,channelDivinity:3:ONE
    Paladin|Oath of the Holy|7|16|10 => layOnHands:35:NONE,channelDivinity:2:ONE
    Paladin|Oath of the Ebon Blade|1|16|10 => deathCoil:4:NONE
    Paladin|Oath of the Ebon Blade|5|8|10 => deathCoil:1:NONE,channelDivinity:2:ONE
    Paladin|oath of the ebon blade|11|20|10 => deathCoil:6:NONE,channelDivinity:3:ONE
    Ranger||5|10|16 => -
    Ranger|Demon Hunter|2|10|16 => -
    Ranger|Demon Hunter|3|10|16 => soulFragments:3:NONE
    Ranger|Demon Hunter|13|10|8 => soulFragments:2:NONE
    Ranger|Demon Hunter|17|10|18 => soulFragments:6:NONE
    Sorcerer||1|10|10 => -
    Sorcerer||2|10|10 => sorceryPoints:2:NONE
    Sorcerer||20|10|10 => sorceryPoints:20:NONE
    Warlock||5|10|10 => -
    Wizard||5|10|10 => -
    Rogue||5|10|10 => -
  `;

  const describeResources = (resources: ClassResource[]): string =>
    resources.length ? resources.map(r => `${r.key}:${r.max}:${r.shortRest}`).join(',') : '-';

  const pc = (over: Partial<PC> = {}): PC =>
    ({ id: 1, name: 'Bex', clazz: 'Fighter', level: 5, playerName: 'Sam', ...over } as PC);

  it('every case gives exactly the resources the rules say', () => {
    const lines = CASES.trim().split('\n').map(l => l.trim());
    expect(lines.length).toBe(44);
    for (const line of lines) {
      const [input, expected] = line.split(' => ');
      const [clazz, subclass, level, cha, wis] = input.split('|');
      const actual = classResourcesFor({
        clazz, subclass: subclass || undefined, level: Number(level),
        stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: Number(wis), CHA: Number(cha) },
      });
      expect(describeResources(actual)).withContext(input).toBe(expected);
    }
  });

  it('tells pools from uses, and names them for the sheet', () => {
    const lay = classResourcesFor(pc({ clazz: 'Paladin', level: 4 }))[0];
    expect(lay).toEqual(jasmine.objectContaining({ pool: true, name: 'Lay On Hands', unit: 'points' }));
    const wind = classResourcesFor(pc({ level: 1 }))[0];
    expect(wind).toEqual(jasmine.objectContaining({ pool: false, unit: 'uses' }));
    // Points belong to the feature that grants them, as the feature lists name it.
    expect(classResourcesFor(pc({ clazz: 'Sorcerer', level: 3 }))[0].feature).toBe('Font of Magic');
    expect(classResourcesFor(pc({ clazz: 'Monk', level: 3 }))[0].feature).toBe("Monk's Focus");
    expect(classResourcesFor(pc({ clazz: 'Paladin', subclass: 'Oath of the Ebon Blade' }))[0].unit).toBe('d8');
  });

  it('handles missing values', () => {
    expect(classResourcesFor(null)).toEqual([]);
    expect(describeResources(classResourcesFor({ clazz: ' fighter ', level: undefined as never })))
      .toBe('secondWind:2:ONE');
    expect(describeResources(classResourcesFor({ clazz: 'Bard', level: 3 }))).toBe('bardicInspiration:1:NONE');
  });

  it('only a Warlock regains spell slots on a Short Rest', () => {
    expect(regainsSpellSlotsOnShortRest('Warlock')).toBeTrue();
    expect(regainsSpellSlotsOnShortRest(' warlock ')).toBeTrue();
    expect(regainsSpellSlotsOnShortRest('Wizard')).toBeFalse();
    expect(regainsSpellSlotsOnShortRest(null)).toBeFalse();
  });

  describe('used amounts', () => {
    it('reads what is used and what is left, clamped to the maximum', () => {
      const states = classResourceStates(pc({ classResources: { secondWind: 1, actionSurge: 9 } }));
      expect(states.map(s => [s.key, s.used, s.remaining])).toEqual([
        ['secondWind', 1, 2],
        ['actionSurge', 1, 0], // 9 used of a maximum of 1
      ]);
      expect(classResourceStates(pc()).map(s => s.remaining)).toEqual([3, 1]); // nothing stored: all left
      expect(classResourceStates(pc({ classResources: { secondWind: -4 } as never }))[0].used).toBe(0);
    });

    it('sets one resource, keeping the others, dropping zeroes and unknown keys', () => {
      const fighter = pc({ classResources: { secondWind: 1, rage: 2 } });
      expect(withResourceUsed(fighter, 'actionSurge', 1)).toEqual({ secondWind: 1, actionSurge: 1 });
      expect(withResourceUsed(fighter, 'secondWind', 99)).toEqual({ secondWind: 3 });
      // Everything handed back is an empty object, never null: the save must say so.
      expect(withResourceUsed(fighter, 'secondWind', 0)).toEqual({});
    });

    it('says when a resource comes back', () => {
      const [wind, surge] = classResourcesFor(pc());
      expect(recoveryLabel(wind)).toBe('Short Rest: 1 back. Long Rest: all back.');
      expect(recoveryLabel(surge)).toBe('All back on a Short or Long Rest.');
      expect(recoveryLabel(classResourcesFor(pc({ clazz: 'Sorcerer' }))[0])).toBe('All back on a Long Rest.');
    });
  });

  describe('rests (demo mirror)', () => {
    it('a Long Rest hands everything back', () => {
      expect(restoreClassResources(pc({ classResources: { secondWind: 2 } })).classResources).toEqual({});
      const wizard = pc({ clazz: 'Wizard' });
      expect(restoreClassResources(wizard)).toBe(wizard); // nothing to track
    });

    it('a Short Rest gives back one use or everything, per the rules', () => {
      const after = applyShortRestToPc(pc({ classResources: { secondWind: 3, actionSurge: 1 } }));
      expect(after.classResources).toEqual({ secondWind: 2 });

      const paladin = applyShortRestToPc(pc({ clazz: 'Paladin', classResources: { layOnHands: 20, channelDivinity: 2 } }));
      expect(paladin.classResources).toEqual({ layOnHands: 20, channelDivinity: 1 });
    });

    it('a Short Rest restores a Warlock\'s slots, and nobody else\'s', () => {
      const slots = { 3: { max: 2, used: 2 } };
      expect(applyShortRestToPc(pc({ clazz: 'Warlock', spellSlots: slots })).spellSlots).toEqual({ 3: { max: 2, used: 0 } });
      expect(applyShortRestToPc(pc({ clazz: 'Wizard', spellSlots: slots })).spellSlots).toBe(slots);
    });

    it('a Short Rest leaves a hero at 0 Hit Points alone', () => {
      const down = pc({ hp: { cur: 0, max: 30, temp: 0 }, classResources: { secondWind: 2 } });
      expect(applyShortRestToPc(down)).toBe(down);
    });
  });
});
