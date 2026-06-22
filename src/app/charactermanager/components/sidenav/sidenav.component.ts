import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { PC } from '../../models/pc';
import { PCService } from '../../services/pc.service';
import { CharacterModalService } from '../../services/character-modal.service';
import { CampaignModalService } from '../../services/campaign-modal.service';
import { JoinModalService } from '../../services/join-modal.service';
import { UiStateService } from '../../services/ui-state.service';
import { CurrentUserService } from '../../services/current-user.service';
import { tintFor } from '../../utils/character-math';

@Component({
  selector: 'app-sidenav',
  templateUrl: './sidenav.component.html',
  styleUrls: ['./sidenav.component.scss']
})
export class SidenavComponent implements OnInit, OnDestroy {
  // Still declared so the parent template's [pcs]="pcs" binding compiles cleanly.
  // Internal data comes directly from pcsByParty$ below.
  @Input() pcs!: PC[];

  query = '';
  /** Mobile only: whether the party pane is slid in over the sheet. Ignored at desktop widths. */
  drawerOpen = false;
  activePC$ = this.pcService.activePC$;
  role$ = this.uiState.role$;
  // When set, Session Mode takes over the main content area for everyone.
  activeSessionId$ = this.uiState.activeSessionId$;
  user = this.currentUser.getUser();

  private allPcs: PC[] = [];
  private sub!: Subscription;

  constructor(
    private pcService: PCService,
    private characterModal: CharacterModalService,
    private campaignModal: CampaignModalService,
    private joinModal: JoinModalService,
    private uiState: UiStateService,
    private currentUser: CurrentUserService,
  ) {}

  ngOnInit(): void {
    this.sub = this.pcService.pcs$.subscribe(pcs => {
      this.allPcs = pcs;
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /** The full roster, filtered by the current search query. */
  get filteredPcs(): PC[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.allPcs;

    return this.allPcs.filter(pc =>
      pc.name.toLowerCase().includes(q) ||
      (pc.player ?? pc.playerName ?? '').toLowerCase().includes(q) ||
      pc.clazz.toLowerCase().includes(q)
    );
  }

  /** Mobile drawer controls — no-ops visually at desktop widths (drawer CSS only applies <=820px). */
  toggleDrawer(): void { this.drawerOpen = !this.drawerOpen; }
  closeDrawer(): void { this.drawerOpen = false; }

  setActivePC(pc: PC): void {
    this.pcService.setActivePC(pc);
    // On mobile, picking a hero should reveal their sheet, so dismiss the drawer.
    this.closeDrawer();
  }

  /** Maps portraitTint to a CSS background value. Delegates to shared utility. */
  tintFor(pc: PC): string { return tintFor(pc); }

  /** Initials for the portrait circle — uses portraitInitials if set, else first two letters of name. */
  initialsFor(pc: PC): string {
    return (pc.portraitInitials || pc.name.slice(0, 2)).toUpperCase();
  }

  forgeHero(): void { this.closeDrawer(); this.characterModal.openCreateModal(); }

  newCampaign(): void { this.closeDrawer(); this.campaignModal.openCreateModal(); }

  joinCampaign(): void { this.closeDrawer(); this.joinModal.open(); }

  /** Account-row tint, reusing the shared portrait util. */
  get userTint(): string { return tintFor({ portraitTint: this.user.tint } as any); }

  openSettings(): void { this.closeDrawer(); this.uiState.openSettings(); }
}
