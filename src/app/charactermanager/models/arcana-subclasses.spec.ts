import {
  ARCANA_DOMAIN, ARCANA_DOMAIN_SKILLS, ARCANA_DOMAIN_SPELLS, ARCANA_FEATURE_SPELLS, ARCANA_SUBCLASSES, ARCANE_ARCHER,
  ARCANE_ARCHER_LORE, ARCANE_ARCHER_REPLACEMENT_SKILLS, ARCANE_SHOT_OPTIONS, CONJURER, ChoiceOwner, ENCHANTER,
  MAGICAL_MASTERY, NECROMANCER, STUDENT_OF_ARCANA, SUBCLASS_PICK_FEATURES, SUBCLASS_SPELL_PICKS, SubclassChoices,
  TRANSMUTER, VESTIGE_DOMAINS, VESTIGE_PATRON, VESTIGE_TYPES, WARRIOR_OF_THE_MYSTIC_ARTS, arcaneShotCount,
  arcanaLevel1Subclasses, arcanaLevelUpSubclasses, arcanaSubclass, arcanaSubclassesFor, cleanSubclassChoices,
  heldSubclassPicks, isArcanaSubclass, mergeSubclassChoices, subclassChoiceShort, subclassChoicesDue,
  subclassChoicesProblem, subclassPickAllows, subclassSkillChoice, subclassSpellPickGroups, subclassSpellPickNeeds,
  subclassSpellPickRule, subclassSpellPickRules, subclassSpellPicksProblem, withSubclassSkills,
} from './arcana-subclasses';
import { HERO_CLASSES, heroClassFor, subclassOptionLabel, subclassSource, wowOnlySubclasses } from './hero-class';
import { WOW_MAGE, WOW_PRIEST, WOW_WARRIOR } from './wow-class-variants';
import { PcSpell } from './pc';

