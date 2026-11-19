import { of, Subject } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SpellbookPanelComponent } from './spellbook-panel.component';
import { DndResourcesService } from '../../../../services/dnd-resources.service';
import { UI_ROLE_KEY, UiStateService } from '../../../../services/ui-state.service';
import { DndSpell } from '../../../../models/dnd-api.types';
import { PC, PcSpell } from '../../../../models/pc';

/**
 * Class-level tests via TestBed fixtures: the panel's cast-resolution logic —
 * level picking, missing-component warning vs. strict block, and the emitted
 * event. Template rendering is verified in the browser.
 */
let dndResources: jasmine.SpyObj<DndResourcesService>;

beforeEach(() => {
  dndResources = jasmine.createSpyObj<DndResourcesService>(
    'DndResourcesService', ['getSpells', 'getSpellsForClass']);
  TestBed.configureTestingModule({
    providers: [{ provide: DndResourcesService, useValue: dndResources }],
  });
});

function makePanel(pc: Partial<PC>, strict = false): SpellbookPanelComponent {
  const fixture = TestBed.createComponent(SpellbookPanelComponent);
  const panel = fixture.componentInstance;
  fixture.componentRef.setInput('pc', {
    id: 1, name: 'Elaria', clazz: 'Wizard', level: 5, playerName: 'Sam',
    spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 2, used: 0 } },
    spells: [],
    ...pc,
  } as PC);
  fixture.componentRef.setInput('strictComponents', strict);
  return panel;
}

const spell = (o: Partial<PcSpell> = {}): PcSpell =>
  ({ lvl: 1, name: 'Cure Wounds', school: 'Evocation', time: '1 action', prepared: true, ...o });

const stop = () => ({ stopPropagation: () => {} } as unknown as Event);

describe('SpellbookPanelComponent (cast logic)', () => {
  it('casts immediately when exactly one slot level is available', () => {
    const panel = makePanel({
      spellSlots: { 1: { max: 4, used: 1 } },
      spells: [spell()],
    });
    const emitted: Array<{ spellName: string; atLevel: number }> = [];
    panel.castRequested.subscribe(e => emitted.push(e));

    panel.onCastClick(panel.pc().spells![0], stop());

    expect(emitted).toEqual([{ spellName: 'Cure Wounds', atLevel: 1 }]);
    expect(panel.pickerFor).toBeNull();
  });

  it('opens the level picker when several slot levels are available', () => {
    const panel = makePanel({ spells: [spell()] }); // L1 and L2 both free
    const emitted: unknown[] = [];
    panel.castRequested.subscribe(e => emitted.push(e));

    panel.onCastClick(panel.pc().spells![0], stop());

    expect(panel.pickerFor).toBe('Cure Wounds');
    expect(emitted.length).toBe(0);

    panel.pickLevel(panel.pc().spells![0], 2, stop());
    expect(emitted).toEqual([{ spellName: 'Cure Wounds', atLevel: 2 }]);
  });

  it('casts a cantrip with no slot spend', () => {
    const panel = makePanel({ spells: [spell({ lvl: 0, name: 'Fire Bolt' })] });
    const emitted: Array<{ atLevel: number }> = [];
    panel.castRequested.subscribe(e => emitted.push(e));

    panel.onCastClick(panel.pc().spells![0], stop());
    expect(emitted).toEqual([{ spellName: 'Fire Bolt', atLevel: 0 } as any]);
  });

  it('parks a cast behind a confirm when a costly component is missing', () => {
    const revivify = spell({ lvl: 2, name: 'Revivify', components: ['v', 'm'],
      material: 'diamonds worth 300+ GP' });
    const panel = makePanel({ spellSlots: { 2: { max: 2, used: 0 } }, spells: [revivify] });
    const emitted: unknown[] = [];
    panel.castRequested.subscribe(e => emitted.push(e));

    panel.onCastClick(revivify, stop());
    expect(panel.pendingCast?.spellName).toBe('Revivify');
    expect(emitted.length).toBe(0);

    panel.confirmPendingCast(stop());
    expect(emitted).toEqual([{ spellName: 'Revivify', atLevel: 2 }]);
    expect(panel.pendingCast).toBeNull();
  });

  it('blocks instead of warning when the campaign runs strict components', () => {
    const revivify = spell({ lvl: 2, name: 'Revivify', components: ['v', 'm'],
      material: 'diamonds worth 300+ GP' });
    const panel = makePanel({ spellSlots: { 2: { max: 2, used: 0 } }, spells: [revivify] }, true);
    const emitted: unknown[] = [];
    panel.castRequested.subscribe(e => emitted.push(e));

    panel.onCastClick(revivify, stop());
    expect(panel.blockedFor?.spellName).toBe('Revivify');
    expect(panel.pendingCast).toBeNull();
    expect(emitted.length).toBe(0);
  });

  it('disables casting when no slot of the spell level or higher is free', () => {
    const panel = makePanel({
      spellSlots: { 1: { max: 2, used: 2 } },
      spells: [spell()],
    });
    expect(panel.canCast(panel.pc().spells![0])).toBeFalse();
    expect(panel.castTitle(panel.pc().spells![0])).toBe('No slots available');
  });

  it('disables casting an unprepared spell even when slots are free', () => {
    const panel = makePanel({ spells: [spell({ prepared: false })] }); // L1/L2 slots free
    const emitted: unknown[] = [];
    panel.castRequested.subscribe(e => emitted.push(e));

    expect(panel.canCast(panel.pc().spells![0])).toBeFalse();
    expect(panel.castTitle(panel.pc().spells![0])).toBe('Cure Wounds is not prepared');

    panel.onCastClick(panel.pc().spells![0], stop());
    expect(emitted.length).toBe(0);
  });
});

