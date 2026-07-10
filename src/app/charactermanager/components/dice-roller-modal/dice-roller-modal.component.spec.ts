import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { of } from 'rxjs';
import { DiceRollerModalComponent } from './dice-roller-modal.component';
import { SessionService } from '../../services/session.service';
import { SessionState } from '../../models/session';

describe('DiceRollerModalComponent', () => {
  let component: DiceRollerModalComponent;
  let fixture: ComponentFixture<DiceRollerModalComponent>;
  let sessionService: jasmine.SpyObj<SessionService>;

  beforeEach(async () => {
    sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['logRoll']);
    sessionService.logRoll.and.returnValue(of({} as SessionState));

    await TestBed.configureTestingModule({
      declarations: [DiceRollerModalComponent],
      imports: [DragDropModule],
      providers: [{ provide: SessionService, useValue: sessionService }],
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

  // ── Grab-and-throw cluster gesture ────────────────────────────────────────
  // Synthetic PointerEvent-shaped objects, calling the handler methods
  // directly — matches this file's existing style of calling component
  // methods rather than dispatching real DOM events.

  function pointerEvent(x: number, y: number): PointerEvent {
    return {
      clientX: x,
      clientY: y,
      pointerId: 1,
      target: { setPointerCapture: () => undefined },
      preventDefault: () => undefined,
    } as unknown as PointerEvent;
  }

  beforeEach(() => {
    // Deterministic clock for gesture timing — real performance.now() would
    // make elapsed/velocity assertions flaky.
    let now = 0;
    spyOn(performance, 'now').and.callFake(() => now);
    (window as any).__advanceClock = (ms: number) => (now += ms);
  });

  it('a tap on the cluster (minimal movement, short duration) rolls at power 0.45', () => {
    component.addDie(6);
    component.onClusterPointerDown(pointerEvent(100, 100));
    (window as any).__advanceClock(50);
    component.onClusterPointerUp(pointerEvent(102, 101)); // 2px move, well under threshold

    expect(component.phase).toBe('rolling');
  });

  it('a slow drag below the flick threshold drops in place without rolling', () => {
    component.addDie(6);
    component.onClusterPointerDown(pointerEvent(100, 100));
    (window as any).__advanceClock(50);
    component.onClusterPointerMove(pointerEvent(120, 100)); // 20px over 50ms = 0.4px/ms
    (window as any).__advanceClock(400);
    component.onClusterPointerUp(pointerEvent(120, 100));

    expect(component.phase).toBe('staging');
    expect(component.canThrow).toBeTrue();
  });

  it('a fast flick above the threshold throws', () => {
    component.addDie(6);
    component.onClusterPointerDown(pointerEvent(100, 100));
    (window as any).__advanceClock(10);
    component.onClusterPointerMove(pointerEvent(300, 100)); // 200px over 10ms = 20px/ms
    component.onClusterPointerUp(pointerEvent(300, 100));

    expect(component.phase).toBe('rolling');
  });

  it('pointercancel resets drag state without rolling', () => {
    component.addDie(6);
    component.onClusterPointerDown(pointerEvent(100, 100));
    (window as any).__advanceClock(10);
    component.onClusterPointerMove(pointerEvent(300, 100));
    component.onClusterPointerCancel();

    expect(component.dragging).toBeFalse();
    expect(component.clusterX).toBe(0);
    expect(component.clusterY).toBe(0);
    expect(component.phase).toBe('staging');
  });

  // ── computeVelocity: pure function, direct unit tests ─────────────────────

  it('computeVelocity returns straight-line px/ms from the oldest windowed sample to release', () => {
    const samples = [{ x: 0, y: 0, t: 0 }];
    expect(component.computeVelocity(samples, { x: 100, y: 0, t: 100 })).toBeCloseTo(1, 5); // 100px / 100ms
  });

  it('computeVelocity handles diagonal movement via hypot', () => {
    const samples = [{ x: 0, y: 0, t: 0 }];
    // 30px / 100ms and 40px / 100ms → hypot(0.3, 0.4) = 0.5 px/ms
    expect(component.computeVelocity(samples, { x: 30, y: 40, t: 100 })).toBeCloseTo(0.5, 5);
  });

  it('computeVelocity uses only the oldest sample in the window, not a per-frame sum', () => {
    const samples = [
      { x: 0, y: 0, t: 0 },
      { x: 5, y: 0, t: 20 },
      { x: 40, y: 0, t: 40 },
    ];
    // straight line from the oldest sample (0,0 @ t=0) to release (100,0 @ t=100)
    expect(component.computeVelocity(samples, { x: 100, y: 0, t: 100 })).toBeCloseTo(1, 5);
  });

  it('computeVelocity returns 0 for an empty sample list', () => {
    expect(component.computeVelocity([], { x: 100, y: 0, t: 100 })).toBe(0);
  });

  it('computeVelocity avoids division by zero on a zero-duration window', () => {
    const samples = [{ x: 0, y: 0, t: 100 }];
    // dt is floored at 1ms — must not throw or return Infinity/NaN
    expect(Number.isFinite(component.computeVelocity(samples, { x: 5, y: 0, t: 100 }))).toBeTrue();
  });
  it('logs the roll to the session when sessionId and participantId are set', fakeAsync(() => {
    component.sessionId = 42;
    component.participantId = 7;
    component.addDie(6);
    component.addDie(6);
    component.throwButton();
    tick(5000);

    expect(sessionService.logRoll).toHaveBeenCalledTimes(1);
    const [sessionId, participantId, groups] = sessionService.logRoll.calls.mostRecent().args;
    expect(sessionId).toBe(42);
    expect(participantId).toBe(7);
    expect(groups.length).toBe(1);
    expect(groups[0].sides).toBe(6);
    expect(groups[0].rolls.length).toBe(2);
  }));

  it('does not log when sessionId is null (standalone/no-session roll)', fakeAsync(() => {
    component.sessionId = null;
    component.participantId = 7;
    component.addDie(6);
    component.throwButton();
    tick(5000);

    expect(sessionService.logRoll).not.toHaveBeenCalled();
  }));

  it('does not log when participantId is null', fakeAsync(() => {
    component.sessionId = 42;
    component.participantId = null;
    component.addDie(6);
    component.throwButton();
    tick(5000);

    expect(sessionService.logRoll).not.toHaveBeenCalled();
  }));
});
