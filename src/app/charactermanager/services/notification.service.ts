import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Tiny app-wide channel for transient, themed toasts — one message at a time,
 * auto-cleared after a timeout. Rendered by ToastComponent at the app shell so a
 * toast survives the view it was raised from closing (e.g. a session ending and
 * routing the player back to their sheet).
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private messageSubject = new BehaviorSubject<string | null>(null);
  message$ = this.messageSubject.asObservable();

  private timer: ReturnType<typeof setTimeout> | null = null;

  notify(message: string, durationMs = 4000): void {
    this.messageSubject.next(message);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.messageSubject.next(null), durationMs);
  }

  /**
   * Report a request that failed, so it never fails silently. Shows the
   * server's own message when it sent one for a request it refused (4xx —
   * e.g. "Unknown catalog keys: …"), otherwise `fallback`, which should name
   * what did not happen and how to recover ("Could not save the notes. Try
   * again."). Server errors, timeouts and offline (status 0) get `fallback`:
   * their bodies are not written for players. The error is still logged for
   * debugging. Held a little longer than a confirmation toast, since it asks
   * the reader to act.
   */
  error(fallback: string, err?: unknown): void {
    console.error(fallback, err);
    this.notify(serverMessage(err) ?? fallback, 6000);
  }

  dismiss(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.messageSubject.next(null);
  }
}

/** The message a 4xx response carries in its body, if any. */
function serverMessage(err: unknown): string | null {
  const e = err as { status?: number; error?: { message?: unknown } } | null | undefined;
  const status = e?.status ?? 0;
  const message = e?.error?.message;
  return status >= 400 && status < 500 && typeof message === 'string' && message.trim()
    ? message.trim()
    : null;
}