describe('SpellbookPanelComponent — spell preparation', () => {
  it('reads the prepared cap from the 2024 class table and counts leveled spells only', () => {
    const panel = makePanel({
      clazz: 'Wizard', level: 5, // wizard 5 → cap 9
      spells: [
        spell({ lvl: 0, name: 'Fire Bolt' }),               // cantrip: never counts
        spell({ lvl: 1, name: 'Shield' }),
        spell({ lvl: 2, name: 'Invisibility', prepared: false }),
      ],
    });
    expect(panel.preparedCap()).toBe(9);
    expect(panel.preparedCount()).toBe(1);
  });

  it('treats a missing prepared flag (pre-feature data) as prepared', () => {
    const legacy = { lvl: 1, name: 'Sleep', school: 'Enchantment', time: '1 action' } as PcSpell;
    const panel = makePanel({ spells: [legacy] });
    expect(panel.isPrepared(legacy)).toBeTrue();
    expect(panel.preparedCount()).toBe(1);
    expect(panel.canCast(legacy)).toBeTrue(); // older characters keep casting
  });

  it('unprepares a spell via pcChange, leaving other spells untouched', () => {
    const shield = spell({ lvl: 1, name: 'Shield' });
    const panel = makePanel({ spells: [spell({ name: 'Cure Wounds' }), shield] });
    const emitted: PC[] = [];
    panel.pcChange.subscribe(p => emitted.push(p));

    panel.togglePrepared(shield, stop());

    expect(emitted.length).toBe(1);
    expect(emitted[0].spells).toEqual([
      jasmine.objectContaining({ name: 'Cure Wounds', prepared: true }),
      jasmine.objectContaining({ name: 'Shield', prepared: false }),
    ]);
  });

  it('blocks preparing beyond the class cap, but always allows unpreparing', () => {
    // Sorcerer 1 → cap 2; two prepared already, a third waiting.
    const waiting = spell({ lvl: 1, name: 'Sleep', prepared: false });
    const panel = makePanel({
      clazz: 'Sorcerer', level: 1,
      spells: [spell({ name: 'Shield' }), spell({ name: 'Magic Missile' }), waiting],
    });
    const emitted: PC[] = [];
    panel.pcChange.subscribe(p => emitted.push(p));

    expect(panel.preparedCap()).toBe(2);
    expect(panel.canTogglePrepared(waiting)).toBeFalse();
    expect(panel.prepareTitle(waiting)).toContain('cap');
    panel.togglePrepared(waiting, stop());
    expect(emitted.length).toBe(0); // at cap — nothing emitted

    // Prepared spells can still be unprepared at cap.
    expect(panel.canTogglePrepared(panel.pc().spells![0])).toBeTrue();

    // One under cap: preparing works again.
    const panel2 = makePanel({
      clazz: 'Sorcerer', level: 1,
      spells: [spell({ name: 'Shield' }), waiting],
    });
    panel2.pcChange.subscribe(p => emitted.push(p));
    panel2.togglePrepared(waiting, stop());
    expect(emitted.length).toBe(1);
    expect(emitted[0].spells![1]).toEqual(jasmine.objectContaining({ name: 'Sleep', prepared: true }));
  });

  it('ignores toggle attempts on cantrips — they are always prepared', () => {
    const cantrip = spell({ lvl: 0, name: 'Fire Bolt', prepared: false }); // stray flag
    const panel = makePanel({ spells: [cantrip] });
    const emitted: unknown[] = [];
    panel.pcChange.subscribe(p => emitted.push(p));

    expect(panel.isPrepared(cantrip)).toBeTrue();
    panel.togglePrepared(cantrip, stop());
    expect(emitted.length).toBe(0);
  });

  it('enforces no cap for classes without a 2024 prepared table', () => {
    const waiting = spell({ lvl: 1, name: 'Sleep', prepared: false });
    const panel = makePanel({ clazz: 'Fighter', level: 3, spells: [waiting] });
    expect(panel.preparedCap()).toBeNull();
    expect(panel.canTogglePrepared(waiting)).toBeTrue();
  });
});

