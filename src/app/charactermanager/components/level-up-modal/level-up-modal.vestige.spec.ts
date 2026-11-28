import { of } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LevelUpModalComponent } from './level-up-modal.component';
import { PCService } from '../../services/pc.service';
import { DndResourcesService } from '../../services/dnd-resources.service';
import { PC } from '../../models/pc';
import { LevelUpPreview } from '../../models/level-up';
import { DndSpell } from '../../models/dnd-api.types';

/**
 * A Vestige Patron's level-up, through the rendered dialog: the type and the
 * domain are asked for until they are stored, and the picked domain's Vestige
 * Spells are shown and sent as always-prepared grants, like an oath's.
 */
describe('LevelUpModalComponent (Vestige Patron)', () => {
  let pcService: jasmine.SpyObj<PCService>;
  let dndResources: jasmine.SpyObj<DndResourcesService>;
  let fixture: ComponentFixture<LevelUpModalComponent>;

  const spell = (name: string, level: number): DndSpell => ({
    name, level, school: 'evocation', classes: ['cleric'], actionType: 'action', concentration: false, ritual: false,
    range: '60 feet', components: ['v', 's'], duration: 'Instantaneous', description: '',
  });
  const SPELLS = [
    spell('Guiding Bolt', 1), spell('Magic Weapon', 2), spell('Shield of Faith', 1), spell('Spiritual Weapon', 2),
    spell('Aid', 2), spell('Bless', 1), spell('Cure Wounds', 1), spell('Lesser Restoration', 2),
    spell("Crusader's Mantle", 3), spell('Spirit Guardians', 3), spell('Hex', 1),
  ];
  const grants = (...names: string[]) => names.map(name => ({ name, grantedBy: 'Vestige Spells' }));
  const BY_DOMAIN = {
    Life: grants('Aid', 'Bless', 'Cure Wounds', 'Lesser Restoration'),
    War: grants('Guiding Bolt', 'Magic Weapon', 'Shield of Faith', 'Spiritual Weapon'),
  };

  const makePC = (over: Partial<PC> = {}): PC =>
    ({ id: 7, name: 'Aelindra', clazz: 'Warlock', subclass: 'Vestige Patron', level: 2, playerName: 'Sam', ...over });

  const makePreview = (over: Partial<LevelUpPreview> = {}): LevelUpPreview => ({
    currentLevel: 2, newLevel: 3, hitDie: 8, conModifier: 1, hpGained: 6, newHpMax: 24,
    currentProfBonus: 2, newProfBonus: 2, currentSpellSlots: { 1: 2 }, newSpellSlots: { 2: 2 },
    subclassDue: false, subclassOptions: [], asiDue: false, featOptions: [], featuresGained: [],
    fightingStyleDue: false, fightingStyleOptions: [],
    currentCantripsKnown: 2, newCantripsKnown: 2, currentSpellsKnown: 3, newSpellsKnown: 3,
    ...over,
  });

  beforeEach(() => {
    pcService = jasmine.createSpyObj<PCService>('PCService',
      ['levelUpPreview', 'levelUp', 'levelUpPreviewAsDm', 'levelUpAsDm']);
    dndResources = jasmine.createSpyObj<DndResourcesService>('DndResourcesService',
      ['getFeatDescription', 'getSpellsForClass', 'getSpells']);
    dndResources.getFeatDescription.and.returnValue('');
    dndResources.getSpellsForClass.and.returnValue(of([]));
    dndResources.getSpells.and.returnValue(of(SPELLS));
    pcService.levelUp.and.returnValue(of(makePC({ level: 3 })));
    pcService.levelUpAsDm.and.returnValue(of(makePC({ level: 3 })));
    TestBed.configureTestingModule({
      providers: [{ provide: PCService, useValue: pcService }, { provide: DndResourcesService, useValue: dndResources }],
    });
  });

  function open(pc: Partial<PC>, preview: Partial<LevelUpPreview>, asDm = false): void {
    const level = makePC(pc).level ?? 1;
    const built = makePreview({ currentLevel: level, newLevel: level + 1, ...preview });
    pcService.levelUpPreview.and.returnValue(of(built));
    pcService.levelUpPreviewAsDm.and.returnValue(of(built));
    fixture = TestBed.createComponent(LevelUpModalComponent);
    fixture.componentInstance.pc = makePC(pc);
    fixture.componentInstance.asDm = asDm;
    refresh();
  }
  const refresh = () => { fixture.detectChanges(); fixture.detectChanges(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (node: Element) => node.textContent!.replace(/\s+/g, ' ').trim();
  const confirmButton = () => el().querySelector('.modal-actions .btn.primary') as HTMLButtonElement;
  const alwaysPrepared = () =>
    Array.from(el().querySelectorAll('.always-prepared-gained .feature-name')).map(text);
  const pick = (group: string, name: string) => {
    const row = (Array.from(el().querySelectorAll(`app-vestige-choices ${group} .subclass-option`)) as HTMLElement[])
      .find(r => text(r.querySelector('.vestige-option-name')!) === name)!;
    (row.querySelector('input') as HTMLInputElement).click();
    refresh();
  };

  it('holds Confirm at Warlock 3 until the type and the domain are picked', () => {
    open({}, { alwaysPreparedSpellsByVestigeDomain: BY_DOMAIN });
    expect(el().querySelector('app-vestige-choices .vestige-type-pick')).not.toBeNull();
    expect(el().querySelector('app-vestige-choices .vestige-domain-pick')).not.toBeNull();
    expect(confirmButton().disabled).toBeTrue();

    pick('.vestige-type-pick', 'Fiend');
    expect(confirmButton().disabled).toBeTrue();
    pick('.vestige-domain-pick', 'War');
    expect(confirmButton().disabled).toBeFalse();
  });

  it("shows the picked domain's spells under Always Prepared, and swaps them with the domain", () => {
    open({}, { alwaysPreparedSpellsByVestigeDomain: BY_DOMAIN });
    expect(el().querySelector('.always-prepared-gained')).toBeNull();
    // The spell data is fetched up front: a domain will hand spells over.
    expect(dndResources.getSpells).toHaveBeenCalled();

    pick('.vestige-domain-pick', 'War');
    expect(alwaysPrepared()).toEqual(['Guiding Bolt', 'Magic Weapon', 'Shield of Faith', 'Spiritual Weapon']);
    expect(text(el().querySelector('.always-prepared-gained .feature-desc')!)).toContain('From Vestige Spells.');

    pick('.vestige-domain-pick', 'Life');
    expect(alwaysPrepared()).toEqual(['Aid', 'Bless', 'Cure Wounds', 'Lesser Restoration']);
  });

  it('sends the type, the domain and the full spells, each marked Vestige Spells and always prepared', () => {
    open({}, { alwaysPreparedSpellsByVestigeDomain: BY_DOMAIN });
    pick('.vestige-type-pick', 'Celestial');
    pick('.vestige-domain-pick', 'War');
    confirmButton().click();

    const [id, choices] = pcService.levelUp.calls.mostRecent().args;
    expect(id).toBe(7);
    expect(choices!.subclassChoices).toEqual({ vestigeType: 'Celestial', vestigeDomain: 'War' });
    expect(choices!.newSpells!.map(s => [s.name, s.lvl, s.grantedBy, s.alwaysPrepared])).toEqual([
      ['Guiding Bolt', 1, 'Vestige Spells', true], ['Magic Weapon', 2, 'Vestige Spells', true],
      ['Shield of Faith', 1, 'Vestige Spells', true], ['Spiritual Weapon', 2, 'Vestige Spells', true],
    ]);
    expect(choices!.subclass).toBeUndefined();
    expect(choices!.forgetSpells).toBeUndefined();
  });

  it("adds the domain's spells to the ones the level hands over anyway, each once", () => {
    open({}, {
      alwaysPreparedSpells: [{ name: 'Hex', grantedBy: 'Some Feat' }, { name: 'Bless', grantedBy: 'Some Feat' }],
      alwaysPreparedSpellsByVestigeDomain: BY_DOMAIN,
    });
    expect(alwaysPrepared()).toEqual(['Hex', 'Bless']);
    pick('.vestige-type-pick', 'Fiend');
    pick('.vestige-domain-pick', 'Life');
    expect(alwaysPrepared()).toEqual(['Hex', 'Bless', 'Aid', 'Cure Wounds', 'Lesser Restoration']);

    const modal = fixture.componentInstance;
    expect(modal.alwaysPreparedGrants).toBe(modal.alwaysPreparedGrants);   // a stable list for the template
    confirmButton().click();
    const [, choices] = pcService.levelUp.calls.mostRecent().args;
    expect(choices!.newSpells!.map(s => [s.name, s.grantedBy])).toEqual([
      ['Hex', 'Some Feat'], ['Bless', 'Some Feat'], ['Aid', 'Vestige Spells'], ['Cure Wounds', 'Vestige Spells'],
      ['Lesser Restoration', 'Vestige Spells'],
    ]);
  });

  it('asks a later level-up only for what is unset, as the DM too', () => {
    open({ level: 7, subclassChoices: { vestigeType: 'Fiend' } },
      { alwaysPreparedSpellsByVestigeDomain: { War: grants('Guiding Bolt', "Crusader's Mantle") } }, true);
    expect(el().querySelector('.vestige-type-pick')).toBeNull();
    expect(confirmButton().disabled).toBeTrue();

    pick('.vestige-domain-pick', 'War');
    expect(alwaysPrepared()).toEqual(['Guiding Bolt', "Crusader's Mantle"]);
    confirmButton().click();

    const [, choices] = pcService.levelUpAsDm.calls.mostRecent().args;
    expect(choices!.subclassChoices).toEqual({ vestigeDomain: 'War' });
    expect(choices!.newSpells!.map(s => s.name)).toEqual(['Guiding Bolt', "Crusader's Mantle"]);
  });

  it('asks nothing once both are stored: the owed spells come in the ordinary list', () => {
    open({ level: 4, subclassChoices: { vestigeType: 'Fiend', vestigeDomain: 'War' } },
      { alwaysPreparedSpells: grants("Crusader's Mantle", 'Spirit Guardians') });
    expect(el().querySelector('app-vestige-choices')).toBeNull();
    expect(alwaysPrepared()).toEqual(["Crusader's Mantle", 'Spirit Guardians']);
    expect(confirmButton().disabled).toBeFalse();

    confirmButton().click();
    const [, choices] = pcService.levelUp.calls.mostRecent().args;
    expect(choices!.subclassChoices).toBeUndefined();
    expect(choices!.newSpells!.map(s => [s.name, s.grantedBy]))
      .toEqual([["Crusader's Mantle", 'Vestige Spells'], ['Spirit Guardians', 'Vestige Spells']]);
  });

  it('asks nothing of a Vestige Patron below Warlock 3 or of another patron', () => {
    open({ level: 1 }, {});
    expect(el().querySelector('app-vestige-choices')).toBeNull();
    expect(confirmButton().disabled).toBeFalse();

    open({ subclass: 'Fiend Patron' }, {});
    expect(el().querySelector('app-vestige-choices')).toBeNull();
    expect(confirmButton().disabled).toBeFalse();
    confirmButton().click();
    expect(pcService.levelUp).toHaveBeenCalledWith(7, {});
  });
});
