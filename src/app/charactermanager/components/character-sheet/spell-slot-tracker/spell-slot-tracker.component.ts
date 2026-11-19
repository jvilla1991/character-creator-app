import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { PC } from '../../../models/pc';
import { SlotLevel, SlotNotice, ordinal, slotLevels, slotsLeftText } from '../../../utils/spell-slots';

let nextId = 0;

/** Most bars one column draws; a larger maximum is drawn to scale (the count beside it is exact). */
export const MAX_SLOT_BARS = 8;

/** One column of the strip: a spell level and its stack of bars, top to bottom. */
interface SlotColumn extends SlotLevel {
  label: string;
  ariaLabel: string;
  /** One entry per bar, top first; true = spent (hollow). Spent bars sit on top, so the stack drains from the top. */
  bars: boolean[];
}

/**
 * The spell slot strip at the top of the Spells tab: one equal-width column
 * per spell level the character has slots for, in a single row that never
 * wraps. A filled bar is a slot still AVAILABLE; a hollow bar is spent.
 * Tapping a column opens a detail row for that level underneath.
 *
 * Presentational: it shows the slots it is given and emits what the viewer
 * asks for; the host decides who may do what and talks to the server. Nothing
 * here changes a count by itself, so the strip always shows what the host
 * last confirmed. With no slot level at all it renders nothing.
 */
@Component({
  selector: 'app-spell-slot-tracker',
  templateUrl: './spell-slot-tracker.component.html',
  styleUrls: ['./spell-slot-tracker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpellSlotTrackerComponent {
  /** The character's slots, as stored: `{ 1: { max: 4, used: 1 } }`. */
  readonly slots = input<PC['spellSlots'] | null | undefined>(null);
  /** Whose slots these are. A different character starts with nothing selected. */
  readonly characterId = input<number | null>(null);
  /** The viewer may spend a slot by hand: the owner, or the DM. */
  readonly canSpend = input(false);
  /** The viewer may give slots back: the DM, or the owner of a character in no campaign. */
  readonly canRestore = input(false);
  /** Offer "Slot maximum" in the detail row: how the level's maximum is made up. */
  readonly showMaximum = input(false);
  /**
   * Spell levels to show although their maximum is zero: levels the DM's lines
   * took away. Only for a viewer who can open "Slot maximum" and undo that.
   */
  readonly extraLevels = input<readonly number[]>([]);
  /** A spend or restore is on its way to the server; further taps wait for it. */
  readonly busy = input(false);
  /**
   * What just happened to the slots, to say in the detail row: "Misty Step cast
   * with a 2nd-level slot." A new notice also selects the level it is about.
   */
  readonly notice = input<SlotNotice | null>(null);

  /** Spend one slot of this spell level. */
  readonly spend = output<number>();
  /** Give one slot of this spell level back. */
  readonly restore = output<number>();
  /** Give every spent slot back. */
  readonly restoreAll = output<void>();
  /** Show how this spell level's maximum is made up. */
  readonly maximumRequested = output<number>();

  readonly headingId = `spell-slots-heading-${++nextId}`;

  /** The level the viewer tapped; kept while that level still exists. */
  private readonly selected = signal<number | null>(null);
  /** The line under the detail title, until the viewer picks a column again. */
  readonly note = signal<string | null>(null);

  readonly columns = computed<SlotColumn[]>(() => {
    const levels = slotLevels(this.slots());
    for (const level of this.extraLevels()) {
      if (!levels.some(l => l.level === level)) levels.push({ level, max: 0, used: 0, left: 0 });
    }
    return levels.sort((a, b) => a.level - b.level).map(level => ({
      ...level,
      label: ordinal(level.level),
      ariaLabel: `${ordinal(level.level)} level: ${level.left} of ${level.max} slots left`,
      bars: barsFor(level),
    }));
  });

  /** The selected column, or null when nothing is selected or its level is gone. */
  readonly active = computed<SlotColumn | null>(() =>
    this.columns().find(column => column.level === this.selected()) ?? null);

  /** "3rd-level slots: 1 of 3 left" */
  readonly detailTitle = computed(() => {
    const active = this.active();
    return active ? `${active.label}-level slots: ${slotsLeftText(active).toLowerCase()}` : '';
  });

  readonly anySpent = computed(() => this.columns().some(column => column.used > 0));

  /** The notice this strip was created with: old news, never shown. */
  private seenNotice: SlotNotice | null | undefined;

  constructor() {
    // Another character took over the sheet: its predecessor's selection and note do not carry.
    effect(() => {
      this.characterId();
      untracked(() => {
        this.selected.set(null);
        this.note.set(null);
      });
    });
    // A notice that arrives while the strip is on screen is said, and its level selected.
    effect(() => {
      const notice = this.notice();
      untracked(() => {
        const first = this.seenNotice === undefined;
        const fresh = notice !== this.seenNotice;
        this.seenNotice = notice;
        if (first || !fresh || !notice) return;
        this.note.set(notice.text);
        if (notice.level != null) this.selected.set(notice.level);
      });
    });
  }

  /** Tap a column to open its detail row; tap it again to close it. */
  toggle(level: number): void {
    this.selected.set(this.active()?.level === level ? null : level);
    this.note.set(null);
  }

  onSpend(): void {
    const active = this.active();
    if (active && this.canSpend() && !this.busy() && active.left > 0) this.spend.emit(active.level);
  }

  onRestore(): void {
    const active = this.active();
    if (active && this.canRestore() && !this.busy() && active.used > 0) this.restore.emit(active.level);
  }

  onRestoreAll(): void {
    if (this.canRestore() && !this.busy() && this.anySpent()) this.restoreAll.emit();
  }

  onMaximum(): void {
    const active = this.active();
    if (!active || !this.showMaximum()) return;
    // The maximum may be about to change; "All slots restored." would be stale beside the new count.
    this.note.set(null);
    this.maximumRequested.emit(active.level);
  }
}

/**
 * The bars of one column. One bar per slot up to {@link MAX_SLOT_BARS}; past
 * that (a DM's bonus lines can go far) the stack is drawn to scale, never
 * showing "all left" or "none left" unless that is true.
 */
function barsFor(level: SlotLevel): boolean[] {
  const count = Math.min(level.max, MAX_SLOT_BARS);
  let spent = level.used;
  if (level.max > MAX_SLOT_BARS) {
    spent = level.used === 0 ? 0
      : level.used === level.max ? count
      : Math.max(1, Math.min(count - 1, Math.round(level.used / level.max * count)));
  }
  return Array.from({ length: count }, (_, i) => i < spent);
}
