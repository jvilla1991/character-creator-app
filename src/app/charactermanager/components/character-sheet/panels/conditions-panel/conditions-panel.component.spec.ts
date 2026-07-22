import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
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

  // --- Heroic Inspiration meter (same gesture as the exhaustion tracker) ---

  it('reads 0 pips for a pc saved before the field existed', () => {
    expect(component.inspirationPips).toBe(0);
  });

  it('clicking a pip above the meter emits that value', () => {
    component.pc = { ...component.pc, inspirationPips: 1 };
    const emitted = jasmine.createSpy('emitted');
    component.inspirationChanged.subscribe(emitted);

    component.setInspiration(3);

    expect(emitted).toHaveBeenCalledWith(3);
  });

  it('re-clicking the top filled pip lowers the meter (no minus button needed)', () => {
    component.pc = { ...component.pc, inspirationPips: 3 };
    const emitted = jasmine.createSpy('emitted');
    component.inspirationChanged.subscribe(emitted);

    component.setInspiration(3);

    expect(emitted).toHaveBeenCalledWith(2);
  });

  it('clicking the only lit pip clears the meter to 0', () => {
    component.pc = { ...component.pc, inspirationPips: 1 };
    const emitted = jasmine.createSpy('emitted');
    component.inspirationChanged.subscribe(emitted);

    component.setInspiration(1);

    expect(emitted).toHaveBeenCalledWith(0);
  });

  it('clicking the fifth pip emits a full meter (the server grants the badge)', () => {
    const emitted = jasmine.createSpy('emitted');
    component.inspirationChanged.subscribe(emitted);

    component.setInspiration(5);

    expect(emitted).toHaveBeenCalledWith(5);
  });

  it('only the DM may move the meter; owner or DM may spend the badge', () => {
    component.editable = false;
    component.ownSheet = true;
    expect(component.canAwardInspiration).toBeFalse();
    expect(component.canUseInspiration).toBeTrue();

    component.editable = true;
    expect(component.canAwardInspiration).toBeTrue();
  });
});

// The specs above drive the class directly. These render the real template, so a
// markup regression in the meter (missing pips, a pip that stops emitting) fails
// here instead of reaching the table.
describe('ConditionsPanelComponent (rendered)', () => {
  let fixture: ComponentFixture<ConditionsPanelComponent>;
  let component: ConditionsPanelComponent;

  const basePc = { id: 1, name: 'X', clazz: 'Fighter', level: 4, playerName: 'P' } as PC;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ConditionsPanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConditionsPanelComponent);
    component = fixture.componentInstance;
    component.pc = basePc;
  });

  const pips = () =>
    fixture.debugElement.queryAll(By.css('.inspiration-tracker .insp-pip'));

  it('renders five pips, filled up to the current meter', () => {
    component.pc = { ...basePc, inspirationPips: 3 };
    fixture.detectChanges();

    expect(pips().length).toBe(5);
    expect(pips().filter(p => p.nativeElement.classList.contains('filled')).length).toBe(3);
  });

  it('renders the pips as buttons for the DM and as plain dots otherwise', () => {
    component.editable = false;
    fixture.detectChanges();
    expect(pips().every(p => p.nativeElement.tagName === 'SPAN')).toBeTrue();

    component.editable = true;
    fixture.detectChanges();
    expect(pips().every(p => p.nativeElement.tagName === 'BUTTON')).toBeTrue();
  });

  it('clicking a rendered pip emits the new meter value', () => {
    component.editable = true;
    component.pc = { ...basePc, inspirationPips: 1 };
    fixture.detectChanges();

    const emitted = jasmine.createSpy('emitted');
    component.inspirationChanged.subscribe(emitted);
    pips()[3].nativeElement.click(); // the 4th pip

    expect(emitted).toHaveBeenCalledWith(4);
  });

  it('shows the Inspired badge only once Heroic Inspiration is granted', () => {
    component.editable = true;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.inspired-badge'))).toBeNull();

    component.pc = { ...basePc, heroicInspiration: true };
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.inspired-badge'))).not.toBeNull();
  });

  it('the meter sits inside the Conditions panel, under the exhaustion tracker', () => {
    fixture.detectChanges();
    const blocks = fixture.debugElement.queryAll(
      By.css('.exhaustion-tracker, .inspiration-tracker'));

    expect(blocks.length).toBe(2);
    expect(blocks[0].nativeElement.classList).toContain('exhaustion-tracker');
    expect(blocks[1].nativeElement.classList).toContain('inspiration-tracker');
  });
});
