import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RestVoteModalComponent } from './rest-vote-modal.component';
import { RestVoteView } from '../../../models/session';

describe('RestVoteModalComponent', () => {
  let component: RestVoteModalComponent;
  let fixture: ComponentFixture<RestVoteModalComponent>;

  const vote = (overrides: Partial<RestVoteView> = {}): RestVoteView => ({
    voteId: 10,
    status: 'ACTIVE',
    initiatorParticipantId: 5,
    initiatorName: 'Gorath',
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
    votes: [
      { participantId: 5, displayName: 'Gorath', vote: true },
      { participantId: 6, displayName: 'Lyra', vote: false },
      { participantId: 7, displayName: 'Pip', vote: null },
    ],
    ...overrides,
  });

  /**
   * The component snapshots `Date.now()` once at construction and only refreshes
   * it on a 500ms tick, so a deadline built from a LATER `Date.now()` sits more
   * than N whole seconds away and `Math.ceil` reports N+1. A 1ms gap between
   * construction and the assertion is enough, which made the countdown spec pass
   * or fail depending on how fast the preceding setup ran.
   *
   * Freezing the clock before the component is constructed makes both references
   * the same instant — which is what the countdown assertions mean to compare —
   * and lets them assert exact values instead of a tolerance band.
   */
  let frozenNow: number;

  beforeEach(async () => {
    frozenNow = Date.now();
    spyOn(Date, 'now').and.returnValue(frozenNow);

    await TestBed.configureTestingModule({
      imports: [RestVoteModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RestVoteModalComponent);
    component = fixture.componentInstance;
  });

  it('renders the three ballot faces: green check, red cross, pending "?"', () => {
    fixture.componentRef.setInput('restVote', vote());
    fixture.detectChanges();

    const glyphs = fixture.debugElement.queryAll(By.css('.vote-glyph'));
    expect(glyphs.length).toBe(3);
    expect(glyphs[0].nativeElement.classList).toContain('yes');
    expect(glyphs[0].nativeElement.textContent).toContain('✓');
    expect(glyphs[1].nativeElement.classList).toContain('no');
    expect(glyphs[1].nativeElement.textContent).toContain('✕');
    expect(glyphs[2].nativeElement.classList).toContain('pending');
    expect(glyphs[2].nativeElement.textContent).toContain('?');
  });

  it('player face is a blocking modal with Yes/No while the own ballot is unanswered', () => {
    fixture.componentRef.setInput('restVote', vote());
    fixture.componentRef.setInput('myParticipantId', 7); // Pip — hasn't voted
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.modal-backdrop'))).toBeTruthy();
    const buttons = fixture.debugElement.queryAll(By.css('.vote-actions .btn'));
    expect(buttons.length).toBe(2);

    const cast: boolean[] = [];
    component.voteCast.subscribe(v => cast.push(v));
    buttons[0].nativeElement.click(); // Rest (yes)
    buttons[1].nativeElement.click(); // Keep going (no)
    expect(cast).toEqual([true, false]);
  });

  it('hides the vote buttons once the viewer has answered', () => {
    fixture.componentRef.setInput('restVote', vote());
    fixture.componentRef.setInput('myParticipantId', 5); // Gorath — already yes
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.vote-actions'))).toBeFalsy();
    expect(fixture.debugElement.query(By.css('.vote-waiting'))).toBeTruthy();
  });

  it('viewer without a ballot (late joiner) watches without vote buttons', () => {
    fixture.componentRef.setInput('restVote', vote());
    fixture.componentRef.setInput('myParticipantId', 99);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.vote-actions'))).toBeFalsy();
  });

  it('DM face is a non-blocking panel whose Allow/Deny emit the override', () => {
    fixture.componentRef.setInput('restVote', vote());
    fixture.componentRef.setInput('dm', true);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.modal-backdrop'))).toBeFalsy();
    expect(fixture.debugElement.query(By.css('.rest-vote-banner'))).toBeTruthy();

    const overrides: boolean[] = [];
    component.overrideCast.subscribe(v => overrides.push(v));
    const buttons = fixture.debugElement.queryAll(By.css('.vote-actions .btn'));
    expect(buttons.length).toBe(2);
    buttons[0].nativeElement.click(); // Allow
    buttons[1].nativeElement.click(); // Deny
    expect(overrides).toEqual([true, false]);
  });

  it('counts down from the server deadline, clamped at zero', () => {
    fixture.componentRef.setInput('restVote', vote({ expiresAt: new Date(frozenNow + 30_000).toISOString() }));
    fixture.detectChanges();
    expect(component.secondsLeft()).toBe(30);

    fixture.componentRef.setInput('restVote', vote({ expiresAt: new Date(frozenNow - 5_000).toISOString() }));
    fixture.detectChanges();
    expect(component.secondsLeft()).toBe(0);
  });

  describe('screen-reader countdown', () => {
    /** Move the component's clock (the 500ms tick writes the same signal). */
    const advanceTo = (ms: number) => component['now'].set(frozenNow + ms);
    const status = () => fixture.debugElement.queryAll(By.css('[role="status"]'));

    for (const dm of [false, true]) {
      it(`speaks only at open, at ten seconds and at zero (${dm ? 'DM' : 'player'} face)`, () => {
        fixture.componentRef.setInput('restVote', vote({ expiresAt: new Date(frozenNow + 60_000).toISOString() }));
        fixture.componentRef.setInput('dm', dm);
        fixture.componentRef.setInput('myParticipantId', 7);
        fixture.detectChanges();

        // One hidden status line, empty at creation so the opening line is
        // a change the reader announces.
        expect(status().length).toBe(1);
        expect(component.countdownAnnouncement()).toBe('');

        advanceTo(500);
        const opening = component.countdownAnnouncement();
        expect(opening).toBe('Gorath calls for a short rest. Every hero must agree.');

        // Every tick from 59s down to 11s leaves the spoken text unchanged.
        for (let left = 59; left > 10; left--) {
          advanceTo(60_000 - left * 1000);
          expect(component.countdownAnnouncement()).toBe(opening);
        }

        advanceTo(50_000);
        expect(component.countdownAnnouncement()).toBe('Ten seconds left in the short rest vote.');
        advanceTo(55_000);
        expect(component.countdownAnnouncement()).toBe('Ten seconds left in the short rest vote.');

        advanceTo(60_000);
        expect(component.countdownAnnouncement()).toBe('Time is up for the short rest vote.');
      });

      it(`keeps the ticking number out of every live region (${dm ? 'DM' : 'player'} face)`, () => {
        fixture.componentRef.setInput('restVote', vote());
        fixture.componentRef.setInput('dm', dm);
        fixture.detectChanges();

        const countdown: HTMLElement = fixture.debugElement.query(By.css('.vote-countdown')).nativeElement;
        expect(countdown.closest('[aria-live], [role="status"], [role="alert"]')).toBeNull();
      });
    }
  });
});
