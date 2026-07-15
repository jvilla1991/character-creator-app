import { Component, ElementRef, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { DndSpell } from '../../../models/dnd-api.types';
import { DndResourcesService } from '../../../services/dnd-resources.service';

/**
 * DM-screen Spell Reference Carousel — a wrapping row of always-expanded spell
 * reference cards the DM pins for quick lookup during a live session.
 *
 * State is intentionally ephemeral: the pinned list lives only on this component
 * instance. The component is mounted for the life of the session screen (it sits
 * behind `state.dm`, which never flips mid-session), so the list survives the
 * poll re-emits but is cleared the moment the DM leaves the session. There is no
 * backend persistence — refresh or exit wipes the carousel, by design.
 *
 * The search overlay reuses {@link SpellPickerComponent}. We bind the pinned list
 * as the picker's `selected`, so already-pinned spells render as checked. Picking
 * an unchecked spell pins it; clicking an already-pinned (checked) spell never
 * unpins — instead it focuses the existing card (the "no duplicates, move to it"
 * rule). Cards are removed only via their own "x". Reorder is CDK drag-and-drop.
 */
@Component({
    selector: 'app-spell-carousel',
    templateUrl: './spell-carousel.component.html',
    styleUrls: ['./spell-carousel.component.scss'],
    standalone: false
})
export class SpellCarouselComponent implements OnInit {
  /** Ordered, de-duplicated pinned spells. Ephemeral — session only. */
  pinned: DndSpell[] = [];

  /** All SRD spells, loaded once for the search overlay's candidate list. */
  allSpells: DndSpell[] = [];
  loadingSpells = false;

  collapsed = false;
  searchOpen = false;

  /** Name of the card to flash (add / duplicate-select), cleared after the pulse. */
  focusedName: string | null = null;
  private focusTimer?: ReturnType<typeof setTimeout>;

  @ViewChildren('cardEl') private cardEls!: QueryList<ElementRef<HTMLElement>>;

  constructor(private dndResources: DndResourcesService) {}

  ngOnInit(): void {
    // Cached via shareReplay in the service, so this is cheap and warms the
    // search list before the DM opens it.
    this.loadingSpells = true;
    this.dndResources.getSpells().subscribe({
      next: spells => { this.allSpells = spells; this.loadingSpells = false; },
      error: () => { this.loadingSpells = false; },
    });
  }

  toggleCollapsed(): void { this.collapsed = !this.collapsed; }

  openSearch(): void { this.searchOpen = true; }
  closeSearch(): void { this.searchOpen = false; }

  isPinned(spell: DndSpell): boolean {
    return this.pinned.some(s => s.name === spell.name);
  }

  /**
   * The picker toggled its selection (bound to `pinned`). A longer array means a
   * new spell was picked → pin it. A shorter array means an already-pinned spell
   * was clicked → don't unpin; focus the existing card instead. Either way the
   * overlay closes so the DM sees the row update.
   */
  onSelectionChange(next: DndSpell[]): void {
    if (next.length > this.pinned.length) {
      const added = next.find(s => !this.isPinned(s));
      this.closeSearch();
      if (added) {
        this.pinned = [...this.pinned, added];
        this.focusCard(added.name);
      }
    } else {
      const existing = this.pinned.find(p => !next.some(s => s.name === p.name));
      this.closeSearch();
      if (existing) this.focusCard(existing.name);
    }
  }

  remove(spell: DndSpell): void {
    this.pinned = this.pinned.filter(s => s.name !== spell.name);
  }

  drop(event: CdkDragDrop<DndSpell[]>): void {
    moveItemInArray(this.pinned, event.previousIndex, event.currentIndex);
    this.pinned = [...this.pinned];
  }

  trackByName(_: number, s: DndSpell): string { return s.name; }

  /** Component string for the card, e.g. "V, S, M (a pinch of soot)". */
  componentLabel(spell: DndSpell): string {
    const letters = (spell.components ?? []).map(c => c.toUpperCase()).join(', ');
    if (spell.material && spell.components?.includes('m')) {
      return `${letters} (${spell.material})`;
    }
    return letters || '—';
  }

  /** Flash the named card and scroll it into view (used on add and on duplicate-select). */
  private focusCard(name: string): void {
    this.focusedName = name;
    clearTimeout(this.focusTimer);
    // Defer a tick so a just-pinned card exists in the DOM before we scroll to it.
    setTimeout(() => {
      const idx = this.pinned.findIndex(s => s.name === name);
      this.cardEls?.get(idx)?.nativeElement.scrollIntoView({
        behavior: 'smooth', inline: 'center', block: 'nearest',
      });
    });
    this.focusTimer = setTimeout(() => { this.focusedName = null; }, 1600);
  }
}
