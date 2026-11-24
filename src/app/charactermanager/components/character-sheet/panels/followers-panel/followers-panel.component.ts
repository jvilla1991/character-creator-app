import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { PC } from '../../../../models/pc';
import {
  Follower, FollowerKind, STAT_BLOCK_EXAMPLE, followerKind, parseStatBlock, playerMayDismiss,
} from '../../../../models/follower';
import { FollowerService } from '../../../../services/follower.service';
import { NotificationService } from '../../../../services/notification.service';
import { tintFor } from '../../../../utils/character-math';

/** What each kind of follower is called on its row. */
const KIND_LABELS: Record<FollowerKind, string> = {
  DM_GRANT: 'Granted',
  SUMMON: 'Summon',
  FAMILIAR: 'Familiar',
  COMPANION: 'Companion',
};

/**
 * The Followers tab: the companions a DM has granted this character and the
 * creatures its own spells made. Everyone who can see the sheet sees the list
 * and can open a follower's own sheet. The DM's cross-link view (`canGrant`)
 * gets the grant form and may dismiss any follower; the owner (`ownSheet`) may
 * dismiss their own summons and familiar — the server enforces the same rules.
 * Self-serviced via FollowerService, like the notes panel; opening a follower
 * is bubbled to the sheet, which swaps itself for the follower's sheet.
 */
@Component({
    selector: 'app-followers-panel',
    templateUrl: './followers-panel.component.html',
    styleUrls: ['./followers-panel.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule]
})
export class FollowersPanelComponent implements OnChanges {
  @Input() pc!: PC;
  /** DM cross-link view — reveals Grant Follower and Dismiss. */
  @Input() canGrant = false;
  /** The viewer owns this character — reveals Dismiss on their own summons and familiar. */
  @Input() ownSheet = false;
  /** The player (or DM) clicked a follower — the sheet opens its sheet. */
  readonly followerOpened = output<Follower>();

  // Signals: all written from HTTP callbacks, which don't mark an OnPush view
  // dirty on their own. The form drafts stay plain fields (template events only).
  readonly followers = signal<Follower[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  /** Follower awaiting a second click to confirm its dismissal. */
  readonly confirmingDismissId = signal<number | null>(null);

  grantFormOpen = false;
  nameDraft = '';
  statBlockDraft = '';

  private readonly notifications = inject(NotificationService);

  constructor(private followerService: FollowerService) {
    // Someone else changed this character's followers (the DM granted one
    // mid-session; the session snapshot showed one hurt): re-list.
    this.followerService.changes$.pipe(takeUntilDestroyed()).subscribe(change => {
      if (change.pcId === this.pc?.id) this.refresh();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const previous = changes['pc']?.previousValue as PC | undefined;
    if (changes['pc'] && this.pc?.id != null && this.pc.id !== previous?.id) {
      this.closeGrantForm();
      this.load();
    }
  }

  // ── List ───────────────────────────────────────────────────────────────────

  tintFor(follower: Follower): string { return tintFor(follower.statBlock); }

  /** "Granted", "Summon", "Familiar" or "Companion": what the follower is. */
  kindLabel(follower: Follower): string { return KIND_LABELS[followerKind(follower)]; }

  /** Whether this viewer may dismiss the follower: the DM any, the owner their own summon or familiar. */
  canDismiss(follower: Follower): boolean {
    return this.canGrant || (this.ownSheet && playerMayDismiss(follower));
  }

  initialsFor(follower: Follower): string {
    return (follower.statBlock.portraitInitials || follower.name.slice(0, 2)).toUpperCase();
  }

  /** One-line identity under the name, e.g. "Human Guard · Level 2". */
  summaryFor(follower: Follower): string {
    const block = follower.statBlock;
    const kind = [block.race, block.clazz].filter(Boolean).join(' ');
    return [kind, 'Level ' + (block.level ?? 1)].filter(Boolean).join(' · ');
  }

  private load(): void {
    this.followers.set([]);
    this.loading.set(true);
    this.followerService.list(this.pc.id).subscribe({
      next: followers => { this.followers.set(followers); this.loading.set(false); },
      // Not readable (stranger / offline) — leave the list empty.
      error: () => { this.loading.set(false); },
    });
  }

  /**
   * Re-list without the loading state, keeping what is on screen until the
   * fresh list lands. Skipped while this panel's own grant or dismissal is in
   * flight (it applies its result itself); the grant form's drafts are never
   * touched; a failed re-list keeps the current list.
   */
  private refresh(): void {
    if (this.saving() || this.loading()) return;
    const pcId = this.pc.id;
    this.followerService.list(pcId).subscribe({
      next: followers => {
        if (this.pc?.id !== pcId || this.saving()) return;
        this.followers.set(followers);
        const confirming = this.confirmingDismissId();
        if (confirming !== null && !followers.some(f => f.id === confirming)) this.confirmingDismissId.set(null);
      },
      error: () => {},
    });
  }

  // ── Grant (DM) ─────────────────────────────────────────────────────────────

  openGrantForm(): void {
    this.grantFormOpen = true;
    this.formError.set(null);
  }

  closeGrantForm(): void {
    this.grantFormOpen = false;
    this.nameDraft = '';
    this.statBlockDraft = '';
    this.formError.set(null);
  }

  /** Drop the worked example into the editor so the DM can author by example. */
  insertExample(): void {
    this.statBlockDraft = STAT_BLOCK_EXAMPLE;
    this.formError.set(null);
  }

  submitGrant(): void {
    const name = this.nameDraft.trim();
    if (!name || !this.statBlockDraft.trim() || this.saving()) return;
    const { statBlock, error } = parseStatBlock(this.statBlockDraft);
    if (!statBlock) {
      this.formError.set(error ?? 'Could not read that stat block.');
      return;
    }
    this.formError.set(null);
    this.saving.set(true);
    this.followerService.grant(this.pc.id, name, statBlock).subscribe({
      next: follower => {
        this.followers.update(list => [...list, follower]);
        this.saving.set(false);
        this.closeGrantForm();
      },
      error: err => {
        this.saving.set(false);
        this.formError.set(err?.error?.message ?? 'Could not grant the follower. Try again.');
      },
    });
  }

  // ── Dismiss (DM, or the owner for a summon or familiar) ────────────────────
  // Two clicks: the first arms the row, the second removes the follower for good.

  askDismiss(follower: Follower): void { this.confirmingDismissId.set(follower.id); }
  cancelDismiss(): void { this.confirmingDismissId.set(null); }

  confirmDismiss(follower: Follower): void {
    if (this.saving() || !this.canDismiss(follower)) return;
    this.saving.set(true);
    this.followerService.dismiss(this.pc.id, follower.id, this.canGrant).subscribe({
      next: () => {
        this.followers.update(list => list.filter(f => f.id !== follower.id));
        this.confirmingDismissId.set(null);
        this.saving.set(false);
      },
      error: err => {
        this.notifications.error(`Could not dismiss ${follower.name}. They are still with you — try again.`, err);
        this.confirmingDismissId.set(null);
        this.saving.set(false);
      },
    });
  }
}