function makeSpell(overrides: Partial<DndSpell> = {}): DndSpell {
  return {
    name: 'Fire Bolt',
    level: 0,
    school: 'evocation',
    classes: ['wizard'],
    actionType: 'action',
    concentration: false,
    ritual: false,
    range: '120 feet',
    components: [],
    duration: 'Instantaneous',
    description: 'A mote of fire.',
    ...overrides,
  } as DndSpell;
}

function makePC(overrides: Partial<PC> = {}): PC {
  return { id: 7, name: 'Aelindra', clazz: 'Wizard', level: 4, ...overrides } as PC;
}

describe('SpellbookPanelComponent — DM grants', () => {
  let fixture: ComponentFixture<SpellbookPanelComponent>;
  let component: SpellbookPanelComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(SpellbookPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('pc', makePC());
  });

  it('loads the full spell list by default ("All classes" pre-checked) and excludes already-known spells (case-insensitive)', () => {
    fixture.componentRef.setInput('pc',
      makePC({ spells: [{ lvl: 0, name: 'fire bolt', school: 'Evocation', time: 'action', prepared: true }] }));
    dndResources.getSpells.and.returnValue(of([makeSpell({ name: 'Fire Bolt' }), makeSpell({ name: 'Cure Wounds', classes: ['cleric'] })]));

    component.openGrantForm();

    expect(component.allClasses).toBeTrue();
    expect(dndResources.getSpells).toHaveBeenCalled();
    expect(dndResources.getSpellsForClass).not.toHaveBeenCalled();
    expect(component.grantCandidates.map(s => s.name)).toEqual(['Cure Wounds']);
    expect(component.loadingGrantSpells).toBeFalse();
  });

  it('narrows to the PC\'s class list when "All classes" is unticked', () => {
    dndResources.getSpells.and.returnValue(of([makeSpell({ name: 'Cure Wounds', classes: ['cleric'] })]));
    dndResources.getSpellsForClass.and.returnValue(of([makeSpell({ name: 'Mage Hand' })]));
    component.openGrantForm();

    component.toggleAllClasses(false);

    expect(component.allClasses).toBeFalse();
    expect(dndResources.getSpellsForClass).toHaveBeenCalledWith('Wizard');
    expect(component.grantCandidates.map(s => s.name)).toEqual(['Mage Hand']);
  });

  it('narrows a WoW priest to the cleric list plus Blur and Levitate', () => {
    fixture.componentRef.setInput('pc', makePC({ clazz: 'Cleric', subclass: 'Shadow Domain', specialization: 'Shadow' }));
    dndResources.getSpells.and.returnValue(of([]));
    dndResources.getSpellsForClass.and.returnValue(of([makeSpell({ name: 'Blur', level: 2 })]));
    component.openGrantForm();

    component.toggleAllClasses(false);

    expect(dndResources.getSpellsForClass).toHaveBeenCalledOnceWith('Cleric', ['Blur', 'Levitate']);
    expect(component.grantCandidates.map(s => s.name)).toEqual(['Blur']);
  });

  it('emits the selection mapped to PcSpell and resets the form on confirm', () => {
    dndResources.getSpells.and.returnValue(of([makeSpell({ name: 'Mage Hand', level: 0 })]));
    const emitted: any[] = [];
    component.spellsGranted.subscribe(v => emitted.push(v));
    component.openGrantForm();
    component.grantSelection = [makeSpell({ name: 'Mage Hand', level: 0, school: 'conjuration', actionType: 'action' })];

    component.confirmGrant();

    expect(emitted.length).toBe(1);
    expect(emitted[0]).toEqual([jasmine.objectContaining({
      lvl: 0, name: 'Mage Hand', school: 'conjuration', time: 'action', prepared: true,
    })]);
    expect(component.grantFormOpen).toBeFalse();
    expect(component.grantSelection).toEqual([]);
  });

  it('does not emit when the selection is empty', () => {
    const emitted: any[] = [];
    component.spellsGranted.subscribe(v => emitted.push(v));
    component.grantSelection = [];

    component.confirmGrant();

    expect(emitted.length).toBe(0);
  });

  it('collapses and clears the form on cancel, restoring the all-classes default', () => {
    dndResources.getSpells.and.returnValue(of([makeSpell()]));
    dndResources.getSpellsForClass.and.returnValue(of([makeSpell()]));
    component.openGrantForm();
    component.toggleAllClasses(false);
    component.grantSelection = [makeSpell()];

    component.cancelGrant();

    expect(component.grantFormOpen).toBeFalse();
    expect(component.grantCandidates).toEqual([]);
    expect(component.grantSelection).toEqual([]);
    expect(component.allClasses).toBeTrue();
  });
});

