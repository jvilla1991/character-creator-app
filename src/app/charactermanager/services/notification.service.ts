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

  dismiss(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.messageSubject.next(null);
  }
}
