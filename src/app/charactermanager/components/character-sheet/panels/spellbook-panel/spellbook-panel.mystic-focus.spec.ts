import { of } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SpellbookPanelComponent } from './spellbook-panel.component';
import { DndResourcesService } from '../../../../services/dnd-resources.service';
import { MysticFocusRequest } from '../../../../models/mystic-focus';
import { PC, PcSpell } from '../../../../models/pc';

/**
 * Mystic Focus on the Spells tab: under the slot strip of a Warrior of the
 * Mystic Arts monk (Monk 6+), for whoever may use it, and for nobody else.
 */
describe('SpellbookPanelComponent (Mystic Focus)', () => {
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

  const before = (a: Element, b: Element): boolean =>
    !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it('sits under the slot strip for a viewer who may use it', () => {
    const el = render(monk(), { mysticFocusUsable: true });

    const block = el.querySelector('app-mystic-focus .mf')!;
    expect(block).not.toBeNull();
    expect(before(el.querySelector('.sst')!, block)).toBeTrue();
    expect(before(block, el.querySelector('.spell-level')!)).toBeTrue();
    expect(el.querySelectorAll('[data-slot-to-focus]').length).toBe(2);
    expect(el.querySelectorAll('[data-focus-to-slot]').length).toBe(2);
  });

  it('is left out for a viewer who may not', () => {
    const el = render(monk());
    expect(el.querySelector('app-mystic-focus')).toBeNull();
    expect(el.textContent).not.toContain('Mystic Focus');
  });

  it('is not there before Monk level 6', () => {
    const el = render(monk({ level: 5, spellSlots: { 1: { max: 3, used: 1 } } }), { mysticFocusUsable: true });
    expect(el.querySelector('.mf')).toBeNull();
    expect(el.querySelector('.sst')).not.toBeNull(); // the strip itself is
  });

  it('passes a confirmed conversion up to the sheet', () => {
    const el = render(monk(), { mysticFocusUsable: true });
    const emitted: MysticFocusRequest[] = [];
    fixture.componentInstance.mysticFocus.subscribe(request => emitted.push(request));

    el.querySelector<HTMLButtonElement>('[data-focus-to-slot]')!.click();
    fixture.detectChanges();
    expect(emitted).toEqual([]);
    el.querySelector<HTMLButtonElement>('[data-confirm]')!.click();

    expect(emitted).toEqual([{ action: 'FOCUS_TO_SLOT', slotLevel: 1 }]);
  });

  it('holds its buttons while a conversion is on its way', () => {
    const el = render(monk(), { mysticFocusUsable: true, mysticFocusBusy: true });
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('.mf-btn'));
    expect(buttons.length).toBe(4);
    expect(buttons.every(b => b.disabled)).toBeTrue();
  });

  it('is not there for any other character, whoever looks', () => {
    for (const pc of [
      monk({ subclass: 'Warrior of the Open Hand', spellSlots: {} }),
      monk({ clazz: 'Wizard', subclass: 'Evoker' }),
      monk({ clazz: 'Fighter', subclass: 'Eldritch Knight', spellSlots: {} }),
    ]) {
      const el = render(pc, { mysticFocusUsable: true });
      expect(el.querySelector('.mf')).withContext(`${pc.clazz} ${pc.subclass}`).toBeNull();
    }
  });
});
