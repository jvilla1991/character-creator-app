import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Subject, of, throwError } from 'rxjs';
import { CombatLogEntry, CombatLogPage } from '../../../models/session';
import { SessionService } from '../../../services/session.service';
import { CombatLogPanelComponent } from './combat-log-panel.component';

describe('CombatLogPanelComponent', () => {
  let fixture: ComponentFixture<CombatLogPanelComponent>;
  let component: CombatLogPanelComponent;
  let sessionService: jasmine.SpyObj<SessionService>;

  const entry = (overrides: Partial<CombatLogEntry> = {}): CombatLogEntry => ({
    id: 1,
    type: 'DAMAGE',
    subject: 'Goblin 2',
    description: 'Took 7 damage. HP 12 → 5.',
    round: 2,
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  /** A page of `count` rows out of `total`, ids counting down from the newest. */
  const pageOf = (page: number, count: number, total: number): CombatLogPage => ({
    entries: Array.from({ length: count }, (_, i) => entry({ id: total - page * 10 - i })),
    page, size: 10, total,
  });

  const text = (): string => fixture.nativeElement.textContent;
  const rows = () => fixture.debugElement.queryAll(By.css('.combat-log-row'));
  const button = (attr: string): HTMLButtonElement =>
    fixture.debugElement.query(By.css(`button[${attr}]`)).nativeElement;

  beforeEach(async () => {
    sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['getCombatLog']);
    sessionService.getCombatLog.and.returnValue(of(pageOf(0, 0, 0)));

    await TestBed.configureTestingModule({
      imports: [CombatLogPanelComponent],
      providers: [{ provide: SessionService, useValue: sessionService }],
    }).compileComponents();

    fixture = TestBed.createComponent(CombatLogPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('sessionId', 3);
  });

  it('reads the first page of its session and shows one row per change', () => {
    sessionService.getCombatLog.and.returnValue(of({
      entries: [
        entry({ id: 2, subject: 'Thorin', type: 'HEALING', description: 'Healed 5. HP 3 → 8.', round: null }),
        entry({ id: 1 }),
      ],
      page: 0, size: 10, total: 2,
    }));

    fixture.detectChanges();

    expect(sessionService.getCombatLog).toHaveBeenCalledOnceWith(3, 0);
    expect(rows().length).toBe(2);
    expect(text()).toContain('Thorin');
    expect(text()).toContain('Healed 5. HP 3 → 8.');
    expect(text()).toContain('Goblin 2');
    expect(text()).toContain('Round 2');
    expect(text()).toContain('Outside an encounter');
  });

  it('marks each row with its kind of change', () => {
    sessionService.getCombatLog.and.returnValue(of({
      entries: [entry({ id: 2, type: 'CONDITION' }), entry({ id: 1, type: 'DAMAGE' })],
      page: 0, size: 10, total: 2,
    }));

    fixture.detectChanges();

    expect(rows().map(r => r.nativeElement.getAttribute('data-type'))).toEqual(['CONDITION', 'DAMAGE']);
  });

  it('says so when nothing has changed yet, and offers no pager', () => {
    fixture.detectChanges();

    expect(text()).toContain('No health or condition changes yet this session.');
    expect(fixture.debugElement.query(By.css('.combat-log-pager'))).toBeNull();
  });

  it('hides the pager while everything fits on one page', () => {
    sessionService.getCombatLog.and.returnValue(of(pageOf(0, 10, 10)));

    fixture.detectChanges();

    expect(rows().length).toBe(10);
    expect(fixture.debugElement.query(By.css('.combat-log-pager'))).toBeNull();
  });

  it('pages back through older rows and forward again', () => {
    sessionService.getCombatLog.and.callFake((_id, page = 0) =>
      of(pageOf(page, page === 2 ? 3 : 10, 23)));
    fixture.detectChanges();

    expect(text()).toContain('Page 1 of 3');
    expect(button('data-newer').disabled).toBeTrue();
    expect(button('data-older').disabled).toBeFalse();

    button('data-older').click();
    fixture.detectChanges();
    expect(sessionService.getCombatLog).toHaveBeenCalledWith(3, 1);
    expect(text()).toContain('Page 2 of 3');

    button('data-older').click();
    fixture.detectChanges();
    expect(text()).toContain('Page 3 of 3');
    expect(rows().length).toBe(3);
    expect(button('data-older').disabled).toBeTrue();

    button('data-newer').click();
    fixture.detectChanges();
    expect(text()).toContain('Page 2 of 3');
    expect(sessionService.getCombatLog.calls.mostRecent().args).toEqual([3, 1]);
  });

  it('reads the page it is on again when the session version moves', () => {
    sessionService.getCombatLog.and.callFake((_id, page = 0) => of(pageOf(page, 10, 23)));
    fixture.detectChanges();
    button('data-older').click();
    fixture.detectChanges();
    sessionService.getCombatLog.calls.reset();

    fixture.componentRef.setInput('version', 8);
    fixture.detectChanges();

    expect(sessionService.getCombatLog).toHaveBeenCalledOnceWith(3, 1);
  });

  it('does not read again while nothing changes', () => {
    fixture.componentRef.setInput('version', 4);
    fixture.detectChanges();
    sessionService.getCombatLog.calls.reset();

    fixture.componentRef.setInput('version', 4);
    fixture.detectChanges();

    expect(sessionService.getCombatLog).not.toHaveBeenCalled();
  });

  it('steps back to the last real page when the one it asked for is past the end', () => {
    // On page 3 of 3, then the log is found shorter (two pages).
    let total = 23;
    sessionService.getCombatLog.and.callFake((_id, page = 0) => {
      const count = Math.max(0, Math.min(10, total - page * 10));
      return of(pageOf(page, count, total));
    });
    fixture.detectChanges();
    button('data-older').click();
    fixture.detectChanges();
    button('data-older').click();
    fixture.detectChanges();
    expect(component.page()).toBe(2);

    total = 14;
    fixture.componentRef.setInput('version', 9);
    fixture.detectChanges(); // asks for page 3, learns there are two
    fixture.detectChanges(); // reads page 2

    expect(component.page()).toBe(1);
    expect(text()).toContain('Page 2 of 2');
    expect(rows().length).toBe(4);
  });

  it('keeps the rows on screen and says so when a read fails, then recovers', () => {
    sessionService.getCombatLog.and.returnValue(of(pageOf(0, 2, 2)));
    fixture.detectChanges();
    expect(rows().length).toBe(2);

    sessionService.getCombatLog.and.returnValue(throwError(() => ({ status: 500 })));
    fixture.componentRef.setInput('version', 5);
    fixture.detectChanges();

    expect(text()).toContain('Could not load the combat log.');
    expect(rows().length).toBe(2);

    sessionService.getCombatLog.and.returnValue(of(pageOf(0, 3, 3)));
    fixture.componentRef.setInput('version', 6);
    fixture.detectChanges();

    expect(text()).not.toContain('Could not load the combat log.');
    expect(rows().length).toBe(3);
  });

  it('lets a newer read win over a slow older one', () => {
    const slow = new Subject<CombatLogPage>();
    sessionService.getCombatLog.and.returnValue(slow);
    fixture.detectChanges();

    sessionService.getCombatLog.and.returnValue(of(pageOf(0, 3, 3)));
    fixture.componentRef.setInput('version', 2);
    fixture.detectChanges();
    expect(rows().length).toBe(3);

    slow.next(pageOf(0, 1, 1)); // the stale answer arrives late
    fixture.detectChanges();

    expect(rows().length).toBe(3);
  });
});
