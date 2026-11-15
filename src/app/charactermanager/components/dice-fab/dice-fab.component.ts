import { Component, HostListener } from '@angular/core';
import { DiceRollerService } from '../../services/dice-roller.service';

/**
 * The floating dice launcher that makes the roller reachable from every screen
 * — the character sheet, the campaign dashboard, a shop, a live session. Lives
 * in the app shell (see CharactermanagerAppComponent) and does nothing but
 * trigger DiceRollerService, which owns the modal and its session wiring.
 *
 * Also binds "r" as a desktop shortcut, since dice get rolled constantly
 * during play.
 */
@Component({
  selector: 'app-dice-fab',
  templateUrl: './dice-fab.component.html',
  styleUrls: ['./dice-fab.component.scss'],
})
export class DiceFabComponent {
  constructor(private dice: DiceRollerService) {}

  open(): void {
    this.dice.open();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'r' && event.key !== 'R') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;  // Ctrl/Cmd+R = reload
    if (this.dice.isOpen()) return;
    if (this.isTyping(event.target)) return;
    if (this.hasOpenOverlay()) return;
    event.preventDefault();
    this.dice.open();
  }

  /** Typing an "r" into a name, a note or a search box must not summon dice. */
  private isTyping(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true;
  }

  /**
   * Another overlay is already up (delete confirm, level-up, create character,
   * the settings slide-over, the sidebar search…). Each of those is an
   * independent boolean on its own component, so rather than thread a dozen
   * flags through the shell we ask the DOM: every overlay in the app renders
   * one of these three backdrops.
   */
  private hasOpenOverlay(): boolean {
    return document.querySelector('.modal-backdrop, .slideover-backdrop, .search-backdrop') !== null;
  }
}
