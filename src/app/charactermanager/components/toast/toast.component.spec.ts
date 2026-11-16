import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { ToastComponent } from './toast.component';
import { NotificationService } from '../../services/notification.service';

describe('ToastComponent', () => {
  let fixture: ComponentFixture<ToastComponent>;
  let message$: BehaviorSubject<string | null>;
  let dismiss: jasmine.Spy;

  beforeEach(() => {
    message$ = new BehaviorSubject<string | null>(null);
    dismiss = jasmine.createSpy('dismiss').and.callFake(() => message$.next(null));
    TestBed.configureTestingModule({
      imports: [ToastComponent],
      providers: [{ provide: NotificationService, useValue: { message$, dismiss } }],
    });
    fixture = TestBed.createComponent(ToastComponent);
    fixture.detectChanges();
  });

  const el = (): HTMLElement => fixture.nativeElement;

  it('keeps an empty status region in the page before any message', () => {
    const status = el().querySelector('[role="status"]')!;
    expect(status).not.toBeNull();
    expect(status.textContent!.trim()).toBe('');
    expect(el().querySelector('.toast')).toBeNull();
  });

  it('speaks the message through that region, which holds no button', () => {
    const status = el().querySelector('[role="status"]')!;
    message$.next('The DM ended the session.');
    fixture.detectChanges();

    expect(el().querySelector('[role="status"]')).toBe(status);
    expect(status.textContent!.trim()).toBe('The DM ended the session.');
    expect(status.querySelector('button')).toBeNull();
  });

  it('can be dismissed from the keyboard with a labelled button', () => {
    message$.next('Saved.');
    fixture.detectChanges();

    const button: HTMLButtonElement = el().querySelector('.toast button')!;
    expect(button.getAttribute('aria-label')).toBe('Dismiss notification');
    button.click();
    fixture.detectChanges();

    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(el().querySelector('.toast')).toBeNull();
  });
});
