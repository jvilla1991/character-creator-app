import { of } from 'rxjs';

import { SpellbookPanelComponent } from './spellbook-panel.component';
import { DndResourcesService } from '../../../../services/dnd-resources.service';
import { DndSpell } from '../../../../models/dnd-api.types';
import { PC, PcSpell } from '../../../../models/pc';

/**
 * Class-level tests (no TestBed): the panel's cast-resolution logic — level
 * picking, missing-component warning vs. strict block, and the emitted event.
 * Template rendering is verified in the browser.
 */
function makePanel(pc: Partial<PC>, strict = false): SpellbookPanelComponent {
  // The constructor now requires DndResourcesService/ChangeDetectorRef (the DM
  // grant flow); the cast-logic tests don't exercise them, so stubs suffice.
  const dndResources = jasmine.createSpyObj<DndResourcesService>(
    'DndResourcesService', ['getSpells', 'getSpellsForClass']);
  const cdr = { markForCheck: () => {} } as any;
  const panel = new SpellbookPanelComponent(dndResources, cdr);
  panel.pc = {
    id: 1, name: 'Elaria', clazz: 'Wizard', level: 5, playerName: 'Sam',
    spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 2, used: 0 } },
    spells: [],
    ...pc,
  } as PC;
  panel.strictComponents = strict;
  panel.ngOnChanges();
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

    panel.onCastClick(panel.pc.spells![0], stop());

    expect(emitted).toEqual([{ spellName: 'Cure Wounds', atLevel: 1 }]);
    expect(panel.pickerFor).toBeNull();
  });

  it('opens the level picker when several slot levels are available', () => {
    const panel = makePanel({ spells: [spell()] }); // L1 and L2 both free
    const emitted: unknown[] = [];
    panel.castRequested.subscribe(e => emitted.push(e));

    panel.onCastClick(panel.pc.spells![0], stop());

    expect(panel.pickerFor).toBe('Cure Wounds');
    expect(emitted.length).toBe(0);

    panel.pickLevel(panel.pc.spells![0], 2, stop());
    expect(emitted).toEqual([{ spellName: 'Cure Wounds', atLevel: 2 }]);
  });

  it('casts a cantrip with no slot spend', () => {
    const panel = makePanel({ spells: [spell({ lvl: 0, name: 'Fire Bolt' })] });
    const emitted: Array<{ atLevel: number }> = [];
    panel.castRequested.subscribe(e => emitted.push(e));

    panel.onCastClick(panel.pc.spells![0], stop());
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
    expect(panel.canCast(panel.pc.spells![0])).toBeFalse();
    expect(panel.castTitle(panel.pc.spells![0])).toBe('No slots available');
  });

  it('disables casting an unprepared spell even when slots are free', () => {
    const panel = makePanel({ spells: [spell({ prepared: false })] }); // L1/L2 slots free
    const emitted: unknown[] = [];
    panel.castRequested.subscribe(e => emitted.push(e));

    expect(panel.canCast(panel.pc.spells![0])).toBeFalse();
    expect(panel.castTitle(panel.pc.spells![0])).toBe('Cure Wounds is not prepared');

    panel.onCastClick(panel.pc.spells![0], stop());
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
    expect(panel.preparedCap).toBe(9);
    expect(panel.preparedCount).toBe(1);
  });

  it('treats a missing prepared flag (pre-feature data) as prepared', () => {
    const legacy = { lvl: 1, name: 'Sleep', school: 'Enchantment', time: '1 action' } as PcSpell;
    const panel = makePanel({ spells: [legacy] });
    expect(panel.isPrepared(legacy)).toBeTrue();
    expect(panel.preparedCount).toBe(1);
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

    expect(panel.preparedCap).toBe(2);
    expect(panel.canTogglePrepared(waiting)).toBeFalse();
    expect(panel.prepareTitle(waiting)).toContain('cap');
    panel.togglePrepared(waiting, stop());
    expect(emitted.length).toBe(0); // at cap — nothing emitted

    // Prepared spells can still be unprepared at cap.
    expect(panel.canTogglePrepared(panel.pc.spells![0])).toBeTrue();

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
    expect(panel.preparedCap).toBeNull();
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
  let component: SpellbookPanelComponent;
  let dndResources: jasmine.SpyObj<DndResourcesService>;
  const cdr = { markForCheck: () => {} } as any;

  beforeEach(() => {
    dndResources = jasmine.createSpyObj<DndResourcesService>('DndResourcesService', ['getSpells', 'getSpellsForClass']);
    component = new SpellbookPanelComponent(dndResources, cdr);
    component.pc = makePC();
  });

  it('loads the class spell list by default and excludes already-known spells (case-insensitive)', () => {
    component.pc = makePC({ spells: [{ lvl: 0, name: 'fire bolt', school: 'Evocation', time: 'action', prepared: true }] });
    dndResources.getSpellsForClass.and.returnValue(of([makeSpell({ name: 'Fire Bolt' }), makeSpell({ name: 'Mage Hand' })]));

    component.openGrantForm();

    expect(dndResources.getSpellsForClass).toHaveBeenCalledWith('Wizard');
    expect(dndResources.getSpells).not.toHaveBeenCalled();
    expect(component.grantCandidates.map(s => s.name)).toEqual(['Mage Hand']);
    expect(component.loadingGrantSpells).toBeFalse();
  });

  it('reloads the full SRD list unfiltered by class when "All classes" is toggled on', () => {
    dndResources.getSpellsForClass.and.returnValue(of([makeSpell({ name: 'Mage Hand' })]));
    dndResources.getSpells.and.returnValue(of([makeSpell({ name: 'Cure Wounds', classes: ['cleric'] })]));
    component.openGrantForm();

    component.toggleAllClasses(true);

    expect(component.allClasses).toBeTrue();
    expect(dndResources.getSpells).toHaveBeenCalled();
    expect(component.grantCandidates.map(s => s.name)).toEqual(['Cure Wounds']);
  });

  it('emits the selection mapped to PcSpell and resets the form on confirm', () => {
    dndResources.getSpellsForClass.and.returnValue(of([makeSpell({ name: 'Mage Hand', level: 0 })]));
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

  it('collapses and clears the form on cancel', () => {
    dndResources.getSpellsForClass.and.returnValue(of([makeSpell()]));
    component.openGrantForm();
    component.grantSelection = [makeSpell()];

    component.cancelGrant();

    expect(component.grantFormOpen).toBeFalse();
    expect(component.grantCandidates).toEqual([]);
    expect(component.grantSelection).toEqual([]);
    expect(component.allClasses).toBeFalse();
  });
});
