import { PC } from '../models/pc';
import {
  ClassResource, applyShortRestToPc, classResourceStates, classResourcesFor, featResourcesFor, recoveryLabel,
  regainsSpellSlotsOnShortRest, restoreClassResources, withResourceUsed,
} from './class-resources';

describe('class resources', () => {
  /**
   * The contract between the client and the server: the backend's
   * ClassResourcesTest carries the SAME block of text and runs it against its
   * own table. Change a rule and both blocks must change — keep them identical,
   * line for line.
   */
  // class | subclass | level | CHA | WIS | INT  =>  key:max:shortRest, ...   ("-" = none)
  const CASES = `
    Fighter||1|10|10|10 => secondWind:2:ONE
    Fighter||2|10|10|10 => secondWind:2:ONE,actionSurge:1:ALL
    Fighter||4|10|10|10 => secondWind:3:ONE,actionSurge:1:ALL
    Fighter||10|10|10|10 => secondWind:4:ONE,actionSurge:1:ALL
    Fighter||17|10|10|10 => secondWind:4:ONE,actionSurge:2:ALL
    Fighter|Battle Master|7|10|10|10 => secondWind:3:ONE,actionSurge:1:ALL
    Barbarian||1|10|10|10 => rage:2:ONE
    Barbarian||3|10|10|10 => rage:3:ONE
    Barbarian||6|10|10|10 => rage:4:ONE
    Barbarian||12|10|10|10 => rage:5:ONE
    Barbarian||17|10|10|10 => rage:6:ONE
    Barbarian|Path of the Elements|10|10|10|10 => rage:4:ONE
    Bard||1|16|10|10 => bardicInspiration:3:NONE
    Bard||4|8|10|10 => bardicInspiration:1:NONE
    Bard||5|18|10|10 => bardicInspiration:4:ALL
    Cleric||1|10|10|10 => -
    Cleric||2|10|10|10 => channelDivinity:2:ONE
    Cleric||6|10|10|10 => channelDivinity:3:ONE
    Cleric||18|10|10|10 => channelDivinity:4:ONE
    Druid||1|10|10|10 => -
    Druid||2|10|10|10 => wildShape:2:ONE
    Druid||6|10|10|10 => wildShape:3:ONE
    Druid||17|10|10|10 => wildShape:4:ONE
    Monk||1|10|10|10 => -
    Monk||2|10|10|10 => focusPoints:2:ALL
    Monk||11|10|10|10 => focusPoints:11:ALL
    Paladin||1|10|10|10 => layOnHands:5:NONE
    Paladin||3|10|10|10 => layOnHands:15:NONE,channelDivinity:2:ONE
    Paladin||11|10|10|10 => layOnHands:55:NONE,channelDivinity:3:ONE
    Paladin|Oath of the Holy|7|16|10|10 => layOnHands:35:NONE,channelDivinity:2:ONE
    Paladin|Oath of the Ebon Blade|1|16|10|10 => deathCoil:4:NONE
    Paladin|Oath of the Ebon Blade|5|8|10|10 => deathCoil:1:NONE,channelDivinity:2:ONE
    Paladin|oath of the ebon blade|11|20|10|10 => deathCoil:6:NONE,channelDivinity:3:ONE
    Ranger||5|10|16|10 => -
    Ranger|Demon Hunter|2|10|16|10 => -
    Ranger|Demon Hunter|3|10|16|10 => soulFragments:3:NONE
    Ranger|Demon Hunter|13|10|8|10 => soulFragments:2:NONE
    Ranger|Demon Hunter|17|10|18|10 => soulFragments:6:NONE
    Sorcerer||1|10|10|10 => -
    Sorcerer||2|10|10|10 => sorceryPoints:2:NONE
    Sorcerer||20|10|10|10 => sorceryPoints:20:NONE
    Warlock||5|10|10|10 => -
    Wizard||5|10|10|10 => -
    Rogue||5|10|10|10 => -
    Cleric|Arcana Domain|5|10|10|10 => channelDivinity:2:ONE
    Cleric|Arcana Domain|6|10|10|10 => channelDivinity:3:ONE,dispellingRecovery:1:ALL
    Cleric|arcana domain|18|10|10|10 => channelDivinity:4:ONE,dispellingRecovery:1:ALL
    Fighter|Arcane Archer|2|10|10|16 => secondWind:2:ONE,actionSurge:1:ALL
    Fighter|Arcane Archer|3|10|10|8 => secondWind:2:ONE,actionSurge:1:ALL,arcaneShot:1:ALL
    Fighter|Arcane Archer|3|10|10|10 => secondWind:2:ONE,actionSurge:1:ALL,arcaneShot:1:ALL
    Fighter|Arcane Archer|6|10|10|16 => secondWind:3:ONE,actionSurge:1:ALL,arcaneShot:3:ALL
    Fighter|Arcane Archer|7|10|10|16 => secondWind:3:ONE,actionSurge:1:ALL,arcaneShot:3:ALL,magicalAmmunition:1:ALL
    Monk|Warrior of the Mystic Arts|6|10|10|16 => focusPoints:6:ALL
    Warlock|Vestige Patron|2|10|10|10 => -
    Warlock|Vestige Patron|3|10|10|10 => divinePower:1:NONE
    Warlock|Vestige Patron|5|10|10|10 => divinePower:1:NONE
    Warlock|Vestige Patron|6|10|10|10 => divinePower:1:ALL
    Warlock|Vestige Patron|9|10|10|10 => divinePower:1:ALL
    Warlock|Vestige Patron|10|10|10|10 => divinePower:1:ALL,vestigeRecovery:1:NONE
    Warlock|Vestige Patron|13|10|10|10 => divinePower:1:ALL,vestigeRecovery:1:NONE
    Warlock|Vestige Patron|14|10|10|10 => divinePower:1:ALL,vestigeRecovery:1:NONE,semblanceOfLife:1:NONE
    Wizard|Conjurer|2|10|10|16 => -
    Wizard|Conjurer|3|10|10|8 => benignTransposition:1:NONE
    Wizard|Conjurer|3|10|10|10 => benignTransposition:1:NONE
    Wizard|Conjurer|13|10|10|16 => benignTransposition:3:NONE
    Wizard|Conjurer|14|10|10|16 => benignTransposition:3:NONE,splinteredSummons:1:NONE
    Wizard|Enchanter|2|10|10|16 => -
    Wizard|Enchanter|3|10|10|8 => hypnoticPresence:1:NONE
    Wizard|Enchanter|5|10|10|16 => hypnoticPresence:3:NONE
    Wizard|Enchanter|6|10|10|8 => hypnoticPresence:1:NONE
    Wizard|Enchanter|6|10|10|10 => hypnoticPresence:1:NONE
    Wizard|Enchanter|6|10|10|16 => hypnoticPresence:3:NONE,splitEnchantment:3:NONE
    Wizard|Enchanter|9|10|10|16 => hypnoticPresence:3:NONE,splitEnchantment:3:NONE
    Wizard|Enchanter|10|10|10|10 => hypnoticPresence:1:NONE,instinctiveCharm:1:NONE
    Wizard|Enchanter|10|10|10|16 => hypnoticPresence:3:NONE,splitEnchantment:3:NONE,instinctiveCharm:1:NONE
    Wizard|Necromancer|5|10|10|16 => -
    Wizard|Necromancer|6|10|10|16 => undeadThralls:1:NONE
    Wizard|Necromancer|13|10|10|16 => undeadThralls:1:NONE
    Wizard|Necromancer|14|10|10|16 => undeadThralls:1:NONE,bolsterUndead:1:NONE
    Wizard|Transmuter|2|10|10|16 => -
    Wizard|Transmuter|3|10|10|16 => wondrousAlteration:1:NONE
    Wizard|Transmuter|5|10|10|16 => wondrousAlteration:1:NONE
    Wizard|Transmuter|6|10|10|8 => wondrousAlteration:1:NONE,empoweredTransmutation:1:NONE
    Wizard|Transmuter|6|10|10|10 => wondrousAlteration:1:NONE,empoweredTransmutation:1:NONE
    Wizard|Transmuter|6|10|10|16 => wondrousAlteration:1:NONE,empoweredTransmutation:3:NONE
    Wizard|Transmuter|9|10|10|16 => wondrousAlteration:1:NONE,empoweredTransmutation:3:NONE
    Wizard|Transmuter|10|10|10|16 => wondrousAlteration:1:NONE,empoweredTransmutation:3:NONE,shapeShifterCast:1:NONE,shapeShifterSelf:1:NONE
    Wizard|Transmuter|13|10|10|16 => wondrousAlteration:1:NONE,empoweredTransmutation:3:NONE,shapeShifterCast:1:NONE,shapeShifterSelf:1:NONE
    Wizard|Transmuter|14|10|10|16 => wondrousAlteration:1:NONE,empoweredTransmutation:3:NONE,shapeShifterCast:1:NONE,shapeShifterSelf:1:NONE,masterTransmuter:1:NONE
  `;

  /**
   * The feat counters, case by case — the second block the backend's
   * ClassResourcesTest carries word for word (FEAT_CASES).
   */
  // level | INT | WIS | CHA | feats ("; " between)  =>  key:max:shortRest, ...   ("-" = none)
  const FEAT_CASES = `
    1|10|10|10|Arcane Artist => inspiringMagic:1:NONE
    1|10|10|10|Arcane Eloquence => -
    1|10|10|10|Arcane Infiltrator => cunningDiversion:2:NONE
    5|10|10|10|Arcane Infiltrator => cunningDiversion:3:NONE
    9|10|10|10|Arcane Omens => helpfulPremonition:4:NONE
    1|10|10|10|Arcane Overload => powerSurge:1:NONE
    13|10|10|10|Arcane Safeguard => bonusActionResistance:5:NONE
    1|10|10|10|Arcane Undertaker => understandingOfDeath:1:NONE
    1|10|10|10|Familiar Friend => findFamiliarFreeCast:1:NONE,helpfulFriend:2:NONE
    17|10|10|10|Familiar Friend => findFamiliarFreeCast:1:NONE,helpfulFriend:6:NONE
    4|10|10|10|Portal Jumper => portalStep:2:NONE
    8|10|10|10|Transmuted Anatomy => resilientAnatomy:3:NONE
    4|10|10|10|Divination Adept => prescientIntervention:1:NONE
    4|10|10|10|Abjuration Adept; Conjuration Adept; Enchantment Adept; Evocation Adept => -
    4|10|10|10|Illusion Adept; Necromancy Adept; Transmutation Adept => -
    4|10|10|10|Magic Initiate (Wizard); Magic Connoisseur => connoisseurLevel1Spell:1:NONE,connoisseurLevel2Spell:1:NONE
    4|10|10|10|Spell Resistant => magicResistant:2:NONE
    20|10|10|10|Spell Resistant => magicResistant:6:NONE
    4|8|8|8|Spell Subterfuge => shroudingSpells:1:NONE
    4|16|12|10|Spell Subterfuge => shroudingSpells:3:NONE
    8|10|20|14|Spell Subterfuge => shroudingSpells:5:NONE
    8|10|12|18|Spell Subterfuge => shroudingSpells:4:NONE
    4|10|10|10|Familiar Friend; Warlike Familiar => findFamiliarFreeCast:1:NONE,helpfulFriend:2:NONE,battleFamiliarFreeCast:1:NONE
    4|10|10|10|Elemental Familiar; Otherworldly Familiar; Soothing Familiar => -
    19|10|10|10|Arcane Warrior; Boon of the Iron Mind => -
    19|10|10|10|Boon of Erupting Spellpower => spellOverload:1:ALL
    19|10|10|10|Boon of Magic School Mastery (Evocation) => signatureArcanumEvocation:1:NONE
    20|10|10|10|Boon of Magic School Mastery (Illusion); Boon of Magic School Mastery (Abjuration) => signatureArcanumIllusion:1:NONE,signatureArcanumAbjuration:1:NONE
    19|10|10|10|Boon of Magic School Mastery => -
    5|10|10|10|arcane artist;  PORTAL JUMPER ; Arcane Artist => inspiringMagic:1:NONE,portalStep:3:NONE
    5|10|10|10|Alert; Lucky; Second Wind; Magic Initiate (Cleric) => -
    5|10|10|10| => -
  `;

  const describeResources = (resources: ClassResource[]): string =>
    resources.length ? resources.map(r => `${r.key}:${r.max}:${r.shortRest}`).join(',') : '-';

  const pc = (over: Partial<PC> = {}): PC =>
    ({ id: 1, name: 'Bex', clazz: 'Fighter', level: 5, playerName: 'Sam', ...over } as PC);

  it('every case gives exactly the resources the rules say', () => {
    const lines = CASES.trim().split('\n').map(l => l.trim());
    expect(lines.length).toBe(89);
    for (const line of lines) {
      const [input, expected] = line.split(' => ');
      const [clazz, subclass, level, cha, wis, int] = input.split('|');
      const actual = classResourcesFor({
        clazz, subclass: subclass || undefined, level: Number(level),
        stats: { STR: 10, DEX: 10, CON: 10, INT: Number(int), WIS: Number(wis), CHA: Number(cha) },
      });
      expect(describeResources(actual)).withContext(input).toBe(expected);
    }
  });

  it('every feat case gives exactly the counters the rules say', () => {
    const lines = FEAT_CASES.trim().split('\n').map(l => l.trim());
    expect(lines.length).toBe(32);
    for (const line of lines) {
      const [input, expected] = line.split(' => ');
      const [level, int, wis, cha, feats] = input.split('|');
      const actual = featResourcesFor(feats.trim() ? feats.split(';') : [], Number(level),
        { INT: Number(int), WIS: Number(wis), CHA: Number(cha) });
      expect(describeResources(actual)).withContext(input).toBe(expected);
    }
  });

  it('lists a character\'s feat counters after its class resources, each belonging to its feat', () => {
    const wizard = classResourcesFor({
      clazz: 'Wizard', level: 4, stats: { STR: 10, DEX: 10, CON: 10, INT: 16, WIS: 10, CHA: 10 },
      feat: 'Familiar Friend',
      features: [
        { name: 'Familiar Friend', source: 'Familiar Trainer · Origin Feat', desc: '' },
        { name: 'Arcane Recovery', source: 'Wizard 1', desc: '' },
        { name: 'Spell Subterfuge', source: 'Feat (Level 4)', desc: '' },
      ],
    });
    expect(describeResources(wizard)).toBe('findFamiliarFreeCast:1:NONE,helpfulFriend:2:NONE,shroudingSpells:3:NONE');
    expect(wizard.map(r => r.feature)).toEqual(['Familiar Friend', 'Familiar Friend', 'Spell Subterfuge']);
    expect(wizard.map(r => r.name)).toEqual(['Find Familiar (free cast)', 'Helpful Friend', 'Shrouding Spells']);
    expect(wizard.every(r => r.fromFeat && !r.pool && r.unit === 'uses')).toBeTrue();

    const fighter = classResourcesFor(pc({ features: [{ name: 'Portal Jumper', source: 'Feat', desc: '' }] }));
    expect(describeResources(fighter)).toBe('secondWind:3:ONE,actionSurge:1:ALL,portalStep:3:NONE');
    expect(fighter.map(r => !!r.fromFeat)).toEqual([false, false, true]);

    const [arcanum] = featResourcesFor(['boon of magic school mastery (necromancy)'], 19);
    expect([arcanum.name, arcanum.feature]).toEqual(['Signature Arcanum (Necromancy)', 'Boon of Magic School Mastery (Necromancy)']);
    // No level, no scores: level 1 and scores of 10.
    expect(describeResources(featResourcesFor(['Spell Subterfuge', 'Spell Resistant'], undefined)))
      .toBe('shroudingSpells:1:NONE,magicResistant:2:NONE');
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

  it('names the Arcana Unleashed subclass counters for the feature each belongs to', () => {
    const stats = { STR: 10, DEX: 10, CON: 10, INT: 18, WIS: 10, CHA: 10 };
    const of = (clazz: string, subclass: string, level = 20) =>
      classResourcesFor({ clazz, subclass, level, stats }).map(r => [r.key, r.name, r.feature]);
    expect(of('Cleric', 'Arcana Domain').at(-1)).toEqual(['dispellingRecovery', 'Dispelling Recovery', 'Dispelling Recovery']);
    expect(of('Fighter', 'Arcane Archer').slice(2)).toEqual([
      ['arcaneShot', 'Arcane Shot', 'Arcane Shot'], ['magicalAmmunition', 'Magical Ammunition', 'Magical Ammunition'],
    ]);
    expect(of('Warlock', 'Vestige Patron')).toEqual([
      ['divinePower', 'Divine Power', 'Vestige Companion'], ['vestigeRecovery', 'Vestige Recovery', 'Vestige Recovery'],
      ['semblanceOfLife', 'Semblance of Life', 'Semblance of Life'],
    ]);
    expect(of('Wizard', 'Conjurer')).toEqual([
      ['benignTransposition', 'Benign Transposition', 'Benign Transposition'],
      ['splinteredSummons', 'Splintered Summons', 'Splintered Summons'],
    ]);
    expect(of('Wizard', 'Enchanter')).toEqual([
      ['hypnoticPresence', 'Hypnotic Presence', 'Hypnotic Presence'], ['splitEnchantment', 'Split Enchantment', 'Split Enchantment'],
      ['instinctiveCharm', 'Instinctive Charm', 'Instinctive Charm'],
    ]);
    expect(of('Wizard', 'Necromancer')).toEqual([
      ['undeadThralls', 'Animate Dead (free cast)', 'Undead Thralls'], ['bolsterUndead', 'Bolster Undead', "Death's Master"],
    ]);
    expect(of('Wizard', 'Transmuter')).toEqual([
      ['wondrousAlteration', 'Alter Self (free cast)', 'Wondrous Alteration'],
      ['empoweredTransmutation', 'Empowered Transmutation', 'Empowered Transmutation'],
      ['shapeShifterCast', 'Polymorph (free cast)', 'Shape-Shifter'], ['shapeShifterSelf', 'Shape-Shifter (self)', 'Shape-Shifter'],
      ['masterTransmuter', 'Master Transmuter', 'Master Transmuter'],
    ]);
    // Every one is a handful of uses, never a pool; a subclass counts only on its own class.
    const all = ['Arcana Domain', 'Arcane Archer', 'Vestige Patron', 'Conjurer', 'Enchanter', 'Necromancer', 'Transmuter'];
    const classOf: Record<string, string> = { 'Arcana Domain': 'Cleric', 'Arcane Archer': 'Fighter', 'Vestige Patron': 'Warlock' };
    for (const subclass of all) {
      const own = classResourcesFor({ clazz: classOf[subclass] ?? 'Wizard', subclass, level: 20, stats });
      expect(own.every(r => !r.pool && r.unit === 'uses' && !r.fromFeat)).withContext(subclass).toBeTrue();
      expect(describeResources(classResourcesFor({ clazz: 'Rogue', subclass, level: 20, stats }))).withContext(subclass).toBe('-');
    }
    // A Short Rest gives an archer's shots back, a Vestige Patron's Divine Power only from Warlock 6.
    const patron = (level: number) => applyShortRestToPc(pc({
      clazz: 'Warlock', subclass: 'Vestige Patron', level, classResources: { divinePower: 1, vestigeRecovery: 1 },
    })).classResources;
    expect(patron(5)).toEqual({ divinePower: 1 });
    expect(patron(10)).toEqual({ vestigeRecovery: 1 });
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

    it('rests restore feat counters like any other: all on a Long Rest, Spell Overload on a Short Rest too', () => {
      const wizard = pc({
        clazz: 'Wizard', level: 19, feat: 'Familiar Friend',
        features: [
          { name: 'Boon of Erupting Spellpower', source: 'Feat (Level 19)', desc: '' },
          { name: 'Boon of Magic School Mastery (Evocation)', source: 'Feat', desc: '' },
        ],
        classResources: { helpfulFriend: 2, spellOverload: 1, signatureArcanumEvocation: 1, rage: 1 },
      });
      expect(classResourceStates(wizard).map(s => [s.key, s.used, s.remaining])).toEqual([
        ['findFamiliarFreeCast', 0, 1], ['helpfulFriend', 2, 4], ['spellOverload', 1, 0], ['signatureArcanumEvocation', 1, 0],
      ]);
      expect(applyShortRestToPc(wizard).classResources).toEqual({ helpfulFriend: 2, signatureArcanumEvocation: 1 });
      expect(restoreClassResources(wizard).classResources).toEqual({});
      expect(withResourceUsed(wizard, 'findFamiliarFreeCast', 5))
        .toEqual({ findFamiliarFreeCast: 1, helpfulFriend: 2, spellOverload: 1, signatureArcanumEvocation: 1 });
      const [, , overload, arcanum] = classResourcesFor(wizard);
      expect(recoveryLabel(overload)).toBe('All back on a Short or Long Rest.');
      expect(recoveryLabel(arcanum)).toBe('All back on a Long Rest.');
      // A character with a feat counter and no class resource still has something to restore.
      const rogue = pc({ clazz: 'Rogue', feat: 'Portal Jumper' });
      expect(restoreClassResources(rogue).classResources).toEqual({});
    });

    it('a Short Rest leaves a hero at 0 Hit Points alone', () => {
      const down = pc({ hp: { cur: 0, max: 30, temp: 0 }, classResources: { secondWind: 2 } });
      expect(applyShortRestToPc(down)).toBe(down);
    });
  });
});
