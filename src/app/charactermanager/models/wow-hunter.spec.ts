import {
  BEAST_MASTER, HUNTER_PET_FAMILIES, PetFamily, keepsHunterPet, petFamilyByName, petFamilyLabel, petSpecialization,
  petStatCard, petStatCards, tenacityHpBonus,
} from './wow-hunter';

describe('wow-hunter (pet families)', () => {
  const family = (name: string): PetFamily => petFamilyByName(name)!;
  const input = { level: 6, wisMod: 3, spellAttack: 6, spellDc: 14 };

  describe('the Pet Families table', () => {
    it('lists 47 uniquely named families in alphabetical order', () => {
      const names = HUNTER_PET_FAMILIES.map(f => f.name);
      expect(names.length).toBe(47);
      expect(new Set(names).size).toBe(47);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
      expect(names[0]).toBe('Basilisk');
      expect(names[46]).toBe('Wolf');
    });

    it('flags exactly the five unusual families', () => {
      expect(HUNTER_PET_FAMILIES.filter(f => f.unusual).map(f => f.name))
        .toEqual(['Blood Beast', 'Direhorn', 'Feathermane', 'Mechanized Animal', 'Threshadon']);
    });

    it('uses only the known stat blocks, specializations and mastery properties', () => {
      for (const f of HUNTER_PET_FAMILIES) {
        expect(['Land', 'Sea', 'Sky', 'Land or Sea']).withContext(f.name).toContain(f.statBlock);
        expect(['Cunning', 'Ferocity', 'Tenacity']).withContext(f.name).toContain(f.specialization);
        expect(['Cleave', 'Graze', 'Push', 'Sap', 'Slow', 'Vex']).withContext(f.name).toContain(f.mastery);
      }
      expect(HUNTER_PET_FAMILIES.filter(f => f.statBlock === 'Land or Sea').map(f => f.name)).toEqual(['Serpent']);
      expect(HUNTER_PET_FAMILIES.filter(f => f.statBlock === 'Sea').map(f => f.name))
        .toEqual(['Dolphin', 'Frenzy', 'Shark', 'Threshadon']);
      expect(HUNTER_PET_FAMILIES.filter(f => f.statBlock === 'Sky').map(f => f.name)).toEqual([
        'Bat', 'Bird of Prey', 'Blood Beast', 'Carrion Bird', 'Dragonhawk', 'Feathermane', 'Moth', 'Ray', 'Wasp',
      ]);
    });

    it('records the table row for a sample of families', () => {
      expect(family('Wolf')).toEqual({ name: 'Wolf', statBlock: 'Land', specialization: 'Ferocity', mastery: 'Slow', unusual: false });
      expect(family('Bear')).toEqual(jasmine.objectContaining({ statBlock: 'Land', specialization: 'Tenacity', mastery: 'Push' }));
      expect(family('Bat')).toEqual(jasmine.objectContaining({ statBlock: 'Sky', specialization: 'Ferocity', mastery: 'Vex' }));
      expect(family('Courser')).toEqual(jasmine.objectContaining({ specialization: 'Ferocity', mastery: 'Graze', descriptor: 'horses' }));
      expect(family('Mechanized Animal')).toEqual(jasmine.objectContaining({ specialization: 'Cunning', mastery: 'Sap', unusual: true }));
      expect(family('Threshadon')).toEqual(jasmine.objectContaining({ statBlock: 'Sea', specialization: 'Tenacity', mastery: 'Sap' }));
      expect(family('Serpent')).toEqual(jasmine.objectContaining({ specialization: 'Cunning', mastery: 'Graze' }));
      expect(family('Scalehide')).toEqual(jasmine.objectContaining({ specialization: 'Ferocity', mastery: 'Sap', descriptor: 'ankylosaurus' }));
    });

    it('finds a family by its stored bare name, case-insensitively', () => {
      expect(petFamilyByName('courser')?.name).toBe('Courser');
      expect(petFamilyByName(' Mechanized Animal ')?.name).toBe('Mechanized Animal');
      expect(petFamilyByName('Courser (horses)')).toBeUndefined();
      expect(petFamilyByName('Dragon')).toBeUndefined();
      expect(petFamilyByName(null)).toBeUndefined();
      expect(petFamilyByName('')).toBeUndefined();
    });

    it('labels families for the selector with the descriptor and a ✦ for unusual ones', () => {
      expect(petFamilyLabel(family('Wolf'))).toBe('Wolf');
      expect(petFamilyLabel(family('Courser'))).toBe('Courser (horses)');
      expect(petFamilyLabel(family('Blood Beast'))).toBe('Blood Beast (stirges) ✦');
      expect(petFamilyLabel(family('Mechanized Animal'))).toBe('Mechanized Animal ✦');
    });
  });

  it('keeps a pet only for a ranger with the Beast Master subclass', () => {
    expect(BEAST_MASTER).toBe('Beast Master');
    expect(keepsHunterPet({ clazz: 'Ranger', subclass: 'Beast Master' })).toBeTrue();
    expect(keepsHunterPet({ clazz: 'ranger', subclass: 'beast master' })).toBeTrue();
    expect(keepsHunterPet({ clazz: 'Ranger', subclass: 'Hunter' })).toBeFalse();
    expect(keepsHunterPet({ clazz: 'Ranger', subclass: null })).toBeFalse();
    expect(keepsHunterPet({ clazz: 'Druid', subclass: 'Beast Master' })).toBeFalse();
    expect(keepsHunterPet(null)).toBeFalse();
  });

  describe('Primal Companion stat cards', () => {
    it('computes the Beast of the Land from the ranger level and Wisdom', () => {
      const card = petStatCard('Land', input);
      expect(card.name).toBe('Beast of the Land');
      expect([card.ac, card.hp]).toEqual([16, 35]);
      expect(card.speed).toContain('Climb 40 ft.');
      expect(card.strike).toContain('+6 to hit');
      expect(card.strike).toContain('1d8 + 5');
      expect(card.trait.name).toBe('Charge');
      expect(card.trait.text).toContain('DC 14');
    });

    it('computes the Beast of the Sea and the Beast of the Sky', () => {
      const sea = petStatCard('Sea', input);
      expect([sea.name, sea.ac, sea.hp]).toEqual(['Beast of the Sea', 16, 35]);
      expect(sea.speed).toContain('Swim 60 ft.');
      expect(sea.strike).toContain('1d6 + 5');
      expect(sea.strike).toContain('Grappled (escape DC 14)');
      const sky = petStatCard('Sky', input);
      expect([sky.name, sky.size, sky.ac, sky.hp]).toEqual(['Beast of the Sky', 'Small Beast', 16, 28]);
      expect(sky.speed).toContain('Fly 60 ft.');
      expect(sky.strike).toContain('1d4 + 6');
      expect(sky.trait.name).toBe('Flyby');
    });

    it('gives the Serpent both the Land and Sea cards, and every other family one card', () => {
      expect(petStatCards(family('Serpent'), input).map(c => c.name)).toEqual(['Beast of the Land', 'Beast of the Sea']);
      expect(petStatCards(family('Wolf'), input).map(c => c.name)).toEqual(['Beast of the Land']);
      expect(petStatCards(family('Shark'), input).map(c => c.name)).toEqual(['Beast of the Sea']);
      expect(petStatCards(family('Moth'), input).map(c => c.name)).toEqual(['Beast of the Sky']);
    });

    it('formats a negative Wisdom modifier with a minus sign', () => {
      const card = petStatCard('Land', { level: 3, wisMod: -3, spellAttack: -1, spellDc: 7 });
      expect(card.ac).toBe(10);
      expect(card.strike).toContain('−1 to hit');
      expect(card.strike).toContain('1d8 − 1');
    });
  });

  describe('Pet Specialization (Beast Mastery, Ranger 6+)', () => {
    it('is not available before Ranger 6', () => {
      expect(petSpecialization(family('Wolf'), 5, 3)).toBeNull();
      expect(tenacityHpBonus(5)).toBe(0);
    });

    it('Cunning: +10 ft Speed and Freedom of Movement once per Long Rest', () => {
      const spec = petSpecialization(family('Fox'), 6, 3)!;
      expect(spec.specialization).toBe('Cunning');
      expect(spec.spell).toBe('Freedom of Movement');
      expect(spec.text).toContain('10 feet');
      expect(spec.hpBonus).toBeUndefined();
    });

    it('Ferocity: Bloodied healing by the Wisdom modifier and Haste once per Long Rest', () => {
      const spec = petSpecialization(family('Wolf'), 6, 3)!;
      expect(spec.specialization).toBe('Ferocity');
      expect(spec.spell).toBe('Haste');
      expect(spec.text).toContain('Bloodied');
      expect(spec.text).toContain('regain 3 Hit Points');
    });

    it('Tenacity: +6 HP max (+1 per Ranger level after 6), beast + Ranger level, and Stoneskin', () => {
      expect(tenacityHpBonus(6)).toBe(6);
      expect(tenacityHpBonus(7)).toBe(7);
      expect(tenacityHpBonus(11)).toBe(11);
      expect(tenacityHpBonus(20)).toBe(20);
      const at6 = petSpecialization(family('Bear'), 6, 3)!;
      expect(at6.hpBonus).toEqual({ you: 6, beast: 6 });
      const at10 = petSpecialization(family('Bear'), 10, 3)!;
      expect(at10.specialization).toBe('Tenacity');
      expect(at10.spell).toBe('Stoneskin');
      expect(at10.hpBonus).toEqual({ you: 10, beast: 10 });
      expect(at10.text).toContain('increases by 10');
    });
  });
});
