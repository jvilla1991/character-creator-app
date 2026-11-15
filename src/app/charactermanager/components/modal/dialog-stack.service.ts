import { DOCUMENT, Injectable, OnDestroy, inject } from '@angular/core';

/** What the stack needs from an open dialog. Implemented by `DialogDirective`. */
export interface StackedDialog {
  /** Escape reached this dialog (it is the topmost one). */
  requestDismiss(): void;
}

/**
 * The open dialogs, oldest first, and the one document-level Escape listener
 * they share. Only the topmost dialog hears Escape, so dismissing the dice
 * roller opened over the level-up dialog closes the dice roller alone.
 *
 * The listener is on the bubble phase and skips events a control already
 * handled (`defaultPrevented`), so a widget inside a dialog that uses Escape
 * for itself keeps it.
 */
@Injectable({ providedIn: 'root' })
export class DialogStack implements OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private readonly open: StackedDialog[] = [];
  private listening = false;

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const top = this.top();
    if (!top) return;
    // Claim the key even when the top dialog refuses to close, so a
    // non-dismissible dialog never lets Escape fall through to the one below.
    event.preventDefault();
    top.requestDismiss();
  };

  push(dialog: StackedDialog): void {
    this.remove(dialog);
    this.open.push(dialog);
    if (!this.listening) {
      this.doc.addEventListener('keydown', this.onKeydown);
      this.listening = true;
    }
  }

  remove(dialog: StackedDialog): void {
    const i = this.open.indexOf(dialog);
    if (i >= 0) this.open.splice(i, 1);
    if (this.open.length === 0) this.stopListening();
  }

  top(): StackedDialog | undefined {
    return this.open[this.open.length - 1];
  }

  get size(): number {
    return this.open.length;
  }

  ngOnDestroy(): void {
    this.open.length = 0;
    this.stopListening();
  }

  private stopListening(): void {
    if (!this.listening) return;
    this.doc.removeEventListener('keydown', this.onKeydown);
    this.listening = false;
  }
}
