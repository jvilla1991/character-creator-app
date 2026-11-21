import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SheetActionsMenuComponent, SheetMenuAction } from './sheet-actions-menu.component';

describe('SheetActionsMenuComponent', () => {
  let fixture: ComponentFixture<SheetActionsMenuComponent>;
  let chosen: SheetMenuAction[];

  const el = (): HTMLElement => fixture.nativeElement;
  const trigger = () => el().querySelector<HTMLButtonElement>('.sheet-menu-trigger')!;
  const panel = () => el().querySelector<HTMLElement>('[role="menu"]');
  const items = () => Array.from(el().querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
  const labels = () => items().map(i => i.textContent!.trim());
  const key = (target: HTMLElement, k: string) => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };

  function open(): void {
    trigger().click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [SheetActionsMenuComponent] });
    fixture = TestBed.createComponent(SheetActionsMenuComponent);
    chosen = [];
    fixture.componentInstance.chosen.subscribe(a => chosen.push(a));
    document.body.appendChild(el());
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    el().remove();
  });

  it('is a labelled menu button, closed to start with', () => {
    expect(trigger().getAttribute('aria-label')).toBe('More actions');
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(panel()).toBeNull();
  });

  it('a click opens it with the first item focused; another click closes it', async () => {
    open();
    await fixture.whenStable();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(panel()).not.toBeNull();
    expect(document.activeElement).toBe(items()[0]);

    open();
    expect(panel()).toBeNull();
  });

  it("a player gets the portrait, rename and delete — delete is not the DM's alone", () => {
    open();
    expect(labels()).toEqual(['Upload portrait', 'Rename character', 'Delete character']);
    expect(items()[2].classList).toContain('danger');
  });

  it('says Change portrait once there is one', () => {
    fixture.componentRef.setInput('hasPortrait', true);
    open();
    expect(labels()[0]).toBe('Change portrait');
  });

  it('a DM also gets the level-up grant, and Level up while the header shows no button', () => {
    fixture.componentRef.setInput('dm', true);
    fixture.componentRef.setInput('levelUpItem', true);
    open();
    expect(labels()).toEqual(['Upload portrait', 'Rename character', 'Grant level-up', 'Level up', 'Delete character']);

    open(); // close
    fixture.componentRef.setInput('granted', true);
    fixture.componentRef.setInput('levelUpItem', false);
    open();
    expect(labels()).toEqual(['Upload portrait', 'Rename character', 'Revoke level-up', 'Delete character']);
  });

  it('each item reports its action, closes the menu and hands focus back to the button', () => {
    fixture.componentRef.setInput('dm', true);
    fixture.componentRef.setInput('levelUpItem', true);
    const expected: SheetMenuAction[] = ['portrait', 'rename', 'toggleGrant', 'levelUp', 'delete'];
    expected.forEach((_, i) => {
      open();
      items()[i].click();
      fixture.detectChanges();
      expect(panel()).toBeNull();
      expect(document.activeElement).toBe(trigger());
    });
    expect(chosen).toEqual(expected);
  });

  it('Escape closes it and returns focus to the button, without choosing anything', async () => {
    open();
    await fixture.whenStable();
    key(items()[0], 'Escape');
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(chosen).toEqual([]);
  });

  it('the arrow keys, Home and End move between items, wrapping round', async () => {
    open();
    await fixture.whenStable();
    const [portrait, rename, del] = items();
    key(portrait, 'ArrowDown');
    expect(document.activeElement).toBe(rename);
    key(rename, 'ArrowDown');
    expect(document.activeElement).toBe(del);
    key(del, 'ArrowDown');
    expect(document.activeElement).toBe(portrait);
    key(portrait, 'ArrowUp');
    expect(document.activeElement).toBe(del);
    key(del, 'Home');
    expect(document.activeElement).toBe(portrait);
    key(portrait, 'End');
    expect(document.activeElement).toBe(del);
  });

  it('a click anywhere else closes it; a click inside does not', () => {
    open();
    panel()!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fixture.detectChanges();
    expect(panel()).not.toBeNull();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('Tab lets focus move on and closes the menu behind it', () => {
    open();
    key(items()[0], 'Tab');
    expect(panel()).toBeNull();
  });
});
