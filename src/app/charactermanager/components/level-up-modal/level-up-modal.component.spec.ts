import { of, throwError } from 'rxjs';

import { LevelUpModalComponent } from './level-up-modal.component';
import { PCService } from '../../services/pc.service';
import { PC } from '../../models/pc';
import { LevelUpPreview } from '../../models/level-up';

/** A SpyObj PCService — the modal only touches levelUpPreview / levelUp. */
function makePcServiceSpy(): jasmine.SpyObj<PCService> {
  return jasmine.createSpyObj<PCService>('PCService', ['levelUpPreview', 'levelUp']);
}

function makePC(overrides: Partial<PC> = {}): PC {
  return { id: 7, name: 'Throk', clazz: 'Barbarian', level: 4, playerName: 'Ben', ...overrides };
}

function makePreview(overrides: Partial<LevelUpPreview> = {}): LevelUpPreview {
  return {
    currentLevel: 4, newLevel: 5, hitDie: 12, conModifier: 1,
    hpGained: 8, newHpMax: 92, currentProfBonus: 2, newProfBonus: 3,
    currentSpellSlots: {}, newSpellSlots: {},
    ...overrides,
  };
}

describe('LevelUpModalComponent', () => {
  let component: LevelUpModalComponent;
  let pcService: jasmine.SpyObj<PCService>;

  beforeEach(() => {
    pcService = makePcServiceSpy();
    component = new LevelUpModalComponent(pcService);
    component.pc = makePC();
  });

  it('loads the preview on init', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview()));

    component.ngOnInit();

    expect(pcService.levelUpPreview).toHaveBeenCalledWith(7);
    expect(component.loading).toBeFalse();
    expect(component.preview?.newLevel).toBe(5);
  });

  it('surfaces a preview error and stops loading', () => {
    pcService.levelUpPreview.and.returnValue(
      throwError(() => ({ error: { message: 'Character is already at the maximum level (20)' } }))
    );

    component.ngOnInit();

    expect(component.loading).toBeFalse();
    expect(component.preview).toBeNull();
    expect(component.error).toContain('maximum level');
  });

  it('reports a proficiency-bonus bump', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({ currentProfBonus: 2, newProfBonus: 3 })));
    component.ngOnInit();
    expect(component.profChanged).toBeTrue();
  });

  it('reports no proficiency change within a band', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({ currentProfBonus: 2, newProfBonus: 2 })));
    component.ngOnInit();
    expect(component.profChanged).toBeFalse();
  });

  it('builds sorted spell-slot rows and flags gained slots (caster)', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({
      currentSpellSlots: { 1: 4, 2: 3, 3: 3, 4: 1 },
      newSpellSlots: { 1: 4, 2: 3, 3: 3, 4: 2 }, // bard 7 -> 8: +1 level-4 slot
    })));
    component.ngOnInit();

    expect(component.slotRows.map(r => r.level)).toEqual([1, 2, 3, 4]);
    expect(component.hasSlotChanges).toBeTrue();
    const lvl4 = component.slotRows.find(r => r.level === 4)!;
    expect(lvl4.current).toBe(1);
    expect(lvl4.next).toBe(2);
    expect(lvl4.gained).toBeTrue();
  });

  it('has no slot rows for a non-caster', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({ currentSpellSlots: {}, newSpellSlots: {} })));
    component.ngOnInit();
    expect(component.slotRows.length).toBe(0);
    expect(component.hasSlotChanges).toBeFalse();
  });

  it('commits the level-up and emits close on success', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview()));
    pcService.levelUp.and.returnValue(of(makePC({ level: 5 })));
    const closeSpy = jasmine.createSpy('close');
    component.close.subscribe(closeSpy);

    component.ngOnInit();
    component.confirm();

    expect(pcService.levelUp).toHaveBeenCalledWith(7);
    expect(closeSpy).toHaveBeenCalled();
  });

  it('keeps the modal open and shows an error if the commit fails', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview()));
    pcService.levelUp.and.returnValue(throwError(() => ({ error: { message: 'Level-up failed.' } })));
    const closeSpy = jasmine.createSpy('close');
    component.close.subscribe(closeSpy);

    component.ngOnInit();
    component.confirm();

    expect(closeSpy).not.toHaveBeenCalled();
    expect(component.submitting).toBeFalse();
    expect(component.error).toBe('Level-up failed.');
  });

  it('does not commit while one is already in flight', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview()));
    component.ngOnInit();

    component.submitting = true; // simulate a commit already running
    component.confirm();

    expect(pcService.levelUp).not.toHaveBeenCalled();
  });
});
