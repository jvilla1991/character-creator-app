import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RestChooserComponent } from './rest-chooser.component';
import { RestType } from '../../../models/session';

describe('RestChooserComponent', () => {
  let fixture: ComponentFixture<RestChooserComponent>;
  let component: RestChooserComponent;

  const option = (type: RestType): HTMLButtonElement =>
    fixture.debugElement.query(By.css(`[data-rest="${type}"]`)).nativeElement;
  const callVote = (): HTMLButtonElement =>
    fixture.debugElement.query(By.css('[data-call-vote]')).nativeElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RestChooserComponent] }).compileComponents();
    fixture = TestBed.createComponent(RestChooserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('offers both rests with their length, short selected first', () => {
    expect(option('SHORT').textContent).toContain('Short Rest');
    expect(option('SHORT').textContent).toContain('1 hour');
    expect(option('LONG').textContent).toContain('Long Rest');
    expect(option('LONG').textContent).toContain('8 hours');
    expect(option('SHORT').getAttribute('aria-pressed')).toBe('true');
    expect(option('LONG').getAttribute('aria-pressed')).toBe('false');
    expect(callVote().textContent).toContain('Call the Short Rest Vote');
  });

  it('choosing a card only selects it; the vote is called by the primary button', () => {
    const chosen: RestType[] = [];
    component.chosen.subscribe(t => chosen.push(t));

    option('LONG').click();
    fixture.detectChanges();

    expect(chosen).toEqual([]);
    expect(option('LONG').getAttribute('aria-pressed')).toBe('true');
    expect(option('LONG').classList).toContain('selected');
    expect(callVote().textContent).toContain('Call the Long Rest Vote');

    callVote().click();
    expect(chosen).toEqual(['LONG']);
  });

  it('shows the long rest rules only while the long rest is selected', () => {
    expect(fixture.debugElement.query(By.css('.rest-notes'))).toBeNull();

    option('LONG').click();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.rest-notes')).nativeElement.textContent)
      .toContain('at least 1 Hit Point');
  });

  it('Cancel and a backdrop click both dismiss without calling a vote', () => {
    let dismissed = 0;
    let chosen = 0;
    component.dismissed.subscribe(() => dismissed++);
    component.chosen.subscribe(() => chosen++);

    const cancel: HTMLButtonElement =
      fixture.debugElement.query(By.css('.rest-actions .btn:not(.primary)')).nativeElement;
    cancel.click();
    fixture.debugElement.query(By.css('.modal-backdrop')).nativeElement.click();

    expect(dismissed).toBe(2);
    expect(chosen).toBe(0);
  });
});
