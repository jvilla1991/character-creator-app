import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../modal/modal.component';
import { LootBallot, LootItem, LootRecipient, LootView } from '../../../models/loot';
import { formatCp } from '../../../models/shop';

/** A pile → character, character → pile or character → character move of one unit. */
export interface LootMove {
  lootItemId: number;
  fromParticipantId: number | null;
  toParticipantId: number | null;
}

export interface LootCoinChange {
  participantId: number;
  coinCp: number;
}

export interface LootBallotCast {
  vote: boolean | null;
  pvp: boolean | null;
}

/** One line of a character's share, as the cards render it. */
export interface ShareLine {
  item: LootItem;
  qty: number;
}

/** A character card: who, what they hold, and their vote. */
export interface PartyCard {
  recipient: LootRecipient;
  lines: ShareLine[];
  coinCp: number;
  valueCp: number;
  ballot: LootBallot | null;
}

/** A coin step on the share steppers: 10 gp. */
const COIN_STEP_CP = 1000;

/**
 * The player's party-split modal. Two faces, chosen by the pool's phase:
 *
 * - SPLITTING: the pile on one side, every seated character on the other.
 *   Pick an item, then give it to someone (in-card buttons on wide screens,
 *   a "Give to…" tray on phones); return it with the arrow; set coins with
 *   the steppers or split them evenly. Anyone may move anything — the vote
 *   is the check. "Send split to vote" unlocks once the pile is empty.
 * - VOTING: the split is read-only. The viewer answers ✓ or ✗; a ✗ then asks
 *   "Settle it with steel?" (PvP cancels the loot for everyone).
 *
 * Purely presentational: every action is an output the loot panel turns into
 * an API call, and the pool it renders is always the server's latest.
 * Dismissing it only minimizes it — the split keeps going without you.
 */
