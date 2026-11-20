import { TestBed } from '@angular/core/testing';
import { SpellsStepComponent } from './spells-step.component';
import { DndSpell } from '../../../../models/dnd-api.types';
import { heroClassByKey, recommendedStartingSpells } from '../../../../models/hero-class';
import { handbookStartingSpells } from '../../../../models/recommended-spells';

describe('spell creation level groups', () => {
  it('collapses levels independently and preserves selection through filtering', () => {
    const fixture = TestBed.createComponent(SpellsStepComponent);
    const cantrip: DndSpell = { name: 'Light', level: 0, school: 'evocation',
      classes: ['wizard'], actionType: 'action', concentration: false, ritual: false,
      range: 'Touch', components: ['v'], duration: '1 hour', description: 'Creates light.' };
    const first: DndSpell = { ...cantrip, name: 'Shield', level: 1, school: 'abjuration' };
    fixture.componentRef.setInput('filteredSpellList', [first, cantrip]);
    fixture.componentRef.setInput('selectedSpells', [cantrip]);
    fixture.detectChanges();
    const groups = fixture.nativeElement.querySelectorAll('details') as NodeListOf<HTMLDetailsElement>;
    expect(groups.length).toBe(2);
    expect(groups[0].querySelector('summary')!.textContent).toContain('Cantrips');
    groups[0].querySelector('summary')!.click();
    expect(groups[0].open).toBeFalse();
    expect(groups[1].open).toBeTrue();
    fixture.componentRef.setInput('filteredSpellList', [cantrip]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('details').open).toBeFalse();
    expect(fixture.componentInstance.isSpellSelected(cantrip)).toBeTrue();
  });

  it('folds a group away once its allowance is spent, and reopens it when a slot frees up', () => {
    const fixture = TestBed.createComponent(SpellsStepComponent);
    const cantrip: DndSpell = { name: 'Light', level: 0, school: 'evocation',
      classes: ['wizard'], actionType: 'action', concentration: false, ritual: false,
      range: 'Touch', components: ['v'], duration: '1 hour', description: 'Creates light.' };
    const first: DndSpell = { ...cantrip, name: 'Shield', level: 1, school: 'abjuration' };
    fixture.componentRef.setInput('filteredSpellList', [cantrip, first]);
    fixture.componentRef.setInput('maxCantrips', 1);
    fixture.componentRef.setInput('maxKnownSpells', 1);
    fixture.componentRef.setInput('selectedCantrips', 1);
    fixture.componentRef.setInput('selectedLeveled', 0);
    fixture.detectChanges();

    const groups = fixture.nativeElement.querySelectorAll('details') as NodeListOf<HTMLDetailsElement>;
    // Cantrips are done, so that group folds; the 1st-level list stays open.
    expect(groups[0].open).toBeFalse();
    expect(groups[1].open).toBeTrue();

    fixture.componentRef.setInput('selectedLeveled', 1);
    fixture.detectChanges();
    expect(groups[1].open).toBeFalse();

    // Removing a cantrip hands the slot back and the list comes out again.
    fixture.componentRef.setInput('selectedCantrips', 0);
    fixture.detectChanges();
    expect(groups[0].open).toBeTrue();
  });

  it('leaves a group open when the class has no picks of that kind', () => {
    const fixture = TestBed.createComponent(SpellsStepComponent);
    const cantrip: DndSpell = { name: 'Light', level: 0, school: 'evocation',
      classes: ['wizard'], actionType: 'action', concentration: false, ritual: false,
      range: 'Touch', components: ['v'], duration: '1 hour', description: 'Creates light.' };
    fixture.componentRef.setInput('filteredSpellList', [cantrip]);
    fixture.componentRef.setInput('maxCantrips', 0);
    fixture.componentRef.setInput('selectedCantrips', 0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('details').open).toBeTrue();
  });

  it('drops the cantrip copy, tab and count for a class with no cantrips (Paladin, Ranger)', () => {
    const fixture = TestBed.createComponent(SpellsStepComponent);
    const smite: DndSpell = { name: 'Searing Smite', level: 1, school: 'evocation',
      classes: ['paladin'], actionType: 'bonus action', concentration: false, ritual: false,
      range: 'Self', components: ['v'], duration: '1 minute', description: 'Smite text.' };
    fixture.componentRef.setInput('filteredSpellList', [smite]);
    fixture.componentRef.setInput('maxCantrips', 0);
    fixture.componentRef.setInput('maxKnownSpells', 2);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.modal-sub')!.textContent!.replace(/\s+/g, ' ').trim())
      .toBe('Select 2 level 1 spells. Your class learns no cantrips at level 1.');
    const tabs = Array.from(el.querySelectorAll('.spell-level-tab')).map(t => t.textContent!.trim());
    expect(tabs).toEqual(['All', '1st']);
    expect(el.querySelector('.spell-counter')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('0/2 spells');
    expect(el.querySelectorAll('details').length).toBe(1);

    // A class with cantrips keeps all three.
    fixture.componentRef.setInput('maxCantrips', 3);
    fixture.detectChanges();
    expect(el.querySelector('.modal-sub')!.textContent).toContain('Select 3 cantrips and 2 spells');
    expect(el.querySelectorAll('.spell-level-tab').length).toBe(3);
    expect(el.querySelector('.spell-counter')!.textContent).toContain('0/3 cantrips');
  });

  it('says which spell the class always keeps prepared, and how many picks start prepared', () => {
    const fixture = TestBed.createComponent(SpellsStepComponent);
    fixture.componentRef.setInput('maxKnownSpells', 2);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = (sel: string) => el.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim();
    expect(el.querySelector('.spell-always-note')).toBeNull();
    expect(el.querySelector('.spell-prepared-note')).toBeNull();

    fixture.componentRef.setInput('alwaysPrepared', [{ name: "Hunter's Mark", grantedBy: 'Favored Enemy' }]);
    fixture.componentRef.setInput('preparedAtStart', 4);
    fixture.detectChanges();
    expect(text('.spell-always-note'))
      .toBe("You also start with Hunter's Mark (Favored Enemy) always prepared. It is not one of your picks.");
    expect(text('.spell-prepared-note'))
      .toBe('Your first 4 spells start prepared. The others wait in your spellbook.');
  });

  it('badges recommended spells without selecting them', () => {
    const fixture = TestBed.createComponent(SpellsStepComponent);
    const base: DndSpell = { name: 'Druidcraft', level: 0, school: 'transmutation',
      classes: ['druid'], actionType: 'action', concentration: false, ritual: false,
      range: '30 feet', components: ['v', 's'], duration: 'Instantaneous', description: 'Nature trick.' };
    const wrath: DndSpell = { ...base, name: 'Wrath', school: 'evocation', source: 'World of Warcraft' };
    const shillelagh: DndSpell = { ...base, name: 'Shillelagh' };
    fixture.componentRef.setInput('filteredSpellList', [base, wrath, shillelagh]);
    fixture.componentRef.setInput('recommendedSpells', ['Druidcraft', 'wrath']);
    fixture.componentRef.setInput('recommendedFor', 'Balance');
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    expect(cmp.isRecommended(base)).toBeTrue();
    expect(cmp.isRecommended(wrath)).toBeTrue();
    expect(cmp.isRecommended(shillelagh)).toBeFalse();
    const badges = fixture.nativeElement.querySelectorAll('.spell-recommended-badge') as NodeListOf<HTMLElement>;
    expect(badges.length).toBe(2);
    expect(badges[0].getAttribute('title')).toBe('Recommended for Balance');
    expect(fixture.nativeElement.querySelectorAll('.spell-selected-badge').length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('suit the Balance specialization');
  });

  it('badges the WoW Warlock spec picks (cantrips and level-1 spells) without selecting them', () => {
    const fixture = TestBed.createComponent(SpellsStepComponent);
    const spell = (name: string, level: number): DndSpell => ({ name, level, school: 'evocation',
      classes: ['warlock'], actionType: 'action', concentration: false, ritual: false,
      range: '120 feet', components: ['v', 's'], duration: 'Instantaneous', description: `${name}.` });
    const list = [
      spell('Eldritch Blast', 0), spell('Toll the Dead', 0), spell('Poison Spray', 0), spell('Mage Hand', 0),
      spell('Arms of Hadar', 1), spell('Hex', 1), spell('Witch Bolt', 1), spell('Hellish Rebuke', 1),
    ];
    fixture.componentRef.setInput('filteredSpellList', list);
    fixture.componentRef.setInput('recommendedSpells', recommendedStartingSpells(heroClassByKey('Warlock (World of Warcraft)'), 'Demonology'));
    fixture.componentRef.setInput('recommendedFor', 'Demonology');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const badged = (Array.from(el.querySelectorAll('.spell-row.recommended .spell-pick-name')) as HTMLElement[])
      .map(n => n.textContent!.replace('Recommended', '').trim());
    expect(badged).toEqual(['Eldritch Blast', 'Toll the Dead', 'Arms of Hadar', 'Hex']);
    expect(el.querySelector('.spell-recommended-badge')!.getAttribute('title')).toBe('Recommended for Demonology');
    expect(el.querySelectorAll('.spell-selected-badge').length).toBe(0);
    expect(el.textContent).toContain('suit the Demonology specialization');
  });

  it('badges the WoW Priest Shadow picks, incl. the WoW Shadow Word: Pain, without selecting them', () => {
    const fixture = TestBed.createComponent(SpellsStepComponent);
    const spell = (name: string, level: number, source?: 'World of Warcraft'): DndSpell => ({ name, level,
      school: 'necromancy', classes: ['cleric'], actionType: 'action', concentration: false, ritual: false,
      range: '60 feet', components: ['v', 's'], duration: 'Instantaneous', description: `${name}.`, source });
    const list = [
      spell('Mending', 0), spell('Resistance', 0), spell('Thaumaturgy', 0), spell('Toll the Dead', 0), spell('Light', 0),
      spell('Bane', 1), spell('Command', 1), spell('Healing Word', 1), spell('Shadow Word: Pain', 1, 'World of Warcraft'),
      spell('Bless', 1),
    ];
    fixture.componentRef.setInput('filteredSpellList', list);
    fixture.componentRef.setInput('recommendedSpells', recommendedStartingSpells(heroClassByKey('Cleric (World of Warcraft)'), 'Shadow'));
    fixture.componentRef.setInput('recommendedFor', 'Shadow');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const badged = (Array.from(el.querySelectorAll('.spell-row.recommended .spell-pick-name')) as HTMLElement[])
      .map(n => n.textContent!.replace('Recommended', '').trim());
    expect(badged.map(n => n.replace(/\s*World of Warcraft$/, ''))).toEqual([
      'Mending', 'Resistance', 'Thaumaturgy', 'Toll the Dead', 'Bane', 'Command', 'Healing Word', 'Shadow Word: Pain',
    ]);
    expect(el.querySelector('.spell-recommended-badge')!.getAttribute('title')).toBe('Recommended for Shadow');
    expect(el.querySelectorAll('.spell-selected-badge').length).toBe(0);
  });

  it("words the Player's Handbook's picks for a base-game class as the handbook's, not a specialization's", () => {
    const fixture = TestBed.createComponent(SpellsStepComponent);
    const spell = (name: string, level: number): DndSpell => ({ name, level, school: 'enchantment',
      classes: ['bard'], actionType: 'action', concentration: false, ritual: false,
      range: '60 feet', components: ['v'], duration: 'Instantaneous', description: `${name}.` });
    fixture.componentRef.setInput('filteredSpellList', [
      spell('Dancing Lights', 0), spell('Vicious Mockery', 0), spell('Mending', 0),
      spell('Charm Person', 1), spell('Healing Word', 1), spell('Sleep', 1),
    ]);
    fixture.componentRef.setInput('recommendedSpells', handbookStartingSpells('Bard'));
    fixture.componentRef.setInput('recommendedFor', 'Bard');
    fixture.componentRef.setInput('recommendedSource', 'handbook');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const badged = (Array.from(el.querySelectorAll('.spell-row.recommended .spell-pick-name')) as HTMLElement[])
      .map(n => n.textContent!.replace('Recommended', '').trim());
    expect(badged).toEqual(['Dancing Lights', 'Vicious Mockery', 'Charm Person', 'Healing Word']);
    expect(el.querySelector('.spell-recommended-badge')!.getAttribute('title'))
      .toBe("Recommended by the Player's Handbook for a new Bard");
    expect(el.querySelector('.spell-recommend-note')!.textContent)
      .toContain("are the Player's Handbook's picks for a new Bard");
    expect(el.textContent).not.toContain('specialization');
    expect(el.querySelectorAll('.spell-selected-badge').length).toBe(0);
  });

  it('shows no recommendation badges by default', () => {
    const fixture = TestBed.createComponent(SpellsStepComponent);
    const light: DndSpell = { name: 'Light', level: 0, school: 'evocation',
      classes: ['wizard'], actionType: 'action', concentration: false, ritual: false,
      range: 'Touch', components: ['v'], duration: '1 hour', description: 'Creates light.' };
    fixture.componentRef.setInput('filteredSpellList', [light]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.spell-recommended-badge').length).toBe(0);
  });
});
