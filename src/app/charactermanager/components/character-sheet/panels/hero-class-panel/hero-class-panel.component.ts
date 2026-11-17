import { ChangeDetectionStrategy, Component, DestroyRef, Input, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PC } from '../../../../models/pc';
import { DndSpell } from '../../../../models/dnd-api.types';
import {
  HeroClassOption, HeroResource, HeroSpellEntry, heroClassFor, heroClassSpells, specializationTitle,
} from '../../../../models/hero-class';
import { DndResourcesService } from '../../../../services/dnd-resources.service';

/** Is this character a hero class (e.g. a Paladin with the Oath of the Ebon Blade)? */
export function isHeroClass(pc: Pick<PC, 'clazz' | 'subclass'> | null | undefined): boolean {
  return !!heroClassFor(pc);
}

/**
 * Hero-class panel (Death Knight, Demon Hunter, …) — text only, driven entirely
 * by the character's entry in HERO_CLASSES. Shows the specialization, the
 * level-1 feature, the resource line (Death Coil pool, Soul Fragments) and the
 * always-prepared spells for the character's level and specialization. Derived
 * from the PC's class/subclass/level/specialization, so nothing is persisted and
 * an existing character picks up new rows as it levels. Spell text is looked up
 * by name in the shared spell data (WoW spells are stubs until their full text lands).
 */
@Component({
  selector: 'app-hero-class-panel',
  templateUrl: './hero-class-panel.component.html',
  styleUrls: ['./hero-class-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroClassPanelComponent {
  private readonly dndResources = inject(DndResourcesService);
  private readonly destroyRef = inject(DestroyRef);

  private _pc!: PC;
  /** Spell data keyed by lower-cased name; null until loaded (loaded once, on demand). */
  readonly spellIndex = signal<Map<string, DndSpell> | null>(null);
  private spellsRequested = false;

  @Input() set pc(value: PC) {
    this._pc = value;
    if (this.spells.length) this.loadSpells();
  }
  get pc(): PC { return this._pc; }

  get hero(): HeroClassOption | undefined {
    return heroClassFor(this._pc);
  }

  /** "Frost Rune" / "Havoc"; '' when no specialization is set. */
  get specializationTitle(): string {
    const hero = this.hero;
    const spec = this._pc?.specialization;
    return hero && spec ? specializationTitle(hero, spec) : '';
  }

  get specializationDesc(): string {
    return this.hero?.specializations.find(s => s.name === this._pc?.specialization)?.desc ?? '';
  }

  /** The resource line at this level (null before it unlocks or for classes without one). */
  get resource(): HeroResource | null {
    const hero = this.hero;
    return hero?.resource ? hero.resource(this._pc.level ?? 1, this._pc.stats) : null;
  }

  /** Always-prepared spells at this level for this specialization. */
  get spells(): HeroSpellEntry[] {
    const hero = this.hero;
    return hero ? heroClassSpells(hero, this._pc.level ?? 1, this._pc.specialization) : [];
  }

  spellFor(name: string): DndSpell | undefined {
    return this.spellIndex()?.get(name.toLowerCase());
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
