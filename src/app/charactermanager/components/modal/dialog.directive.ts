import {
  DOCUMENT, Directive, ElementRef, Injector, OnDestroy, afterNextRender, effect, inject, input,
  output, untracked,
} from '@angular/core';
import { FocusTrap, FocusTrapFactory, InteractivityChecker } from '@angular/cdk/a11y';
import { DialogStack, StackedDialog } from './dialog-stack.service';

const TABBABLE = [
  'button', 'a[href]', 'input', 'select', 'textarea', 'summary',
  '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]',
].join(',');

/**
 * The behaviour every dialog in the app shares, in one place instead of wired
 * dialog by dialog:
 *
 * - `role` + `aria-modal` on the host while it is active;
 * - **Escape** dismisses it, but only when it is the topmost open dialog
 *   (`DialogStack`); `dialogDismissible = false` keeps it open and still stops
 *   Escape reaching the dialog underneath;
 * - **focus moves in** on open: `[cdkFocusInitial]`, then `[autofocus]`, then
 *   the first tabbable control (a shell close button marked
 *   `data-dialog-close` only if nothing else is), then the dialog itself;
 * - **Tab is trapped** inside (CDK `FocusTrap`);
 * - **focus returns** to whatever opened it when it closes.
 *
 * The host decides what dismissing means by handling `(dismiss)` — guard a
 * submit in flight, or ignore it. `<app-modal>` is the visual shell built on
 * this; dialogs with their own chrome (dice roller, settings, wizard, the
 * mobile drawer) put `appDialog` on their root directly.
 *
 * `dialogActive` lets an element that is always in the DOM (the drawer) be a
 * dialog only while it is open.
 */
@Directive({
  selector: '[appDialog]',
  host: {
    '[attr.role]': 'active() ? dialogRole() : null',
    '[attr.aria-modal]': 'active() ? "true" : null',
    '[attr.tabindex]': 'active() ? "-1" : null',
    '[class.dialog-active]': 'active()',
  },
})
export class DialogDirective implements StackedDialog, OnDestroy {
  readonly dialogRole = input<'dialog' | 'alertdialog'>('dialog');
  readonly active = input(true, { alias: 'dialogActive' });
  readonly dismissible = input(true, { alias: 'dialogDismissible' });
  readonly dismiss = output<void>();

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly doc = inject(DOCUMENT);
  private readonly stack = inject(DialogStack);
  private readonly trapFactory = inject(FocusTrapFactory);
  private readonly checker = inject(InteractivityChecker);
  private readonly injector = inject(Injector);

  private trap: FocusTrap | null = null;
  private opener: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const on = this.active();
      untracked(() => (on ? this.activate() : this.deactivate()));
    });
  }

  requestDismiss(): void {
    if (this.dismissible()) this.dismiss.emit();
  }

  ngOnDestroy(): void {
    this.deactivate();
  }

  private activate(): void {
    if (this.trap) return;
    const focused = this.doc.activeElement;
    this.opener = focused instanceof HTMLElement && focused !== this.doc.body ? focused : null;
    this.trap = this.trapFactory.create(this.el.nativeElement);
    this.stack.push(this);
    afterNextRender(() => this.focusInitial(), { injector: this.injector });
  }

  private deactivate(): void {
    if (!this.trap) return;
    this.trap.destroy();
    this.trap = null;
    this.stack.remove(this);

    const host = this.el.nativeElement;
    const focused = this.doc.activeElement;
    const focusWasInside = !focused || focused === this.doc.body || host.contains(focused);
    const opener = this.opener;
    this.opener = null;
    if (focusWasInside && opener?.isConnected) opener.focus();
  }

  private focusInitial(): void {
    if (!this.trap) return;
    const host = this.el.nativeElement;
    // Something inside already took focus (e.g. a field focused on init).
    if (host.contains(this.doc.activeElement) && this.doc.activeElement !== host) return;

    const usable = (e: Element): e is HTMLElement =>
      e instanceof HTMLElement && this.checker.isFocusable(e) && this.checker.isTabbable(e);

    const preferred = host.querySelector('[cdkFocusInitial]') ?? host.querySelector('[autofocus]');
    if (preferred instanceof HTMLElement && this.checker.isFocusable(preferred)) {
      preferred.focus();
      return;
    }

    const tabbables = Array.from(host.querySelectorAll(TABBABLE)).filter(usable);
    const target = tabbables.find(e => !e.hasAttribute('data-dialog-close')) ?? tabbables[0] ?? host;
    target.focus();
  }
}
