import { Directive, EventEmitter, HostListener, Output } from '@angular/core';

/**
 * Attribute directive that listens for the Escape key anywhere in the
 * document and emits `escapeClose` — the modal-dismiss behavior every
 * full-screen modal in this app wants, without each one wiring its own
 * `@HostListener('document:keydown.escape')`. The host component decides
 * what "close" means (e.g. guard against a submit in flight) by handling
 * the output itself.
 */
@Directive({
  selector: '[appEscapeClose]',
  standalone: false,
})
export class EscapeCloseDirective {
  @Output() escapeClose = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.escapeClose.emit();
  }
}
