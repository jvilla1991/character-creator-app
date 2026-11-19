import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DndSpell } from '../../../../models/dnd-api.types';
import { PC } from '../../../../models/pc';
import { SpeciesSpellGrant, catalogSpeciesFor, speciesLabel, speciesSpellGrants } from '../../../../models/species';
import { spellKey } from '../../../../models/spell-names';
import { DndResourcesService } from '../../../../services/dnd-resources.service';

/** What the panel shows for one character. */
export interface SpeciesSpellsView {
  title: string;
  /** Spells the character has at its level. */
  known: SpeciesSpellGrant[];
  /** Spells it will gain at a later level, earliest first. */
  upcoming: SpeciesSpellGrant[];
  /** True when any granted spell is a levelled one (cast once per Long Rest for free). */
  hasLevelledSpells: boolean;
}

/**
 * Species spells panel — the cantrips and always-prepared spells a World of
 * Warcraft species or lineage gives (a Void Elf's Mind Sliver, a Haranir's
 * Entangle at level 3). Text only and derived entirely from the character's
 * species, lineage and level: nothing here is saved, and nothing is added to
 * the spellbook. Renders nothing for a species that gives no spells.
 */
@Component({
    selector: 'app-species-spells',
    templateUrl: './species-spells.component.html',
    styleUrls: ['./species-spells.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpeciesSpellsComponent {
  readonly pc = input<PC | null>(null);

  readonly view = computed<SpeciesSpellsView | null>(() => {
    const pc = this.pc();
    const species = pc ? catalogSpeciesFor(pc.race, pc.speciesSource) : undefined;
    if (!pc || !species) return null;
    const grants = speciesSpellGrants(species, pc.lineage);
    if (!grants.length) return null;
    const level = pc.level ?? 1;
    return {
      title: `${speciesLabel(pc.race, pc.lineage)} Spells`,
      known: grants.filter(g => g.level <= level),
      upcoming: grants.filter(g => g.level > level),
      hasLevelledSpells: grants.some(g => !g.cantrip),
    };
  });

  /** Spell data by lookup key; null until the spell list has loaded. */
  readonly spellIndex = signal<Map<string, DndSpell> | null>(null);
  private spellsRequested = false;

  constructor(private dndResources: DndResourcesService, private destroyRef: DestroyRef) {
    // The spell text is only fetched for a character that actually has species spells.
    effect(() => { if (this.view()) this.loadSpells(); });
  }

  spellFor(name: string): DndSpell | undefined {
    return this.spellIndex()?.get(spellKey(name));
  }

  /** 'Longstrider at level 3, Pass without Trace at level 5' */
  upcomingLine(view: SpeciesSpellsView): string {
    return view.upcoming.map(g => `${g.name} at level ${g.level}`).join(', ');
  }

  private loadSpells(): void {
    if (this.spellsRequested) return;
    this.spellsRequested = true;
    this.dndResources.getSpells().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: spells => {
        this.spellIndex.set(new Map(spells.map(s => [s.name.toLowerCase(), s])));
      },
      // Offline asset fetch: the list still renders names; allow a retry on the next input.
      error: () => { this.spellsRequested = false; },
    });
  }
}
