import { Follower, FollowerStatBlock } from './follower';
import { PC } from './pc';
import { VESTIGE_TYPES, VestigeType } from './arcana-subclasses';
import {
  VESTIGE_DAMAGE, VESTIGE_NAME, buildVestigeStatBlock, isVestigeCompanion, isVestigePatron,
  syncVestigeCompanion, vestigeInputsFor, vestigeTypeOf,
} from './vestige-companion';

// type | Warlock level | Charisma | Proficiency Bonus  =>  Armor Class, Hit Points, Hit Dice, the Pact Bond
// bonus, Vestige's Strike (to hit, damage), the Divine Power option (with the Hit Points a Healing Touch
// restores), the resistance and the creature line.
// Keep this block identical to SHARED_CASES in the backend's VestigeCompanionTest.
const SHARED_CASES = `
    Celestial|3|8|2 => AC 12 ; HP 16 ; 3d6 ; Bond +2 ; Strike +1, 1d6 + 2 Radiant ; Healing Touch 2d8 - 1 ; Resists Radiant damage. ; Small Celestial, Neutral
    Celestial|5|10|3 => AC 13 ; HP 24 ; 5d6 ; Bond +3 ; Strike +3, 1d6 + 3 Radiant ; Healing Touch 2d8 ; Resists Radiant damage. ; Small Celestial, Neutral
    Celestial|20|18|6 => AC 17 ; HP 84 ; 20d6 ; Bond +6 ; Strike +10, 1d6 + 7 Radiant ; Healing Touch 2d8 + 4 ; Resists Radiant damage. ; Small Celestial, Neutral
    Fiend|3|10|2 => AC 13 ; HP 16 ; 3d6 ; Bond +2 ; Strike +2, 1d6 + 3 Fire ; Fiendish Swap ; Resists Fire damage. ; Small Fiend, Neutral
    Fiend|5|18|3 => AC 17 ; HP 24 ; 5d6 ; Bond +3 ; Strike +7, 1d6 + 7 Fire ; Fiendish Swap ; Resists Fire damage. ; Small Fiend, Neutral
    Fiend|20|8|6 => AC 12 ; HP 84 ; 20d6 ; Bond +6 ; Strike +5, 1d6 + 2 Fire ; Fiendish Swap ; Resists Fire damage. ; Small Fiend, Neutral
    Undead|3|18|2 => AC 17 ; HP 16 ; 3d6 ; Bond +2 ; Strike +6, 1d6 + 7 Necrotic ; Cursed Invocation ; Resists Necrotic damage. ; Small Undead, Neutral
    Undead|5|8|3 => AC 12 ; HP 24 ; 5d6 ; Bond +3 ; Strike +2, 1d6 + 2 Necrotic ; Cursed Invocation ; Resists Necrotic damage. ; Small Undead, Neutral
    Undead|20|10|6 => AC 13 ; HP 84 ; 20d6 ; Bond +6 ; Strike +6, 1d6 + 3 Necrotic ; Cursed Invocation ; Resists Necrotic damage. ; Small Undead, Neutral
    Fiend|5|18|4 => AC 17 ; HP 24 ; 5d6 ; Bond +4 ; Strike +8, 1d6 + 7 Fire ; Fiendish Swap ; Resists Fire damage. ; Small Fiend, Neutral
    Undead|9|20|4 => AC 18 ; HP 40 ; 9d6 ; Bond +4 ; Strike +9, 1d6 + 8 Necrotic ; Cursed Invocation ; Resists Necrotic damage. ; Small Undead, Neutral
    Celestial|17|1|6 => AC 8 ; HP 72 ; 17d6 ; Bond +6 ; Strike +1, 1d6 - 2 Radiant ; Healing Touch 2d8 - 5 ; Resists Radiant damage. ; Small Celestial, Neutral
    Fiend|3|30|2 => AC 23 ; HP 16 ; 3d6 ; Bond +2 ; Strike +12, 1d6 + 13 Fire ; Fiendish Swap ; Resists Fire damage. ; Small Fiend, Neutral
    Celestial|12|16|5 => AC 16 ; HP 52 ; 12d6 ; Bond +5 ; Strike +8, 1d6 + 6 Radiant ; Healing Touch 2d8 + 3 ; Resists Radiant damage. ; Small Celestial, Neutral
`;