describe('SpellbookPanelComponent (description disclosure)', () => {
  it('makes each spell name a button that reports and toggles its expanded state', () => {
    dndResources.getSpells.and.returnValue(of([]));
    dndResources.getSpellsForClass.and.returnValue(of([]));
    const fixture = TestBed.createComponent(SpellbookPanelComponent);
    fixture.componentRef.setInput('pc', {
      id: 1, name: 'Elaria', clazz: 'Wizard', level: 5, playerName: 'Sam',
      spellSlots: { 1: { max: 4, used: 0 } },
      spells: [spell({ description: 'Heals a creature you touch.' })],
    } as PC);
    fixture.detectChanges();

    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('button.spell-toggle');
    expect(toggle.getAttribute('aria-label')).toBe('Cure Wounds');
    expect(toggle.getAttribute('aria-expanded')).toBe('true'); // spells start expanded
    expect(fixture.nativeElement.querySelector('.spell-desc')).not.toBeNull();

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('.spell-desc')).toBeNull();

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('SpellbookPanelComponent (prepared spells locked to the long rest)', () => {
  // A campaign character on its owner's sheet: the Prepare buttons are withheld
  // (preparable false) and the hint says why; the count stays, read-only.
  function render(preparable: boolean, hint: string | null) {
    dndResources.getSpells.and.returnValue(of([]));
    dndResources.getSpellsForClass.and.returnValue(of([]));
    const fixture = TestBed.createComponent(SpellbookPanelComponent);
    fixture.componentRef.setInput('pc', {
      id: 1, name: 'Elaria', clazz: 'Wizard', level: 5, playerName: 'Sam', // wizard 5 → cap 9
      spellSlots: { 1: { max: 4, used: 0 } },
      spells: [
        spell({ lvl: 1, name: 'Shield' }),
        spell({ lvl: 1, name: 'Sleep', prepared: false }),
        spell({ lvl: 0, name: 'Fire Bolt' }),
      ],
    } as PC);
    fixture.componentRef.setInput('preparable', preparable);
    fixture.componentRef.setInput('preparedHint', hint);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the hint and the read-only count, and no Prepare buttons', () => {
    const el = render(false, 'Prepared spells change during a long rest.');

    expect(el.querySelector('.prepared-locked-hint')!.textContent).toContain('Prepared spells change during a long rest.');
    expect(el.querySelector('.prepared-counter')!.textContent).toContain('Prepared 1 / 9');
    expect(el.querySelectorAll('.spell-prep-btn').length).toBe(0);
    expect(el.querySelectorAll('.spell-row.unprepared').length).toBe(1); // Sleep is still shown as not prepared
  });

  it('a viewer who may prepare gets the buttons and the count, with no hint', () => {
    const el = render(true, null);

    expect(el.querySelector('.prepared-locked-hint')).toBeNull();
    expect(el.querySelector('.prepared-counter')!.textContent).toContain('Prepared 1 / 9');
    expect(el.querySelectorAll('.spell-prep-btn').length).toBe(2); // the two leveled spells, not the cantrip
  });

  it('a read-only viewer gets neither the buttons, the count nor the hint, as before', () => {
    const el = render(false, null);

    expect(el.querySelector('.prepared-locked-hint')).toBeNull();
    expect(el.querySelector('.prepared-counter')).toBeNull();
    expect(el.querySelectorAll('.spell-prep-btn').length).toBe(0);
  });
});

describe('SpellbookPanelComponent (spell slots)', () => {
  function render(pc: Partial<PC>, inputs: Record<string, unknown> = {}): HTMLElement {
    dndResources.getSpells.and.returnValue(of([]));
    dndResources.getSpellsForClass.and.returnValue(of([]));
    const fixture = TestBed.createComponent(SpellbookPanelComponent);
    fixture.componentRef.setInput('pc', {
      id: 1, name: 'Elaria', clazz: 'Wizard', level: 5, playerName: 'Sam',
      spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 3, used: 3 } },
      spells: [spell({ lvl: 0, name: 'Fire Bolt' }), spell({ lvl: 1, name: 'Shield' }), spell({ lvl: 2, name: 'Misty Step' })],
      ...pc,
    } as PC);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const before = (a: Element, b: Element): boolean =>
    !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it('puts the slot strip at the top of the tab, above the search box', () => {
    const el = render({});

    const strip = el.querySelector('app-spell-slot-tracker .sst')!;
    expect(strip).not.toBeNull();
    expect(Array.from(strip.querySelectorAll('.sst-count')).map(c => c.textContent!.trim())).toEqual(['3/4', '0/3']);
    expect(before(el.querySelector('.panel-header')!, strip)).toBeTrue();
    expect(before(strip, el.querySelector('.spell-filter-bar')!)).toBeTrue();
    expect(before(strip, el.querySelector('.spell-level')!)).toBeTrue();
  });

  it('shows a character with no slot level nothing new', () => {
    // A Fighter who knows a spell or two (a species trait, a feat) but has no slots.
    for (const spellSlots of [undefined, {}, { 1: { max: 0, used: 0 } }]) {
      const el = render({ clazz: 'Fighter', spellSlots: spellSlots as PC['spellSlots'] });

      expect(el.querySelector('.sst')).withContext(JSON.stringify(spellSlots)).toBeNull();
      expect(el.querySelector('app-spell-slot-tracker')!.textContent!.trim()).toBe('');
      expect(el.querySelector('.spell-slots-left')).toBeNull();
      expect(el.textContent).not.toContain('Spell slots');
      expect(el.querySelectorAll('.spell-level').length).toBe(3); // the spells are listed as before
    }
  });

  it('shows the strip to a caster who knows no spells yet', () => {
    const el = render({ clazz: 'Paladin', level: 1, spellSlots: { 1: { max: 2, used: 0 } }, spells: [] });
    expect(el.querySelector('.sst')).not.toBeNull();
  });

  it('keeps the words beside each spell level and drops the old pips', () => {
    const el = render({});

    const words = Array.from(el.querySelectorAll('.spell-level')).map(level =>
      level.querySelector('.spell-slots-left')?.textContent?.trim() ?? null);
    expect(words).toEqual([null, '3 of 4 left', 'None left']); // cantrips need no slot
    expect(el.querySelector('.spell-slot')).toBeNull();
  });

  it('shows the DM the same words: the old inline Spent n / max inputs are gone', () => {
    const el = render({}, { editable: true, slotsSpendable: true, slotsRestorable: true, slotMaximum: 'edit' });

    const words = Array.from(el.querySelectorAll('.spell-level')).map(level =>
      level.querySelector('.spell-slots-left')?.textContent?.trim() ?? null);
    expect(words).toEqual([null, '3 of 4 left', 'None left']);
    expect(el.querySelector('.slot-edit')).toBeNull();
    expect(el.querySelector('app-editable-number')).toBeNull();
    expect(el.textContent).not.toContain('Spent');
  });

  describe('wired to the sheet', () => {
    function open(inputs: Record<string, unknown>, pc: Partial<PC> = {}) {
      dndResources.getSpells.and.returnValue(of([]));
      dndResources.getSpellsForClass.and.returnValue(of([]));
      const fixture = TestBed.createComponent(SpellbookPanelComponent);
      fixture.componentRef.setInput('pc', {
        id: 1, name: 'Elaria', clazz: 'Wizard', level: 5, playerName: 'Sam',
        spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 3, used: 3 } },
        spells: [spell({ lvl: 1, name: 'Shield' })],
        ...pc,
      } as PC);
      for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const events: string[] = [];
      const panel = fixture.componentInstance;
      panel.slotSpend.subscribe(level => events.push(`spend ${level}`));
      panel.slotRestore.subscribe(level => events.push(`restore ${level}`));
      panel.slotsRestoreAll.subscribe(() => events.push('restore all'));
      panel.slotMaximumRequested.subscribe(level => events.push(`maximum ${level}`));
      const tap = (label: string): void => {
        Array.from(el.querySelectorAll<HTMLButtonElement>('.sst-col'))
          .find(c => c.querySelector('.sst-label')!.textContent!.trim() === label)!.click();
        fixture.detectChanges();
      };
      const press = (attr: string): void => el.querySelector<HTMLButtonElement>(`[${attr}]`)!.click();
      return { fixture, el, events, tap, press };
    }

    it('a player in a campaign may spend and look at the maximum, nothing more', () => {
      const { el, events, tap, press } = open({ slotsSpendable: true, slotMaximum: 'view' });
      tap('1st');

      expect(el.querySelector('[data-restore]')).toBeNull();
      expect(el.querySelector('[data-restore-all]')).toBeNull();
      press('data-spend');
      press('data-maximum');
      expect(events).toEqual(['spend 1', 'maximum 1']);
    });

    it('the DM may also restore one slot or all of them', () => {
      const { events, tap, press } = open({ slotsSpendable: true, slotsRestorable: true, slotMaximum: 'edit' });
      tap('2nd');

      press('data-restore');
      press('data-restore-all');
      expect(events).toEqual(['restore 2', 'restore all']);
    });

    it('a read-only viewer gets the strip with no actions', () => {
      const { el, tap } = open({});
      tap('1st');

      expect(el.querySelector('.sst-detail')).not.toBeNull();
      expect(el.querySelector('.sst-actions')).toBeNull();
    });

    it('passes on what the sheet says just happened', () => {
      const { fixture, el } = open({ slotsSpendable: true });

      fixture.componentRef.setInput('slotNotice', { level: 1, text: 'One 1st-level slot spent by hand.' });
      fixture.detectChanges();
      expect(el.querySelector('.sst-note')!.textContent!.trim()).toBe('One 1st-level slot spent by hand.');
    });

    it('shows whoever may change the lines a level the lines took to nothing', () => {
      const cursed: Partial<PC> = {
        spellSlots: { 1: { max: 4, used: 1 } },
        statAdjustments: { ac: [{ value: 1, label: 'Taunka' }], slot2: [{ value: -3, label: 'Cursed' }] },
      };
      const labels = (el: HTMLElement) =>
        Array.from(el.querySelectorAll('.sst-label')).map(l => l.textContent!.trim());

      expect(labels(open({ slotMaximum: 'edit' }, cursed).el)).toEqual(['1st', '2nd']);
      expect(labels(open({ slotMaximum: 'view' }, cursed).el)).toEqual(['1st']); // a player just has no 2nd-level slots
    });
  });
});

