import { ChangeDetectionStrategy, Component, DestroyRef, Input, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PC } from '../../../../models/pc';
import { DndSpell } from '../../../../models/dnd-api.types';
import { DEATH_COIL_DESC, EBON_BLADE_SUBCLASS, OathSpellEntry, RUNE_OPTIONS, ebonBladeOathSpells } from '../../../../models/hero-class';
import { DndResourcesService } from '../../../../services/dnd-resources.service';
import { modFromScore } from '../../../../utils/character-math';

/** Is this character a Death Knight (Paladin with the Oath of the Ebon Blade)? */
export function isEbonBlade(pc: Pick<PC, 'subclass'> | null | undefined): boolean {
  return pc?.subclass === EBON_BLADE_SUBCLASS;
}

/**
 * Oath of the Ebon Blade (Death Knight) panel — text only. Shows the chosen
 * rune, Death Coil (the subclass's replacement for Lay On Hands) and the
 * always-prepared oath spells for the character's level and rune. Derived
 * entirely from the PC's level/subclass/rune, so nothing is persisted and an
 * existing character picks up new rows as it levels. Spell text is looked up by
 * name in the shared spell data (WoW spells are stubs until their full text lands).
 */
@Component({
  selector: 'app-ebon-blade-panel',
  templateUrl: './ebon-blade-panel.component.html',
  styleUrls: ['./ebon-blade-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EbonBladePanelComponent {
  private readonly dndResources = inject(DndResourcesService);
  private readonly destroyRef = inject(DestroyRef);

  private _pc!: PC;
  /** Spell data keyed by lower-cased name; null until loaded (loaded once, on demand). */
  readonly spellIndex = signal<Map<string, DndSpell> | null>(null);
  private spellsRequested = false;

  @Input() set pc(value: PC) {
    this._pc = value;
    if (this.oathSpells.length) this.loadSpells();
  }
  get pc(): PC { return this._pc; }

  get runeDesc(): string {
    return RUNE_OPTIONS.find(r => r.name === this.pc.rune)?.desc ?? '';
  }

  readonly deathCoilDesc = DEATH_COIL_DESC;

  /** Death Coil pool size: 1 + CHA modifier (never below one die). */
  get deathCoilDice(): number {
    return Math.max(1, 1 + modFromScore(this.pc.stats?.CHA ?? 10));
  }

  /** Always-prepared oath spells at this level for this rune. */
  get oathSpells(): OathSpellEntry[] {
    return this._pc ? ebonBladeOathSpells(this._pc.level ?? 1, this._pc.rune) : [];
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
