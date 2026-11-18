import {
  WOW_DRUID_SUGGESTED_SPELLS, bearForm, catForm, classicBeastForms, diceWithMod, isMoonCircle, pounceBonusDice,
  tierDice,
} from './wow-druid';

describe('wow-druid', () => {
  // WIS 16 (+3), spell attack +5, DC 13 — a level 2–4 druid.
  const base = { level: 2, wis: 16, spellAttack: 5, spellDc: 13 };

  describe('Cat Form', () => {
    it('computes the level-2 card from WIS and the spell math', () => {
      const cat = catForm(base);
      expect(cat.size).toBe('Medium');
      expect(cat.ac).toBe(16);                 // 13 + WIS 3
      expect(cat.tempHp).toBe(6);              // 3 × level
      expect(cat.speed).toBe('40 ft.');
      expect(cat.strDex).toBe(16);
      expect(cat.skills).toContain('Stealth');
      expect(cat.senses).toBe('Darkvision 60 ft.');
      expect(cat.attacks).toEqual([{ name: 'Pounce', toHit: 5, reach: '5 ft.', damage: '1d10 + 3 slashing' }]);
      expect(cat.actions.find(a => a.name.startsWith('Pounce'))?.text).toContain('extra 1d6 slashing');
      expect(cat.actions.find(a => a.name === 'Primal Wrath')?.text).toContain('DC 13 Dexterity save');
      expect(cat.actions.find(a => a.name === 'Primal Wrath')?.text).toContain('2d6 per slot level + 3');
      expect(cat.actions.find(a => a.name === 'Primal Wrath')?.kind).toBe('Bonus Action');
    });

    it('scales Pounce dice at 5 / 11 / 17 and the Advantage bonus at 6 / 9 / 12 / 15 / 18', () => {
      const at = (level: number) => catForm({ ...base, level });
      expect(at(5).attacks[0].damage).toBe('2d10 + 3 slashing');
      expect(at(5).actions[0].text).toContain('extra 1d6');
      expect(at(6).actions[0].text).toContain('extra 2d6');
      expect(at(6).tempHp).toBe(18);
      expect(at(11).attacks[0].damage).toBe('3d10 + 3 slashing');
      expect(at(11).actions[0].text).toContain('extra 3d6');
      expect(at(17).attacks[0].damage).toBe('4d10 + 3 slashing');
      expect(at(17).actions[0].text).toContain('extra 5d6');
      expect(at(18).actions[0].text).toContain('extra 6d6');
    });

    it('follows the WIS modifier (positive, zero, negative)', () => {
      expect(catForm({ ...base, wis: 20 }).ac).toBe(18);
      expect(catForm({ ...base, wis: 20 }).attacks[0].damage).toBe('1d10 + 5 slashing');
      expect(catForm({ ...base, wis: 10 }).ac).toBe(13);
      expect(catForm({ ...base, wis: 10 }).attacks[0].damage).toBe('1d10 slashing');
      expect(catForm({ ...base, wis: 8 }).ac).toBe(12);
      expect(catForm({ ...base, wis: 8 }).attacks[0].damage).toBe('1d10 − 1 slashing');
    });
  });

  describe('Bear Form', () => {
    it('computes the level-2 card', () => {
      const bear = bearForm(base);
      expect(bear.size).toBe('Large');
      expect(bear.ac).toBe(18);                // 15 + WIS 3
      expect(bear.tempHp).toBe(6);
      expect(bear.speed).toBe('30 ft.');
      expect(bear.strDex).toBe(16);
      expect(bear.skills).toBeUndefined();
      expect(bear.multiattack).toContain('two Mangle');
      expect(bear.attacks).toEqual([{ name: 'Mangle', toHit: 5, reach: '5 ft.', damage: '1d8 + 3 slashing' }]);
      expect(bear.actions.map(a => [a.name, a.kind]))
        .toEqual([['Frenzied Regeneration', 'Bonus Action'], ['Growl', 'Reaction']]);
      expect(bear.actions[0].text).toContain('5 × the slot level');
    });

    it('scales Mangle dice at 5 / 11 / 17', () => {
      const at = (level: number) => bearForm({ ...base, level, wis: 18 });
      expect(at(4).attacks[0].damage).toBe('1d8 + 4 slashing');
      expect(at(5).attacks[0].damage).toBe('2d8 + 4 slashing');
      expect(at(6).attacks[0].damage).toBe('2d8 + 4 slashing');
      expect(at(11).attacks[0].damage).toBe('3d8 + 4 slashing');
      expect(at(17).attacks[0].damage).toBe('4d8 + 4 slashing');
      expect(at(17).tempHp).toBe(51);
      expect(at(17).ac).toBe(19);
    });
  });

  it('has the dice helpers the cards use', () => {
    expect([1, 4, 5, 10, 11, 16, 17, 20].map(tierDice)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect([2, 5, 6, 8, 9, 12, 15, 18, 20].map(pounceBonusDice)).toEqual([1, 1, 2, 2, 3, 4, 5, 6, 6]);
    expect(diceWithMod('1d8', 2)).toBe('1d8 + 2');
    expect(diceWithMod('1d8', 0)).toBe('1d8');
    expect(diceWithMod('1d8', -2)).toBe('1d8 − 2');
  });

  describe('classic beast forms', () => {
    const avail = (level: number, moon: boolean) =>
      classicBeastForms(level, moon).filter(f => f.available).map(f => f.beast);

    it('lists every form for a non-Moon druid, unlocking by level', () => {
      expect(avail(1, false)).toEqual([]);
      expect(avail(2, false)).toEqual(['Panther', 'Elk']);
      expect(avail(3, false)).toEqual(['Panther', 'Elk']);
      expect(avail(4, false)).toEqual(['Panther', 'Black Bear', 'Elk', 'Giant Seahorse']);
      expect(avail(8, false).length).toBe(7);
      expect(classicBeastForms(2, false).find(f => f.beast === 'Tiger'))
        .toEqual({ form: 'Cat Form', beast: 'Tiger', fromLevel: 8, available: false });
    });

    it('drops Cat/Bear for Circle of the Moon and gives the seahorse at 3', () => {
      const forms = classicBeastForms(3, true);
      expect(forms.map(f => f.form)).toEqual(['Travel Form', 'Aquatic Form', 'Flight Form']);
      expect(avail(2, true)).toEqual(['Elk']);
      expect(avail(3, true)).toEqual(['Elk', 'Giant Seahorse']);
      expect(forms.find(f => f.form === 'Aquatic Form')?.fromLevel).toBe(3);
      expect(classicBeastForms(3, false).find(f => f.form === 'Aquatic Form')?.fromLevel).toBe(4);
      expect(avail(8, true)).toContain('Eagle, Giant Bat, Hawk, Pteranodon, or Raven');
    });
  });

  it('recognizes the Circle of the Moon case-insensitively', () => {
    expect(isMoonCircle('Circle of the Moon')).toBeTrue();
    expect(isMoonCircle('circle of the moon')).toBeTrue();
    expect(isMoonCircle('Circle of the Land')).toBeFalse();
    expect(isMoonCircle(null)).toBeFalse();
  });

  describe('suggested spells', () => {
    const flat = (spec: string) => WOW_DRUID_SUGGESTED_SPELLS[spec].flatMap(r => r.spells);

    it('covers spell levels 2–9 for every specialization', () => {
      for (const spec of ['Balance', 'Feral', 'Guardian', 'Restoration']) {
        expect(WOW_DRUID_SUGGESTED_SPELLS[spec].map(r => r.level)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
      }
    });

    it('lists the per-specialization picks (incl. the WoW stubs)', () => {
      expect(flat('Balance')).toContain('Starfall');
      expect(flat('Balance')).toContain('Storm of Vengeance');
      expect(flat('Feral')).toContain('Feral Prowl');
      expect(flat('Feral')).toContain('Innervate');
      expect(flat('Guardian')).toContain('Roar of Ursoc');
      expect(flat('Guardian')[0]).toBe('Aid');
      expect(flat('Restoration')).toEqual(jasmine.arrayContaining(['Regrowth', 'Tranquility', 'Tree of Life', 'Foresight']));
      expect(flat('Restoration')).not.toContain('Starfall');
    });
  });
});
