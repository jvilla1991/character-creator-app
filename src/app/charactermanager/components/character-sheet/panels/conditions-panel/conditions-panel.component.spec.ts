import { ConditionsPanelComponent } from './conditions-panel.component';
import { PC } from '../../../../models/pc';

describe('ConditionsPanelComponent', () => {
  let component: ConditionsPanelComponent;

  beforeEach(() => {
    component = new ConditionsPanelComponent();
    component.pc = { id: 1, name: 'X', clazz: 'Fighter', level: 4, playerName: 'P' } as PC;
  });

  // --- Condition chips (existing behavior) ---

  it('isActive reflects the pc conditions array', () => {
    component.pc = { ...component.pc, conditions: ['prone'] };
    expect(component.isActive('prone')).toBeTrue();
    expect(component.isActive('stunned')).toBeFalse();
  });

  it('isActive is false with no conditions array', () => {
    expect(component.isActive('prone')).toBeFalse();
  });

  // --- Exhaustion tracker (2024 PHB) ---

  it('reads level 0 for a pc saved before the field existed', () => {
    expect(component.exhaustion).toBe(0);
    expect(component.exhaustionFatal).toBeFalse();
  });

  it('clicking a pip above the current level emits that level', () => {
    component.pc = { ...component.pc, exhaustion: 2 };
    const emitted = jasmine.createSpy('emitted');
    component.exhaustionChanged.subscribe(emitted);

    component.setExhaustion(4);

    expect(emitted).toHaveBeenCalledWith(4);
  });

  it('re-clicking the current top pip steps back one level', () => {
    component.pc = { ...component.pc, exhaustion: 3 };
    const emitted = jasmine.createSpy('emitted');
    component.exhaustionChanged.subscribe(emitted);

    component.setExhaustion(3);

    expect(emitted).toHaveBeenCalledWith(2);
  });

  it('re-clicking pip 1 at level 1 walks the tracker back to 0', () => {
    component.pc = { ...component.pc, exhaustion: 1 };
    const emitted = jasmine.createSpy('emitted');
    component.exhaustionChanged.subscribe(emitted);

    component.setExhaustion(1);

    expect(emitted).toHaveBeenCalledWith(0);
  });

  it('level 6 is fatal', () => {
    component.pc = { ...component.pc, exhaustion: 6 };
    expect(component.exhaustionFatal).toBeTrue();
    expect(component.exhaustionTooltip).toContain('dies');
  });

  it('tooltip states the per-level rule at level 0', () => {
    expect(component.exhaustionTooltip)
      .toContain('−2 to all d20 Tests and −5 ft Speed per level; death at level 6');
  });

  it('tooltip sums the cumulative penalty at a mid level', () => {
    component.pc = { ...component.pc, exhaustion: 3 };
    expect(component.exhaustionTooltip).toContain('−6 to all d20 Tests');
    expect(component.exhaustionTooltip).toContain('−15 ft Speed');
  });
});