describe('SpellbookPanelComponent (ELI5 summaries)', () => {
  const ELI5_KEY = 'tm_eli5';
  const FULL = 'A creature you touch regains a number of Hit Points equal to 2d8 plus your spellcasting ability modifier.';
  const SHORT = 'Touch a creature to heal it for 2d8 plus your spellcasting modifier.';

  // The role is persisted too (UiStateService rehydrates it), so a DM-view spec
  // elsewhere must not leak into these Player-view ones.
  const clearStorage = (): void => {
    localStorage.removeItem(ELI5_KEY);
    localStorage.removeItem(UI_ROLE_KEY);
  };
  beforeEach(clearStorage);
  afterEach(clearStorage);

  function render(): ComponentFixture<SpellbookPanelComponent> {
    dndResources.getSpells.and.returnValue(of([makeSpell({ name: 'Cure Wounds', eli5: SHORT })]));
    const fixture = TestBed.createComponent(SpellbookPanelComponent);
    fixture.componentRef.setInput('pc', {
      id: 1, name: 'Elaria', clazz: 'Wizard', level: 5, playerName: 'Sam',
      spellSlots: { 1: { max: 4, used: 0 } },
      spells: [
        spell({ description: FULL, higherLevelSlot: 'The healing increases by 2d8.' }),
        spell({ name: 'Homebrew Zap', description: 'A spell nobody summarized.' }),
      ],
    } as PC);
    fixture.detectChanges();
    return fixture;
  }

  const descriptions = (fixture: ComponentFixture<SpellbookPanelComponent>): string[] =>
    Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.spell-desc'))
      .map(el => el.textContent!.trim());

  it('shows the full descriptions while ELI5 is off, without fetching the catalog', () => {
    const fixture = render();

    expect(descriptions(fixture)).toEqual([FULL, 'A spell nobody summarized.']);
    expect(dndResources.getSpells).not.toHaveBeenCalled();
  });

  it('swaps in the one-sentence summary when the header switch is turned on', () => {
    const fixture = render();
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('app-eli5-toggle button[role="switch"]');
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-checked')).toBe('true');
    // Summarized spell → one sentence; un-summarized spell keeps its full text.
    expect(descriptions(fixture)).toEqual([SHORT, 'A spell nobody summarized.']);
    // Only the description is condensed: the upcast note stays.
    expect(fixture.nativeElement.querySelector('.spell-higher')).not.toBeNull();

    toggle.click();
    fixture.detectChanges();
    expect(descriptions(fixture)).toEqual([FULL, 'A spell nobody summarized.']);
  });

  it('hides the switch and keeps full text in the DM view', () => {
    localStorage.setItem(ELI5_KEY, 'true');
    TestBed.inject(UiStateService).setRole('dm');
    const fixture = render();

    expect(fixture.nativeElement.querySelector('app-eli5-toggle button')).toBeNull();
    expect(descriptions(fixture)).toEqual([FULL, 'A spell nobody summarized.']);
  });
});

