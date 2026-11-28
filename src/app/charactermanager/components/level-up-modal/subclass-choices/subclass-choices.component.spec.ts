import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SubclassChoiceResult, SubclassChoicesComponent } from './subclass-choices.component';
import { DndResourcesService } from '../../../services/dnd-resources.service';
import { DndSpell } from '../../../models/dnd-api.types';
import { PC, PcSpell } from '../../../models/pc';

describe('SubclassChoicesComponent', () => {
  let dndResources: jasmine.SpyObj<DndResourcesService>;
  let fixture: ComponentFixture<SubclassChoicesComponent>;
  let results: SubclassChoiceResult[];

  const spell = (name: string, level: number, classes: string[] = ['wizard']): DndSpell => ({
    name, level, school: 'evocation', classes, actionType: 'action', concentration: false, ritual: false,
    range: '60 feet', components: ['v', 's'], duration: 'Instantaneous', description: `${name} text`,
  });
  const SPELLS: DndSpell[] = [
    spell('Light', 0, ['cleric', 'wizard']), spell('Mage Hand', 0), spell('Fire Bolt', 0), spell('Ray of Frost', 0),
    spell('Guidance', 0, ['cleric', 'druid']), spell('Druidcraft', 0, ['druid']), spell('Prestidigitation', 0),
    spell('Magic Missile', 1), spell('Fireball', 3),
    spell('Disintegrate', 6), spell('True Seeing', 6, ['cleric', 'wizard']), spell('Heal', 6, ['cleric']),
    spell('Teleport', 7), spell('Maze', 8), spell('Mind Blank', 8), spell('Wish', 9), spell('Mass Heal', 9, ['cleric']),
  ];
  const held = (name: string, lvl: number, grantedBy?: string, alwaysPrepared = false): PcSpell => ({
    name, lvl, school: 'evocation', time: 'action', prepared: true,
    ...(grantedBy ? { grantedBy } : {}), ...(alwaysPrepared ? { alwaysPrepared } : {}),
  });
  const CANTRIPS = [held('Light', 0, 'Student of Arcana'), held('Mage Hand', 0, 'Student of Arcana')];
  const MASTERY = [
    held('Disintegrate', 6, 'Magical Mastery', true), held('Teleport', 7, 'Magical Mastery', true),
    held('Maze', 8, 'Magical Mastery', true), held('Wish', 9, 'Magical Mastery', true),
  ];

  const makePC = (over: Partial<PC> = {}): PC =>
    ({ id: 7, name: 'Vess', clazz: 'Cleric', level: 2, playerName: 'Ben', ...over });

  beforeEach(() => {
    dndResources = jasmine.createSpyObj<DndResourcesService>('DndResourcesService', ['getSpells']);
    dndResources.getSpells.and.returnValue(of(SPELLS));
    TestBed.configureTestingModule({ providers: [{ provide: DndResourcesService, useValue: dndResources }] });
    results = [];
  });

  function render(pc: Partial<PC>, subclass: string | null, newLevel: number, exclude: string[] = []): HTMLElement {
    fixture = TestBed.createComponent(SubclassChoicesComponent);
    fixture.componentRef.setInput('pc', makePC(pc));
    fixture.componentRef.setInput('subclass', subclass);
    fixture.componentRef.setInput('newLevel', newLevel);
    fixture.componentRef.setInput('exclude', exclude);
    fixture.componentInstance.choicesChange.subscribe(result => results.push(result));
    refresh();
    return fixture.nativeElement as HTMLElement;
  }
  /** Twice: the spell data arrives while the first pass is running. */
  const refresh = () => { fixture.detectChanges(); fixture.detectChanges(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const last = () => results[results.length - 1];
  const texts = (selector: string, root: ParentNode = el()) =>
    Array.from(root.querySelectorAll(selector)).map(n => n.textContent!.replace(/\s+/g, ' ').trim());
  const skillInputs = () => Array.from(el().querySelectorAll('.skill-pick input')) as HTMLInputElement[];
  const pickers = () => Array.from(el().querySelectorAll('.subclass-spell-pick')) as HTMLElement[];
  const names = (picker: HTMLElement) => texts('.spell-name', picker);

  function clickSkill(skill: string): void {
    const row = (Array.from(el().querySelectorAll('.skill-pick .subclass-option')) as HTMLElement[])
      .find(r => r.textContent!.trim() === skill)!;
    (row.querySelector('input') as HTMLInputElement).click();
    refresh();
  }
  function clickSpell(picker: HTMLElement, name: string): void {
    const row = (Array.from(picker.querySelectorAll('.spell-option')) as HTMLElement[])
      .find(r => r.querySelector('.spell-name')!.textContent!.trim() === name)!;
    (row.querySelector('input') as HTMLInputElement).click();
    refresh();
  }
  function forget(feature: string, name: string): void {
    fixture.componentInstance.setForget(feature, name);
    refresh();
  }

  it('renders nothing, loads nothing and reports nothing for a subclass with no choice to make', () => {
    for (const [clazz, subclass] of [
      ['Cleric', 'Life Domain'], ['Cleric', null], ['Monk', 'Warrior of the Mystic Arts'], ['Warlock', 'Vestige Patron'],
      ['Wizard', 'Conjurer'], ['Wizard', 'Enchanter'], ['Wizard', 'Necromancer'], ['Wizard', 'Transmuter'],
      // The right subclass on the wrong class, and the right class a level early.
      ['Wizard', 'Arcana Domain'], ['Cleric', 'Arcane Archer'],
    ] as [string, string | null][]) {
      const host = render({ clazz }, subclass, 3);
      expect(host.children.length).withContext(`${clazz} ${subclass}`).toBe(0);
      expect(fixture.componentInstance.result()).withContext(`${clazz} ${subclass}`)
        .toEqual({ subclassChoices: {}, newSpells: [], forgetSpells: [], valid: true });
    }
    expect(render({ clazz: 'Cleric', level: 1 }, 'Arcana Domain', 2).children.length).toBe(0);
    expect(dndResources.getSpells).not.toHaveBeenCalled();
    expect(results).toEqual([]);
  });

  describe('Arcana Domain at Cleric 3', () => {
    beforeEach(() => {
      render({ skills: { Insight: 'prof', Religion: 'expert' }, spells: [held('Guidance', 0), held('Fire Bolt', 0)] }, 'Arcana Domain', 3);
    });

    it('offers one skill: Arcana or a Cleric skill the character lacks', () => {
      expect(el().querySelector('.granted-skills')).toBeNull();
      expect(texts('.skill-pick .subclass-label')).toEqual(['Student of Arcana skill 0/1']);
      expect(texts('.skill-pick .subclass-option')).toEqual(['Arcana', 'History', 'Medicine', 'Persuasion']);
      expect(skillInputs().every(input => input.type === 'radio')).toBeTrue();
      expect(fixture.componentInstance.result().valid).toBeFalse();

      clickSkill('History');
      clickSkill('Arcana');   // a single choice replaces the pick
      expect(last().subclassChoices).toEqual({ skills: ['Arcana'] });
      expect(texts('.skill-pick .is-selected')).toEqual(['Arcana']);
      expect(texts('.skill-pick .spell-counts')).toEqual(['1/1']);
      expect(last().valid).toBeFalse();   // the cantrips are still owed
    });

    it('offers the two cantrips from the Wizard list, less the ones the character knows', () => {
      expect(dndResources.getSpells).toHaveBeenCalledTimes(1);
      expect(pickers().length).toBe(1);
      expect(texts('.spell-label', pickers()[0])[0]).toContain('Student of Arcana cantrips');
      expect(texts('.spell-counts', pickers()[0])).toEqual(['Wizard cantrips 0/2']);
      // Guidance is not a Wizard cantrip; Fire Bolt is already known.
      expect(names(pickers()[0])).toEqual(['Light', 'Mage Hand', 'Ray of Frost', 'Prestidigitation']);
      expect(el().querySelector('.replace-pick')).toBeNull();
    });

    it('reports the picks with their feature, and is complete with the skill and both cantrips', () => {
      clickSkill('Medicine');
      clickSpell(pickers()[0], 'Light');
      expect(last().valid).toBeFalse();
      expect(texts('.spell-counts', pickers()[0])).toEqual(['Wizard cantrips 1/2']);
      clickSpell(pickers()[0], 'Mage Hand');
      clickSpell(pickers()[0], 'Ray of Frost');   // over the limit: ignored by the picker
      expect(last()).toEqual({
        subclassChoices: { skills: ['Medicine'] },
        newSpells: [
          jasmine.objectContaining({ name: 'Light', lvl: 0, grantedBy: 'Student of Arcana', prepared: true, description: 'Light text' }),
          jasmine.objectContaining({ name: 'Mage Hand', lvl: 0, grantedBy: 'Student of Arcana' }),
        ],
        forgetSpells: [],
        valid: true,
      });
      expect(last().newSpells.some(s => s.alwaysPrepared)).toBeFalse();   // a cantrip needs no marker
      clickSpell(pickers()[0], 'Light');   // unpicked again
      expect(last().valid).toBeFalse();
      expect(last().newSpells.map(s => s.name)).toEqual(['Mage Hand']);
    });
  });

  it('leaves out a spell the dialog has already spoken for', () => {
    render({}, 'Arcana Domain', 3, ['light', 'prestidigitation']);
    expect(names(pickers()[0])).toEqual(['Mage Hand', 'Fire Bolt', 'Ray of Frost']);
  });

  it('asks an Arcana Domain cleric who never chose (an older character) for the same things later', () => {
    render({ subclass: 'Arcana Domain', level: 6 }, 'Arcana Domain', 7);
    expect(texts('.skill-pick .subclass-label')).toEqual(['Student of Arcana skill 0/1']);
    expect(texts('.spell-counts', pickers()[0])).toEqual(['Wizard cantrips 0/2']);
    // One cantrip already held: one more is owed, and the held one may be swapped as well.
    render({ subclass: 'Arcana Domain', level: 6, subclassChoices: { skills: ['Arcana'] }, spells: [CANTRIPS[0]] }, 'Arcana Domain', 7);
    expect(el().querySelector('.skill-pick')).toBeNull();
    expect(texts('.spell-counts', pickers()[0])).toEqual(['Wizard cantrips 0/1']);
    expect(texts('.replace-pick option')).toEqual(['No change', 'Light']);
  });

  describe('Arcana Domain at a later level', () => {
    beforeEach(() => {
      render({
        subclass: 'Arcana Domain', level: 3, subclassChoices: { skills: ['Arcana'] },
        spells: [...CANTRIPS, held('Guidance', 0)],
      }, 'Arcana Domain', 4);
    });

    it('asks for nothing, and offers to replace one of the two cantrips', () => {
      expect(el().querySelector('.skill-pick')).toBeNull();
      expect(pickers().length).toBe(0);
      expect(texts('.replace-pick .subclass-label')).toEqual(['Replace a Student of Arcana cantrip (optional)']);
      expect(texts('.replace-pick option')).toEqual(['No change', 'Light', 'Mage Hand']);
      expect(fixture.componentInstance.result()).toEqual({ subclassChoices: {}, newSpells: [], forgetSpells: [], valid: true });
      expect(results).toEqual([]);
    });

    it('swaps a cantrip: the one to forget, then exactly one replacement', () => {
      forget('Student of Arcana', 'Light');
      expect(last()).toEqual({ subclassChoices: {}, newSpells: [], forgetSpells: ['Light'], valid: false });
      expect(texts('.spell-counts', pickers()[0])).toEqual(['Wizard cantrips 0/1']);
      expect(texts('.spell-label', pickers()[0])[0]).toContain('Student of Arcana cantrip');
      // Neither held cantrip is offered back.
      expect(names(pickers()[0])).toEqual(['Fire Bolt', 'Ray of Frost', 'Prestidigitation']);

      clickSpell(pickers()[0], 'Fire Bolt');
      clickSpell(pickers()[0], 'Ray of Frost');   // one only
      expect(last().forgetSpells).toEqual(['Light']);
      expect(last().newSpells.map(s => [s.name, s.grantedBy])).toEqual([['Fire Bolt', 'Student of Arcana']]);
      expect(last().valid).toBeTrue();
    });

    it('drops the swap, and its pick, when the player changes their mind', () => {
      forget('Student of Arcana', 'Mage Hand');
      clickSpell(pickers()[0], 'Fire Bolt');
      forget('Student of Arcana', '');
      expect(last()).toEqual({ subclassChoices: {}, newSpells: [], forgetSpells: [], valid: true });
      expect(pickers().length).toBe(0);
    });
  });

  describe('Arcana Domain at Cleric 17 (Magical Mastery)', () => {
    beforeEach(() => {
      render({
        subclass: 'Arcana Domain', level: 16, subclassChoices: { skills: ['Arcana'] },
        spells: [...CANTRIPS, held('True Seeing', 6)],
      }, 'Arcana Domain', 17);
    });

    it('offers one Wizard spell each of level 6, 7, 8 and 9', () => {
      expect(pickers().map(p => texts('.spell-label', p)[0].split(' Wizard')[0])).toEqual([
        'Magical Mastery, level 6 spell', 'Magical Mastery, level 7 spell', 'Magical Mastery, level 8 spell',
        'Magical Mastery, level 9 spell',
      ]);
      expect(pickers().map(p => texts('.spell-counts', p)[0])).toEqual(Array(4).fill('Wizard spells 0/1'));
      // Heal and Mass Heal are not Wizard spells; a spell the cleric merely has prepared stays on offer.
      expect(pickers().map(names)).toEqual([['Disintegrate', 'True Seeing'], ['Teleport'], ['Maze', 'Mind Blank'], ['Wish']]);
      expect(fixture.componentInstance.result().valid).toBeFalse();
    });

    it('is complete with all four, saved always prepared under the feature', () => {
      clickSpell(pickers()[0], 'True Seeing');
      clickSpell(pickers()[0], 'Disintegrate');   // one per level
      clickSpell(pickers()[1], 'Teleport');
      clickSpell(pickers()[2], 'Mind Blank');
      expect(last().valid).toBeFalse();
      clickSpell(pickers()[3], 'Wish');
      expect(last().valid).toBeTrue();
      expect(last().newSpells.map(s => [s.name, s.lvl, s.grantedBy, s.alwaysPrepared])).toEqual([
        ['True Seeing', 6, 'Magical Mastery', true], ['Teleport', 7, 'Magical Mastery', true],
        ['Mind Blank', 8, 'Magical Mastery', true], ['Wish', 9, 'Magical Mastery', true],
      ]);
      expect(last().subclassChoices).toEqual({});
      expect(last().forgetSpells).toEqual([]);
    });
  });

  it('swaps a Magical Mastery spell for another of the same level', () => {
    render({
      subclass: 'Arcana Domain', level: 17, subclassChoices: { skills: ['Arcana'] }, spells: [...CANTRIPS, ...MASTERY],
    }, 'Arcana Domain', 18);
    expect(pickers().length).toBe(0);
    expect(texts('.replace-pick .subclass-label')).toEqual([
      'Replace a Student of Arcana cantrip (optional)', 'Replace a Magical Mastery spell (optional)',
    ]);
    expect(texts('.replace-pick:last-of-type option'))
      .toEqual(['No change', 'Disintegrate (level 6)', 'Teleport (level 7)', 'Maze (level 8)', 'Wish (level 9)']);

    forget('Magical Mastery', 'Maze');
    expect(pickers().length).toBe(1);
    expect(texts('.spell-label', pickers()[0])[0]).toContain('Magical Mastery, level 8 spell');
    expect(names(pickers()[0])).toEqual(['Mind Blank']);
    clickSpell(pickers()[0], 'Mind Blank');
    forget('Student of Arcana', 'Light');
    expect(last().valid).toBeFalse();   // the cantrip swap has no replacement yet
    clickSpell(pickers()[0], 'Fire Bolt');
    expect(last().forgetSpells).toEqual(['Light', 'Maze']);
    expect(last().newSpells.map(s => [s.name, s.grantedBy, !!s.alwaysPrepared])).toEqual([
      ['Fire Bolt', 'Student of Arcana', false], ['Mind Blank', 'Magical Mastery', true],
    ]);
    expect(last().valid).toBeTrue();
  });

  describe('Arcane Archer skills', () => {
    it('shows Arcana and Nature as gained and asks nothing of an archer who had neither', () => {
      render({ clazz: 'Fighter', skills: { Athletics: 'prof' } }, 'Arcane Archer', 3);
      expect(texts('.granted-skills .subclass-label')).toEqual(['Arcane Archer Lore skills']);
      expect(texts('.granted-skills .feature-item')).toEqual(['ArcanaGained', 'NatureGained']);
      expect(el().querySelector('.skill-pick')).toBeNull();
      // No key is sent: the server stores the empty list itself.
      expect(fixture.componentInstance.result()).toEqual({ subclassChoices: {}, newSpells: [], forgetSpells: [], valid: true });
      expect(results).toEqual([]);
    });

    it('asks for one replacement when the archer already had one of the two', () => {
      render({ clazz: 'Fighter', skills: { Nature: 'prof', Athletics: 'prof' } }, 'Arcane Archer', 3);
      expect(texts('.granted-skills .feature-item')).toEqual(['ArcanaGained', 'NatureAlready proficient']);
      expect(texts('.skill-pick .subclass-label')).toEqual(['Replacement skill 0/1']);
      expect(texts('.skill-pick .subclass-option')).toEqual([
        'Acrobatics', 'Animal Handling', 'History', 'Insight', 'Intimidation', 'Persuasion', 'Perception', 'Survival',
      ]);
      expect(fixture.componentInstance.result().valid).toBeFalse();
      clickSkill('Insight');
      expect(last()).toEqual({ subclassChoices: { skills: ['Insight'] }, newSpells: [], forgetSpells: [], valid: true });
    });

    it('asks for two when it had both, and stops at two', () => {
      render({ clazz: 'Fighter', skills: { Nature: 'expert', Arcana: 'prof' } }, 'Arcane Archer', 3);
      expect(texts('.granted-skills .feature-desc')).toEqual(['Already proficient', 'Already proficient']);
      expect(texts('.skill-pick .subclass-label')).toEqual(['Replacement skills 0/2']);
      expect(skillInputs().every(input => input.type === 'checkbox')).toBeTrue();
      expect(skillInputs().length).toBe(9);

      clickSkill('Insight');
      expect(last().valid).toBeFalse();
      clickSkill('Survival');
      expect(last()).toEqual({ subclassChoices: { skills: ['Insight', 'Survival'] }, newSpells: [], forgetSpells: [], valid: true });
      expect(skillInputs().filter(input => input.disabled).length).toBe(7);
      fixture.componentInstance.toggleSkill('Athletics');   // a third is ignored
      expect(last().subclassChoices).toEqual({ skills: ['Insight', 'Survival'] });
      clickSkill('Insight');   // unticked
      expect(last().subclassChoices).toEqual({ skills: ['Survival'] });
      expect(last().valid).toBeFalse();
      expect(skillInputs().some(input => input.disabled)).toBeFalse();
    });

    it('has no cantrip picker yet, and never loads the spell data', () => {
      render({ clazz: 'Fighter', skills: { Nature: 'prof' } }, 'Arcane Archer', 3);
      expect(pickers().length).toBe(0);
      expect(dndResources.getSpells).not.toHaveBeenCalled();
    });

    it('asks nothing once the choice is stored', () => {
      render({ clazz: 'Fighter', subclass: 'Arcane Archer', level: 3, skills: { Arcana: 'prof', Nature: 'prof' },
        subclassChoices: { skills: [] } }, 'Arcane Archer', 4);
      expect(el().children.length).toBe(0);
    });
  });

  it('starts over when another subclass is picked', () => {
    render({ clazz: 'Fighter', skills: { Nature: 'prof' } }, 'Arcane Archer', 3);
    clickSkill('Insight');
    fixture.componentRef.setInput('subclass', 'Champion');
    refresh();
    expect(el().children.length).toBe(0);
    expect(fixture.componentInstance.result()).toEqual({ subclassChoices: {}, newSpells: [], forgetSpells: [], valid: true });
    // Coming back to it does not bring the old answer back: the dialog has forgotten it too.
    fixture.componentRef.setInput('subclass', 'Arcane Archer');
    refresh();
    expect(texts('.skill-pick .subclass-label')).toEqual(['Replacement skill 0/1']);
    expect(fixture.componentInstance.result().valid).toBeFalse();
    expect(results.length).toBe(1);
  });

  it('says so when the spell list does not load, and stays incomplete', () => {
    dndResources.getSpells.and.returnValue(throwError(() => new Error('offline')));
    render({}, 'Arcana Domain', 3);
    expect(texts('.subclass-spell-pick [role="status"]')).toEqual(['The spell list did not load. Close this and try again.']);
    expect(names(pickers()[0])).toEqual([]);
    expect(fixture.componentInstance.result().valid).toBeFalse();
    expect(dndResources.getSpells).toHaveBeenCalledTimes(1);   // no retry loop
  });
});
