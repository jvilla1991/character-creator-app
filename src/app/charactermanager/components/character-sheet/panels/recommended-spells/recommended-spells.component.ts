import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ClassFeatureProgressionEntry } from '../../../../models/class-feature';
import { DndSpell } from '../../../../models/dnd-api.types';
import { PC } from '../../../../models/pc';
import {
  StartingSpellPicks, handbookClassPicks, readsSubclassSpellList, startingSpellPicksFor, subclassSpellList,
} from '../../../../models/recommended-spells';
import { spellKey } from '../../../../models/spell-names';
import { ClassFeatureService } from '../../../../services/class-feature.service';
import { DndResourcesService } from '../../../../services/dnd-resources.service';

/** One recommended spell, with whether the character already has it. */
export interface RecommendedSpellView {
  name: string;
  known: boolean;
  prepared: boolean;
}

/** One set of starting picks: a heading, where the recommendation comes from, and its rows. */
export interface StartingPicksView {
  title: string;
  note: string;
  rows: { label: string; spells: RecommendedSpellView[] }[];
}

/** A subclass spell with the class level it arrives at. */
export interface SubclassSpellView {
  name: string;
  classLevel: number;
}

/** The subclass's always-prepared list, split around the character's level. */
export interface SubclassListView {
  title: string;
  /** The class the levels count in ('Paladin'). */
  baseClass: string;
  known: SubclassSpellView[];
  /** 'Aid, Zone of Truth at level 5; Beacon of Hope, Dispel Magic at level 9', or '' when none are left. */
  upcoming: string;
}

/** What the panel shows for one character. */
export interface RecommendedSpellsView {
  picks: StartingPicksView[];
  list: SubclassListView | null;
}

const SEPARATOR = '|';

/**
 * Recommended spells panel — for every character that casts spells, the
 * official recommendations only: the starting cantrips and level-1 spells its
 * class's book names (the Player's Handbook; the World of Warcraft book for a
 * specialization that has its own), and the always-prepared list of a
 * base-game subclass, read from the class-feature roadmap.
 *
 * Text only and derived from the character's class, subclass, specialization,
 * level and spells: nothing is saved, granted or selected. Renders nothing for
 * a character with no recommendation (a Barbarian, a Champion fighter).
 *
 * A base-game character gets it as its own sheet panel. A World of Warcraft
 * character gets it `embedded` in the hero-class panel, beside that panel's
 * suggested spells, so the recommendations stay in one section.
 */
@Component({
  selector: 'app-recommended-spells',
  templateUrl: './recommended-spells.component.html',
  styleUrls: ['./recommended-spells.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
})
export class RecommendedSpellsComponent {
  private readonly classFeatures = inject(ClassFeatureService);
  private readonly dndResources = inject(DndResourcesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pc = input<PC | null>(null);
  /** True inside another panel (the hero-class panel): no frame or title of its own. */
  readonly embedded = input(false);

  /** Class, subclass and specialization of the roadmap to read; '' when there is no list to read. */
  private readonly roadmapKey = computed(() => {
    const pc = this.pc();
    return pc && readsSubclassSpellList(pc)
      ? [pc.clazz, pc.subclass, pc.specialization ?? ''].join(SEPARATOR)
      : '';
  });

  /** The roadmap for {@link roadmapKey}, tagged with its key so a stale answer is never shown for a new subclass. */
  private readonly roadmap = toSignal(
    toObservable(this.roadmapKey).pipe(
      switchMap(key => {
        if (!key) return of({ key, entries: [] as ClassFeatureProgressionEntry[] });
        const [clazz, subclass, specialization] = key.split(SEPARATOR);
        return this.classFeatures.progression(clazz, subclass, specialization || null)
          .pipe(map(entries => ({ key, entries })));
      }),
    ),
    { initialValue: { key: '', entries: [] as ClassFeatureProgressionEntry[] } },
  );

  readonly view = computed<RecommendedSpellsView | null>(() => {
    const pc = this.pc();
    if (!pc) return null;
    const owned = new Map((pc.spells ?? []).map(s => [spellKey(s.name), s]));
    const toView = (name: string): RecommendedSpellView => {
      const have = owned.get(spellKey(name));
      return { name, known: !!have, prepared: !!have?.prepared };
    };

    const picks = startingSpellPicksFor(pc).map((p): StartingPicksView => ({
      title: p.classLevel === 1 ? 'Starting spells' : `${p.for} starting spells`,
      note: picksNote(p),
      rows: [
        { label: 'Cantrips', spells: p.cantrips.map(toView) },
        { label: p.level1Label ?? 'Level 1', spells: p.level1Spells.map(toView) },
      ].filter(row => row.spells.length > 0),
    }));

    const roadmap = this.roadmap();
    const spellList = roadmap.key && roadmap.key === this.roadmapKey() ? subclassSpellList(roadmap.entries) : null;
    let list: SubclassListView | null = null;
    if (spellList) {
      const level = pc.level ?? 1;
      list = {
        title: spellList.title,
        baseClass: handbookClassPicks(pc.clazz)?.baseClass ?? pc.clazz ?? '',
        known: spellList.rows.filter(row => row.classLevel <= level)
          .flatMap(row => row.spells.map(name => ({ name, classLevel: row.classLevel }))),
        upcoming: spellList.rows.filter(row => row.classLevel > level)
          .map(row => `${row.spells.join(', ')} at level ${row.classLevel}`).join('; '),
      };
    }

    return picks.length || list ? { picks, list } : null;
  });

  /** Spell data by lookup key; null until the spell list has loaded. */
  readonly spellIndex = signal<Map<string, DndSpell> | null>(null);
  private spellsRequested = false;

  constructor() {
    // The spell text is only fetched for a character that actually has recommendations.
    effect(() => { if (this.view()) this.loadSpells(); });
  }

  spellFor(name: string): DndSpell | undefined {
    return this.spellIndex()?.get(spellKey(name));
  }

  /** True for a spell from the World of Warcraft module (marked ✦). */
  isWowSpell(name: string): boolean {
    return this.spellFor(name)?.source === 'World of Warcraft';
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

/** Where a set of starting picks comes from, as one line under its heading. */
function picksNote(picks: StartingSpellPicks): string {
  const book = picks.source === 'World of Warcraft' ? 'The World of Warcraft book'
    : picks.source === 'Arcana Unleashed' ? 'Arcana Unleashed' : "The Player's Handbook";
  const when = picks.classLevel === 1 ? '' : `, at ${picks.baseClass} level ${picks.classLevel}`;
  return `${book} recommends these for a new ${picks.for}${when}. They are suggestions only.`;
}