describe('SpellbookPanelComponent (stale placeholder spells)', () => {
  // A spell learned while its catalog entry was a "TBD" stub keeps that stub as
  // its saved snapshot; the sheet shows the catalog's finished text instead.
  const TBD = 'TBD: full text coming in the World of Warcraft spells update.';
  const RUNE_TEXT = 'Your weapon flares with runes and deals an extra 1d6 Necrotic damage.';

  const staleRune = spell({
    lvl: 1, name: 'Rune Strike', school: 'necromancy', time: 'action', prepared: false,
    range: 'TBD', duration: 'TBD', description: TBD, components: ['v', 's'],
  });
  const normal = spell({ description: 'Heals a creature you touch.', range: 'Touch', duration: 'Instantaneous' });

  function render(spells: PcSpell[]): ComponentFixture<SpellbookPanelComponent> {
    dndResources.getSpells.and.returnValue(of([
      makeSpell({ name: 'Rune Strike', level: 1, school: 'evocation', actionType: 'bonus action',
        range: 'Self', duration: 'up to 1 minute', components: ['v'], description: RUNE_TEXT }),
      makeSpell({ name: 'Cure Wounds', level: 1, range: '60 feet', description: 'Catalog text that must not replace a real snapshot.' }),
    ]));
    const fixture = TestBed.createComponent(SpellbookPanelComponent);
    fixture.componentRef.setInput('pc', {
      id: 1, name: 'Elaria', clazz: 'Wizard', level: 5, playerName: 'Sam',
      spellSlots: { 1: { max: 4, used: 0 } },
      spells,
    } as PC);
    fixture.componentRef.setInput('preparable', true);
    fixture.detectChanges();
    fixture.detectChanges(); // the catalog arrives from the load effect; render it
    return fixture;
  }

  const rowText = (el: HTMLElement, name: string): string => {
    const toggle = el.querySelector(`button.spell-toggle[aria-label="${name}"]`)!;
    return toggle.closest('.spell-row')!.parentElement!.textContent!;
  };

  it("shows the catalog's description, range and duration instead of TBD", () => {
    const fixture = render([staleRune, normal]);
    const el = fixture.nativeElement as HTMLElement;
    const rune = rowText(el, 'Rune Strike');

    expect(dndResources.getSpells).toHaveBeenCalledTimes(1);
    expect(rune).toContain(RUNE_TEXT);
    expect(rune).toContain('Self');
    expect(rune).toContain('up to 1 minute');
    expect(rune).toContain('evocation');
    expect(rune).toContain('bonus action');
    expect(el.textContent).not.toContain('TBD');
  });

  it('renders a normal spell exactly from its snapshot, and never fetches the catalog for it', () => {
    const fixture = render([normal]);
    const el = fixture.nativeElement as HTMLElement;

    expect(dndResources.getSpells).not.toHaveBeenCalled();
    expect(el.querySelector('.spell-desc')!.textContent!.trim()).toBe('Heals a creature you touch.');
    expect(el.querySelector('.spell-range')!.textContent!.trim()).toBe('Touch');
    expect(el.querySelector('.spell-school')!.textContent!.trim()).toBe('Evocation');
  });

  it('keeps a real snapshot as saved next to a refreshed one', () => {
    const fixture = render([staleRune, normal]);
    const cure = rowText(fixture.nativeElement, 'Cure Wounds');

    expect(cure).toContain('Heals a creature you touch.');
    expect(cure).toContain('Touch');
    expect(cure).not.toContain('Catalog text');
  });

  it('keeps showing the saved snapshot until the catalog arrives', () => {
    dndResources.getSpells.and.returnValue(new Subject<DndSpell[]>());
    const fixture = TestBed.createComponent(SpellbookPanelComponent);
    fixture.componentRef.setInput('pc', {
      id: 1, name: 'Elaria', clazz: 'Wizard', level: 5, playerName: 'Sam', spells: [staleRune],
    } as PC);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.spell-desc').textContent.trim()).toBe(TBD);
  });

  it('preparing a refreshed spell persists the SAVED snapshot with only its flag flipped', () => {
    const fixture = render([staleRune, normal]);
    const emitted: PC[] = [];
    fixture.componentInstance.pcChange.subscribe(p => emitted.push(p));

    const prep: HTMLButtonElement = fixture.nativeElement.querySelector('.spell-row.unprepared .spell-prep-btn');
    prep.click();

    expect(emitted.length).toBe(1);
    expect(emitted[0].spells![0]).toEqual({ ...staleRune, prepared: true });
    expect(emitted[0].spells![1]).toBe(normal);
  });
});
