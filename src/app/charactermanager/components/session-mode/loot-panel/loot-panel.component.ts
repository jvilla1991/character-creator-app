import { Component, Input, OnChanges } from '@angular/core';
import { Observable } from 'rxjs';
import { SessionState, ParticipantView } from '../../../models/session';
import { LootItem, LootOutcome, LootResultView, LootView } from '../../../models/loot';
import { CuratedLootSummary } from '../../../models/curated-loot';
import { formatCp } from '../../../models/shop';
import { AuthoredItem } from '../../item-composer/authored-item';
import { LootService } from '../../../services/loot.service';
import { CuratedLootService } from '../../../services/curated-loot.service';
import { PCService } from '../../../services/pc.service';
import { NotificationService } from '../../../services/notification.service';
import { FormsModule } from '@angular/forms';
import { ItemComposerComponent } from '../../item-composer/item-composer.component';
import { ModalComponent } from '../../modal/modal.component';
import {
  LootBallotCast, LootCoinChange, LootMove, LootSplitModalComponent,
} from '../loot-split-modal/loot-split-modal.component';

/** One character's line in a split summary ("Thessaly — Ruby, Scroll · 60 gp"). */
export interface ShareSummary {
  participantId: number;
  name: string;
  share: string;
}

/** Outcomes that end the drop for players — they get the outcome modal, not just a toast. */
const FINAL_OUTCOMES: ReadonlySet<LootOutcome> = new Set(['APPROVED', 'DM_APPROVED', 'PVP', 'DM_CANCELLED']);

/** An outcome older than this when first seen (a late join or reload) is not announced. */
const STALE_RESULT_MS = 2 * 60 * 1000;

/**
 * Session Mode post-combat loot. The DM prepares a pool — seeded from one of
 * the campaign's curated loot lists or built from scratch — edits it as an
 * invisible draft, then drops it. The party then splits it: players divide
 * the pile between their characters in {@link LootSplitModalComponent} and
 * vote on the split (majority ✓ distributes it; any ✗ + PvP cancels it back
 * to the DM's draft). The DM watches the split and votes live here and can
 * force it through or cancel it.
 *
 * State stays server-authoritative: every move and ballot hits the backend
 * and the returned pool replaces the local copy. Pool CONTENTS change under a
 * stable status (others move things and vote), so the poll-driven refetch is
 * keyed on the session version. The outcome arrives on the snapshot as
 * `lootResult` and is announced once per result id.
 */
@Component({
  selector: 'app-loot-panel',
  templateUrl: './loot-panel.component.html',
  styleUrls: ['./loot-panel.component.scss'],
  imports: [FormsModule, ItemComposerComponent, LootSplitModalComponent, ModalComponent]
})
export class LootPanelComponent implements OnChanges {
  @Input() state!: SessionState;

  loot: LootView | null = null;
  loading = false;
  /** A split/vote call is in flight. */
  busy = false;

  // DM prepare form
  source: 'list' | 'scratch' = 'list';
  lootListId: number | null = null;
  lootLists: CuratedLootSummary[] = [];
  nameDraft = '';

  /** The DM's coin pile input, in gp. */
  coinGpDraft: number | null = null;

  /** The player tucked the split modal away; it reopens when the phase changes. */
  minimized = false;
  private minimizedPhase: string | null = null;

  /** The outcome modal a player sees once the split resolves. */
  outcome: { result: LootResultView; shares: ShareSummary[] } | null = null;

  /**
   * Guards re-fetching on every 2s poll. Includes the version: split moves,
   * ballots and DM edits mutate the pool under a stable lootStatus, and every
   * one of them bumps the session version.
   */
  private fetchedKey: string | null = null;
  /** Guards re-loading the DM's curated loot lists per campaign. */
  private listsLoadedFor: string | null = null;
  /** The last split outcome seen; undefined until the first snapshot. */
  private lastResultId: number | null | undefined = undefined;
  /** The last voted-on split, kept so the outcome can say who got what. */
  private lastVotedSplit: LootView | null = null;