@Component({
  selector: 'app-loot-split-modal',
  templateUrl: './loot-split-modal.component.html',
  styleUrls: ['./loot-split-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent],
})
export class LootSplitModalComponent {
  readonly loot = input.required<LootView>();
  /** True while a call is in flight — buttons hold still. */
  readonly busy = input(false);

  readonly move = output<LootMove>();
  readonly coinChange = output<LootCoinChange>();
  readonly splitEvenly = output<void>();
  readonly propose = output<void>();
  readonly ballotCast = output<LootBallotCast>();
  readonly minimize = output<void>();

  readonly formatCp = formatCp;

  /** The pile item the viewer picked, waiting for "give to". */
  readonly selectedId = signal<number | null>(null);

  constructor() {
    // A picked item that left the pile (someone else moved it) is unpicked.
    effect(() => {
      const id = this.selectedId();
      if (id != null && !this.pile().some(i => i.id === id)) this.selectedId.set(null);
    });
  }

  readonly title = computed(() => this.loot().name || 'Divide the Spoils');
  readonly voting = computed(() => this.loot().phase === 'VOTING');

  readonly pile = computed(() => this.loot().items.filter(i => i.qtyRemaining > 0));
  readonly selected = computed(() => this.pile().find(i => i.id === this.selectedId()) ?? null);

  readonly cards = computed<PartyCard[]>(() => {
    const loot = this.loot();
    const byId = new Map(loot.items.map(i => [i.id, i]));
    return loot.recipients.map(r => {
      const lines = loot.allocations
        .filter(a => a.participantId === r.participantId && byId.has(a.lootItemId))
        .map(a => ({ item: byId.get(a.lootItemId)!, qty: a.qty }));
      const coinCp = loot.coinShares.find(c => c.participantId === r.participantId)?.coinCp ?? 0;
      const valueCp = lines.reduce((sum, l) => sum + (l.item.valueCp ?? 0) * l.qty, 0) + coinCp;
      const ballot = loot.ballots.find(b => b.participantId === r.participantId) ?? null;
      return { recipient: r, lines, coinCp, valueCp, ballot };
    });
  });

  /** Items left, counting each unit of a stack (header and footer agree). */
  readonly pileUnits = computed(() => this.pile().reduce((n, i) => n + i.qtyRemaining, 0));

  readonly pileEmpty = computed(() => this.pile().length === 0 && this.loot().coinCpRemaining === 0);
  readonly nothingToSplit = computed(() => this.loot().items.length === 0 && this.loot().coinCpTotal === 0);

  /** What's still unclaimed, in words, for the footer. */
  readonly pileStatus = computed(() => {
    if (this.pileEmpty()) return 'Everything has an owner. Send it to the party for a vote.';
    const bits: string[] = [];
    const count = this.pile().reduce((n, i) => n + i.qtyRemaining, 0);
    if (count) bits.push(`${count} item${count === 1 ? '' : 's'}`);
    if (this.loot().coinCpRemaining) bits.push(formatCp(this.loot().coinCpRemaining));
    return `Still in the pile: ${bits.join(' and ')}. Everything needs an owner before the vote.`;
  });

  // --- vote -----------------------------------------------------------------

  readonly myBallot = computed(() => this.loot().ballots.find(b => b.mine) ?? null);
  readonly agreeCount = computed(() => this.loot().ballots.filter(b => b.vote === true).length);
  /** Settled ✗ only — a ✗ still deciding on PvP counts as pending, so the tally adds up. */
  readonly objectCount = computed(() => this.loot().ballots.filter(b => b.vote === false && b.pvp != null).length);
  readonly pendingCount = computed(() =>
    this.loot().ballots.filter(b => !(b.vote === true || (b.vote === false && b.pvp != null))).length);

  /** The viewer still owes a ✓ or ✗. */
  readonly needBallot = computed(() => this.voting() && this.myBallot() != null && this.myBallot()!.vote == null);
  /** The viewer said ✗ and still owes the PvP answer. */
  readonly needPvpChoice = computed(() => {
    const b = this.myBallot();
    return this.voting() && b != null && b.vote === false && b.pvp == null;
  });
  /** The viewer's ballot is settled; they wait on the rest of the table. */
  readonly waiting = computed(() => this.voting() && !this.needBallot() && !this.needPvpChoice());

  readonly myVoteText = computed(() => {
    const b = this.myBallot();
    if (!b) return '';
    if (b.vote === true) return '✓ Agree';
    return b.pvp ? '✗ Object, with PvP' : '✗ Object';
  });

  readonly waitingOn = computed(() => this.loot().ballots
    .filter(b => !b.mine && !(b.vote === true || (b.vote === false && b.pvp != null)))
    .map(b => b.name));

  // --- actions ----------------------------------------------------------------

  pick(item: LootItem): void {
    this.selectedId.set(this.selectedId() === item.id ? null : item.id);
  }

  giveTo(card: PartyCard): void {
    const item = this.selected();
    if (!item || this.busy()) return;
    this.move.emit({ lootItemId: item.id, fromParticipantId: null, toParticipantId: card.recipient.participantId });
    this.selectedId.set(null);
  }

  returnToPile(card: PartyCard, line: ShareLine): void {
    if (this.busy()) return;
    this.move.emit({ lootItemId: line.item.id, fromParticipantId: card.recipient.participantId, toParticipantId: null });
  }

  moreCoins(card: PartyCard): void {
    const step = Math.min(COIN_STEP_CP, this.loot().coinCpRemaining);
    if (step <= 0 || this.busy()) return;
    this.coinChange.emit({ participantId: card.recipient.participantId, coinCp: card.coinCp + step });
  }

  lessCoins(card: PartyCard): void {
    if (card.coinCp <= 0 || this.busy()) return;
    this.coinChange.emit({ participantId: card.recipient.participantId, coinCp: Math.max(0, card.coinCp - COIN_STEP_CP) });
  }

  // --- view helpers -------------------------------------------------------------

  /** Coins for display; an empty share reads "0 gp", not "0 cp". */
  gp(cp: number): string {
    return cp > 0 ? formatCp(cp) : '0 gp';
  }

  /** The rarity-ish dot: gold for treasure, emerald for priced gear, dim otherwise. */
  dotClass(item: LootItem): string {
    if (item.category === 'treasure') return 'dot treasure';
    return (item.valueCp ?? 0) >= 5000 ? 'dot notable' : 'dot';
  }

  itemMeta(item: LootItem): string {
    const parts: string[] = [];
    if (item.qtyRemaining > 1) parts.push(`×${item.qtyRemaining}`);
    if (item.valueCp) parts.push(formatCp(item.valueCp) + (item.qtyRemaining > 1 ? ' each' : ''));
    return parts.join(' · ');
  }

  lineLabel(line: ShareLine): string {
    return line.qty > 1 ? `${line.item.name} ×${line.qty}` : line.item.name;
  }

  ballotText(card: PartyCard): string {
    const b = card.ballot;
    if (!b || b.vote == null) return 'Deciding…';
    if (b.vote) return 'Agreed';
    return b.pvp == null ? 'Objecting…' : 'Objected';
  }

  ballotClass(card: PartyCard): string {
    const b = card.ballot;
    if (!b || b.vote == null || (b.vote === false && b.pvp == null)) return 'badge pending';
    return b.vote ? 'badge yes' : 'badge no';
  }

  /** The share as one line ("Longsword, Potion ×2 · 60 gp"), for the read-only vote cards. */
  shareLine(card: PartyCard): string {
    const parts = card.lines.map(l => this.lineLabel(l));
    if (card.coinCp) parts.push(formatCp(card.coinCp));
    return parts.length ? parts.join(', ') : 'Nothing';
  }
}
