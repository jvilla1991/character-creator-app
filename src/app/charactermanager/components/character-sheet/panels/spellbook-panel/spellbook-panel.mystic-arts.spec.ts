import { of } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SpellbookPanelComponent } from './spellbook-panel.component';
import { DndResourcesService } from '../../../../services/dnd-resources.service';
import { PC, PcSpell } from '../../../../models/pc';

/**
 * The Spells tab of a Warrior of the Mystic Arts monk: the slot strip and the
 * casting numbers like any caster's (Wisdom), its own prepared-spell cap and
 * the Sorcerer list behind "Grant spells". And nothing new for any other
 * character.
 */
describe('SpellbookPanelComponent (Warrior of the Mystic Arts)', () => {
  const MYSTIC_ARTS = 'Warrior of the Mystic Arts';
  let dndResources: jasmine.SpyObj<DndResourcesService>;
  let fixture: ComponentFixture<SpellbookPanelComponent>;

  const spell = (o: Partial<PcSpell> = {}): PcSpell =>
    ({ lvl: 1, name: 'Shield', school: 'Abjuration', time: '1 reaction', prepared: true, ...o });

  const monk = (over: Partial<PC> = {}): PC => ({
    id: 1, name: 'Shen', clazz: 'Monk', subclass: MYSTIC_ARTS, level: 8, playerName: 'Sam', prof: 3,
    stats: { STR: 10, DEX: 16, CON: 14, INT: 8, WIS: 18, CHA: 12 },
    spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 2, used: 1 } },
    classResources: { focusPoints: 5 },
    spells: [
      spell({ lvl: 0, name: 'Blade Ward' }), spell({ name: 'Shield' }), spell({ name: 'Jump' }),
      spell({ lvl: 2, name: 'Misty Step', prepared: false }),
    ],
    ...over,
  });

  beforeEach(() => {
    dndResources = jasmine.createSpyObj<DndResourcesService>('DndResourcesService', ['getSpells', 'getSpellsForClass']);
    dndResources.getSpells.and.returnValue(of([]));
    dndResources.getSpellsForClass.and.returnValue(of([]));
    TestBed.configureTestingModule({ providers: [{ provide: DndResourcesService, useValue: dndResources }] });
  });

  function render(pc: PC, inputs: Record<string, unknown> = {}): HTMLElement {
    fixture = TestBed.createComponent(SpellbookPanelComponent);
    fixture.componentRef.setInput('pc', pc);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the slot strip and the Wisdom casting numbers', () => {
    const el = render(monk());

    expect(Array.from(el.querySelectorAll('.sst-count')).map(c => c.textContent!.trim())).toEqual(['3/4', '1/2']);
    // Proficiency +3, Wisdom +4.
    expect(el.querySelector('.spell-dc')!.textContent).toContain('Save DC 15 · Spell Atk +7');
  });

  it('counts prepared spells against the subclass\'s own column', () => {
    const el = render(monk(), { preparable: true });

    expect(fixture.componentInstance.preparedCap()).toBe(6); // Monk 8
    expect(el.querySelector('.prepared-counter')!.textContent).toContain('Prepared 2 / 6');
    fixture.componentRef.setInput('pc', monk({ level: 20 }));
    expect(fixture.componentInstance.preparedCap()).toBe(13);
  });

  it('stops preparing at that cap', () => {
    const spells = [spell({ name: 'Shield' }), spell({ name: 'Jump' }), spell({ name: 'Sleep' }),
      spell({ name: 'Magic Missile', prepared: false })];
    render(monk({ level: 3, spells, spellSlots: { 1: { max: 2, used: 0 } } }), { preparable: true }); // Monk 3: three

    const panel = fixture.componentInstance;
    expect(panel.preparedCap()).toBe(3);
    expect(panel.canTogglePrepared(panel.pc().spells![3])).toBeFalse();
    expect(panel.canTogglePrepared(panel.pc().spells![0])).toBeTrue(); // unpreparing is always allowed
  });

  it('offers the Sorcerer list when "All classes" is unticked in Grant spells', () => {
    render(monk(), { addAllowed: true });
    const panel = fixture.componentInstance;
    panel.openGrantForm();

    panel.toggleAllClasses(false);

    expect(dndResources.getSpellsForClass).toHaveBeenCalledOnceWith('Sorcerer');
  });

  describe('any other character', () => {
    it('keeps its class\'s casting numbers, cap and list', () => {
      const openHand = render(monk({ subclass: 'Warrior of the Open Hand', spellSlots: {} }), { preparable: true });
      expect(openHand.querySelector('.spell-dc')).toBeNull();          // a Monk has no casting ability
      expect(openHand.querySelector('.prepared-counter')).toBeNull();  // and no prepared-spell cap
      expect(fixture.componentInstance.preparedCap()).toBeNull();

      render(monk({ clazz: 'Fighter', subclass: 'Eldritch Knight', spellSlots: {} }), { preparable: true });
      expect(fixture.componentInstance.preparedCap()).toBeNull();
      expect(fixture.componentInstance.saveDc()).toBeNull();

      render(monk({ clazz: 'Wizard', subclass: 'Evoker', level: 5 }), { addAllowed: true });
      const wizard = fixture.componentInstance;
      expect(wizard.preparedCap()).toBe(9);
      expect(wizard.saveDc()).toBe(8 + 3 - 1); // Intelligence 8
      wizard.openGrantForm();
      wizard.toggleAllClasses(false);
      expect(dndResources.getSpellsForClass).toHaveBeenCalledOnceWith('Wizard');
    });
  });
});
