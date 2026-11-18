import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush } from '@angular/core/testing';
import { ConfirmHostComponent } from './confirm-host.component';
import { ConfirmService } from './confirm.service';

@Component({
  imports: [ConfirmHostComponent],
  template: `<button id="opener">Delete</button><app-confirm-host />`,
})
class ShellComponent {}

describe('ConfirmService + ConfirmHostComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;
  let el: HTMLElement;
  let confirmations: ConfirmService;

  const q = <T extends Element = HTMLElement>(sel: string) => el.querySelector(sel) as T | null;
  const buttons = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.modal-actions button'));
  const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  function settle(): void {
    fixture.detectChanges();
    flush();
    fixture.detectChanges();
  }

  const request = {
    title: 'Delete Encounter', subject: 'Goblin Ambush',
    message: 'and its creatures will be erased. This cannot be undone.', confirmLabel: 'Delete Encounter',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ShellComponent] });
    fixture = TestBed.createComponent(ShellComponent);
    el = fixture.nativeElement;
    document.body.appendChild(el);
    confirmations = TestBed.inject(ConfirmService);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    el.remove();
  });

  it('renders a crimson alertdialog that names the action and the thing', fakeAsync(() => {
    confirmations.ask(request).subscribe();
    settle();
    const modal = q('app-modal')!;
    expect(modal.getAttribute('role')).toBe('alertdialog');
    expect(modal.classList).toContain('tone-crimson');
    expect(q('h2')!.textContent!.trim()).toBe('Delete Encounter');
    expect(q('.confirm-subject')!.textContent!.trim()).toBe('Goblin Ambush');
    expect(buttons().map(b => b.textContent!.trim())).toEqual(['Cancel', 'Delete Encounter']);
  }));

  it('lands focus on Cancel, and returns it to the opener on close', fakeAsync(() => {
    q('#opener')!.focus();
    confirmations.ask(request).subscribe();
    settle();
    expect(document.activeElement?.textContent?.trim()).toBe('Cancel');

    buttons()[0].click();
    settle();
    expect(q('app-modal')).toBeNull();
    expect(document.activeElement?.id).toBe('opener');
  }));

  it('confirm emits only when the destructive button is pressed', fakeAsync(() => {
    let confirmed = 0;
    confirmations.confirm(request).subscribe(() => confirmed++);
    settle();
    buttons()[1].click();
    settle();
    expect(confirmed).toBe(1);
    expect(q('app-modal')).toBeNull();
  }));

  it('Escape, the backdrop and the close button all cancel', fakeAsync(() => {
    const answers: boolean[] = [];
    confirmations.ask(request).subscribe(a => answers.push(a));
    settle();
    escape();
    settle();

    confirmations.ask(request).subscribe(a => answers.push(a));
    settle();
    q('.modal-backdrop')!.click();
    settle();

    confirmations.ask(request).subscribe(a => answers.push(a));
    settle();
    q<HTMLButtonElement>('.modal-close')!.click();
    settle();

    expect(answers).toEqual([false, false, false]);
    expect(q('app-modal')).toBeNull();
  }));

  it('a click inside the dialog does not reach the backdrop', fakeAsync(() => {
    const answers: boolean[] = [];
    confirmations.ask(request).subscribe(a => answers.push(a));
    settle();
    q('.modal-sub')!.click();
    settle();
    expect(answers).toEqual([]);
    expect(q('app-modal')).not.toBeNull();
  }));

  it('a new request cancels the open one; unsubscribing closes it', fakeAsync(() => {
    const first: boolean[] = [];
    confirmations.ask(request).subscribe(a => first.push(a));
    const sub = confirmations.ask({ ...request, title: 'Delete Note' }).subscribe();
    settle();
    expect(first).toEqual([false]);
    expect(q('h2')!.textContent!.trim()).toBe('Delete Note');

    sub.unsubscribe();
    settle();
    expect(q('app-modal')).toBeNull();
  }));
});