// The whole block for a Fiend vestige of a Warlock 5 with Charisma 18, Proficiency Bonus +3, who knows
// Common and Infernal: key for key, in order. The backend's VestigeCompanionTest holds the same text.
const FIEND_5_JSON = '{"companion":"vestige","clazz":"Vestige","race":"Fiend","level":5,'
  + '"alignment":"Neutral","hp":{"max":24,"cur":24,"temp":0},"ac":17,"init":2,"speed":5,'
  + '"prof":3,"stats":{"STR":1,"DEX":14,"CON":10,"INT":15,"WIS":15,"CHA":16},"saves":[],'
  + '"skills":{},"conditions":[],"conditionImmunities":["charmed","frightened","prone"],'
  + '"coins":{"cp":0,"sp":0,"gp":0},"spellSlots":{},"spells":[],"inventory":[],"features":['
  + '{"name":"Pact Bond","source":"Trait","desc":"Adds +3 (your Proficiency Bonus) to every '
  + 'ability check and saving throw it makes."},'
  + '{"name":"Vestige\'s Strike","source":"Action","desc":"Melee or ranged attack: +7 to hit, '
  + 'reach 5 ft. or range 60 ft. Hit: 1d6 + 7 Fire damage."},'
  + '{"name":"Divine Power: Fiendish Swap","source":"Bonus Action","desc":"While you and the '
  + 'vestige are within 60 ft. of each other, you teleport into each other\'s space. One use, counted as '
  + 'Divine Power on your sheet."},'
  + '{"name":"Creature","source":"Stat block","desc":"Small Fiend, Neutral","category":"other"},'
  + '{"name":"Movement","source":"Stat block","desc":"Fly 30 ft. (hover)","category":"other"},'
  + '{"name":"Resistance","source":"Stat block","desc":"Fire damage.","category":"other"},'
  + '{"name":"Hit Dice","source":"Stat block","desc":"5d6","category":"other"}],'
  + '"languages":["Common","Infernal"],"toolProfs":[],"bio":"The vestige of a dying god, bound to '
  + 'you by your pact. It acts on your turn: it moves and uses its Reaction by itself, but only Dodges '
  + 'unless you command it with a Bonus Action or give up one attack of your Attack action for its '
  + 'Vestige\'s Strike. At 0 Hit Points it disappears until you perform a 1-minute ceremony, which brings '
  + 'it back with all its Hit Points."}';

const build = (type: VestigeType, level: number, charisma: number, prof: number, languages: string[] = []) =>
  buildVestigeStatBlock({ type, level, charisma, prof, languages });

const desc = (block: FollowerStatBlock, namePrefix: string): string =>
  (block.features ?? []).find(f => f.name.startsWith(namePrefix))!.desc;

/** One block as a shared case reads it; the backend's test has the same function. */
function summary(block: FollowerStatBlock): string {
  const power = (block.features ?? []).find(f => f.name.startsWith('Divine Power: '))!;
  const strike = /: ([+-]\d+) to hit, reach 5 ft\. or range 60 ft\. Hit: (.+) damage\./.exec(desc(block, "Vestige's Strike"))!;
  const heal = /regains (\S+(?: [+-] \d+)?) Hit Points/.exec(power.desc);
  return [
    `AC ${block.ac}`,
    `HP ${block.hp!.max}`,
    desc(block, 'Hit Dice'),
    `Bond ${/Adds ([+-]\d+) /.exec(desc(block, 'Pact Bond'))![1]}`,
    `Strike ${strike[1]}, ${strike[2]}`,
    power.name.slice('Divine Power: '.length) + (heal ? ` ${heal[1]}` : ''),
    `Resists ${desc(block, 'Resistance')}`,
    desc(block, 'Creature'),
  ].join(' ; ');
}

/** A level 5 Vestige Patron with Charisma 18 who chose a Fiend: the sheet stores a +3 bonus. */
const warlock = (over: Partial<PC> = {}): PC => ({
  id: 7, name: 'Aelindra', clazz: 'Warlock', subclass: 'Vestige Patron', level: 5, playerName: 'Sam', prof: 3,
  stats: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 18 },
  languages: ['Common', 'Infernal'],
  subclassChoices: { vestigeType: 'Fiend', vestigeDomain: 'War' },
  ...over,
});