describe('arcana-subclasses', () => {
  const spell = (name: string, lvl: number, grantedBy?: string): PcSpell =>
    ({ name, lvl, school: 'evocation', time: 'action', prepared: true, ...(grantedBy ? { grantedBy } : {}) });
  const cleric = (over: Partial<ChoiceOwner> = {}): ChoiceOwner => ({ clazz: 'Cleric', ...over });
  const fighter = (over: Partial<ChoiceOwner> = {}): ChoiceOwner => ({ clazz: 'Fighter', ...over });

  describe('the eight subclasses', () => {
    it('lists them under their base class, by the exact names the server stores', () => {
      expect(ARCANA_SUBCLASSES.map(s => [s.baseClass, s.name])).toEqual([
        ['Cleric', 'Arcana Domain'], ['Fighter', 'Arcane Archer'], ['Monk', 'Warrior of the Mystic Arts'],
        ['Warlock', 'Vestige Patron'], ['Wizard', 'Conjurer'], ['Wizard', 'Enchanter'], ['Wizard', 'Necromancer'],
        ['Wizard', 'Transmuter'],
      ]);
      expect([ARCANA_DOMAIN, ARCANE_ARCHER, WARRIOR_OF_THE_MYSTIC_ARTS, VESTIGE_PATRON, CONJURER, ENCHANTER,
        NECROMANCER, TRANSMUTER]).toEqual(ARCANA_SUBCLASSES.map(s => s.name));
    });

    it('tags every one Arcana Unleashed and gives each a one-line description', () => {
      for (const entry of ARCANA_SUBCLASSES) {
        expect(entry.source).withContext(entry.name).toBe('Arcana Unleashed');
        expect(entry.desc.length).withContext(entry.name).toBeGreaterThan(40);
        expect(entry.desc).withContext(entry.name).not.toContain('\n');
        expect(subclassSource(entry.name)).withContext(entry.name).toBe('Arcana Unleashed');
      }
    });

    it('finds one by name whatever the case, and nothing else', () => {
      expect(arcanaSubclass('arcana domain')?.name).toBe('Arcana Domain');
      expect(arcanaSubclass('  TRANSMUTER ')?.baseClass).toBe('Wizard');
      expect(isArcanaSubclass('Vestige Patron')).toBeTrue();
      for (const other of ['Life Domain', 'Evoker', 'Fiend Patron', 'Oath of the Holy', '', null, undefined]) {
        expect(isArcanaSubclass(other)).withContext(String(other)).toBeFalse();
      }
    });

    it('leaves the base-game and World of Warcraft source tags as they were', () => {
      expect(subclassSource('Life Domain')).toBeUndefined();
      expect(subclassSource('Evoker')).toBeUndefined();
      expect(subclassSource('Oath of the Holy')).toBe('World of Warcraft');
      expect(subclassSource('Shadow Domain')).toBe('World of Warcraft');
      expect(subclassSource('Oath of the Ebon Blade')).toBe('World of Warcraft');
    });

    it('offers a Warlock its subclass at level 1 and everyone else theirs at level 3', () => {
      expect(arcanaLevel1Subclasses('Warlock').map(s => s.name)).toEqual(['Vestige Patron']);
      expect(arcanaLevel1Subclasses('warlock')[0].source).toBe('Arcana Unleashed');
      expect(arcanaLevelUpSubclasses('Warlock')).toEqual([]);
      expect(arcanaLevelUpSubclasses('Cleric')).toEqual(['Arcana Domain']);
      expect(arcanaLevelUpSubclasses('fighter')).toEqual(['Arcane Archer']);
      expect(arcanaLevelUpSubclasses('Monk')).toEqual(['Warrior of the Mystic Arts']);
      expect(arcanaLevelUpSubclasses('Wizard')).toEqual(['Conjurer', 'Enchanter', 'Necromancer', 'Transmuter']);
      for (const clazz of ['Sorcerer', 'Bard', 'Paladin', '', null]) {
        expect(arcanaSubclassesFor(clazz)).withContext(String(clazz)).toEqual([]);
        expect(arcanaLevel1Subclasses(clazz)).withContext(String(clazz)).toEqual([]);
      }
    });

    it('is no World of Warcraft subclass: a variant takes one and stays that variant', () => {
      for (const hero of HERO_CLASSES) {
        expect(hero.subclass && isArcanaSubclass(hero.subclass)).withContext(hero.key).toBeFalsy();
        expect(wowOnlySubclasses(hero).some(isArcanaSubclass)).withContext(hero.key).toBeFalse();
      }
      expect(heroClassFor({ clazz: 'Cleric', subclass: 'Arcana Domain', specialization: 'Holy' })).toBe(WOW_PRIEST);
      expect(heroClassFor({ clazz: 'Fighter', subclass: 'Arcane Archer', specialization: 'Arms' })).toBe(WOW_WARRIOR);
      expect(heroClassFor({ clazz: 'Wizard', subclass: 'Conjurer', specialization: 'Frost' })).toBe(WOW_MAGE);
      // Without a specialization it is a plain base-game character.
      expect(heroClassFor({ clazz: 'Cleric', subclass: 'Arcana Domain' })).toBeUndefined();
      expect(heroClassFor({ clazz: 'Wizard', subclass: 'Necromancer', specialization: null })).toBeUndefined();
    });

    it("keeps a World of Warcraft Mage's option labels: only its Evoker reads differently", () => {
      expect(subclassOptionLabel(WOW_MAGE, 'Evoker')).toBe('Evoker (school of evocation)');
      for (const name of ['Conjurer', 'Enchanter', 'Necromancer', 'Transmuter']) {
        expect(subclassOptionLabel(WOW_MAGE, name)).toBe(name);
        expect(subclassOptionLabel(undefined, name)).toBe(name);
      }
    });
  });

  describe('always-prepared spells', () => {
    it('lists the ten Arcana Domain spells by Cleric level', () => {
      expect(ARCANA_DOMAIN_SPELLS.map(r => [r.classLevel, r.spells.length])).toEqual([[3, 4], [5, 2], [7, 2], [9, 2]]);
      expect(ARCANA_DOMAIN_SPELLS.flatMap(r => r.spells)).toEqual([
        'Detect Magic', 'Magic Missile', 'Magic Weapon', "Nystul's Magic Aura", 'Counterspell', 'Dispel Magic',
        'Arcane Eye', "Leomund's Secret Chest", "Bigby's Hand", 'Teleportation Circle',
      ]);
    });

    it("names the Necromancer's and Transmuter's feature spells", () => {
      expect(ARCANA_FEATURE_SPELLS.map(g => [g.subclass, g.feature, g.spell, g.classLevel])).toEqual([
        ['Necromancer', 'Necromancy Spellbook', 'Find Familiar', 3], ['Necromancer', 'Undead Thralls', 'Animate Dead', 6],
        ['Transmuter', 'Wondrous Alteration', 'Alter Self', 3], ['Transmuter', 'Shape-Shifter', 'Polymorph', 10],
      ]);
    });
  });

  describe('Arcane Shot options and vestiges', () => {
    it('lists the eight options, and how many an archer knows at each Fighter level', () => {
      expect(ARCANE_SHOT_OPTIONS).toEqual([
        'Banishing Shot', 'Beguiling Shot', 'Bursting Shot', 'Enfeebling Shot', 'Grasping Shot', 'Piercing Shot',
        'Seeking Shot', 'Shadow Shot',
      ]);
      const counts = [1, 2, 3, 6, 7, 9, 10, 14, 15, 17, 18, 20].map(level => [level, arcaneShotCount(level)]);
      expect(counts).toEqual([
        [1, 0], [2, 0], [3, 2], [6, 2], [7, 3], [9, 3], [10, 4], [14, 4], [15, 5], [17, 5], [18, 6], [20, 6],
      ]);
      expect(arcaneShotCount(null)).toBe(0);
    });

    it('lists the vestige types and domains', () => {
      expect(VESTIGE_TYPES).toEqual(['Celestial', 'Fiend', 'Undead']);
      expect(VESTIGE_DOMAINS).toEqual(['Life', 'Light', 'Trickery', 'War']);
    });
  });

  describe('skill choices', () => {
    it('owes an Arcana Domain cleric one skill from level 3: Arcana or a Cleric skill it lacks', () => {
      expect(ARCANA_DOMAIN_SKILLS).toEqual(['Arcana', 'History', 'Insight', 'Medicine', 'Persuasion', 'Religion']);
      expect(subclassSkillChoice(cleric(), ARCANA_DOMAIN, 2)).toBeNull();
      const choice = subclassSkillChoice(cleric({ skills: { Insight: 'prof', Religion: 'expert', Stealth: 'prof' } }), ARCANA_DOMAIN, 3)!;
      expect(choice.feature).toBe(STUDENT_OF_ARCANA);
      expect(choice.granted).toEqual([]);
      expect(choice.count).toBe(1);
      expect(choice.options).toEqual(['Arcana', 'History', 'Medicine', 'Persuasion']);
      // Later, while still unset, it is owed all the same.
      expect(subclassSkillChoice(cleric(), 'arcana domain', 9)?.count).toBe(1);
    });

    it('asks nothing once a choice is stored, of another class, or of another subclass', () => {
      expect(subclassSkillChoice(cleric({ subclassChoices: { skills: ['Arcana'] } }), ARCANA_DOMAIN, 5)).toBeNull();
      expect(subclassSkillChoice(fighter({ subclassChoices: { skills: [] } }), ARCANE_ARCHER, 5)).toBeNull();
      expect(subclassSkillChoice({ clazz: 'Wizard' }, ARCANA_DOMAIN, 5)).toBeNull();
      expect(subclassSkillChoice(cleric(), 'Life Domain', 5)).toBeNull();
      expect(subclassSkillChoice(cleric(), null, 5)).toBeNull();
      for (const other of [WARRIOR_OF_THE_MYSTIC_ARTS, VESTIGE_PATRON, CONJURER, ENCHANTER, NECROMANCER, TRANSMUTER]) {
        expect(subclassSkillChoice({ clazz: arcanaSubclass(other)!.baseClass }, other, 10)).withContext(other).toBeNull();
      }
    });

    it('gives an Arcane Archer Arcana and Nature, and a Fighter skill for each one it already had', () => {
      expect(ARCANE_ARCHER_REPLACEMENT_SKILLS).toEqual([
        'Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Persuasion', 'Perception',
        'Survival',
      ]);
      const none = subclassSkillChoice(fighter({ skills: { Athletics: 'prof' } }), ARCANE_ARCHER, 3)!;
      expect(none.feature).toBe(ARCANE_ARCHER_LORE);
      expect(none.granted).toEqual([
        { name: 'Arcana', alreadyProficient: false }, { name: 'Nature', alreadyProficient: false },
      ]);
      expect(none.count).toBe(0);

      const one = subclassSkillChoice(fighter({ skills: { Nature: 'prof', Athletics: 'prof' } }), ARCANE_ARCHER, 3)!;
      expect(one.granted.map(g => g.alreadyProficient)).toEqual([false, true]);
      expect(one.count).toBe(1);
      expect(one.options).not.toContain('Athletics');
      expect(one.options).not.toContain('Nature');
      expect(one.options.length).toBe(8);

      const two = subclassSkillChoice(fighter({ skills: { Arcana: 'expert', Nature: 'prof' } }), ARCANE_ARCHER, 4)!;
      expect(two.count).toBe(2);
      expect(two.options).toEqual(ARCANE_ARCHER_REPLACEMENT_SKILLS);
      expect(subclassSkillChoice(fighter(), ARCANE_ARCHER, 2)).toBeNull();
    });

    it('never owes more skills than there are left to pick', () => {
      const all = Object.fromEntries([...ARCANA_DOMAIN_SKILLS, ...ARCANE_ARCHER_REPLACEMENT_SKILLS, 'Nature']
        .map(skill => [skill, 'prof' as const]));
      expect(subclassSkillChoice(cleric({ skills: all }), ARCANA_DOMAIN, 3)?.count).toBe(0);
      expect(subclassSkillChoice(fighter({ skills: all }), ARCANE_ARCHER, 3)?.count).toBe(0);
    });

    it('marks the chosen skills proficient and never lowers expertise', () => {
      const skills = { Insight: 'expert' as const };
      expect(withSubclassSkills(cleric({ skills }), ARCANA_DOMAIN, 3, ['Arcana'])).toEqual({ Insight: 'expert', Arcana: 'prof' });
      expect(withSubclassSkills(cleric({ skills }), ARCANA_DOMAIN, 3, ['Insight'])).toBe(skills);
      expect(withSubclassSkills(fighter({ skills: { Arcana: 'expert' } }), ARCANE_ARCHER, 3, ['Insight']))
        .toEqual({ Arcana: 'expert', Nature: 'prof', Insight: 'prof' });
      // An archer who owes no replacement still gains the two skills.
      expect(withSubclassSkills(fighter(), ARCANE_ARCHER, 3, [])).toEqual({ Arcana: 'prof', Nature: 'prof' });
      expect(withSubclassSkills(fighter(), 'Champion', 3, [])).toEqual({});
    });
  });

  describe('spells picked for a feature', () => {
    it('defines the three pick features, their counts, levels and lists', () => {
      expect(SUBCLASS_PICK_FEATURES).toEqual(['Student of Arcana', 'Magical Mastery', 'Arcane Archer Lore']);
      expect(SUBCLASS_SPELL_PICKS.map(r => [r.subclass, r.fromLevel, r.levels, r.spellList ?? r.names, r.replaceable, r.required]))
        .toEqual([
          ['Arcana Domain', 3, [0, 0], 'wizard', true, true],
          ['Arcana Domain', 17, [6, 7, 8, 9], 'wizard', true, true],
          ['Arcane Archer', 3, [0], ['Druidcraft', 'Prestidigitation'], false, false],
        ]);
      expect(subclassSpellPickRule('student of arcana')?.feature).toBe(STUDENT_OF_ARCANA);
      expect(subclassSpellPickRule('Arcane Warrior')).toBeUndefined();
      expect(subclassSpellPickRule(undefined)).toBeUndefined();
    });

    it('applies a rule only to its own class, subclass and level', () => {
      const features = (owner: ChoiceOwner, subclass: string, level: number) =>
        subclassSpellPickRules(owner, subclass, level).map(r => r.feature);
      expect(features(cleric(), ARCANA_DOMAIN, 2)).toEqual([]);
      expect(features(cleric(), ARCANA_DOMAIN, 3)).toEqual([STUDENT_OF_ARCANA]);
      expect(features(cleric(), ARCANA_DOMAIN, 16)).toEqual([STUDENT_OF_ARCANA]);
      expect(features(cleric(), ARCANA_DOMAIN, 17)).toEqual([STUDENT_OF_ARCANA, MAGICAL_MASTERY]);
      expect(features(fighter(), ARCANE_ARCHER, 3)).toEqual([ARCANE_ARCHER_LORE]);
      expect(features(fighter(), ARCANA_DOMAIN, 17)).toEqual([]);
      expect(features(cleric(), 'Life Domain', 17)).toEqual([]);
    });

    it('allows a Wizard spell of the right level, or one of the spells a rule names', () => {
      const [student, mastery, lore] = SUBCLASS_SPELL_PICKS;
      const light = { name: 'Light', level: 0, classes: ['bard', 'cleric', 'sorcerer', 'wizard'] };
      const guidance = { name: 'Guidance', level: 0, classes: ['cleric', 'druid'] };
      const wish = { name: 'Wish', level: 9, classes: ['sorcerer', 'wizard'] };
      expect(subclassPickAllows(student, light, 0)).toBeTrue();
      expect(subclassPickAllows(student, guidance, 0)).toBeFalse();
      expect(subclassPickAllows(student, wish, 9)).toBeFalse();
      expect(subclassPickAllows(mastery, wish, 9)).toBeTrue();
      expect(subclassPickAllows(mastery, wish, 8)).toBeFalse();
      expect(subclassPickAllows(mastery, { name: 'Heal', level: 6, classes: ['cleric', 'druid'] }, 6)).toBeFalse();
      expect(subclassPickAllows(lore, { name: 'Druidcraft', level: 0, classes: ['druid'] }, 0)).toBeTrue();
      expect(subclassPickAllows(lore, { name: 'prestidigitation', level: 0 }, 0)).toBeTrue();
      expect(subclassPickAllows(lore, light, 0)).toBeFalse();
    });

    it('owes two cantrips at Cleric 3, nothing once they are held, and four spells at Cleric 17', () => {
      const fresh = subclassSpellPickNeeds(cleric(), ARCANA_DOMAIN, 3);
      expect(fresh.map(n => [n.rule.feature, n.owed, n.held.length, n.replaceable.length]))
        .toEqual([[STUDENT_OF_ARCANA, [0, 0], 0, 0]]);

      const spells = [spell('Light', 0, STUDENT_OF_ARCANA), spell('Mage Hand', 0, 'student of arcana'), spell('Guidance', 0)];
      const held = subclassSpellPickNeeds(cleric({ spells }), ARCANA_DOMAIN, 4);
      expect(held[0].owed).toEqual([]);
      expect(held[0].replaceable.map(s => s.name)).toEqual(['Light', 'Mage Hand']);
      expect(heldSubclassPicks(cleric({ spells }), STUDENT_OF_ARCANA).map(s => s.name)).toEqual(['Light', 'Mage Hand']);

      const high = subclassSpellPickNeeds(cleric({ spells }), ARCANA_DOMAIN, 17);
      expect(high.map(n => [n.rule.feature, n.owed])).toEqual([[STUDENT_OF_ARCANA, []], [MAGICAL_MASTERY, [6, 7, 8, 9]]]);

      const partial = subclassSpellPickNeeds(cleric({ spells: [...spells, spell('Wish', 9, MAGICAL_MASTERY)] }), ARCANA_DOMAIN, 18);
      expect(partial[1].owed).toEqual([6, 7, 8]);
    });

    it('leaves out a rule the server does not require yet unless asked for it', () => {
      expect(subclassSpellPickNeeds(fighter(), ARCANE_ARCHER, 3)).toEqual([]);
      expect(subclassSpellPickNeeds(fighter(), ARCANE_ARCHER, 3, true).map(n => [n.rule.feature, n.owed]))
        .toEqual([[ARCANE_ARCHER_LORE, [0]]]);
    });

    it('turns a need into one picker per spell level, plus the level of the pick being swapped', () => {
      const [student] = subclassSpellPickNeeds(cleric(), ARCANA_DOMAIN, 3);
      expect(subclassSpellPickGroups(student)).toEqual([{ level: 0, count: 2 }]);

      const spells = [
        spell('Light', 0, STUDENT_OF_ARCANA), spell('Mage Hand', 0, STUDENT_OF_ARCANA),
        spell('Disintegrate', 6, MAGICAL_MASTERY), spell('Teleport', 7, MAGICAL_MASTERY),
        spell('Maze', 8, MAGICAL_MASTERY), spell('Wish', 9, MAGICAL_MASTERY),
      ];
      const [cantrips, mastery] = subclassSpellPickNeeds(cleric({ spells }), ARCANA_DOMAIN, 18);
      expect(subclassSpellPickGroups(cantrips)).toEqual([]);
      expect(subclassSpellPickGroups(cantrips, 'Light')).toEqual([{ level: 0, count: 1 }]);
      expect(subclassSpellPickGroups(mastery, 'maze')).toEqual([{ level: 8, count: 1 }]);
      expect(subclassSpellPickGroups(mastery, 'Fireball')).toEqual([]);

      const [, fresh] = subclassSpellPickNeeds(cleric(), ARCANA_DOMAIN, 17);
      expect(subclassSpellPickGroups(fresh)).toEqual([6, 7, 8, 9].map(level => ({ level, count: 1 })));
    });

    it('says whether a level-up has to wait for a choice', () => {
      expect(subclassChoicesDue(cleric(), ARCANA_DOMAIN, 3)).toBeTrue();
      const settled = cleric({
        subclassChoices: { skills: ['Arcana'] },
        spells: [spell('Light', 0, STUDENT_OF_ARCANA), spell('Mage Hand', 0, STUDENT_OF_ARCANA)],
      });
      expect(subclassChoicesDue(settled, ARCANA_DOMAIN, 4)).toBeFalse();
      expect(subclassChoicesDue(settled, ARCANA_DOMAIN, 17)).toBeTrue();   // Magical Mastery
      expect(subclassChoicesDue(cleric({ subclassChoices: { skills: ['Arcana'] } }), ARCANA_DOMAIN, 4)).toBeTrue();
      expect(subclassChoicesDue(fighter(), ARCANE_ARCHER, 3)).toBeFalse();
      expect(subclassChoicesDue(fighter({ skills: { Arcana: 'prof' } }), ARCANE_ARCHER, 3)).toBeTrue();
      for (const other of [WARRIOR_OF_THE_MYSTIC_ARTS, VESTIGE_PATRON, CONJURER, ENCHANTER, NECROMANCER, TRANSMUTER]) {
        expect(subclassChoicesDue({ clazz: arcanaSubclass(other)!.baseClass }, other, 3)).withContext(other).toBeFalse();
      }
      expect(subclassChoicesDue(cleric(), 'Life Domain', 3)).toBeFalse();
      expect(subclassChoicesDue(cleric(), null, 3)).toBeFalse();
    });
  });

  describe('writing the stored choices (the server rules, for demo mode)', () => {
    it('keeps only the keys that apply to the class, subclass and level', () => {
      const all: SubclassChoices = { skills: ['Arcana'], arcaneShots: ['Seeking Shot'], vestigeType: 'Fiend', vestigeDomain: 'War' };
      expect(cleanSubclassChoices(all, cleric(), ARCANA_DOMAIN, 3)).toEqual({ skills: ['Arcana'] });
      expect(cleanSubclassChoices(all, fighter(), ARCANE_ARCHER, 3)).toEqual({ skills: ['Arcana'], arcaneShots: ['Seeking Shot'] });
      expect(cleanSubclassChoices(all, { clazz: 'Warlock' }, VESTIGE_PATRON, 3)).toEqual({ vestigeType: 'Fiend', vestigeDomain: 'War' });
      expect(cleanSubclassChoices(all, cleric(), 'Life Domain', 3)).toBeNull();
      expect(cleanSubclassChoices(all, cleric(), ARCANA_DOMAIN, 2)).toBeNull();
      expect(cleanSubclassChoices({ skills: [] }, fighter(), ARCANE_ARCHER, 3)).toEqual({ skills: [] });
      expect(cleanSubclassChoices(null, cleric(), ARCANA_DOMAIN, 3)).toBeNull();
    });

    it('requires exactly the skills owed at a level-up', () => {
      const problem = (owner: ChoiceOwner, subclass: string, partial?: SubclassChoices) =>
        subclassChoicesProblem(owner, subclass, 3, partial, { levelUp: true });
      expect(problem(cleric(), ARCANA_DOMAIN)).toContain('Choose 1 skill');
      expect(problem(cleric(), ARCANA_DOMAIN, { skills: ['Arcana', 'History'] })).toContain('Choose 1 skill');
      expect(problem(cleric(), ARCANA_DOMAIN, { skills: ['Stealth'] })).toContain('Stealth cannot be chosen');
      expect(problem(cleric({ skills: { Arcana: 'prof' } }), ARCANA_DOMAIN, { skills: ['Arcana'] })).toContain('cannot be chosen');
      expect(problem(cleric(), ARCANA_DOMAIN, { skills: ['Arcana'] })).toBeNull();
      // Once stored, a level-up neither asks again nor reads what is sent.
      expect(problem(cleric({ subclassChoices: { skills: ['Arcana'] } }), ARCANA_DOMAIN)).toBeNull();

      expect(problem(fighter(), ARCANE_ARCHER)).toBeNull();
      expect(problem(fighter(), ARCANE_ARCHER, { skills: ['Insight'] })).toContain('no skill to choose');
      const both = fighter({ skills: { Arcana: 'prof', Nature: 'prof' } });
      expect(problem(both, ARCANE_ARCHER, { skills: ['Insight'] })).toContain('Choose 2 skills');
      expect(problem(both, ARCANE_ARCHER, { skills: ['Insight', 'Insight'] })).toContain('different skills');
      expect(problem(both, ARCANE_ARCHER, { skills: ['Insight', 'Survival'] })).toBeNull();
      expect(problem(cleric(), 'Life Domain')).toBeNull();
    });

    it('checks the other keys only when they are sent', () => {
      const archer = fighter({ subclassChoices: { skills: [], arcaneShots: ['Seeking Shot', 'Shadow Shot'] } });
      const problem = (level: number, arcaneShots: string[]) =>
        subclassChoicesProblem(archer, ARCANE_ARCHER, level, { arcaneShots }, { levelUp: true });
      expect(subclassChoicesProblem(archer, ARCANE_ARCHER, 7, {}, { levelUp: true })).toBeNull();
      expect(problem(7, ['Seeking Shot', 'Shadow Shot'])).toContain('Choose 3');
      expect(problem(7, ['Seeking Shot', 'Shadow Shot', 'Fire Shot'])).toContain('not an Arcane Shot option');
      expect(problem(7, ['Seeking Shot', 'Seeking Shot', 'Shadow Shot'])).toContain('once');
      expect(problem(7, ['Seeking Shot', 'Shadow Shot', 'Bursting Shot'])).toBeNull();
      // The count rises at 7: one known option may be swapped, not two.
      expect(problem(7, ['Seeking Shot', 'Bursting Shot', 'Piercing Shot'])).toBeNull();
      expect(problem(7, ['Grasping Shot', 'Bursting Shot', 'Piercing Shot'])).toContain('Only one');
      // It does not rise at 6: the known options stay.
      expect(problem(6, ['Seeking Shot', 'Bursting Shot'])).toContain('cannot be replaced');
      // The endpoint has no swap limit.
      expect(subclassChoicesProblem(archer, ARCANE_ARCHER, 6, { arcaneShots: ['Grasping Shot', 'Bursting Shot'] })).toBeNull();

      const patron: ChoiceOwner = { clazz: 'Warlock', subclassChoices: { vestigeDomain: 'Life' } };
      expect(subclassChoicesProblem(patron, VESTIGE_PATRON, 4, { vestigeType: 'Dragon' as never })).toContain('not a vestige type');
      expect(subclassChoicesProblem(patron, VESTIGE_PATRON, 4, { vestigeDomain: 'Death' as never })).toContain('not a vestige domain');
      expect(subclassChoicesProblem(patron, VESTIGE_PATRON, 4, { vestigeType: 'Undead', vestigeDomain: 'War' })).toBeNull();
      expect(subclassChoicesProblem(patron, VESTIGE_PATRON, 4, { vestigeDomain: 'War' }, { levelUp: true })).toContain('cannot be changed');
      expect(subclassChoicesProblem(patron, VESTIGE_PATRON, 4, { vestigeDomain: 'Life' }, { levelUp: true })).toBeNull();
    });

    it('merges a write into the stored choices: keys present replace, a stored skill choice stays at a level-up', () => {
      expect(mergeSubclassChoices(cleric(), ARCANA_DOMAIN, 3, { skills: ['Arcana'] }, { levelUp: true })).toEqual({ skills: ['Arcana'] });
      const stored = cleric({ subclassChoices: { skills: ['Arcana'] } });
      expect(mergeSubclassChoices(stored, ARCANA_DOMAIN, 4, { skills: ['History'] }, { levelUp: true })).toEqual({ skills: ['Arcana'] });
      expect(mergeSubclassChoices(stored, ARCANA_DOMAIN, 4, { skills: ['History'] })).toEqual({ skills: ['History'] });
      expect(mergeSubclassChoices(stored, ARCANA_DOMAIN, 4, undefined, { levelUp: true })).toEqual({ skills: ['Arcana'] });
      // An archer who owes no skill gets an empty list, so the choice counts as made.
      expect(mergeSubclassChoices(fighter(), ARCANE_ARCHER, 3, undefined, { levelUp: true })).toEqual({ skills: [] });
      expect(mergeSubclassChoices(fighter(), ARCANE_ARCHER, 3, { arcaneShots: ['Seeking Shot', 'Shadow Shot'] }, { levelUp: true }))
        .toEqual({ skills: [], arcaneShots: ['Seeking Shot', 'Shadow Shot'] });
      expect(mergeSubclassChoices({ clazz: 'Warlock', subclassChoices: { vestigeType: 'Fiend' } }, VESTIGE_PATRON, 3, { vestigeDomain: 'War' }))
        .toEqual({ vestigeType: 'Fiend', vestigeDomain: 'War' });
      expect(mergeSubclassChoices(fighter(), 'Champion', 3, { skills: ['Insight'] }, { levelUp: true })).toBeNull();
    });

    it('says when a stored key is missing or short, so its owner may still fill it in', () => {
      const archer = fighter({ subclassChoices: { skills: [], arcaneShots: ['Seeking Shot', 'Shadow Shot'] } });
      expect(subclassChoiceShort(archer, 6, 'skills')).toBeFalse();
      expect(subclassChoiceShort(archer, 6, 'arcaneShots')).toBeFalse();
      expect(subclassChoiceShort(archer, 7, 'arcaneShots')).toBeTrue();
      expect(subclassChoiceShort(fighter(), 3, 'skills')).toBeTrue();
      expect(subclassChoiceShort({ clazz: 'Warlock' }, 3, 'vestigeDomain')).toBeTrue();
      expect(subclassChoiceShort({ clazz: 'Warlock', subclassChoices: { vestigeDomain: 'War' } }, 3, 'vestigeDomain')).toBeFalse();
    });

    it('checks the picks of a level-up: the count, the levels, one swap per feature', () => {
      type Pick = { name: string; lvl: number; grantedBy?: string };
      const pick = (name: string, lvl: number, grantedBy: string): Pick => ({ name, lvl, grantedBy });
      const problem = (owner: ChoiceOwner, level: number, picks: Pick[], forget: string[] = []) =>
        subclassSpellPicksProblem(owner, ARCANA_DOMAIN, level, picks, forget);
      const two = [pick('Light', 0, STUDENT_OF_ARCANA), pick('Mage Hand', 0, STUDENT_OF_ARCANA)];
      expect(problem(cleric(), 3, [])).toBe('Student of Arcana needs two cantrips.');
      expect(problem(cleric(), 3, [two[0]])).toContain('two cantrips');
      expect(problem(cleric(), 3, [...two, pick('Fire Bolt', 0, STUDENT_OF_ARCANA)])).toContain('two cantrips');
      expect(problem(cleric(), 3, [two[0], pick('Shield', 1, STUDENT_OF_ARCANA)])).toContain('two cantrips');
      expect(problem(cleric(), 3, two)).toBeNull();
      // Class picks and feat picks in the same request are not this rule's business.
      expect(problem(cleric(), 3, [...two, { name: 'Bless', lvl: 1 }, pick('Shield', 1, 'Abjuration Adept')])).toBeNull();
      expect(problem(cleric(), 2, two)).toContain('not a feature of this character');

      const held = cleric({ spells: [spell('Light', 0, STUDENT_OF_ARCANA), spell('Mage Hand', 0, STUDENT_OF_ARCANA), spell('Guidance', 0)] });
      expect(problem(held, 4, [])).toBeNull();
      expect(problem(held, 4, [], ['Light'])).toContain('two cantrips');
      expect(problem(held, 4, [pick('Fire Bolt', 0, STUDENT_OF_ARCANA)], ['Light'])).toBeNull();
      expect(problem(held, 4, [pick('Fire Bolt', 0, STUDENT_OF_ARCANA)])).toContain('two cantrips');
      expect(problem(held, 4, [], ['Guidance'])).toContain('not a spell a subclass feature lets you replace');
      expect(problem(held, 4, two, ['Light', 'Mage Hand'])).toContain('Only one Student of Arcana spell');

      const mastery = [6, 7, 8, 9].map(lvl => pick(`Spell ${lvl}`, lvl, MAGICAL_MASTERY));
      expect(problem(held, 17, [])).toBe('Magical Mastery needs one spell each of level 6, 7, 8 and 9.');
      expect(problem(held, 17, mastery.slice(0, 3))).toContain('Magical Mastery needs');
      expect(problem(held, 17, [...mastery.slice(0, 3), pick('Other 8', 8, MAGICAL_MASTERY)])).toContain('Magical Mastery needs');
      expect(problem(held, 17, mastery)).toBeNull();
      const master = cleric({ spells: [...held.spells!, ...mastery.map(m => spell(m.name, m.lvl, MAGICAL_MASTERY))] });
      expect(problem(master, 18, [pick('Maze', 8, MAGICAL_MASTERY)], ['Spell 8'])).toBeNull();
      expect(problem(master, 18, [pick('Wish', 9, MAGICAL_MASTERY)], ['Spell 8'])).toContain('Magical Mastery needs');
      expect(problem(master, 18, [pick('Maze', 8, MAGICAL_MASTERY), pick('Fire Bolt', 0, STUDENT_OF_ARCANA)], ['Spell 8', 'Light'])).toBeNull();
    });

    it("accepts an Arcane Archer without its cantrip for now, but not a cantrip the feature doesn't name", () => {
      const problem = (picks: { name: string; lvl: number; grantedBy: string }[]) =>
        subclassSpellPicksProblem(fighter(), ARCANE_ARCHER, 3, picks, []);
      expect(problem([])).toBeNull();
      expect(problem([{ name: 'Druidcraft', lvl: 0, grantedBy: ARCANE_ARCHER_LORE }])).toBeNull();
      expect(problem([{ name: 'Light', lvl: 0, grantedBy: ARCANE_ARCHER_LORE }])).toContain('cannot be picked');
      expect(problem([
        { name: 'Druidcraft', lvl: 0, grantedBy: ARCANE_ARCHER_LORE }, { name: 'Prestidigitation', lvl: 0, grantedBy: ARCANE_ARCHER_LORE },
      ])).toBe('Arcane Archer Lore needs one cantrip.');
    });
  });
});
