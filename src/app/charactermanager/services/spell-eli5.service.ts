import { computed, effect, Injectable, Injector, signal, untracked } from '@angular/core';
import { spellKey } from '../models/spell-names';
import { DndResourcesService } from './dnd-resources.service';
import { PreferencesService } from './preferences.service';
import { UiStateService } from './ui-state.service';

/**
 * ELI5 mode: swap a spell's full rules text for a one-sentence summary.
 *
 * The sentences live on the reference spells (the `eli5` field in the spell JSON
 * assets), NOT on the character: a PC's spells are saved snapshots, so the
 * summary is looked up by spell name at render time. That makes it work for
 * every existing character with no backend change. A spell with no summary
 * (homebrew, or a placeholder entry) simply keeps its full description.
 *
 * It is a Player-view feature: the switch is only offered, and only applies,
 * while the user has chosen "View As: Player". A DM cross-linked into a member's
 * sheet is displayed as 'player' but did not choose it, so they are excluded.
 */
@Injectable({ providedIn: 'root' })
export class SpellEli5Service {
  /** The viewer can use ELI5 at all (drives whether the switch is shown). */
  readonly available = computed(() => this.uiState.isPlayer() && !this.uiState.dmReturn());
  /** The viewer's saved on/off choice, regardless of role. */
  readonly enabled = this.prefs.eli5;
  /** ELI5 is switched on AND applies to the current view. */
  readonly active = computed(() => this.available() && this.enabled());

  /** Lower-cased spell name → summary. Empty until the spell catalog has loaded. */
  private readonly summaries = signal<ReadonlyMap<string, string>>(new Map());
  private requested = false;

  constructor(
    private prefs: PreferencesService,
    private uiState: UiStateService,
    // DndResourcesService (and the HttpClient behind it) is resolved lazily in
    // load(), so merely showing the switch never constructs the HTTP stack.
    private injector: Injector,
  ) {
    // The catalog is ~400 kB of JSON, so it is only fetched once someone
    // actually turns ELI5 on (and it is cached by DndResourcesService).
    effect(() => {
      if (this.active()) untracked(() => this.load());
    });
  }

  toggle(): void {
    this.prefs.setEli5(!this.enabled());
  }

  /**
   * The one-sentence summary to show for a known spell, or null when the full
   * description should be shown instead (ELI5 off, not Player view, the catalog
   * still loading, or no summary written for that spell).
   */
  summaryFor(spellName: string): string | null {
    if (!this.active()) return null;
    return this.summaries().get(spellKey(spellName)) ?? null;
  }

  private load(): void {
    if (this.requested) return;
    this.requested = true;
    this.injector.get(DndResourcesService).getSpells().subscribe({
      next: spells => {
        const map = new Map<string, string>();
        for (const s of spells) {
          if (s.eli5) map.set(s.name.toLowerCase(), s.eli5);
        }
        this.summaries.set(map);
      },
      // Leave the door open for a retry the next time ELI5 becomes active.
      error: () => { this.requested = false; },
    });
  }
}