  readonly formatCp = formatCp;

  constructor(
    private lootService: LootService,
    private curatedLootService: CuratedLootService,
    private pcService: PCService,
    private notifications: NotificationService,
  ) {}

  ngOnChanges(): void {
    const s = this.state;
    if (!s) return;
    this.trackResult(s);
    if (s.lootStatus) {
      const key = `${s.sessionId}|${s.version}`;
      if (key !== this.fetchedKey) {
        this.fetchedKey = key;
        this.fetchLoot();
      }
    } else {
      this.loot = null;
      this.fetchedKey = null;
    }
    // The DM can seed the pool from a curated loot list — load them once.
    if (s.dm && `${s.campaignId}` !== this.listsLoadedFor) {
      this.listsLoadedFor = `${s.campaignId}`;
      this.curatedLootService.list(s.campaignId).subscribe({
        next: lists => (this.lootLists = lists),
        error: () => (this.lootLists = []),
      });
    }
  }

  get myParticipant(): ParticipantView | null {
    return (this.state?.participants ?? []).find(p => p.ownedByMe && p.pcId != null) ?? null;
  }

  /** Heading for the pool: its label or a generic fallback. */
  lootTitle(loot: LootView): string {
    return loot.name || 'Spoils';
  }

  /** The player sees the split modal while the pool is dropped and they haven't tucked it away. */
  get showSplitModal(): boolean {
    return !this.state.dm && !!this.loot?.dropped && !!this.myParticipant && !this.minimized && !this.outcome;
  }

  // --- DM actions ------------------------------------------------------------

  get canPrepare(): boolean {
    return this.source === 'scratch' || this.lootListId != null;
  }

  prepare(): void {
    const lootId = this.source === 'list' ? this.lootListId : null;
    this.lootService.open(this.state.sessionId, lootId, this.nameDraft.trim() || null).subscribe({
      next: view => this.setLoot(view),
      error: err => this.notifications.notify(this.errMsg(err, 'Could not prepare the loot. Try again.')),
    });
  }

  drop(): void {
    this.lootService.drop(this.state.sessionId).subscribe({
      next: view => this.setLoot(view),
      error: err => this.notifications.notify(this.errMsg(err, 'Could not drop the loot. Try again.')),
    });
  }

  close(): void {
    this.lootService.close(this.state.sessionId).subscribe({
      next: () => {
        this.loot = null;
        this.fetchedKey = null;
      },
      error: err => this.notifications.notify(this.errMsg(err, 'Could not close the loot. Try again.')),
    });
  }

  /** The shared composer authored a line — append it to the pool (draft or live). */
  onItemAuthored(item: AuthoredItem): void {
    if (!this.loot) return;
    this.lootService.addItem(this.state.sessionId, item).subscribe({
      next: view => this.setLoot(view),
      error: err => this.notifications.notify(this.errMsg(err, 'Could not add the item. Try again.')),
    });
  }

  changeQty(item: LootItem, qty: number): void {
    if (!qty || qty < 1) return;
    this.lootService.updateItem(this.state.sessionId, item.id, Math.floor(qty), null, null).subscribe({
      next: view => this.setLoot(view),
      error: err => this.notifications.notify(this.errMsg(err, 'Could not update the item. Try again.')),
    });
  }

  removeItem(item: LootItem): void {
    this.lootService.removeItem(this.state.sessionId, item.id).subscribe({
      next: view => this.setLoot(view),
      error: err => this.notifications.notify(this.errMsg(err, 'Could not remove the item. Try again.')),
    });
  }

  saveCoins(): void {
    if (this.coinGpDraft == null || this.coinGpDraft < 0) return;
    this.lootService.setCoins(this.state.sessionId, this.coinGpDraft).subscribe({
      next: view => this.setLoot(view),
      error: err => this.notifications.notify(this.errMsg(err, 'Could not set the coins. Try again.')),
    });
  }

