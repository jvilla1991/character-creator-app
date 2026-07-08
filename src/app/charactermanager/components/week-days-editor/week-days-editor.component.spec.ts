import { WeekDaysEditorComponent } from './week-days-editor.component';
import { WEEKDAY_PRESETS } from '../../models/campaign';

/** Tests the component class directly (no TestBed/DOM), per the app convention. */
describe('WeekDaysEditorComponent', () => {
  let component: WeekDaysEditorComponent;
  let emitted: (string[] | null)[];

  const eberron = WEEKDAY_PRESETS.find(p => p.key === 'eberron')!;

  beforeEach(() => {
    component = new WeekDaysEditorComponent();
    emitted = [];
    component.valueChange.subscribe(v => emitted.push(v));
  });

  it('emits a preset\'s ordered days when picked', () => {
    component.onChoice('eberron');
    expect(emitted).toEqual([['Sul', 'Mol', 'Zol', 'Wir', 'Zor', 'Far', 'Sar']]);
    expect(component.preview).toEqual(eberron.days);
  });

  it('parses custom text — trimmed, blank-dropped, deduped case-insensitively, order kept', () => {
    component.onChoice('custom');
    component.onCustomText(' Sul , Mol,, sul , Zol ');
    expect(emitted[emitted.length - 1]).toEqual(['Sul', 'Mol', 'Zol']);
  });

  it('emits null for "no defined week" and for empty custom text', () => {
    component.onChoice('eberron');
    component.onChoice('');
    expect(emitted[emitted.length - 1]).toBeNull();
    component.onChoice('custom');
    component.onCustomText('  ,  ');
    expect(emitted[emitted.length - 1]).toBeNull();
  });

  it('ngOnChanges detects a preset value vs a custom one', () => {
    component.value = [...eberron.days];
    component.ngOnChanges();
    expect(component.choice).toBe('eberron');

    component.value = ['Sul', 'Mol'];
    component.ngOnChanges();
    expect(component.choice).toBe('custom');
    expect(component.customText).toBe('Sul, Mol');

    component.value = null;
    component.ngOnChanges();
    expect(component.choice).toBe('');
  });
});
