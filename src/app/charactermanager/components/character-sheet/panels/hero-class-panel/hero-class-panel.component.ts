import { ChangeDetectionStrategy, Component, DestroyRef, Input, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PC } from '../../../../models/pc';
import { DndSpell } from '../../../../models/dnd-api.types';
import {
  HeroClassOption, HeroResource, HeroSpellEntry, SpecializationGuidance, heroClassFor, heroClassSpells,
  specializationTitle,
} from '../../../../models/hero-class';
import {
  BEAST_FORM_UNCHANGED, BeastFormCard, BeastFormInput, ClassicBeastForm, bearForm, catForm, classicBeastForms,
  isMoonCircle,
} from '../../../../models/wow-druid';
import { DndResourcesService } from '../../../../services/dnd-resources.service';
import { modFromScore, spellAttackBonus, spellSaveDc } from '../../../../utils/character-math';

/** Is this character a hero class (e.g. a Paladin with the Oath of the Ebon Blade, or a WoW Druid)? */
export function isHeroClass(pc: Pick<PC, 'clazz' | 'subclass' | 'specialization'> | null | undefined): boolean {
  return !!heroClassFor(pc);
}

/** One suggested spell, with whether the character already has it. */
export interface SuggestedSpellView {
  name: string;
  known: boolean;
  prepared: boolean;
}

export interface SuggestedSpellLevelView {
  level: number;
  spells: SuggestedSpellView[];
}

/** How the character's actual subclass compares to the one recommended for its specialization. */
export type SubclassMatch = 'match' | 'different' | 'pending';

/**
 * Hero-class panel (Death Knight, Demon Hunter, WoW Druid, …) — text only,
 * driven entirely by the character's entry in HERO_CLASSES. Shows the
 * specialization, the level-1 feature, the resource line (Death Coil pool, Soul
 * Fragments) and the always-prepared spells for the character's level and
 * specialization. For a WoW Druid it adds the recommended circle, the
 * specialization's suggested spells and the beast forms (Cat/Bear stat cards
 * for Circle of the Moon, classic beasts otherwise). Derived from the PC's
 * class/subclass/level/specialization/stats, so nothing is persisted and an
 * existing character picks up new rows as it levels. Spell text is looked up by
 * name in the shared spell data (WoW spells are stubs until their full text lands).
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

  readonly beastFormUnchanged = BEAST_FORM_UNCHANGED;

  private _pc!: PC;
  /** Spell data keyed by lower-cased name; null until loaded (loaded once, on demand). */
  readonly spellIndex = signal<Map<string, DndSpell> | null>(null);
  private spellsRequested = false;

  /** WoW Druid derived state — recomputed whenever the character changes. */
  suggestedSpells: SuggestedSpellLevelView[] = [];
  /** Cat and Bear Form stat cards — Circle of the Moon WoW Druids only. */
  formCards: BeastFormCard[] = [];
  classicForms: ClassicBeastForm[] = [];

  @Input() set pc(value: PC) {
    this._pc = value;
    this.deriveDruid();
    if (this.spells.length || this.suggestedSpells.length) this.loadSpells();
  }
  get pc(): PC { return this._pc; }

  get hero(): HeroClassOption | undefined {
    return heroClassFor(this._pc);
  }

  /** The panel heading: the hero subclass, or e.g. "World of Warcraft Druid" for a variant. */
  get panelTitle(): string {
    const hero = this.hero;
    if (!hero) return '';
    return hero.subclass ?? `${hero.source} ${hero.name}`;
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

  /** The specialization's recommended picks (WoW Druid); null for everyone else. */
  get guidance(): SpecializationGuidance | null {
    const spec = this._pc?.specialization;
    return (spec && this.hero?.guidance?.[spec]) || null;
  }

  /** Whether the character's subclass is the recommended one — informational only. */
  get subclassMatch(): SubclassMatch {
    const recommended = this.guidance?.subclass.name;
    const actual = this._pc?.subclass;
    if (!actual) return 'pending';
    return recommended && actual.toLowerCase() === recommended.toLowerCase() ? 'match' : 'different';
  }

  /** Feral → Cat Form, Guardian → Bear Form: the card to emphasize. */
  isEmphasized(card: BeastFormCard): boolean {
    const spec = this._pc?.specialization;
    return (spec === 'Feral' && card.name === 'Cat Form') || (spec === 'Guardian' && card.name === 'Bear Form');
  }

  /** True for a World of Warcraft stub spell (from the loaded spell data). */
  isWowSpell(name: string): boolean {
    return this.spellFor(name)?.source === 'World of Warcraft';
  }

  spellFor(name: string): DndSpell | undefined {
    return this.spellIndex()?.get(name.toLowerCase());
  }

  /** "+5" / "−1" for an attack bonus. */
  fmtBonus(n: number): string {
    return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
  }

  private deriveDruid(): void {
    const hero = this.hero;
    const pc = this._pc;
    const spec = pc?.specialization;
    const levels = (spec && hero?.suggestedSpells?.[spec]) || [];
    const owned = new Map((pc?.spells ?? []).map(s => [s.name.toLowerCase(), s]));
    this.suggestedSpells = levels.map(row => ({
      level: row.level,
      spells: row.spells.map(name => {
        const have = owned.get(name.toLowerCase());
        return { name, known: !!have, prepared: !!have?.prepared };
      }),
    }));

    if (!hero?.beastForms) {
      this.formCards = [];
      this.classicForms = [];
      return;
    }
    const moon = isMoonCircle(pc.subclass);
    if (moon) {
      const input = beastFormInput(pc);
      this.formCards = [catForm(input), bearForm(input)];
    } else {
      this.formCards = [];
    }
    this.classicForms = classicBeastForms(pc.level ?? 1, moon);
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

/**
 * Beast-form inputs from the sheet: druid level, WIS score, and the spell attack
 * bonus / save DC from the shared spell math (falling back to proficiency + WIS
 * if the stored class name isn't the canonical 'Druid').
 */
export function beastFormInput(pc: PC): BeastFormInput {
  const level = pc.level ?? 1;
  const wis = pc.stats?.WIS ?? 10;
  const prof = pc.prof ?? Math.floor((level - 1) / 4) + 2;
  const wisMod = modFromScore(wis);
  return {
    level,
    wis,
    spellAttack: spellAttackBonus(pc) ?? prof + wisMod,
    spellDc: spellSaveDc(pc) ?? 8 + prof + wisMod,
  };
}
