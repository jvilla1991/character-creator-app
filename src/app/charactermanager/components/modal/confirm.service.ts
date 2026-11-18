import { Injectable, signal } from '@angular/core';
import { Observable, filter, map } from 'rxjs';

/** What a destructive-action confirmation says. */
export interface ConfirmRequest {
  /** Dialog title — names the action ("Delete Encounter"). */
  title: string;
  /** The thing being acted on, shown emphasised at the head of the message. */
  subject?: string;
  /** What will happen, and whether it can be undone. */
  message: string;
  /** The destructive button's label — repeats the action ("Delete Encounter"). */
  confirmLabel: string;
  cancelLabel?: string;
}

/** The request the host is showing, with the answer channel. */
export interface PendingConfirm extends ConfirmRequest {
  settle(confirmed: boolean): void;
}

/**
 * One crimson confirmation dialog for destructive actions, rendered once at the
 * app shell by `ConfirmHostComponent` on the shared `<app-modal>` shell (so it
 * gets Escape, focus-in, the Tab trap and focus return like every dialog).
 *
 * ```ts
 * this.confirmations.confirm({ title: 'Delete Encounter', subject: e.name,
 *   message: '…This cannot be undone.', confirmLabel: 'Delete Encounter' })
 *   .subscribe(() => this.reallyDelete());
 * ```
 *
 * Only one is open at a time: a new request cancels the one before it.
 * Unsubscribing (the caller was destroyed) closes it.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly current = signal<PendingConfirm | null>(null);
  readonly request = this.current.asReadonly();

  /** Emits `true` (confirmed) or `false` (cancelled, Escape, backdrop), then completes. */
  ask(request: ConfirmRequest): Observable<boolean> {
    return new Observable<boolean>(subscriber => {
      this.current()?.settle(false);
      const pending: PendingConfirm = {
        ...request,
        settle: confirmed => {
          if (this.current() !== pending) return;
          this.current.set(null);
          subscriber.next(confirmed);
          subscriber.complete();
        },
      };
      this.current.set(pending);
      return () => {
        if (this.current() === pending) this.current.set(null);
      };
    });
  }

  /** Emits once, only if the user confirmed. */
  confirm(request: ConfirmRequest): Observable<void> {
    return this.ask(request).pipe(filter(Boolean), map(() => undefined));
  }
}
