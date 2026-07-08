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

  it('emits a preset\'s ordered days immediately when picked', () => {
    component.onChoice('eberron');
    expect(emitted).toEqual([['Sul', 'Mol', 'Zol', 'Wir', 'Zor', 'Far', 'Sar']]);
    expect(component.preview).toEqual(eberron.days);
  });

  it('emits null for "no defined week"', () => {
    component.onChoice('eberron');
    component.onChoice('');
    expect(emitted[emitted.length - 1]).toBeNull();
  });

  describe('custom mode (live emission)', () => {
    it('choosing Custom… spawns one empty box and emits null (nothing usable yet)', () => {
      component.onChoice('custom');
      expect(component.customDays).toEqual(['']);
      expect(emitted).toEqual([null]);
      expect(component.incomplete).toBeTrue();
    });

    it('the "+" appears only once the last box has content, and spawns the next box', () => {
      component.onChoice('custom');
      expect(component.canAddDay).toBeFalse(); // empty first box — no "+"

      component.onDayInput(0, 'Sul');
      expect(component.canAddDay).toBeTrue();

      component.addDay();
      expect(component.customDays).toEqual(['Sul', '']);
      expect(component.canAddDay).toBeFalse(); // new last box is empty again
    });

    it('the "+" stops at the max week length', () => {
      component.onChoice('custom');
      component.customDays = Array.from({ length: component.maxDays }, (_, i) => `Day ${i + 1}`);
      expect(component.canAddDay).toBeFalse();
      component.addDay(); // guarded — must not exceed the cap
      expect(component.customDays.length).toBe(component.maxDays);
    });

    it('emits null below 2 named days, then the list as soon as 2 exist', () => {
      component.onChoice('custom');
      component.onDayInput(0, 'Sul');
      expect(emitted[emitted.length - 1]).toBeNull(); // one day — not a week yet
      expect(component.preview).toBeNull();

      component.addDay();
      component.onDayInput(1, 'Mol');
      expect(emitted[emitted.length - 1]).toEqual(['Sul', 'Mol']);
      expect(component.incomplete).toBeFalse();
      expect(component.preview).toEqual(['Sul', 'Mol']);
    });

    it('emits trimmed, blank-dropped, case-insensitively deduped days in order', () => {
      component.onChoice('custom');
      component.onDayInput(0, ' Sul ');
      component.addDay();
      component.onDayInput(1, 'Mol');
      component.addDay();
      component.onDayInput(2, 'sul'); // dup, case-insensitive
      component.addDay();
      component.onDayInput(3, '   '); // blank — dropped
      expect(emitted[emitted.length - 1]).toEqual(['Sul', 'Mol']);
    });

    it('falls back to null when an edit drops the week below 2 days', () => {
      component.onChoice('custom');
      component.onDayInput(0, 'Sul');
      component.addDay();
      component.onDayInput(1, 'Mol');
      expect(emitted[emitted.length - 1]).toEqual(['Sul', 'Mol']);

      component.onDayInput(1, ''); // back to one named day
      expect(emitted[emitted.length - 1]).toBeNull();
      expect(component.incomplete).toBeTrue();
    });
  });

  describe('ngOnChanges (seeding from the bound value)', () => {
    it('seeds one box per existing custom day, with the "+" available', () => {
      component.value = ['Sul', 'Mol'];
      component.ngOnChanges();
      expect(component.choice).toBe('custom');
      expect(component.customDays).toEqual(['Sul', 'Mol']);
      expect(component.canAddDay).toBeTrue(); // last box non-empty
    });

    it('detects a preset value, and resets for null', () => {
      component.value = [...eberron.days];
      component.ngOnChanges();
      expect(component.choice).toBe('eberron');
      expect(component.customDays).toEqual([]);

      component.value = null;
      component.ngOnChanges();
      expect(component.choice).toBe('');
    });

    it('the parent echoing an emission back does not reset the boxes', () => {
      component.onChoice('custom');
      component.onDayInput(0, 'Sul');
      component.addDay(); // boxes: ['Sul', ''] — value emitted so far is null

      component.value = emitted[emitted.length - 1]; // the null echo
      component.ngOnChanges();
      expect(component.choice).toBe('custom');
      expect(component.customDays).toEqual(['Sul', '']); // in-progress boxes survive

      component.onDayInput(1, 'Mol');
      component.value = emitted[emitted.length - 1]; // the ['Sul','Mol'] echo
      component.ngOnChanges();
      expect(component.customDays).toEqual(['Sul', 'Mol']); // not reseeded mid-typing
    });

    it('a genuinely external value change still resets the editor', () => {
      component.onChoice('custom');
      component.onDayInput(0, 'Sul');
      component.addDay();
      component.onDayInput(1, 'Mol'); // last emitted: ['Sul', 'Mol']

      component.value = [...eberron.days]; // external — not what was emitted
      component.ngOnChanges();
      expect(component.choice).toBe('eberron');
      expect(component.customDays).toEqual([]);
    });
  });
});
