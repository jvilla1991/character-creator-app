import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush } from '@angular/core/testing';
import { ModalComponent } from './modal.component';
import { DialogDirective } from './dialog.directive';
import { DialogStack } from './dialog-stack.service';

@Component({
  imports: [ModalComponent, DialogDirective],
  template: `
    <button id="opener">Open</button>
    @if (lowerOpen()) {
      <app-modal title="Lower Dialog" (dismiss)="lowerDismissed = lowerDismissed + 1">
        <input id="lower-field">
      </app-modal>
    }
    @if (upperOpen()) {
      <app-modal title="Upper Dialog" tone="crimson" dialogRole="alertdialog"
        [closable]="upperClosable()" [dialogDismissible]="upperDismissible()"
        (dismiss)="upperDismissed = upperDismissed + 1">
        <p>Body copy</p>
        <button id="cancel">Cancel</button>
        <button id="confirm" [attr.cdkFocusInitial]="preferConfirm() ? '' : null">Confirm</button>
      </app-modal>
    }
    @if (emptyOpen()) {
      <app-modal title="Loading" [closable]="false"><p>Nothing to tab to yet.</p></app-modal>
    }
    <aside id="drawer" appDialog [dialogActive]="drawerOpen()" aria-label="Drawer"
      (dismiss)="drawerOpen.set(false)">
      <button id="drawer-close">Close drawer</button>
    </aside>
  `,
})
class HostComponent {
  lowerOpen = signal(false);
  upperOpen = signal(false);
  emptyOpen = signal(false);
  drawerOpen = signal(false);
  upperClosable = signal(true);
  upperDismissible = signal(true);
  preferConfirm = signal(false);
  lowerDismissed = 0;
  upperDismissed = 0;
}

describe('ModalComponent + DialogDirective (shared modal shell)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;

  const q = <T extends Element = HTMLElement>(sel: string) => el.querySelector(sel) as T | null;
  const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  /** Render, then let afterNextRender's focus-in run. */
  function settle(): void {
    fixture.detectChanges();
    flush();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    document.body.appendChild(el);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    el.remove();
  });

  it('is a labelled modal dialog whose name is a real heading', fakeAsync(() => {
    host.upperOpen.set(true);
    settle();
    const modal = q('app-modal')!;
    const heading = q('app-modal h2.modal-title')!;

    expect(modal.getAttribute('role')).toBe('alertdialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(modal.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(heading.textContent!.trim()).toBe('Upper Dialog');
    expect(modal.classList).toContain('modal');
    expect(modal.classList).toContain('tone-crimson');
  }));

  it('gives every shell a unique title id', fakeAsync(() => {
    host.lowerOpen.set(true);
    host.upperOpen.set(true);
    settle();
    const ids = Array.from(el.querySelectorAll('app-modal h2')).map(h => h.id);
    expect(new Set(ids).size).toBe(2);
  }));

  it('moves focus to the first control, skipping the shell close button', fakeAsync(() => {
    q('#opener')!.focus();
    host.upperOpen.set(true);
    settle();
    expect(document.activeElement?.id).toBe('cancel');
  }));

  it('lets cdkFocusInitial choose the starting control', fakeAsync(() => {
    host.preferConfirm.set(true);
    host.upperOpen.set(true);
    settle();
    expect(document.activeElement?.id).toBe('confirm');
  }));

  it('focuses the dialog itself when nothing inside is tabbable yet', fakeAsync(() => {
    host.emptyOpen.set(true);
    settle();
    expect(document.activeElement).toBe(q('app-modal'));
  }));

  it('returns focus to the opener when it closes', fakeAsync(() => {
    q('#opener')!.focus();
    host.upperOpen.set(true);
    settle();
    expect(document.activeElement?.id).toBe('cancel');

    host.upperOpen.set(false);
    settle();
    expect(document.activeElement?.id).toBe('opener');
  }));

  it('dismisses on Escape', fakeAsync(() => {
    host.upperOpen.set(true);
    settle();
    escape();
    expect(host.upperDismissed).toBe(1);
  }));

  it('dismisses from the close button, which is labelled', fakeAsync(() => {
    host.upperOpen.set(true);
    settle();
    const close = q<HTMLButtonElement>('app-modal .modal-close')!;
    expect(close.getAttribute('aria-label')).toBe('Close');
    close.click();
    expect(host.upperDismissed).toBe(1);
  }));

  it('sends Escape to the topmost dialog only', fakeAsync(() => {
    host.lowerOpen.set(true);
    settle();
    host.upperOpen.set(true);
    settle();

    escape();
    expect(host.upperDismissed).toBe(1);
    expect(host.lowerDismissed).toBe(0);

    host.upperOpen.set(false);
    settle();
    escape();
    expect(host.lowerDismissed).toBe(1);
  }));

  it('a non-dismissible dialog ignores Escape and does not let it reach the dialog below', fakeAsync(() => {
    host.upperClosable.set(false);
    host.upperDismissible.set(false);
    host.lowerOpen.set(true);
    settle();
    host.upperOpen.set(true);
    settle();

    // Only the lower dialog has a close button; the upper one is action-only.
    expect(el.querySelectorAll('app-modal .modal-close').length).toBe(1);
    escape();
    expect(host.upperDismissed).toBe(0);
    expect(host.lowerDismissed).toBe(0);
  }));

  it('leaves Escape alone once a control inside has handled it', fakeAsync(() => {
    host.upperOpen.set(true);
    settle();
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    ev.preventDefault();
    document.dispatchEvent(ev);
    expect(host.upperDismissed).toBe(0);
  }));

  it('stops clicks inside the shell from reaching a backdrop', fakeAsync(() => {
    host.upperOpen.set(true);
    settle();
    const outer = jasmine.createSpy('backdrop click');
    el.addEventListener('click', outer);
    q('app-modal p')!.click();
    expect(outer).not.toHaveBeenCalled();
  }));

  it('traps Tab inside with focus-trap anchors while open, and removes them on close', fakeAsync(() => {
    host.upperOpen.set(true);
    settle();
    expect(document.querySelectorAll('.cdk-focus-trap-anchor').length).toBe(2);
    host.upperOpen.set(false);
    settle();
    expect(document.querySelectorAll('.cdk-focus-trap-anchor').length).toBe(0);
  }));

  describe('dialogActive (an always-present element such as the drawer)', () => {
    it('is not a dialog, and not on the stack, while inactive', fakeAsync(() => {
      const drawer = q('#drawer')!;
      expect(drawer.getAttribute('role')).toBeNull();
      expect(drawer.getAttribute('aria-modal')).toBeNull();
      expect(TestBed.inject(DialogStack).size).toBe(0);
      escape();
      expect(host.drawerOpen()).toBeFalse();
    }));

    it('becomes a modal dialog when activated, takes focus, closes on Escape and gives focus back', fakeAsync(() => {
      q('#opener')!.focus();
      host.drawerOpen.set(true);
      settle();
      const drawer = q('#drawer')!;
      expect(drawer.getAttribute('role')).toBe('dialog');
      expect(drawer.getAttribute('aria-modal')).toBe('true');
      expect(document.activeElement?.id).toBe('drawer-close');

      escape();
      settle();
      expect(host.drawerOpen()).toBeFalse();
      expect(drawer.getAttribute('role')).toBeNull();
      expect(document.activeElement?.id).toBe('opener');
      expect(TestBed.inject(DialogStack).size).toBe(0);
    }));
  });
});
