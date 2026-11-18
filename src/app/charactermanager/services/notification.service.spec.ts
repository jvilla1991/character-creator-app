import { fakeAsync, tick } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let latest: string | null;

  beforeEach(() => {
    service = new NotificationService();
    service.message$.subscribe(m => (latest = m));
    spyOn(console, 'error');
  });

  it('error shows the fallback and logs the error', () => {
    const err = new Error('boom');
    service.error('Could not save the notes. Try again.', err);
    expect(latest).toBe('Could not save the notes. Try again.');
    expect(console.error).toHaveBeenCalledWith('Could not save the notes. Try again.', err);
  });

  it('error prefers the message a 4xx response carries', () => {
    service.error('Could not import.', { status: 400, error: { message: 'Unknown catalog keys: vorpal' } });
    expect(latest).toBe('Unknown catalog keys: vorpal');
  });

  it('error keeps the fallback for server errors and offline', () => {
    service.error('Could not save.', { status: 500, error: { message: 'NullPointerException' } });
    expect(latest).toBe('Could not save.');
    service.error('Could not save again.', { status: 0, error: { message: 'whatever' } });
    expect(latest).toBe('Could not save again.');
  });

  it('error ignores a blank server message', () => {
    service.error('Could not save.', { status: 409, error: { message: '  ' } });
    expect(latest).toBe('Could not save.');
  });

  it('error stays up longer than a confirmation', fakeAsync(() => {
    service.error('Could not save.');
    tick(4500);
    expect(latest).toBe('Could not save.');
    tick(1500);
    expect(latest).toBeNull();
  }));
});