const guard = (id: number, kind: Follower['kind'], statBlock: FollowerStatBlock = { clazz: 'Guard', ac: 16 }): Follower =>
  ({ id, pcId: 7, name: `Follower ${id}`, statBlock, kind });

let nextId = 100;
const newId = () => nextId++;
const sync = (followers: readonly Follower[], pc: PC) => syncVestigeCompanion(followers, pc, newId);
const vestigeIn = (followers: readonly Follower[]): Follower => {
  const found = followers.filter(isVestigeCompanion);
  expect(found.length).toBe(1);
  return found[0];
};

describe('vestige companion', () => {
  describe('the stat block', () => {
    it('matches the server for every shared case', () => {
      const lines = SHARED_CASES.split('\n').map(l => l.trim()).filter(l => !!l);
      expect(lines.length).toBe(14);
      for (const line of lines) {
        const [input, expected] = line.split(' => ');
        const [type, level, charisma, prof] = input.split('|');
        const block = build(type as VestigeType, Number(level), Number(charisma), Number(prof));
        expect(summary(block)).withContext(input).toBe(expected);
        expect(block.prof).withContext(input).toBe(Number(prof));
        expect(block.level).withContext(input).toBe(Number(level));
        expect(block.race).withContext(input).toBe(type);
      }
    });

    it('is the same JSON the server builds, key for key', () => {
      expect(JSON.stringify(build('Fiend', 5, 18, 3, ['Common', 'Infernal']))).toBe(FIEND_5_JSON);
    });

    it("carries the book's fixed numbers, whatever the type", () => {
      for (const type of VESTIGE_TYPES) {
        const block = build(type, 7, 14, 3, ['Common']);
        expect(block.companion).toBe('vestige');
        expect(block.clazz).toBe('Vestige');
        expect(block.alignment).toBe('Neutral');
        expect(block.init).toBe(2);
        expect(block.speed).toBe(5);
        expect(block.stats).toEqual({ STR: 1, DEX: 14, CON: 10, INT: 15, WIS: 15, CHA: 16 });
        expect(block.conditionImmunities).toEqual(['charmed', 'frightened', 'prone']);
        expect(block.conditions).toEqual([]);
        expect(block.hp).toEqual({ max: 32, cur: 32, temp: 0 });
        expect(block.ac).toBe(15);
        expect(block.languages).toEqual(['Common']);
        expect(desc(block, 'Movement')).toBe('Fly 30 ft. (hover)');
        expect((block.features ?? []).map(f => f.source))
          .toEqual(['Trait', 'Action', 'Bonus Action', 'Stat block', 'Stat block', 'Stat block', 'Stat block']);
        // The four facts sit under Other Features; the trait and the actions do not.
        expect((block.features ?? []).map(f => f.category))
          .toEqual([undefined, undefined, undefined, 'other', 'other', 'other', 'other']);
      }
    });

    it('gives each type its damage, its resistance and its one Divine Power', () => {
      expect(VESTIGE_DAMAGE).toEqual({ Celestial: 'Radiant', Fiend: 'Fire', Undead: 'Necrotic' });
      const powers: Record<VestigeType, string> = {
        Celestial: 'Divine Power: Healing Touch', Fiend: 'Divine Power: Fiendish Swap',
        Undead: 'Divine Power: Cursed Invocation',
      };
      for (const type of VESTIGE_TYPES) {
        const block = build(type, 3, 16, 2);
        expect(desc(block, "Vestige's Strike")).toContain(`Hit: 1d6 + 6 ${VESTIGE_DAMAGE[type]} damage.`);
        expect(desc(block, 'Resistance')).toBe(`${VESTIGE_DAMAGE[type]} damage.`);
        expect((block.features ?? []).map(f => f.name).filter(n => n.startsWith('Divine Power'))).toEqual([powers[type]]);
      }
    });

    it('never shares a list between two blocks', () => {
      const first = build('Fiend', 3, 10, 2, ['Common']);
      first.conditionImmunities!.length = 0;
      first.languages!.push('Orc');
      const second = build('Fiend', 3, 10, 2, ['Common']);
      expect(second.conditionImmunities).toEqual(['charmed', 'frightened', 'prone']);
      expect(second.languages).toEqual(['Common']);
    });
  });

  describe('who has one', () => {
    it('a Vestige Patron of Warlock 3 or higher with a type chosen', () => {
      expect(vestigeTypeOf(warlock())).toBe('Fiend');
      expect(vestigeTypeOf(warlock({ level: 3, subclassChoices: { vestigeType: 'Undead' } }))).toBe('Undead');
      expect(vestigeTypeOf(warlock({ clazz: 'warlock', subclass: ' vestige patron ' }))).toBe('Fiend');
    });

    it('nobody below Warlock 3, without a type, or of another subclass or class', () => {
      expect(vestigeTypeOf(warlock({ level: 2 }))).toBeNull();
      expect(vestigeTypeOf(warlock({ subclassChoices: null }))).toBeNull();
      expect(vestigeTypeOf(warlock({ subclassChoices: { vestigeDomain: 'War' } }))).toBeNull();
      expect(vestigeTypeOf(warlock({ subclassChoices: { vestigeType: 'Dragon' as VestigeType } }))).toBeNull();
      expect(vestigeTypeOf(warlock({ subclass: 'Fiend Patron' }))).toBeNull();
      expect(vestigeTypeOf(warlock({ subclass: undefined }))).toBeNull();
      expect(vestigeTypeOf(warlock({ clazz: 'Wizard' }))).toBeNull();
      expect(vestigeTypeOf(null)).toBeNull();
    });

    it('isVestigePatron looks only at the class and the subclass', () => {
      expect(isVestigePatron(warlock({ level: 1, subclassChoices: null }))).toBeTrue();
      expect(isVestigePatron(warlock({ subclass: 'Fiend Patron' }))).toBeFalse();
      expect(isVestigePatron(warlock({ clazz: 'Fighter' }))).toBeFalse();
      expect(isVestigePatron(null)).toBeFalse();
    });

    it('builds from the warlock: level, Charisma, languages, and the table bonus plus the DM lines', () => {
      expect(vestigeInputsFor(warlock())).toEqual(
        { type: 'Fiend', level: 5, charisma: 18, prof: 3, languages: ['Common', 'Infernal'] });
      // The stored bonus is not read: the table for the level plus the DM's lines is.
      expect(vestigeInputsFor(warlock({ prof: 9 }))!.prof).toBe(3);
      expect(vestigeInputsFor(warlock({ statAdjustments: { prof: [{ value: 1, label: 'Blessing' }] } }))!.prof).toBe(4);
      expect(vestigeInputsFor(warlock({ level: 17 }))!.prof).toBe(6);
      expect(vestigeInputsFor(warlock({ stats: undefined, languages: undefined })))
        .toEqual({ type: 'Fiend', level: 5, charisma: 10, prof: 3, languages: [] });
      expect(vestigeInputsFor(warlock({ subclass: 'Fiend Patron' }))).toBeNull();
    });
  });

  describe('isVestigeCompanion', () => {
    it('is a COMPANION that carries the marker', () => {
      const block = build('Fiend', 5, 18, 3);
      expect(isVestigeCompanion({ kind: 'COMPANION', statBlock: block })).toBeTrue();
      expect(isVestigeCompanion({ kind: 'COMPANION', statBlock: { clazz: 'Wolf' } })).toBeFalse();
      expect(isVestigeCompanion({ kind: 'SUMMON', statBlock: block })).toBeFalse();
      expect(isVestigeCompanion({ statBlock: block })).toBeFalse();
    });
  });

  describe('the sync step (demo mode)', () => {
    it('creates the vestige, named Vestige, at full Hit Points', () => {
      const followers = sync([], warlock());
      const vestige = vestigeIn(followers);
      expect(vestige.name).toBe(VESTIGE_NAME);
      expect(vestige.kind).toBe('COMPANION');
      expect(vestige.pcId).toBe(7);
      expect(JSON.stringify(vestige.statBlock)).toBe(FIEND_5_JSON);
    });

    it('returns the very same list when nothing changed', () => {
      const followers = sync([], warlock());
      expect(sync(followers, warlock())).toBe(followers);
      // What the sheet stores as its bonus, or anything else the vestige is not built from, changes nothing.
      expect(sync(followers, warlock({ prof: 9, bio: 'Bound at the Hollow Ford.' }))).toBe(followers);
    });

    it('creates none below Warlock 3, without a type, or for another patron', () => {
      for (const pc of [warlock({ level: 2 }), warlock({ subclassChoices: null }),
        warlock({ subclass: 'Fiend Patron' }), warlock({ clazz: 'Fighter', subclass: 'Champion' })]) {
        const none: Follower[] = [];
        expect(sync(none, pc)).toBe(none);
      }
    });

    it('rebuilds on a level-up, handing over the new Hit Points, and keeps the name, temporary Hit Points and conditions', () => {
      let followers = sync([], warlock({ level: 4 }));           // 20 Hit Points, +2
      const made = vestigeIn(followers);
      const played: Follower = {
        ...made, name: 'Ashmaw',
        statBlock: { ...made.statBlock, hp: { max: 20, cur: 7, temp: 3 }, conditions: ['poisoned'] },
      };
      followers = sync([played], warlock({ level: 5 }));         // 24 Hit Points, +3

      const vestige = vestigeIn(followers);
      expect(vestige.id).toBe(made.id);
      expect(vestige.name).toBe('Ashmaw');
      expect(vestige.statBlock.hp).toEqual({ max: 24, cur: 11, temp: 3 });
      expect(vestige.statBlock.conditions).toEqual(['poisoned']);
      expect(vestige.statBlock.prof).toBe(3);
      expect(desc(vestige.statBlock, 'Hit Dice')).toBe('5d6');
    });

    it('rebuilds on a Charisma change and on a new type, without touching the Hit Points', () => {
      const made = vestigeIn(sync([], warlock()));
      const hurt: Follower = { ...made, statBlock: { ...made.statBlock, hp: { max: 24, cur: 9, temp: 0 } } };

      const weaker = vestigeIn(sync([hurt], warlock({ stats: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 8 } })));
      expect(weaker.statBlock.ac).toBe(12);
      expect(desc(weaker.statBlock, "Vestige's Strike")).toContain('+2 to hit');
      expect(weaker.statBlock.hp).toEqual({ max: 24, cur: 9, temp: 0 });

      const undead = vestigeIn(sync([hurt], warlock({ subclassChoices: { vestigeType: 'Undead', vestigeDomain: 'War' } })));
      expect(undead.id).toBe(made.id);
      expect(undead.statBlock.race).toBe('Undead');
      expect(desc(undead.statBlock, 'Resistance')).toBe('Necrotic damage.');
      expect(JSON.stringify(undead.statBlock)).not.toContain('Fiendish Swap');
      expect(undead.statBlock.hp).toEqual({ max: 24, cur: 9, temp: 0 });
    });

    it('caps the Hit Points when the level drops', () => {
      const made = vestigeIn(sync([], warlock({ level: 6 })));   // 28
      expect(vestigeIn(sync([made], warlock({ level: 4 }))).statBlock.hp).toEqual({ max: 20, cur: 20, temp: 0 });
    });

    it('removes the vestige when the subclass changes, the level drops below 3 or the type is gone', () => {
      const followers = sync([], warlock());
      for (const pc of [warlock({ subclass: 'Fiend Patron' }), warlock({ level: 2 }),
        warlock({ subclassChoices: null }), warlock({ clazz: 'Wizard', subclass: 'Evoker' })]) {
        expect(sync(followers, pc)).toEqual([]);
      }
    });

    it('never touches a grant, a summon, a familiar or another companion', () => {
      const others = [guard(1, 'DM_GRANT'), guard(2, 'SUMMON'), guard(3, 'FAMILIAR'), guard(4, undefined),
        guard(5, 'COMPANION', { clazz: 'Wolf' })];
      const withVestige = sync(others, warlock());
      expect(withVestige.length).toBe(6);
      others.forEach((other, i) => expect(withVestige[i]).toBe(other));

      const retyped = sync(withVestige, warlock({ subclassChoices: { vestigeType: 'Celestial', vestigeDomain: 'War' } }));
      others.forEach((other, i) => expect(retyped[i]).toBe(other));

      const gone = sync(retyped, warlock({ subclass: 'Fiend Patron' }));
      expect(gone).toEqual(others);
      gone.forEach((other, i) => expect(other).toBe(others[i]));
      // And a character that never had one keeps its list untouched.
      expect(sync(others, warlock({ subclass: 'Fiend Patron' }))).toBe(others);
    });

    it('keeps the first vestige should a second ever exist', () => {
      const first = vestigeIn(sync([], warlock()));
      const twin: Follower = { ...first, id: 999 };
      expect(sync([first, twin], warlock())).toEqual([first]);
    });
  });
});
