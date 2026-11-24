import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { PC } from '../../../models/pc';
import { Follower, followerKind } from '../../../models/follower';
import {
  BuiltSpellFollower, ELEMENTAL_DAMAGE_TYPES, OTHERWORLDLY_DAMAGE_TYPES, buildSpellFollower,
  familiarFeatsOf, followerSpellFor, slotLevelsFor,
} from '../../../models/spell-followers';
import { FollowerService } from '../../../services/follower.service';
import { NotificationService } from '../../../services/notification.service';
import { ordinal } from '../../../utils/spell-slots';
import { ModalComponent } from '../../modal/modal.component';

let nextId = 0;

const ADD_FAILED = 'Could not add the follower. Try again.';

/**
 * "Add as follower" for a spell that makes a creature (Find Familiar, Battle
 * Familiar, Summon Dinosaur, Summon Plant). The player names it and picks what
 * that spell lets them pick: the slot level, the form, the creature type, and
 * for a familiar the damage type a feat asks for. The stat block is built from
 * those choices and the caster's own numbers, then saved as a follower.
 *
 * It does not cast the spell: no slot is spent here. It renders its own
 * backdrop, so a click outside goes through the same guard as Cancel and
 * nothing closes while the save is on its way.
 */
@Component({
  selector: 'app-spell-follower-dialog',
  templateUrl: './spell-follower-dialog.component.html',
  styleUrls: ['./spell-follower-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent],
})
export class SpellFollowerDialogComponent implements OnInit {
  /** The caster: the character whose spell this is. */
  readonly pc = input.required<PC>();
  /** The spell "Add as follower" was pressed on. */
  readonly spellName = input.required<string>();
  /** Closed: cancelled, or the follower was added. */
  readonly closed = output<void>();

  private readonly followers = inject(FollowerService);
  private readonly notifications = inject(NotificationService);

  /** Keeps this dialog's field ids apart from any other form on the page. */
  readonly uid = `spell-follower-${++nextId}`;
  readonly elementalTypes = ELEMENTAL_DAMAGE_TYPES;
  readonly otherworldlyTypes = OTHERWORLDLY_DAMAGE_TYPES;

  readonly spell = computed(() => followerSpellFor(this.spellName()));
  readonly slotLevels = computed(() => {
    const spell = this.spell();
    return spell?.scales ? slotLevelsFor(spell).map(level => ({ level, label: `${ordinal(level)} level` })) : [];
  });
  private readonly feats = computed(() => familiarFeatsOf(this.pc()));
  private readonly isFindFamiliar = computed(() => this.spell()?.name === 'Find Familiar');
  private readonly isBattleFamiliar = computed(() => this.spell()?.name === 'Battle Familiar');
  /** The feats that ask for a damage type act when Find Familiar is cast, and only then. */
  readonly asksElemental = computed(() => this.isFindFamiliar() && this.feats().elemental);
  readonly asksOtherworldly = computed(() => this.isFindFamiliar() && this.feats().otherworldly);

  // The choices. Empty until ngOnInit seeds them from the spell.
  readonly form = signal('');
  readonly slotLevel = signal(0);
  readonly creatureType = signal('');
  readonly elementalDamage = signal<string>(ELEMENTAL_DAMAGE_TYPES[0]);
  readonly otherworldlyDamage = signal<string>(OTHERWORLDLY_DAMAGE_TYPES[0]);
  /** Battle Familiar: empower the current familiar instead of conjuring a new creature. */
  readonly empower = signal(false);

  /** The character's familiar right now, if it has one. */
  readonly currentFamiliar = signal<Follower | null>(null);
  /** Find Familiar: the familiar this one will replace. */
  readonly replaces = computed(() => (this.isFindFamiliar() ? this.currentFamiliar() : null));
  /** Battle Familiar: the familiar it can empower. */
  readonly empowerable = computed(() => (this.isBattleFamiliar() ? this.currentFamiliar() : null));
  private readonly empowered = computed(() => (this.empower() ? this.empowerable() : null));
  /** An empowered familiar keeps its own creature type, so there is nothing to pick. */
  readonly asksCreatureType = computed(() => (this.spell()?.creatureTypes.length ?? 0) > 0 && !this.empowered());

  readonly built = computed<BuiltSpellFollower | null>(() => buildSpellFollower(this.spellName(), this.pc(), {
    form: this.form(),
    slotLevel: this.slotLevel(),
    creatureType: this.creatureType(),
    elementalDamage: this.elementalDamage(),
    otherworldlyDamage: this.otherworldlyDamage(),
    empower: this.empowered(),
  }));

  /** The name as typed; null until the player types one, so it follows the form until then. */
  private readonly typedName = signal<string | null>(null);
  readonly name = computed(() => this.typedName() ?? this.built()?.name ?? '');

  /** "AC 17 · HP 70": what the choices come to, so a higher slot shows its worth. */
  readonly summary = computed(() => {
    const block = this.built()?.statBlock;
    if (!block?.hp) return '';
    const temp = block.hp.temp ? ` + ${block.hp.temp} temporary` : '';
    return `AC ${block.ac} · HP ${block.hp.max}${temp}`;
  });

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly canAdd = computed(() => !!this.built() && this.name().trim().length > 0 && !this.saving());

  ngOnInit(): void {
    const spell = this.spell();
    if (!spell) return;
    this.form.set(spell.forms[0]);
    this.slotLevel.set(spell.level);
    this.creatureType.set(spell.creatureTypes[0] ?? '');
    if (spell.name !== 'Find Familiar' && spell.name !== 'Battle Familiar') return;
    // Both spells care about the familiar the character already has. A list
    // that cannot be read leaves the dialog as it is: the server still
    // replaces a familiar on its own.
    this.followers.list(this.pc().id).subscribe({
      next: list => {
        const familiar = [...list].reverse().find(f => followerKind(f) === 'FAMILIAR') ?? null;
        this.currentFamiliar.set(familiar);
        // A familiar at 0 Hit Points has disappeared, so there is nothing to empower by default.
        this.empower.set(spell.name === 'Battle Familiar' && (familiar?.statBlock.hp?.cur ?? 0) > 0);
      },
      error: () => {},
    });
  }

  onName(value: string): void { this.typedName.set(value); }
  onSlotLevel(value: string): void { this.slotLevel.set(Number(value)); }

  add(): void {
    const built = this.built();
    if (!built || !this.canAdd()) return;
    const name = this.name().trim();
    this.error.set(null);
    this.saving.set(true);
    this.followers.summon(this.pc().id, name, built.statBlock, built.kind).subscribe({
      next: () => {
        this.saving.set(false);
        this.notifications.notify(`${name} joined your followers.`);
        this.closed.emit();
      },
      error: err => {
        this.saving.set(false);
        const message = err?.status >= 400 && err?.status < 500 ? err?.error?.message : null;
        this.error.set(typeof message === 'string' && message.trim() ? message.trim() : ADD_FAILED);
      },
    });
  }

  /** Cancel, the close button, Escape and a click on the backdrop. Waits out a save. */
  dismiss(): void {
    if (!this.saving()) this.closed.emit();
  }
}
