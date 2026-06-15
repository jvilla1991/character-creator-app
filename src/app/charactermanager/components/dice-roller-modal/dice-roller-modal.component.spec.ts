import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { DiceRollerModalComponent } from './dice-roller-modal.component';

describe('DiceRollerModalComponent', () => {
  let component: DiceRollerModalComponent;
  let fixture: ComponentFixture<DiceRollerModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DiceRollerModalComponent],
      imports: [DragDropModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DiceRollerModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('adds dice to the field and counts them per type', () => {
    component.addDie(20);
    component.addDie(20);
    component.addDie(6);
    expect(component.totalDice).toBe(3);
    expect(component.countOf(20)).toBe(2);
    expect(component.countOf(6)).toBe(1);
  });

  it('removes a die only while staging', () => {
    component.addDie(8);
    const id = component.staged[0].id;
    component.removeDie(id);
    expect(component.totalDice).toBe(0);
  });

  it('cannot throw with an empty field', () => {
    expect(component.canThrow).toBeFalse();
    component.addDie(12);
    expect(component.canThrow).toBeTrue();
  });

  it('rolls every die into a valid face and totals them', fakeAsync(() => {
    component.addDie(6);
    component.addDie(20);
    component.throwButton();
    expect(component.phase).toBe('rolling');

    tick(5000); // let the flight + settle timers resolve
    expect(component.phase).toBe('result');

    for (const d of component.staged) {
      expect(d.value).toBeGreaterThanOrEqual(1);
      expect(d.value!).toBeLessThanOrEqual(d.sides);
    }
    const expectedTotal = component.staged.reduce((s, d) => s + (d.value ?? 0), 0);
    expect(component.grandTotal).toBe(expectedTotal);
  }));

  it('groups results into one breakdown row per die type', fakeAsync(() => {
    component.addDie(6);
    component.addDie(6);
    component.addDie(20);
    component.throwButton();
    tick(5000);

    const rows = component.breakdown;
    expect(rows.length).toBe(2);
    const d6row = rows.find(r => r.label.endsWith('d6'));
    expect(d6row?.rolls.length).toBe(2);
  }));

  it('emits close on cancel', () => {
    let closed = false;
    component.close.subscribe(() => (closed = true));
    component.cancel();
    expect(closed).toBeTrue();
  });
});
