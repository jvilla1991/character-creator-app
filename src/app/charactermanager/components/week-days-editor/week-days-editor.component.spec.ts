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
    expect(component.dirty).toBeFalse();
  });

  it('emits null for "no defined week"', () => {
    component.onChoice('eberron');
    component.onChoice('');
    expect(emitted[emitted.length - 1]).toBeNull();
  });

  describe('custom mode', () => {
    it('choosing Custom… spawns one empty box and clears the value (null)', () => {
      component.onChoice('custom');
      expect(component.customDays).toEqual(['']);
      expect(emitted).toEqual([null]); // pending days aren\'t the value yet
      expect(component.dirty).toBeTrue();
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

    it('typing never emits — Inscribe locks the trimmed, deduped days in', () => {
      component.onChoice('custom');
      component.onDayInput(0, ' Sul ');
      component.addDay();
      component.onDayInput(1, 'Mol');
      component.addDay();
      component.onDayInput(2, 'sul'); // dup, case-insensitive
      component.addDay();
      component.onDayInput(3, '   '); // blank — dropped
      expect(emitted).toEqual([null]); // still only the Custom… clear

      component.inscribe();
      expect(emitted[emitted.length - 1]).toEqual(['Sul', 'Mol']);
      expect(component.customDays).toEqual(['Sul', 'Mol']); // boxes normalized
      expect(component.inscribed).toBeTrue();
      expect(component.dirty).toBeFalse();
      expect(component.preview).toEqual(['Sul', 'Mol']);
    });

    it('Inscribe is gated on at least 2 non-blank days', () => {
      component.onChoice('custom');
      component.onDayInput(0, 'Sul');
      expect(component.canInscribe).toBeFalse();
      component.inscribe(); // guarded no-op
      expect(emitted).toEqual([null]);

      component.addDay();
      component.onDayInput(1, 'Mol');
      expect(component.canInscribe).toBeTrue();
    });

    it('editing an inscribed box re-opens the week until re-inscribed', () => {
      component.onChoice('custom');
      component.onDayInput(0, 'Sul');
      component.addDay();
      component.onDayInput(1, 'Mol');
      component.inscribe();

      component.onDayInput(1, 'Zol');
      expect(component.dirty).toBeTrue();
      expect(component.preview).toBeNull(); // pending — nothing locked in to show
      expect(emitted.length).toBe(2);       // no emit until re-inscribed

      component.inscribe();
      expect(emitted[emitted.length - 1]).toEqual(['Sul', 'Zol']);
    });
  });

  describe('ngOnChanges (seeding from the bound value)', () => {
    it('seeds one box per existing custom day, already inscribed, "+" available', () => {
      component.value = ['Sul', 'Mol'];
      component.ngOnChanges();
      expect(component.choice).toBe('custom');
      expect(component.customDays).toEqual(['Sul', 'Mol']);
      expect(component.inscribed).toBeTrue();
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

    it('the null echo from choosing Custom… does not wipe the in-progress boxes', () => {
      component.value = [...eberron.days];
      component.ngOnChanges();
      component.onChoice('custom'); // emits null; a bound parent writes it back
      component.value = null;
      component.ngOnChanges();
      expect(component.choice).toBe('custom');
      expect(component.customDays).toEqual([...eberron.days]); // seeded boxes survive
    });
  });
});