  /** DM override: push the split through now, or take the loot back as a draft. */
  overrideSplit(action: 'APPROVE' | 'CANCEL'): void {
    this.run(this.lootService.override(this.state.sessionId, action),
      action === 'APPROVE' ? 'Could not push the split through.' : 'Could not cancel the split.');
  }

  /** The DM's view of the split: every character's share, in words. */
  get dmShares(): ShareSummary[] {
    return this.loot ? this.sharesOf(this.loot) : [];
  }

  get dmPileEmpty(): boolean {
    return !!this.loot && this.loot.coinCpRemaining === 0 && this.loot.items.every(i => i.qtyRemaining === 0);
  }

  ballotGlyph(participantId: number): string {
    const b = this.loot?.ballots.find(x => x.participantId === participantId);
    if (!b || b.vote == null) return '…';
    if (b.vote) return '✓';
    return b.pvp ? '✗ PvP' : b.pvp === false ? '✗' : '✗ …';
  }

  // --- player actions ---------------------------------------------------------

  onMove(m: LootMove): void {
    this.run(this.lootService.assign(this.state.sessionId, m.lootItemId, m.fromParticipantId, m.toParticipantId),
      'Could not move that item.');
  }

  onCoinChange(c: LootCoinChange): void {
    this.run(this.lootService.setCoinShare(this.state.sessionId, c.participantId, c.coinCp),
      'Could not change the coins.');
  }

  onSplitEvenly(): void {
    this.run(this.lootService.splitCoinsEvenly(this.state.sessionId), 'Could not split the coins.');
  }

  onPropose(): void {
    this.run(this.lootService.propose(this.state.sessionId), 'Could not start the vote.');
  }

  onBallot(b: LootBallotCast): void {
    this.run(this.lootService.vote(this.state.sessionId, b.vote, b.pvp), 'Could not cast your vote.');
  }

  minimize(): void {
    this.minimized = true;
    this.minimizedPhase = this.loot?.phase ?? null;
  }

  reopen(): void {
    this.minimized = false;
  }

  closeOutcome(): void {
    this.outcome = null;
  }

  outcomeTitle(o: LootOutcome): string {
    switch (o) {
      case 'APPROVED': case 'DM_APPROVED': return 'The split stands';
      case 'PVP': return 'Steel is drawn';
      case 'DM_CANCELLED': return 'Loot called back';
      default: return 'No majority';
    }
  }

  outcomeMessage(r: LootResultView): string {
    switch (r.outcome) {
      case 'APPROVED':
        return `The party agreed ${r.agreeCount} to ${r.objectCount}. Every item and coin is now in its character's inventory.`;
      case 'DM_APPROVED':
        return 'The DM pushed the split through. Every item and coin is now in its character’s inventory.';
      case 'PVP':
        return `${this.callers(r)} chose PvP. The loot is canceled — nobody receives anything, and the DM has been told to start the fight.`;
      case 'DM_CANCELLED':
        return 'The DM took the loot back. Nobody receives anything from this drop for now.';
      default:
        return 'Not enough of the party agreed, and nobody chose PvP. Rework the split and vote again.';
    }
  }

  // --- helpers -----------------------------------------------------------------

  /** Run a split/vote call; the returned pool replaces ours (null = it's gone for us). */
  private run(call: Observable<LootView | null>, fallback: string): void {
    if (this.busy) return;
    this.busy = true;
    call.subscribe({
      next: view => {
        this.busy = false;
        if (view) this.setLoot(view); else this.loot = null;
      },
      error: err => {
        this.busy = false;
        this.notifications.notify(this.errMsg(err, fallback));
        this.refetchNow();
      },
    });
  }

