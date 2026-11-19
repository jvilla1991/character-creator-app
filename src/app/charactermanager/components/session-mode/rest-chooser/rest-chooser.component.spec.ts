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

    const notes = fixture.debugElement.query(By.css('.rest-notes')).nativeElement.textContent;
    expect(notes).toContain('at least 1 Hit Point');
    expect(notes).toContain('The party can take one long rest every 24 hours.');
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

describe('RestChooserComponent when a long rest is not available', () => {
  let fixture: ComponentFixture<RestChooserComponent>;
  let component: RestChooserComponent;
  const reason = 'The party finished a long rest this morning. The next one can start tonight.';

  const long = (): HTMLButtonElement => fixture.debugElement.query(By.css('[data-rest="LONG"]')).nativeElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RestChooserComponent] }).compileComponents();
    fixture = TestBed.createComponent(RestChooserComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('longRestBlocked', reason);
    fixture.detectChanges();
  });

  it('disables the Long Rest card and writes the reason on it', () => {
    expect(long().disabled).toBeTrue();
    expect(long().textContent).toContain(reason);
    expect(long().textContent).not.toContain('All Hit Points');
    expect(getComputedStyle(long()).borderTopStyle).toBe('dashed'); // the house disabled look
  });

  it('cannot be chosen, so the vote stays a short rest', () => {
    const chosen: RestType[] = [];
    component.chosen.subscribe(t => chosen.push(t));

    long().click();
    component.select('LONG'); // even called directly
    fixture.detectChanges();

    expect(component.selected()).toBe('SHORT');
    fixture.debugElement.query(By.css('[data-call-vote]')).nativeElement.click();
    expect(chosen).toEqual(['SHORT']);
  });

  it('falls back to the short rest if the long rest becomes unavailable after it was picked', () => {
    fixture.componentRef.setInput('longRestBlocked', null);
    fixture.detectChanges();
    long().click();
    fixture.detectChanges();
    expect(component.selected()).toBe('LONG');

    fixture.componentRef.setInput('longRestBlocked', reason);
    fixture.detectChanges();

    expect(component.selected()).toBe('SHORT');
    expect(fixture.debugElement.query(By.css('[data-call-vote]')).nativeElement.textContent)
      .toContain('Call the Short Rest Vote');
  });
});
