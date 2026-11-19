import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PC } from '../../../models/pc';
import { Follower, followerToPc } from '../../../models/follower';
import { FollowerService } from '../../../services/follower.service';
import { passiveScore, tintFor } from '../../../utils/character-math';
import { ClassDisplayPipe } from '../../../pipes/class-display.pipe';

/** A follower chosen on the board, with the member it belongs to. */
export interface BoardFollowerRef {
  owner: PC;
  follower: Follower;
}

/** One follower row: the follower itself plus its sheet-shaped view, so the
 *  row runs the same HP / passive / condition math as a member row. */
interface FollowerRow {
  follower: Follower;
  pc: PC;
}

interface MemberRow {
  pc: PC;
  followers: FollowerRow[];
}

/**
 * Party Vitals Board — one row per campaign member with HP bar, AC, passive
 * Perception/Insight and conditions. Clicking a row opens that hero's sheet.
 *
 * Each member's followers sit in nested rows under it (expanded until the DM
 * collapses them with the member row's toggle); clicking one opens that
 * follower's sheet. The board fetches the followers itself, one request per
 * member, every time the member list is replaced (which is what Refresh party
 * and returning to the tab do), and re-lists a single member whenever
 * FollowerService says that member's followers changed.
 */
@Component({
    selector: 'app-party-board',
    templateUrl: './party-board.component.html',
    styleUrls: ['./party-board.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DecimalPipe, NgTemplateOutlet, ClassDisplayPipe]
})
export class PartyBoardComponent {
  readonly members = input<PC[]>([]);
  /** The campaign's invite code, quoted in the empty state so "nobody has
   *  joined" comes with the step that fixes it. */
  readonly inviteCode = input<string | null>(null);
  readonly openHero = output<PC>();
  /** A follower row was chosen: open the owner's sheet with that follower on top. */
  readonly openFollower = output<BoardFollowerRef>();

  private readonly followerService = inject(FollowerService);

  /** Followers by owning character id, as last fetched. */
  private readonly followersByPc = signal<Record<number, Follower[]>>({});

  /** Members whose follower rows the DM folded away. */
  private readonly collapsed = signal<ReadonlySet<number>>(new Set<number>());

  readonly rows = computed<MemberRow[]>(() => {
    const byPc = this.followersByPc();
    return this.members().map(pc => ({
      pc,
      followers: (byPc[pc.id] ?? []).map(follower => ({ follower, pc: followerToPc(follower, pc) })),
    }));
  });

  /** True when any member has followers: every member row then keeps the
   *  toggle's slot, so the portraits stay in one column. */
  readonly anyFollowers = computed(() => this.rows().some(r => r.followers.length > 0));

  constructor() {
    effect(onCleanup => {
      const members = this.members();
      if (!members.length) {
        this.followersByPc.set({});
        return;
      }
      // One member's failed fetch (a 403, a dropped connection) leaves that
      // member without follower rows; the rest of the board is unaffected.
      // The rows already showing stay up until the fresh lists arrive.
      const request: Subscription = forkJoin(
        members.map(pc => this.followerService.list(pc.id).pipe(catchError(() => of<Follower[]>([])))),
      ).subscribe(lists => {
        const byPc: Record<number, Follower[]> = {};
        members.forEach((pc, i) => (byPc[pc.id] = lists[i] ?? []));
        untracked(() => this.setFollowers(byPc));
      });
      onCleanup(() => request.unsubscribe());
    });

    // A grant, edit or dismissal somewhere else (usually the member's sheet,
    // opened from this board) does not replace `members`: re-list that member.
    // A failed re-list keeps the rows already showing.
    this.followerService.changes$.pipe(takeUntilDestroyed()).subscribe(({ pcId }) => {
      const isMember = () => this.members().some(pc => pc.id === pcId);
      if (!isMember()) return;
      this.followerService.list(pcId).subscribe({
        next: list => {
          if (isMember()) this.setFollowers({ ...this.followersByPc(), [pcId]: list });
        },
        error: () => {},
      });
    });
  }

  /** Store fresh lists. A member who gained a follower is unfolded, so a new
   *  arrival is never hidden behind a collapsed row. */
  private setFollowers(byPc: Record<number, Follower[]>): void {
    const before = this.followersByPc();
    const collapsed = new Set(this.collapsed());
    for (const pcId of [...collapsed]) {
      const known = before[pcId];
      if (known && (byPc[pcId] ?? []).some(f => !known.some(k => k.id === f.id))) collapsed.delete(pcId);
    }
    if (collapsed.size !== this.collapsed().size) this.collapsed.set(collapsed);
    this.followersByPc.set(byPc);
  }

  isCollapsed(pc: PC): boolean { return this.collapsed().has(pc.id); }

  toggleFollowers(pc: PC): void {
    const next = new Set(this.collapsed());
    if (!next.delete(pc.id)) next.add(pc.id);
    this.collapsed.set(next);
  }

  tintFor(pc: PC): string { return tintFor(pc); }

  initialsFor(pc: PC): string {
    return (pc.portraitInitials || pc.name.slice(0, 2)).toUpperCase();
  }

  hpPct(pc: PC): number {
    const max = pc.hp?.max ?? 0;
    const cur = pc.hp?.cur ?? 0;
    return max <= 0 ? 0 : Math.max(0, Math.min(100, (cur / max) * 100));
  }

  bloodied(pc: PC): boolean {
    const max = pc.hp?.max ?? 0;
    const cur = pc.hp?.cur ?? 0;
    return max > 0 && cur <= max / 2;
  }

  passivePerception(pc: PC): number { return passiveScore(pc, 'Perception', 'WIS'); }
  passiveInsight(pc: PC): number { return passiveScore(pc, 'Insight', 'WIS'); }
}
