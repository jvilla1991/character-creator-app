import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { PC, PcSpell } from '../../../models/pc';
import { heroClassFor, heroClassSpells, subclassSpellsFor } from '../../../models/hero-class';
import { modFromScore } from '../../../utils/character-math';
import { LongRestDraft } from '../../../utils/long-rest-choices';
import {
  canToggleLongRestSpell, leveledSpells, longRestSpellChange, preparedSpellCap, samePreparedList,
} from '../../../utils/spell-preparation';
import {
  MeleeWeapon, bloodRuneTempHp, isBloodRune, isRuneforger, meleeWeapons, runeName,
} from '../../../utils/rune-weapon';

/**
 * The choices a hero makes as a long rest ends, projected into the player's
 * long rest screen between the recovery summary and Ready:
 *
 * - Prepared spells, for the classes that change them at a long rest. Cleric,
 *   Druid and Wizard may change any number; Paladin and Ranger may replace
 *   one, so their list starts folded away behind "Change a Spell".
 * - The Death Knight's rune weapon (Runeforging, level 3+).
 *
 * Presentational: the draft lives with the session screen (it must survive
 * the poll redrawing the dialog), and every change is emitted as a new draft.
 * `locked` is set while the hero is Ready — the choices have been sent, so
 * they are read-only until the player takes Ready back.
 */
@Component({
  selector: 'app-long-rest-choices',
  templateUrl: './long-rest-choices.component.html',
  styleUrls: ['./long-rest-choices.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LongRestChoicesComponent {
  readonly pc = input.required<PC>();
  readonly draft = input.required<LongRestDraft>();
  readonly locked = input(false);

  readonly draftChange = output<LongRestDraft>();

  // ── Prepared spells ───────────────────────────────────────────────────────

  readonly spellChange = computed(() => longRestSpellChange(this.pc().clazz));
  readonly spells = computed<PcSpell[]>(() => leveledSpells(this.pc().spells));
  readonly cap = computed(() => preparedSpellCap(this.pc().clazz, this.pc().level));
  readonly showSpells = computed(() => this.spellChange() !== 'NONE' && this.spells().length > 0);

  /** A one-swap class keeps the list folded until the player asks for it. */
  private readonly opened = signal(false);
  readonly listOpen = computed(() =>
    this.spellChange() === 'ANY' || this.opened() || this.spellsChanged());

  readonly spellsChanged = computed(() =>
    !samePreparedList(this.draft().originalSpells, this.draft().spells));

  /** Spells the class or oath keeps ready on top of the chosen list. */
  readonly alwaysReady = computed<string[]>(() => {
    const pc = this.pc();
    const hero = heroClassFor(pc);
    if (!hero) return [];
    const names = [
      ...heroClassSpells(hero, pc.level ?? 1, pc.specialization),
      ...subclassSpellsFor(hero, pc.subclass, pc.level ?? 1),
    ].map(e => e.name);
    return [...new Set(names)];
  });

  readonly spellHint = computed(() => (this.spellChange() === 'ONE'
    ? 'You can replace one prepared spell.'
    : 'Your current list is ticked. Change as many as you like.'));

  readonly spellStatus = computed(() => {
    const d = this.draft();
    if (this.locked()) return 'Take back Ready to change your spells.';
    const added = d.spells.filter(n => !d.originalSpells.includes(n)).length;
    const removed = d.originalSpells.filter(n => !d.spells.includes(n)).length;
    if (this.spellChange() === 'ONE' && added === 1 && removed === 1) {
      return 'One spell replaced. Use Same as Before to pick again.';
    }
    if (this.spellChange() === 'ONE' && removed === 1) return 'Now tick the spell that takes its place.';
    const cap = this.cap();
    if (cap == null) return '';
    const left = cap - d.spells.length;
    if (left <= 0) return 'Your list is full. Untick a spell to make room for another.';
    return this.spellChange() === 'ONE' && added === 1
      ? 'One spell added. Use Same as Before to pick again.'
      : `You can prepare ${left} more.`;
  });

  isSelected(name: string): boolean {
    return this.draft().spells.includes(name);
  }

  canToggle(name: string): boolean {
    const d = this.draft();
    return !this.locked()
      && canToggleLongRestSpell(name, d.originalSpells, d.spells, this.spellChange(), this.cap());
  }

  toggle(name: string): void {
    if (!this.canToggle(name)) return;
    const d = this.draft();
    const spells = d.spells.includes(name) ? d.spells.filter(n => n !== name) : [...d.spells, name];
    this.draftChange.emit({ ...d, spells });
  }

  openList(): void { this.opened.set(true); }

  resetSpells(): void {
    const d = this.draft();
    this.draftChange.emit({ ...d, spells: [...d.originalSpells] });
  }

  // ── Death Knight: rune weapon ─────────────────────────────────────────────

  readonly runeforger = computed(() => isRuneforger(this.pc()));
  readonly weapons = computed<MeleeWeapon[]>(() => meleeWeapons(this.pc()));
  readonly runeName = computed(() => runeName(this.pc()));
  readonly blood = computed(() => isBloodRune(this.pc()));
  /** What the Blood Rune gives once a weapon carries it. */
  readonly bloodTempHp = computed(() => bloodRuneTempHp(this.pc(), true));
  readonly bloodHow = computed(() => {
    const mod = modFromScore(this.pc().stats?.CHA ?? 10);
    return `Charisma ${mod >= 0 ? '+' + mod : '−' + Math.abs(mod)}, plus Paladin level ${this.pc().level}`;
  });

  weaponNote(name: string): string {
    const original = this.draft().originalRune;
    if (original === name) return 'The rune is here now';
    return original ? 'Move the rune to this weapon' : 'Inscribe the rune on this weapon';
  }

  setRune(name: string): void {
    if (this.locked()) return;
    this.draftChange.emit({ ...this.draft(), rune: name });
  }
}
