import { SpellbookPanelComponent } from './spellbook-panel.component';
import { PC, PcSpell } from '../../../../models/pc';

/**
 * Class-level tests (no TestBed): the panel's cast-resolution logic — level
 * picking, missing-component warning vs. strict block, and the emitted event.
 * Template rendering is verified in the browser.
 */
function makePanel(pc: Partial<PC>, strict = false): SpellbookPanelComponent {
  const panel = new SpellbookPanelComponent();
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
});
