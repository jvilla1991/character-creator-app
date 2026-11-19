import { Injectable, Injector, signal } from '@angular/core';
import { DndSpell } from '../models/dnd-api.types';
import { PcSpell } from '../models/pc';
import { refreshStaleSpell } from '../utils/spell-mapping';
import { DndResourcesService } from './dnd-resources.service';

/**
 * Shows the finished catalog text for saved spells that are still "TBD"
 * placeholder snapshots (see {@link refreshStaleSpell}). Display only: the
 * character keeps its saved copy, so nothing is migrated or written back.
 *
 * The catalog is ~400 kB of JSON, so it is only fetched once a view asks for
 * it via load(), which callers do only when a displayed spell is actually a
 * placeholder; characters without stale spells never trigger the request.
 * Until it arrives refresh() returns the saved snapshot unchanged.
 */
@Injectable({ providedIn: 'root' })
export class SpellRefreshService {
  /** Lower-cased spell name → catalog spell. Null until the catalog has loaded. */
  private readonly catalog = signal<ReadonlyMap<string, DndSpell> | null>(null);
  private requested = false;

  // DndResourcesService (and the HttpClient behind it) is resolved lazily in
  // load(), so a sheet with no stale spells never constructs the HTTP stack.
  constructor(private injector: Injector) {}

  /** The spell to display: the catalog's current text for a stale placeholder, else the saved spell itself. */
  refresh(spell: PcSpell): PcSpell {
    const catalog = this.catalog();
    return catalog ? refreshStaleSpell(spell, catalog) : spell;
  }

  /** Fetch the catalog once (cached by DndResourcesService). Safe to call repeatedly. */
  load(): void {
    if (this.requested) return;
    this.requested = true;
    this.injector.get(DndResourcesService).getSpells().subscribe({
      next: spells => this.catalog.set(new Map(spells.map(s => [s.name.toLowerCase(), s]))),
      // Leave the door open for a retry the next time a stale spell is shown.
      error: () => { this.requested = false; },
    });
  }
}
