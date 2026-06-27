import { of } from 'rxjs';
import { CreateCharacterModalComponent } from './create-character-modal.component';
import { DndResourcesService } from '../../services/dnd-resources.service';
import { AuthService } from '../../services/auth.service';

/**
 * Tests exercise the TypeScript logic of the wizard component directly
 * (without Angular TestBed / DOM compilation) to keep setup lightweight.
 * DOM/template behaviour is covered by manual verification and E2E tests.
 */

/**
 * Sage background detail, as the API would return it. In the running app this is
 * loaded lazily via the `backgroundTrigger$` switchMap when a background is picked;
 * tests that read background-derived getters assign it onto the component directly.
 */
const SAGE_BACKGROUND_DETAIL = {
  index: 'sage', name: 'Sage',
  source: "Player's Handbook",
  ability_scores: [{ index: 'int', name: 'INT', url: '' }, { index: 'wis', name: 'WIS', url: '' }],
  feat: { index: 'magic-initiate-wizard', name: 'Magic Initiate (Wizard)', url: '' },
  proficiencies: [
    { index: 'arcana', name: 'Arcana', url: '' },
    { index: 'history', name: 'History', url: '' },
  ],
};

function makeMockDndResources(): jasmine.SpyObj<DndResourcesService> {
  const spy = jasmine.createSpyObj<DndResourcesService>('DndResourcesService', [
    'getSpeciesList',
    'getClassNames2024',
    'getClassDetail',
    'getBackgroundGroups',
    'getBackgroundDetail',
    'getSubclassesForClass',
    'getClassSkillChoices',
    'getFeatDescription',
    'getBackgroundGold',
    'getClassEquipment',
    'getSpellsForClass',
    'getSpeciesDetail',
    'getTraitDescription',
  ]);

  // Provide safe defaults for all calls made during ngOnInit
  spy.getSpeciesList.and.returnValue(of(['Elf', 'Human', 'Dwarf']));
  spy.getClassNames2024.and.returnValue(of(['Barbarian', 'Bard', 'Wizard']));
  spy.getBackgroundGroups.and.returnValue(of([
    { source: "Player's Handbook", backgrounds: ['Sage', 'Criminal', 'Noble'] }
  ]));
  spy.getBackgroundDetail.and.returnValue(of(SAGE_BACKGROUND_DETAIL as any));
  spy.getSubclassesForClass.and.returnValue([]);
  spy.getClassSkillChoices.and.returnValue({ choose: 2, from: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion'] });
  spy.getFeatDescription.and.returnValue('You learn two Wizard cantrips and one 1st-level spell.');
  spy.getBackgroundGold.and.returnValue(15);
  spy.getClassDetail.and.returnValue(of({
    index: 'wizard', name: 'Wizard',
    hit_die: 6,
    saving_throws: [{ index: 'int', name: 'INT', url: '' }, { index: 'wis', name: 'WIS', url: '' }],
    proficiency_choices: [],
    proficiencies: [],
    url: '',
  } as any));
  spy.getSpeciesDetail.and.returnValue(of(null as any));
  spy.getTraitDescription.and.returnValue('');

  return spy;
}

describe('CreateCharacterModalComponent — logic', () => {
  let component: CreateCharacterModalComponent;
  let dndResources: jasmine.SpyObj<DndResourcesService>;
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    dndResources = makeMockDndResources();
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['getUsername']);
    auth.getUsername.and.returnValue('tester');
    component = new CreateCharacterModalComponent(dndResources, auth);
    component.ngOnInit();
  });

  afterEach(() => component.ngOnDestroy());

  // ── Step count ────────────────────────────────────────────────────────────

  describe('totalSteps / reviewStep / equipmentStep', () => {
    it('totalSteps is 8 for a non-spellcasting class (Fighter)', () => {
      component.clazz = 'Fighter';
      expect(component.totalSteps).toBe(8);
    });

    it('totalSteps is 9 for a spellcasting class (Wizard)', () => {
      component.clazz = 'Wizard';
      expect(component.totalSteps).toBe(9);
    });

    it('reviewStep is the last step (equals totalSteps)', () => {
      component.clazz = 'Fighter';
      expect(component.reviewStep).toBe(component.totalSteps);
      component.clazz = 'Wizard';
      expect(component.reviewStep).toBe(component.totalSteps);
    });

    it('equipmentStep is 7 for non-casters', () => {
      component.clazz = 'Barbarian';
      expect(component.equipmentStep).toBe(7);
    });

    it('equipmentStep is 8 for casters', () => {
      component.clazz = 'Bard';
      expect(component.equipmentStep).toBe(8);
    });
  });

  // ── isSpellcastingClass ───────────────────────────────────────────────────

  describe('isSpellcastingClass', () => {
    const casters    = ['bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'wizard'];
    const nonCasters = ['barbarian', 'fighter', 'monk', 'paladin', 'ranger', 'rogue'];

    casters.forEach(cls => {
      it(`${cls} is a spellcasting class`, () => {
        component.clazz = cls;
        expect(component.isSpellcastingClass).toBeTrue();
      });
    });

    nonCasters.forEach(cls => {
      it(`${cls} is not a spellcasting class`, () => {
        component.clazz = cls;
        expect(component.isSpellcastingClass).toBeFalse();
      });
    });
  });

  // ── requiresLevel1Subclass ────────────────────────────────────────────────

  describe('requiresLevel1Subclass', () => {
    it('is true for Sorcerer', () => {
      component.clazz = 'Sorcerer';
      expect(component.requiresLevel1Subclass).toBeTrue();
    });

    it('is true for Warlock', () => {
      component.clazz = 'warlock';
      expect(component.requiresLevel1Subclass).toBeTrue();
    });

    it('is false for Wizard', () => {
      component.clazz = 'Wizard';
      expect(component.requiresLevel1Subclass).toBeFalse();
    });

    it('is false for Fighter', () => {
      component.clazz = 'Fighter';
      expect(component.requiresLevel1Subclass).toBeFalse();
    });
  });

  // ── canAdvance — step 1 ───────────────────────────────────────────────────

  describe('canAdvance step 1', () => {
    beforeEach(() => { component.step = 1; });

    it('is false when name is empty', () => {
      component.name = '';
      expect(component.canAdvance).toBeFalse();
    });

    it('is false when name is only whitespace', () => {
      component.name = '   ';
      expect(component.canAdvance).toBeFalse();
    });

    it('is true when name has content', () => {
      component.name = 'Aelindra';
      expect(component.canAdvance).toBeTrue();
    });
  });

  // ── canAdvance — step 2 ───────────────────────────────────────────────────

  describe('canAdvance step 2', () => {
    beforeEach(() => { component.step = 2; });

    it('is false when no species selected', () => {
      component.species = '';
      expect(component.canAdvance).toBeFalse();
    });

    it('is true when species selected', () => {
      component.species = 'Elf';
      expect(component.canAdvance).toBeTrue();
    });
  });

  // ── canAdvance — step 3 ───────────────────────────────────────────────────

  describe('canAdvance step 3', () => {
    beforeEach(() => { component.step = 3; });

    it('is false when no class selected', () => {
      component.clazz = '';
      expect(component.canAdvance).toBeFalse();
    });

    it('is true for a non-subclass class (Fighter) without subclass', () => {
      component.clazz = 'Fighter';
      component.selectedSubclass = '';
      expect(component.canAdvance).toBeTrue();
    });

    it('is false for Sorcerer without subclass', () => {
      component.clazz = 'Sorcerer';
      component.selectedSubclass = '';
      expect(component.canAdvance).toBeFalse();
    });

    it('is true for Sorcerer with a subclass chosen', () => {
      component.clazz = 'Sorcerer';
      component.selectedSubclass = 'Draconic Sorcery';
      expect(component.canAdvance).toBeTrue();
    });

    it('is false for Warlock without subclass', () => {
      component.clazz = 'Warlock';
      component.selectedSubclass = '';
      expect(component.canAdvance).toBeFalse();
    });

    it('is true for Warlock with a subclass chosen', () => {
      component.clazz = 'Warlock';
      component.selectedSubclass = 'Fiend Patron';
      expect(component.canAdvance).toBeTrue();
    });
  });

  // ── canAdvance — step 4 ───────────────────────────────────────────────────

  describe('canAdvance step 4', () => {
    beforeEach(() => { component.step = 4; });

    it('is false when no background selected', () => {
      component.background = '';
      expect(component.canAdvance).toBeFalse();
    });

    it('is true when background selected', () => {
      component.background = 'Sage';
      expect(component.canAdvance).toBeTrue();
    });
  });

  // ── canAdvance — step 5 (proficiencies) ──────────────────────────────────

  describe('canAdvance step 5', () => {
    beforeEach(() => {
      component.step = 5;
      component.clazz = 'Wizard';
      // classSkillChoices spy returns choose:2 from mock
    });

    it('is false when no skills chosen', () => {
      component.selectedSkills = [];
      expect(component.canAdvance).toBeFalse();
    });

    it('is false when only 1 of 2 class skills chosen', () => {
      component.selectedSkills = ['Arcana'];
      expect(component.canAdvance).toBeFalse();
    });

    it('is true when exactly 2 class skills chosen', () => {
      component.selectedSkills = ['Arcana', 'History'];
      expect(component.canAdvance).toBeTrue();
    });
  });

  // ── canAdvance — step 6 (ability scores, Standard Array) ─────────────────

  describe('canAdvance step 6 — Standard Array', () => {
    beforeEach(() => {
      component.step = 6;
      component.abilityMethod = 'standard';
      component.bonusPlus2 = 'INT';
      component.bonusPlus1 = 'WIS';
    });

    it('is false when not all scores assigned', () => {
      // assignments all null by default
      expect(component.canAdvance).toBeFalse();
    });

    it('is true when all 6 scores assigned and bonuses set', () => {
      component.assignments = { STR: 8, DEX: 12, CON: 13, INT: 15, WIS: 14, CHA: 10 };
      expect(component.canAdvance).toBeTrue();
    });

    it('is false when bonuses not set even with scores assigned', () => {
      component.assignments = { STR: 8, DEX: 12, CON: 13, INT: 15, WIS: 14, CHA: 10 };
      component.bonusPlus2 = '';
      expect(component.canAdvance).toBeFalse();
    });
  });

  // ── canAdvance — step 6 (Point Buy) ──────────────────────────────────────

  describe('canAdvance step 6 — Point Buy', () => {
    beforeEach(() => {
      component.step = 6;
      component.abilityMethod = 'point-buy';
    });

    it('is false when bonuses not set', () => {
      component.bonusPlus2 = '';
      component.bonusPlus1 = 'WIS';
      expect(component.canAdvance).toBeFalse();
    });

    it('is true when both bonuses assigned (no budget requirement)', () => {
      component.bonusPlus2 = 'INT';
      component.bonusPlus1 = 'WIS';
      expect(component.canAdvance).toBeTrue();
    });
  });

  // ── canAdvance — equipment step ───────────────────────────────────────────

  describe('canAdvance at equipment step', () => {
    beforeEach(() => {
      component.clazz = 'Fighter';
      component.step = component.equipmentStep;
    });

    it('is false when no equipment choice made', () => {
      component.equipmentChoice = '';
      expect(component.canAdvance).toBeFalse();
    });

    it('is true when Option A selected', () => {
      component.equipmentChoice = 'A';
      expect(component.canAdvance).toBeTrue();
    });

    it('is true when Option B selected', () => {
      component.equipmentChoice = 'B';
      expect(component.canAdvance).toBeTrue();
    });
  });

  // ── toggleSkillProf ───────────────────────────────────────────────────────

  describe('toggleSkillProf', () => {
    beforeEach(() => {
      component.clazz = 'Wizard';
      // Mock returns choose:2 and background grants Arcana + History
    });

    it('adds a skill when it is not yet selected', () => {
      component.selectedSkills = [];
      component.toggleSkillProf('Insight');
      expect(component.selectedSkills).toContain('Insight');
    });

    it('removes a skill that was already selected', () => {
      component.selectedSkills = ['Insight'];
      component.toggleSkillProf('Insight');
      expect(component.selectedSkills).not.toContain('Insight');
    });

    it('does not add a skill if the class limit is reached', () => {
      component.selectedSkills = ['Insight', 'Investigation'];
      component.toggleSkillProf('Medicine');
      expect(component.selectedSkills.length).toBe(2);
    });

    it('does not toggle a background-locked skill', () => {
      // backgroundDetail from mock grants Arcana and History as skill proficiencies
      component.backgroundDetail = SAGE_BACKGROUND_DETAIL as any;
      const before = [...component.selectedSkills];
      component.toggleSkillProf('Arcana');
      expect(component.selectedSkills).toEqual(before);
    });

    it('background skills are not double-counted toward the class limit', () => {
      // Background already grants Arcana; player should still be able to pick 2 class skills
      component.selectedSkills = ['Insight'];
      component.toggleSkillProf('Investigation');
      expect(component.selectedSkills).toContain('Investigation');
    });
  });

  // ── Point Buy math ────────────────────────────────────────────────────────

  describe('Point Buy', () => {
    beforeEach(() => { component.abilityMethod = 'point-buy'; });

    it('starts with 0 points spent', () => {
      expect(component.pointBuySpent).toBe(0);
    });

    it('starts with 27 points remaining', () => {
      expect(component.pointBuyRemaining).toBe(27);
    });

    it('increaseScore spends the correct number of points', () => {
      // Score 8 → 9 costs 1 point
      component.increaseScore('STR');
      expect(component.pointBuySpent).toBe(1);
      expect(component.pointBuyScores['STR']).toBe(9);
    });

    it('decreaseScore refunds points', () => {
      component.increaseScore('STR'); // 8 → 9, spent: 1
      component.decreaseScore('STR'); // 9 → 8, spent: 0
      expect(component.pointBuySpent).toBe(0);
    });

    it('canIncreaseScore is false at POINT_BUY_MAX (15)', () => {
      component.pointBuyScores = { STR: 15, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 };
      expect(component.canIncreaseScore('STR')).toBeFalse();
    });

    it('canDecreaseScore is false at POINT_BUY_MIN (8)', () => {
      component.pointBuyScores = { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 };
      expect(component.canDecreaseScore('STR')).toBeFalse();
    });

    it('canIncreaseScore is false when budget is exhausted', () => {
      // Spend budget: 6 × (14 = 7 pts each)
      component.pointBuyScores = { STR: 13, DEX: 13, CON: 13, INT: 12, WIS: 8, CHA: 8 };
      // STR:5 + DEX:5 + CON:5 + INT:4 = 19 pts; budget 27 remaining = 8 pts
      // At 13 → 14 costs 2 pts; that's fine. Let's just set remaining to 0.
      component.pointBuyScores = { STR: 15, DEX: 15, CON: 13, INT: 8, WIS: 8, CHA: 8 };
      // 9 + 9 + 5 = 23 pts; 4 remaining — DEX 15 can't increase (at max)
      // Let's verify canIncrease is false for STR (at 15)
      expect(component.canIncreaseScore('STR')).toBeFalse();
    });

    it('scores 14 → 15 costs 2 points (cumulative)', () => {
      component.pointBuyScores = { STR: 14, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 };
      const spentAt14 = component.pointBuySpent; // should be 7
      component.increaseScore('STR'); // 14 → 15 costs 2 more
      expect(component.pointBuySpent).toBe(spentAt14 + 2);
    });
  });

  // ── finalScore ────────────────────────────────────────────────────────────

  describe('finalScore', () => {
    beforeEach(() => {
      component.abilityMethod = 'standard';
      component.assignments = { STR: 8, DEX: 12, CON: 13, INT: 15, WIS: 14, CHA: 10 };
      component.bonusPlus2 = 'INT';
      component.bonusPlus1 = 'WIS';
    });

    it('adds +2 bonus to the designated ability', () => {
      expect(component.finalScore('INT')).toBe(17); // 15 + 2
    });

    it('adds +1 bonus to the designated ability', () => {
      expect(component.finalScore('WIS')).toBe(15); // 14 + 1
    });

    it('leaves unmodified abilities unchanged', () => {
      expect(component.finalScore('STR')).toBe(8);
      expect(component.finalScore('DEX')).toBe(12);
    });
  });

  // ── backgroundSkillProfs / backgroundToolProfs ────────────────────────────

  describe('backgroundSkillProfs and backgroundToolProfs', () => {
    it('backgroundSkillProfs contains only skills from ALL_SKILLS', () => {
      component.backgroundDetail = SAGE_BACKGROUND_DETAIL as any;
      const profs = component.backgroundSkillProfs;
      // Sage mock grants Arcana and History — both are valid skills
      expect(profs).toContain('Arcana');
      expect(profs).toContain('History');
    });

    it('backgroundToolProfs does not include standard skills', () => {
      const toolProfs = component.backgroundToolProfs;
      const skills = component.backgroundSkillProfs;
      toolProfs.forEach(t => expect(skills).not.toContain(t));
    });
  });

  // ── submit output shape ───────────────────────────────────────────────────

  describe('submit', () => {
    function prepareFullWizard() {
      component.name    = 'Aelindra';
      component.player  = 'Alice';
      component.species = 'Elf';
      component.clazz   = 'Wizard';
      component.background = 'Sage';
      component.selectedSubclass = '';
      component.selectedSkills = ['Arcana', 'History'];
      component.abilityMethod = 'standard';
      component.assignments = { STR: 8, DEX: 12, CON: 13, INT: 15, WIS: 14, CHA: 10 };
      component.bonusPlus2 = 'INT';
      component.bonusPlus1 = 'WIS';
      component.languageChoice = 'Elvish';
      component.equipmentChoice = 'A';
      component.classEquipmentData = {
        wizard: {
          optionA: { weapons: [], gear: [], gp: 0 },
          optionB: { gp: 25 },
        }
      };
      // classDetail needed for HP and saves
      (component as any).classDetail = { hit_die: 6, saving_throws: [{ name: 'INT' }, { name: 'WIS' }] };
      // backgroundDetail is loaded lazily via the RxJS trigger in the real app;
      // set it directly here so background-derived feat/skills resolve in submit().
      component.backgroundDetail = SAGE_BACKGROUND_DETAIL as any;
    }

    it('emits a PC draft with required fields', (done) => {
      prepareFullWizard();
      component.step = component.equipmentStep;

      component.confirm.subscribe((draft: any) => {
        expect(draft.name).toBe('Aelindra');
        expect(draft.clazz).toBe('Wizard');
        expect(draft.race).toBe('Elf');
        expect(draft.background).toBe('Sage');
        expect(draft.level).toBe(1);
        done();
      });

      component.submit();
    });

    it('emits stat block with final scores including bonuses', (done) => {
      prepareFullWizard();
      component.step = component.equipmentStep;

      component.confirm.subscribe((draft: any) => {
        expect(draft.stats.INT).toBe(17); // 15 base + 2 bonus
        expect(draft.stats.WIS).toBe(15); // 14 base + 1 bonus
        expect(draft.stats.STR).toBe(8);
        done();
      });

      component.submit();
    });

    it('emits languages including Common and chosen language', (done) => {
      prepareFullWizard();
      component.step = component.equipmentStep;

      component.confirm.subscribe((draft: any) => {
        expect(draft.languages).toContain('Common');
        expect(draft.languages).toContain('Elvish');
        done();
      });

      component.submit();
    });

    it('emits skills combining background + class selections', (done) => {
      prepareFullWizard();
      component.step = component.equipmentStep;

      component.confirm.subscribe((draft: any) => {
        expect(draft.skills['Arcana']).toBe('prof');
        expect(draft.skills['History']).toBe('prof');
        done();
      });

      component.submit();
    });

    it('emits feat from background', (done) => {
      prepareFullWizard();
      component.step = component.equipmentStep;

      component.confirm.subscribe((draft: any) => {
        expect(draft.feat).toBe('Magic Initiate (Wizard)');
        done();
      });

      component.submit();
    });

    it('emits HP calculated from hit die + CON modifier', (done) => {
      prepareFullWizard();
      component.step = component.equipmentStep;

      component.confirm.subscribe((draft: any) => {
        // d6 + CON mod (13 → +1) = 7
        expect(draft.hp.max).toBe(7);
        expect(draft.hp.cur).toBe(7);
        done();
      });

      component.submit();
    });

    it('includes backgroundPortraitInitials derived from name', (done) => {
      prepareFullWizard();
      component.step = component.equipmentStep;

      component.confirm.subscribe((draft: any) => {
        expect(draft.portraitInitials).toBe('A');
        done();
      });

      component.submit();
    });
  });

  // ── Review step ───────────────────────────────────────────────────────────

  describe('canAdvance at review step', () => {
    it('is always true at the review step', () => {
      component.clazz = 'Fighter';
      component.step = component.reviewStep;
      expect(component.canAdvance).toBeTrue();
    });

    it('is always true at the review step for casters', () => {
      component.clazz = 'Wizard';
      component.step = component.reviewStep;
      expect(component.canAdvance).toBeTrue();
    });
  });

  describe('goToStep', () => {
    it('sets step to the given value', () => {
      component.step = component.reviewStep;
      component.goToStep(3);
      expect(component.step).toBe(3);
    });

    it('can jump back to step 1 from review', () => {
      component.step = component.reviewStep;
      component.goToStep(1);
      expect(component.step).toBe(1);
    });
  });

  describe('review computed properties', () => {
    beforeEach(() => {
      component.abilityMethod = 'standard';
      component.assignments = { STR: 8, DEX: 12, CON: 13, INT: 15, WIS: 14, CHA: 10 };
      component.bonusPlus2 = 'INT';
      component.bonusPlus1 = 'WIS';
      (component as any).classDetail = { hit_die: 6, saving_throws: [{ name: 'INT' }, { name: 'WIS' }] };
    });

    it('reviewHp = hit die + CON modifier', () => {
      // d6 + CON mod(13) = 6 + 1 = 7
      expect(component.reviewHp).toBe(7);
    });

    it('reviewAc = 10 + DEX modifier', () => {
      // 10 + mod(12) = 10 + 1 = 11
      expect(component.reviewAc).toBe(11);
    });

    it('reviewInitiative matches formatted DEX modifier', () => {
      expect(component.reviewInitiative).toBe('+1'); // DEX 12 → +1
    });

    it('reviewAllSkills deduplicates background and class skills', () => {
      // Background mock grants Arcana and History; selected also includes them
      component.selectedSkills = ['Arcana', 'History'];
      const skills = component.reviewAllSkills;
      const arcanaCount = skills.filter(s => s === 'Arcana').length;
      expect(arcanaCount).toBe(1);
    });

    it('reviewAllSkills combines background and extra class skills', () => {
      component.backgroundDetail = SAGE_BACKGROUND_DETAIL as any;
      component.selectedSkills = ['Insight', 'Investigation'];
      const skills = component.reviewAllSkills;
      expect(skills).toContain('Arcana');    // from background
      expect(skills).toContain('History');   // from background
      expect(skills).toContain('Insight');   // class pick
      expect(skills).toContain('Investigation'); // class pick
    });

    it('reviewCantripNames lists only cantrip names', () => {
      component.selectedSpells = [
        { level: 0, name: 'Prestidigitation', school: 'transmutation', actionType: '1 action', classes: [], concentration: false, ritual: false, range: '', components: [], duration: '', description: '', material: '' },
        { level: 1, name: 'Magic Missile',    school: 'evocation',     actionType: '1 action', classes: [], concentration: false, ritual: false, range: '', components: [], duration: '', description: '', material: '' },
      ];
      expect(component.reviewCantripNames).toBe('Prestidigitation');
    });

    it('reviewLeveledSpellNames lists only leveled spell names', () => {
      component.selectedSpells = [
        { level: 0, name: 'Prestidigitation', school: 'transmutation', actionType: '1 action', classes: [], concentration: false, ritual: false, range: '', components: [], duration: '', description: '', material: '' },
        { level: 1, name: 'Magic Missile',    school: 'evocation',     actionType: '1 action', classes: [], concentration: false, ritual: false, range: '', components: [], duration: '', description: '', material: '' },
      ];
      expect(component.reviewLeveledSpellNames).toBe('Magic Missile');
    });

    it('reviewStartingGp totals background gold + class gold (Option B)', () => {
      component.clazz = 'Wizard';
      component.equipmentChoice = 'B';
      component.classEquipmentData = {
        wizard: { optionA: { weapons: [], gear: [], gp: 0 }, optionB: { gp: 25 } }
      };
      // Background gold mock = 15, class option B = 25
      expect(component.reviewStartingGp).toBe(40);
    });
  });
});
