import {
  ChangeDetectionStrategy, Component, DOCUMENT, ElementRef, afterNextRender, inject, input, output,
  signal, viewChild, viewChildren, Injector,
} from '@angular/core';

/** What a menu item asks the sheet to do. */
export type SheetMenuAction = 'portrait' | 'rename' | 'toggleGrant' | 'levelUp' | 'delete';

let nextId = 0;

/**
 * The character sheet header's "More actions" menu: the things done to a
 * character rather than with it (portrait, rename, the DM's level-up grant,
 * delete). A menu button with a small panel anchored under it.
 *
 * - A click toggles it; a click outside, Escape, Tab or choosing an item closes it.
 * - Opening puts focus on the first item; the arrow keys, Home and End move
 *   between items. Escape and choosing an item return focus to the button, so a
 *   dialog an item opens hands focus back to something still on the page.
 *
 * It only reports the choice (`chosen`); the sheet does the work.
 */
@Component({
  selector: 'app-sheet-actions-menu',
  templateUrl: './sheet-actions-menu.component.html',
  styleUrls: ['./sheet-actions-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'sheet-menu',
    '(document:pointerdown)': 'onDocumentPointer($event)',
  },
})
export class SheetActionsMenuComponent {
  /** The character has a saved portrait: "Change portrait" rather than "Upload portrait". */
  readonly hasPortrait = input(false);
  /** A DM cross-viewing the sheet: reveals the level-up grant (and, below, Level up). */
  readonly dm = input(false);
  /** The DM has granted a level-up that is not spent yet: the grant item revokes it. */
  readonly granted = input(false);
  /** Offer "Level up" here: a DM, while the header shows no Level Up button. */
  readonly levelUpItem = input(false);

  readonly chosen = output<SheetMenuAction>();

  readonly open = signal(false);
  readonly menuId = `sheet-menu-${++nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly doc = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly items = viewChildren<ElementRef<HTMLButtonElement>>('item');

  toggle(): void {
    if (this.open()) this.close(false);
    else this.show();
  }

  /** Open from the keyboard on the button (ArrowDown / ArrowUp), as menu buttons do. */
  onTriggerKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    this.show(event.key === 'ArrowUp' ? 'last' : 'first');
  }

  /** Escape on the button itself (the menu was opened with the pointer and focus stayed put). */
  onTriggerEscape(event: Event): void {
    if (!this.open()) return;
    event.stopPropagation();
    this.close(true);
  }

  choose(action: SheetMenuAction): void {
    this.close(true);
    this.chosen.emit(action);
  }

  onMenuKey(event: KeyboardEvent): void {
    const items = this.items().map(i => i.nativeElement);
    const at = items.indexOf(this.doc.activeElement as HTMLButtonElement);
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        event.stopPropagation(); // never also close a dialog underneath
        this.close(true);
        return;
      case 'Tab':
        // Let focus move on; the menu just goes away behind it.
        this.close(false);
        return;
      case 'ArrowDown':
        event.preventDefault();
        items[(at + 1) % items.length]?.focus();
        return;
      case 'ArrowUp':
        event.preventDefault();
        items[(at - 1 + items.length) % items.length]?.focus();
        return;
      case 'Home':
        event.preventDefault();
        items[0]?.focus();
        return;
      case 'End':
        event.preventDefault();
        items[items.length - 1]?.focus();
        return;
    }
  }

  onDocumentPointer(event: Event): void {
    if (!this.open()) return;
    if (event.target instanceof Node && this.host.nativeElement.contains(event.target)) return;
    this.close(false);
  }

  private show(focus: 'first' | 'last' = 'first'): void {
    this.open.set(true);
    afterNextRender(() => {
      const items = this.items();
      (focus === 'first' ? items[0] : items[items.length - 1])?.nativeElement.focus();
    }, { injector: this.injector });
  }

  private close(refocus: boolean): void {
    if (!this.open()) return;
    this.open.set(false);
    if (refocus) this.trigger().nativeElement.focus();
  }
}
