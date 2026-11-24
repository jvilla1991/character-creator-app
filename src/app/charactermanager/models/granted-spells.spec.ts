import { DndSpell } from './dnd-api.types';
import { PC, PcSpell } from './pc';
import { highestSpellSlotLevel } from './arcana-feats';
import {
  FEAT_SPELLS, SCHOOL_ADEPT_SPELLS, featChoiceAllows, featChoiceFits, featChoiceSatisfied, featSpellGrants,
  featSpellGrantsThrough, featSpellsOwed, featSpellsOwedByFeat, hasLevelUpFeatSpellChoices,
  levelUpFeatSpellChoices, magicInitiateFeat, magicInitiateFeats, originFeatSpellChoice,
} from './granted-spells';
import { spellKey } from './spell-names';

describe('granted-spells (feats)', () => {
  const names = (grants: { name: string }[]): string[] => grants.map(g => g.name);

  const spell = (name: string, level: number, school: string, classes: string[] = []): DndSpell => ({
    name, level, school, classes, actionType: 'action', concentration: false, ritual: false, range: 'Self',
    components: ['v'], duration: 'Instantaneous', description: `${name} text.`,
  } as DndSpell);

  const known = (name: string, lvl: number, extra: Partial<PcSpell> = {}): PcSpell =>
    ({ name, lvl, school: 'x', time: 'action', prepared: true, ...extra });

  const pc = (over: Partial<PC>): PC => ({ id: 1, name: 'Mirel', clazz: 'Wizard', level: 3, playerName: 'Q', ...over } as PC);

  // ── Spells a feat names ─────────────────────────────────────────────────────

  it('names the spell each feat gives, with the feat as its source', () => {
    // feat => spell
    const NAMED = `
      Arcane Artist => Minor Illusion
      Arcane Eloquence => Vicious Mockery
      Arcane Infiltrator => Friends
      Arcane Omens => Guidance
      Arcane Overload => Fire Bolt
      Arcane Safeguard => Resistance
      Familiar Friend => Find Familiar
      Warlike Familiar => Battle Familiar
    `.trim().split('\n').map(line => line.trim().split(' => '));
    expect(NAMED.length).toBe(8);
    expect(Object.keys(FEAT_SPELLS).length).toBe(8);
    for (const [feat, name] of NAMED) {
      expect(featSpellGrants(feat)).withContext(feat).toEqual([{ name, grantedBy: feat }]);
      expect(featSpellGrants(`  ${feat.toUpperCase()} `, 9)).withContext(feat).toEqual([{ name, grantedBy: feat }]);
    }
    for (const feat of ['Arcane Undertaker', 'Portal Jumper', 'Transmuted Anatomy', 'Elemental Familiar',
      'Magic Connoisseur', 'Spell Resistant', 'Arcane Warrior', 'Boon of Magic School Mastery (Evocation)',
      'Magic Initiate (Wizard)', 'Alert', '', null, undefined]) {
      expect(featSpellGrants(feat, 9)).withContext(String(feat)).toEqual([]);
    }
  });

  // ── School Adept tables ─────────────────────────────────────────────────────

  it('carries each School Adept\'s five spells, one per spell slot level', () => {
    // feat => the spells for spell slot levels 1, 2, 3, 4, 5 (the same block the server's FeatSpellGrantsTest carries)
    const TABLES = `
      Abjuration Adept => Shield, Lesser Restoration, Protection from Energy, Banishment, Mass Cure Wounds
      Conjuration Adept => Entangle, Misty Step, Conjure Animals, Dimension Door, Conjure Elemental
      Divination Adept => Detect Evil and Good, Mind Spike, Clairvoyance, Divination, Scrying
      Enchantment Adept => Dissonant Whispers, Enthrall, Hold Person, Dominate Beast, Modify Memory
      Evocation Adept => Chromatic Orb, Shatter, Fireball, Vitriolic Sphere, Wall of Force
      Illusion Adept => Silent Image, Phantasmal Force, Major Image, Hallucinatory Terrain, Seeming
      Necromancy Adept => Inflict Wounds, Ray of Enfeeblement, Vampiric Touch, Blight, Raise Dead
      Transmutation Adept => Jump, Spider Climb, Slow, Polymorph, Animate Objects
    `.trim().split('\n').map(line => line.trim().split(' => '));
    expect(TABLES.length).toBe(8);
    expect(Object.keys(SCHOOL_ADEPT_SPELLS).length).toBe(8);
    for (const [feat, spells] of TABLES) {
      expect([...SCHOOL_ADEPT_SPELLS[feat]]).withContext(feat).toEqual(spells.split(', '));
      expect(featSpellGrants(feat, 9)).withContext(feat)
        .toEqual(spells.split(', ').map(name => ({ name, grantedBy: feat })));
      expect(featSpellGrants(feat)).withContext(feat).toEqual([]);   // no spell slots, no rows
    }
  });

  it('gives a full caster a row at each new slot level, up to the fifth', () => {
    const at = (clazz: string, level: number) => names(featSpellGrants('Evocation Adept', highestSpellSlotLevel(clazz, level)));
    expect(at('Wizard', 1)).toEqual(['Chromatic Orb']);
    expect(at('Wizard', 4)).toEqual(['Chromatic Orb', 'Shatter']);
    expect(at('Wizard', 5)).toEqual(['Chromatic Orb', 'Shatter', 'Fireball']);
    expect(at('Cleric', 7)).toEqual(['Chromatic Orb', 'Shatter', 'Fireball', 'Vitriolic Sphere']);
    expect(at('Sorcerer', 9)).toEqual(['Chromatic Orb', 'Shatter', 'Fireball', 'Vitriolic Sphere', 'Wall of Force']);
    expect(at('Wizard', 20).length).toBe(5);   // slot levels 6 to 9 add nothing
  });

  it('gives a half caster the rows more slowly, and a Warlock the rows up to its pact slot level', () => {
    const rows = (clazz: string, level: number) => featSpellGrants('Abjuration Adept', highestSpellSlotLevel(clazz, level)).length;
    // character level => rows
    expect([4, 5, 8, 9, 12, 13, 16, 17, 20].map(level => rows('Paladin', level))).toEqual([1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect([4, 5, 9, 13, 17].map(level => rows('Ranger', level))).toEqual([1, 2, 3, 4, 5]);
    expect([2, 3, 4, 5, 6, 7, 8, 9, 20].map(level => rows('Warlock', level))).toEqual([1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(rows('Fighter', 20)).toBe(0);
  });

  it('adds up the feats a character holds, in order, each spell once', () => {
    const feats = ['Sage', 'Familiar Friend', 'Second Wind', 'Evocation Adept', 'familiar friend', 'Warlike Familiar'];
    expect(featSpellGrantsThrough(feats, 2)).toEqual([
      { name: 'Find Familiar', grantedBy: 'Familiar Friend' },
      { name: 'Chromatic Orb', grantedBy: 'Evocation Adept' },
      { name: 'Shatter', grantedBy: 'Evocation Adept' },
      { name: 'Battle Familiar', grantedBy: 'Warlike Familiar' },
    ]);
    expect(featSpellGrantsThrough([], 9)).toEqual([]);
  });

  // ── What a level-up owes (demo mirror of the server's preview) ──────────────

  it('owes a feat spell until it is saved always prepared; a known cantrip is not owed', () => {
    const familiar = pc({ clazz: 'Fighter', feat: 'Familiar Friend' });
    expect(featSpellsOwed(familiar, 2)).toEqual([{ name: 'Find Familiar', grantedBy: 'Familiar Friend' }]);
    expect(featSpellsOwed({ ...familiar, spells: [known('Find Familiar', 1)] }, 2).length).toBe(1);   // owed the marker
    expect(featSpellsOwed({ ...familiar, spells: [known('Find Familiar', 1, { alwaysPrepared: true })] }, 2)).toEqual([]);

    const artist = pc({ clazz: 'Rogue', features: [{ name: 'Arcane Artist', source: 'Feat', desc: '' }] });
    expect(names(featSpellsOwed(artist, 2))).toEqual(['Minor Illusion']);
    expect(featSpellsOwed({ ...artist, spells: [known('Minor Illusion', 0)] }, 2)).toEqual([]);
  });

  it('owes a School Adept the row of a slot level it has just reached', () => {
    const adept = pc({
      features: [{ name: 'Evocation Adept', source: 'Feat (Level 4)', desc: '' }],
      spells: [known('Chromatic Orb', 1, { alwaysPrepared: true }), known('Shatter', 2, { alwaysPrepared: true })],
    });
    expect(featSpellsOwed(adept, 4)).toEqual([]);
    expect(featSpellsOwed(adept, 5)).toEqual([{ name: 'Fireball', grantedBy: 'Evocation Adept' }]);
  });

  it('lists, for each feat on offer, the spells it would add', () => {
    const wizard = pc({ feat: 'Familiar Friend', spells: [known('Shield', 1, { alwaysPrepared: true })] });
    const byFeat = featSpellsOwedByFeat(wizard, ['Alert', 'Abjuration Adept', 'Evocation Adept', 'Warlike Familiar'], 4);
    expect(Object.keys(byFeat)).toEqual(['Abjuration Adept', 'Evocation Adept', 'Warlike Familiar']);
    expect(names(byFeat['Abjuration Adept'])).toEqual(['Lesser Restoration']);   // Shield is already held
    expect(names(byFeat['Evocation Adept'])).toEqual(['Chromatic Orb', 'Shatter']);
    expect(byFeat['Warlike Familiar']).toEqual([{ name: 'Battle Familiar', grantedBy: 'Warlike Familiar' }]);
    expect(featSpellsOwedByFeat(pc({ clazz: 'Fighter' }), ['Evocation Adept', 'Spell Resistant'], 4)).toEqual({});
  });

  // ── Picks: Origin feats (create wizard) ─────────────────────────────────────

  it('finds the Magic Initiate feats among a character\'s feats', () => {
    expect(magicInitiateFeat('Magic Initiate (Druid)')?.spellList).toBe('druid');
    expect(magicInitiateFeats(['Alert', 'Magic Initiate (Cleric)', 'Second Wind', 'Magic Initiate (Wizard)'])
      .map(f => [f.feat, f.spellList, f.className])).toEqual([
      ['Magic Initiate (Cleric)', 'cleric', 'Cleric'], ['Magic Initiate (Wizard)', 'wizard', 'Wizard'],
    ]);
    expect(magicInitiateFeats(['Alert'])).toEqual([]);
  });

  it('lets Magic Initiate pick two cantrips and a level 1 spell from its class list', () => {
    const choice = originFeatSpellChoice('Magic Initiate (Cleric)')!;
    expect(choice).toEqual(jasmine.objectContaining({
      feat: 'Magic Initiate (Cleric)', label: 'Magic Initiate (Cleric)', spellLists: ['cleric'],
      minLevel: 0, maxLevel: 1, cantrips: 2, spells: 1,
    }));
    expect(choice.school).toBeUndefined();
    expect(choice.hint).toContain('Pick two Cleric cantrips and one level 1 Cleric spell.');
    expect(featChoiceAllows(choice, spell('Guidance', 0, 'divination', ['cleric', 'druid']))).toBeTrue();
    expect(featChoiceAllows(choice, spell('Bless', 1, 'enchantment', ['cleric']))).toBeTrue();
    expect(featChoiceAllows(choice, spell('Aid', 2, 'abjuration', ['cleric']))).toBeFalse();
    expect(featChoiceAllows(choice, spell('Fire Bolt', 0, 'evocation', ['wizard']))).toBeFalse();
    expect(featChoiceSatisfied(choice, [{ level: 0 }, { level: 0 }, { level: 1 }])).toBeTrue();
    expect(featChoiceSatisfied(choice, [{ level: 0 }, { level: 1 }])).toBeFalse();
  });

  it('lets Arcane Undertaker pick one Cleric or Wizard cantrip of the Necromancy school', () => {
    const choice = originFeatSpellChoice(' arcane undertaker ')!;
    expect(choice).toEqual(jasmine.objectContaining({
      feat: 'Arcane Undertaker', spellLists: ['cleric', 'wizard'], school: 'necromancy',
      minLevel: 0, maxLevel: 0, cantrips: 1, spells: 0,
    }));
    expect(choice.hint).toBe('Pick one Cleric or Wizard cantrip of the Necromancy school.');
    expect(featChoiceAllows(choice, spell('Toll the Dead', 0, 'necromancy', ['cleric', 'warlock', 'wizard']))).toBeTrue();
    expect(featChoiceAllows(choice, spell('Chill Touch', 0, 'necromancy', ['sorcerer', 'warlock', 'wizard']))).toBeTrue();
    expect(featChoiceAllows(choice, spell('Spare the Dying', 0, 'necromancy', ['cleric', 'druid']))).toBeTrue();
    expect(featChoiceAllows(choice, spell('Druid Only', 0, 'necromancy', ['druid', 'sorcerer']))).toBeFalse();   // neither list
    expect(featChoiceAllows(choice, spell('Fire Bolt', 0, 'evocation', ['wizard']))).toBeFalse();
    expect(featChoiceAllows(choice, spell('Inflict Wounds', 1, 'necromancy', ['cleric']))).toBeFalse();
    expect(featChoiceFits(choice, spell('Druid Only', 0, 'necromancy', ['druid']))).toBeTrue();   // the list aside
    expect(featChoiceSatisfied(choice, [{ level: 0 }])).toBeTrue();
    expect(featChoiceSatisfied(choice, [])).toBeFalse();
  });

  it('has no picks for the Origin feats that name their spell, or for any other feat', () => {
    for (const feat of ['Arcane Artist', 'Familiar Friend', 'Portal Jumper', 'Alert', 'Arcane Warrior', '', null]) {
      expect(originFeatSpellChoice(feat)).withContext(String(feat)).toBeUndefined();
    }
  });

  // ── Picks: feats taken at a level-up ────────────────────────────────────────

  it('lets Arcane Warrior pick two Wizard cantrips', () => {
    const [choice, ...rest] = levelUpFeatSpellChoices('Arcane Warrior', 'Fighter');
    expect(rest).toEqual([]);
    expect(choice).toEqual(jasmine.objectContaining({
      feat: 'Arcane Warrior', key: 'cantrips', spellLists: ['wizard'], minLevel: 0, maxLevel: 0, cantrips: 2, spells: 0,
    }));
    expect(choice.hint).toContain('Mage Hand and Ray of Frost');
    expect(featChoiceAllows(choice, spell('Mage Hand', 0, 'conjuration', ['bard', 'wizard']))).toBeTrue();
    expect(featChoiceAllows(choice, spell('Guidance', 0, 'divination', ['cleric']))).toBeFalse();
    expect(featChoiceAllows(choice, spell('Shield', 1, 'abjuration', ['wizard']))).toBeFalse();
  });

  it('lets Magic Connoisseur pick a level 1 and a level 2 spell from the Magic Initiate class list', () => {
    const choices = levelUpFeatSpellChoices('Magic Connoisseur', 'Fighter', 'cleric');
    expect(choices.map(c => [c.feat, c.key, c.spellLists, c.minLevel, c.maxLevel, c.cantrips, c.spells])).toEqual([
      ['Magic Connoisseur', 'level1', ['cleric'], 1, 1, 0, 1],
      ['Magic Connoisseur', 'level2', ['cleric'], 2, 2, 0, 1],
    ]);
    expect(choices[0].hint).toContain('one level 1 Cleric spell');
    expect(choices[1].hint).toContain('one level 2 Cleric spell');
    expect(featChoiceAllows(choices[0], spell('Bless', 1, 'enchantment', ['cleric']))).toBeTrue();
    expect(featChoiceAllows(choices[0], spell('Aid', 2, 'abjuration', ['cleric']))).toBeFalse();
    expect(featChoiceAllows(choices[1], spell('Aid', 2, 'abjuration', ['cleric']))).toBeTrue();
    expect(featChoiceAllows(choices[1], spell('Misty Step', 2, 'conjuration', ['wizard']))).toBeFalse();
    // Without a Magic Initiate list there is nothing to pick from.
    expect(levelUpFeatSpellChoices('Magic Connoisseur', 'Fighter')).toEqual([]);
  });

  it('lets a Boon of Magic School Mastery pick a level 1 class spell and a spell of level 7 or lower, of its school', () => {
    const [rote, signature] = levelUpFeatSpellChoices('Boon of Magic School Mastery (Evocation)', 'Wizard');
    expect(rote).toEqual(jasmine.objectContaining({
      feat: 'Boon of Magic School Mastery (Evocation)', key: 'rote', label: 'Rote Casting', school: 'evocation',
      spellLists: ['wizard'], minLevel: 1, maxLevel: 1, cantrips: 0, spells: 1,
    }));
    expect(signature).toEqual(jasmine.objectContaining({
      feat: 'Boon of Magic School Mastery (Evocation)', key: 'signature', label: 'Signature Arcanum',
      school: 'evocation', spellLists: [], minLevel: 1, maxLevel: 7, cantrips: 0, spells: 1,
    }));
    expect(featChoiceAllows(rote, spell('Magic Missile', 1, 'evocation', ['sorcerer', 'wizard']))).toBeTrue();
    expect(featChoiceAllows(rote, spell('Guiding Bolt', 1, 'evocation', ['cleric']))).toBeFalse();   // not a Wizard spell
    expect(featChoiceAllows(rote, spell('Shield', 1, 'abjuration', ['wizard']))).toBeFalse();
    expect(featChoiceAllows(rote, spell('Fireball', 3, 'evocation', ['wizard']))).toBeFalse();
    expect(featChoiceAllows(signature, spell('Guiding Bolt', 1, 'evocation', ['cleric']))).toBeTrue();   // any list
    expect(featChoiceAllows(signature, spell('Delayed Blast Fireball', 7, 'evocation', ['wizard']))).toBeTrue();
    expect(featChoiceAllows(signature, spell('Sunburst', 8, 'evocation', ['wizard']))).toBeFalse();
    expect(featChoiceAllows(signature, spell('Fire Bolt', 0, 'evocation', ['wizard']))).toBeFalse();
    expect(featChoiceAllows(signature, spell('Fly', 3, 'transmutation', ['wizard']))).toBeFalse();
  });

  it('knows which feats come with picks at a level-up', () => {
    for (const feat of ['Arcane Warrior', 'magic connoisseur', 'Boon of Magic School Mastery (Illusion)']) {
      expect(hasLevelUpFeatSpellChoices(feat)).withContext(feat).toBeTrue();
    }
    for (const feat of ['Evocation Adept', 'Warlike Familiar', 'Arcane Undertaker', 'Boon of Magic School Mastery',
      'War Caster', '', null]) {
      expect(hasLevelUpFeatSpellChoices(feat)).withContext(String(feat)).toBeFalse();
      expect(levelUpFeatSpellChoices(feat, 'Wizard', 'wizard')).withContext(String(feat)).toEqual([]);
    }
  });

  // ── Against the shipped spell data ──────────────────────────────────────────

  describe('against the shipped spell data', () => {
    let index: Map<string, DndSpell>;
    /** Arcana Unleashed's own spells are added by another change; without its file they cannot be checked here. */
    let hasArcanaSpells = false;

    beforeAll(async () => {
      const load = (file: string): Promise<DndSpell[]> => fetch(`/assets/data/spells/${file}`)
        .then(r => r.ok ? r.json() as Promise<DndSpell[]> : [])
        .catch(() => []);
      const [srd, supplement, wow, arcana] = await Promise.all(
        ['srd-5.2-spells.json', 'phb-2024-supplement.json', 'wow-spells.json', 'arcana-unleashed-spells.json'].map(load));
      hasArcanaSpells = arcana.length > 0;
      index = new Map([...srd, ...supplement, ...wow, ...arcana].map(s => [s.name.toLowerCase(), s]));
    });

    it('finds every spell a feat names, at the level a feat gives it', () => {
      for (const [feat, spells] of Object.entries(FEAT_SPELLS)) {
        for (const name of spells) {
          if (name === 'Battle Familiar' && !hasArcanaSpells) continue;
          expect(index.has(spellKey(name))).withContext(`${feat}: ${name}`).toBeTrue();
        }
      }
      // An Origin feat's cantrip is a cantrip; Find Familiar is a level 1 spell.
      for (const cantrip of ['Minor Illusion', 'Vicious Mockery', 'Friends', 'Guidance', 'Fire Bolt', 'Resistance']) {
        expect(index.get(spellKey(cantrip))?.level).withContext(cantrip).toBe(0);
      }
      expect(index.get('find familiar')?.level).toBe(1);
    });

    it('finds every School Adept spell, of the feat\'s school and no higher than its row', () => {
      for (const [feat, spells] of Object.entries(SCHOOL_ADEPT_SPELLS)) {
        const school = feat.replace(' Adept', '').toLowerCase();
        spells.forEach((name, i) => {
          const found = index.get(spellKey(name));
          expect(found).withContext(`${feat}: ${name}`).toBeDefined();
          expect(found?.school).withContext(name).toBe(school as DndSpell['school']);
          expect(found?.level).withContext(name).toBeLessThanOrEqual(i + 1);
          expect(found?.level).withContext(name).toBeGreaterThan(0);
        });
      }
    });

    it('has Necromancy cantrips on the Cleric and Wizard lists for Arcane Undertaker', () => {
      const choice = originFeatSpellChoice('Arcane Undertaker')!;
      const options = [...index.values()].filter(s => featChoiceAllows(choice, s)).map(s => s.name).sort();
      expect(options).toEqual(jasmine.arrayContaining(['Chill Touch', 'Poison Spray', 'Spare the Dying', 'Toll the Dead']));
      for (const name of options) {
        const found = index.get(name.toLowerCase())!;
        expect([found.level, found.school]).withContext(name).toEqual([0, 'necromancy']);
        expect(found.classes.some(c => c === 'cleric' || c === 'wizard')).withContext(name).toBeTrue();
      }
    });
  });
});
