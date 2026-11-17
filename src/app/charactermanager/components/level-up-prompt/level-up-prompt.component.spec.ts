import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush } from '@angular/core/testing';
import { LevelUpPromptComponent } from './level-up-prompt.component';
import { ModalComponent } from '../modal/modal.component';
import { LEVEL_UP_ANSWERED_KEY, LevelUpPromptService } from '../../services/level-up-prompt.service';
import { SessionService } from '../../services/session.service';
import { UiStateService } from '../../services/ui-state.service';
import { PC } from '../../models/pc';

describe('LevelUpPromptComponent (shell host)', () => {
  let fixture: ComponentFixture<LevelUpPromptComponent>;
  let el: HTMLElement;
  let service: LevelUpPromptService;
  let refresh: jasmine.Spy;
  const activeSessionId = signal<string | null>(null);

  const ready = { id: 7, name: 'Aria', level: 3, xp: 0, pendingLevelGrant: true } as PC;
  const q = <T extends Element = HTMLElement>(sel: string) => el.querySelector(sel) as T | null;
  const buttons = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.levelup-prompt button'));
  const button = (label: string) => buttons().find(b => b.textContent!.trim() === label)!;

  function settle(): void {
    fixture.detectChanges();
    flush();
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.removeItem(LEVEL_UP_ANSWERED_KEY);
    activeSessionId.set(null);
    refresh = jasmine.createSpy('refresh');
    TestBed.configureTestingModule({
      imports: [LevelUpPromptComponent],
      providers: [
        { provide: SessionService, useValue: { refresh } },
        { provide: UiStateService, useValue: { activeSessionId } },
      ],
    });
    // The level-up modal itself is covered by its own spec; keep it inert here.
    TestBed.overrideComponent(LevelUpPromptComponent,
      { set: { imports: [ModalComponent], schemas: [NO_ERRORS_SCHEMA] } });
    service = TestBed.inject(LevelUpPromptService);
    fixture = TestBed.createComponent(LevelUpPromptComponent);
    el = fixture.nativeElement;
    document.body.appendChild(el);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    el.remove();
    localStorage.removeItem(LEVEL_UP_ANSWERED_KEY);
  });

  it('keeps an ambient, hidden-from-AT glow layer that lights only while prompting', fakeAsync(() => {
    const glow = q('.levelup-glow')!;
    expect(glow.getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(glow).pointerEvents).toBe('none');
    expect(glow.classList).not.toContain('open');

    service.evaluate(ready);
    settle();
    expect(glow.classList).toContain('open');

    button('Later').click();
    settle();
    expect(glow.classList).not.toContain('open');
  }));

  it('is a labelled dialog with the copy and exactly two choices, focusing "Level Up Now"', fakeAsync(() => {
    service.evaluate(ready);
    settle();

    const dialog = q('app-modal')!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(q(`#${dialog.getAttribute('aria-labelledby')}`)!.textContent!.trim()).toBe('Level up');
    expect(q(`#${dialog.getAttribute('aria-describedby')}`)!.textContent).toContain('Aria can advance to level 4.');
    expect(dialog.textContent).toContain('Your DM granted a level-up.');
    expect(buttons().map(b => b.textContent!.trim())).toEqual(['Later', 'Level Up Now']);
    expect(document.activeElement).toBe(button('Level Up Now'));
  }));

  it('names the XP route when there is no grant', fakeAsync(() => {
    service.evaluate({ ...ready, pendingLevelGrant: false, xp: 2_700 } as PC);
    settle();

    expect(q('app-modal')!.textContent).toContain('You have enough experience.');
  }));

  it('Escape answers "Later"', fakeAsync(() => {
    service.evaluate(ready);
    settle();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    settle();

    expect(service.prompt()).toBeNull();
    expect(q('app-modal')).toBeNull();
    expect(q('app-level-up-modal')).toBeNull();
  }));

  it('a backdrop click answers "Later"', fakeAsync(() => {
    service.evaluate(ready);
    settle();

    q('.levelup-backdrop')!.click();
    settle();

    expect(service.prompt()).toBeNull();
  }));

  it('"Level Up Now" swaps the prompt for the level-up modal', fakeAsync(() => {
    service.evaluate(ready);
    settle();

    button('Level Up Now').click();
    settle();

    expect(q('app-modal.levelup-prompt')).toBeNull();
    expect(q('app-level-up-modal')).not.toBeNull();
  }));

  it('closing the modal inside a live session forces a session refetch', fakeAsync(() => {
    activeSessionId.set('42');
    service.openLevelUp(ready);
    settle();

    q('app-level-up-modal')!.dispatchEvent(new CustomEvent('close'));
    settle();

    expect(service.levelUp()).toBeNull();
    expect(refresh).toHaveBeenCalled();
  }));

  it('closing the modal outside a session does not touch the session', fakeAsync(() => {
    service.openLevelUp(ready);
    settle();

    q('app-level-up-modal')!.dispatchEvent(new CustomEvent('close'));
    settle();

    expect(refresh).not.toHaveBeenCalled();
  }));
});
