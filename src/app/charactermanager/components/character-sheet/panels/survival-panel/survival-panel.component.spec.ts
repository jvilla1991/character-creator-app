import { SurvivalPanelComponent } from './survival-panel.component';
import { PC } from '../../../../models/pc';

describe('SurvivalPanelComponent', () => {
  let component: SurvivalPanelComponent;

  const basePc = (survival?: PC['survival']): PC =>
    ({ id: 1, name: 'X', clazz: 'Ranger', level: 3, playerName: 'P', survival } as PC);

  beforeEach(() => {
    component = new SurvivalPanelComponent();
    component.editable = true;
  });

  it('defaults an untracked PC to the neutral Ok stage', () => {
    component.pc = basePc(undefined);
    expect(component.stage('hunger')).toBe(2);
    expect(component.label('hunger')).toBe('Ok');
    expect(component.exhaustion).toBe(0); // no free −3 for a fresh character
  });

  it('shows the label for the current stage', () => {
    component.pc = basePc({ hunger: 5, thirst: 3, fatigue: 6 });
    expect(component.label('hunger')).toBe('Ravenous');
    expect(component.label('thirst')).toBe('Parched');
    expect(component.label('fatigue')).toBe('Barely awake');
  });

  it('steppers emit a pcChange with the adjusted, clamped stage', () => {
    component.pc = basePc({ hunger: 6, thirst: 2, fatigue: 0 });
    const spy = spyOn(component.pcChange, 'emit');

    component.adjust('hunger', 1); // already 6 — clamps
    component.adjust('thirst', -1);

    const first = spy.calls.argsFor(0)[0] as PC;
    const second = spy.calls.argsFor(1)[0] as PC;
    expect(first.survival!.hunger).toBe(6);
    expect(second.survival!.thirst).toBe(1);
    expect(component.pc.survival!.thirst).toBe(2); // input untouched
  });

  it('computes the exhaustion badge from the stages', () => {
    component.pc = basePc({ hunger: 5, thirst: 6, fatigue: 2 });
    expect(component.exhaustion).toBe(2);

    component.pc = basePc({ hunger: 0, thirst: 0, fatigue: 0 });
    expect(component.exhaustion).toBe(-3);

    component.pc = basePc({ hunger: 2, thirst: 3, fatigue: 1 });
    expect(component.exhaustion).toBe(0);
  });
});