  /** Announce each new split outcome once (stale ones from before a reload stay quiet). */
  private trackResult(s: SessionState): void {
    const result = s.lootResult;
    const id = result?.id ?? null;
    const firstLook = this.lastResultId === undefined;
    if (id === this.lastResultId) return;
    this.lastResultId = id;
    if (!result) return;
    if (firstLook) {
      const age = result.createdAt ? Date.now() - Date.parse(result.createdAt) : Infinity;
      if (!(age < STALE_RESULT_MS)) return;
    }

    this.notifications.notify(this.toast(result, s.dm));
    if (s.dm || !FINAL_OUTCOMES.has(result.outcome)) return;

    const split = this.lastVotedSplit;
    this.outcome = {
      result,
      shares: split && (result.outcome === 'APPROVED' || result.outcome === 'DM_APPROVED' || result.outcome === 'PVP')
        ? this.sharesOf(split) : [],
    };
    this.lastVotedSplit = null;
    this.minimized = false;
    if (result.outcome === 'APPROVED' || result.outcome === 'DM_APPROVED') {
      // The server wrote our share into the sheet — pull the fresh character.
      const pcId = this.myParticipant?.pcId;
      if (pcId != null) this.pcService.refreshPC(pcId);
    }
  }

  private toast(r: LootResultView, dm: boolean): string {
    switch (r.outcome) {
      case 'APPROVED': return `Loot split approved ${r.agreeCount}–${r.objectCount}.`;
      case 'DM_APPROVED': return 'The loot split was pushed through.';
      case 'PVP': return dm
        ? `${this.callers(r)} called PvP — the loot is back in your draft.`
        : `${this.callers(r)} called PvP — the loot is canceled.`;
      case 'DM_CANCELLED': return dm ? 'Loot taken back as a draft.' : 'The DM took the loot back.';
      default: return `No majority (${r.agreeCount}–${r.objectCount}) — back to the pile.`;
    }
  }

  private callers(r: LootResultView): string {
    return r.pvpCallers.length ? r.pvpCallers.join(' and ') : 'Someone';
  }

  private sharesOf(view: LootView): ShareSummary[] {
    const byId = new Map(view.items.map(i => [i.id, i]));
    return view.recipients.map(r => {
      const parts = view.allocations
        .filter(a => a.participantId === r.participantId && byId.has(a.lootItemId))
        .map(a => a.qty > 1 ? `${byId.get(a.lootItemId)!.name} ×${a.qty}` : byId.get(a.lootItemId)!.name);
      const coins = view.coinShares.find(c => c.participantId === r.participantId)?.coinCp ?? 0;
      if (coins) parts.push(formatCp(coins));
      return { participantId: r.participantId, name: r.name, share: parts.length ? parts.join(', ') : 'Nothing' };
    });
  }

  private setLoot(view: LootView): void {
    this.loot = view;
    this.coinGpDraft = view.coinCpTotal > 0 ? view.coinCpTotal / 100 : null;
    if (view.phase === 'VOTING') this.lastVotedSplit = view;
    // A minimized modal pops back up when the phase moves on (the vote opened, or re-opened the split).
    if (this.minimized && this.minimizedPhase !== view.phase) this.minimized = false;
  }

  private fetchLoot(): void {
    this.loading = true;
    this.lootService.getLoot(this.state.sessionId).subscribe({
      next: view => {
        if (view) this.setLoot(view); else this.loot = null;
        this.loading = false;
      },
      error: () => {
        this.loot = null;
        this.loading = false;
      },
    });
  }

  /** After a failed move or vote (usually a 409 race), pull the fresh pool immediately. */
  private refetchNow(): void {
    this.fetchedKey = null;
    this.fetchLoot();
  }

  private errMsg(err: unknown, fallback: string): string {
    // HttpErrorResponse in real mode; a plain Error in demo mode.
    const e = err as { status?: number; error?: { message?: string } } | null;
    if (e?.status === 409) return e?.error?.message || 'Someone changed the split first.';
    if (e?.status === 403) return 'That character can’t take part in this split.';
    return e?.error?.message || fallback;
  }

  trackById(_: number, item: LootItem): number {
    return item.id;
  }
}
