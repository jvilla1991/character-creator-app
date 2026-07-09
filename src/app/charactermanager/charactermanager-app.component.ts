import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { PC } from './models/pc';
import { PCService } from './services/pc.service';
import { CharacterModalService } from './services/character-modal.service';
import { CampaignModalService } from './services/campaign-modal.service';
import { JoinConsentState, JoinModalService, JoinRequest } from './services/join-modal.service';
import { UiStateService } from './services/ui-state.service';
import { CurrentUserService } from './services/current-user.service';
import { CampaignDraft } from './models/campaign';

@Component({
  selector: 'app-charactermanager-app',
  template: `
    <app-sidenav [pcs]="pcs"></app-sidenav>

    <!-- Create-character overlay — position: fixed, inset 0, blurred backdrop -->
    <div *ngIf="isCreateModalOpen"
         class="modal-backdrop"
         (click)="closeCreate()">
      <app-create-character-modal
        (click)="$event.stopPropagation()"
        (confirm)="onCreate($event)"
        (close)="closeCreate()">
      </app-create-character-modal>
    </div>

    <!-- Create-campaign overlay (DM mode) -->
    <div *ngIf="isCampaignModalOpen"
         class="modal-backdrop"
         (click)="closeCampaign()">
      <app-create-campaign-modal
        (confirm)="onCreateCampaign($event)"
        (close)="closeCampaign()">
      </app-create-campaign-modal>
    </div>

    <!-- Join-campaign overlay (player mode) -->
    <div *ngIf="isJoinModalOpen"
         class="modal-backdrop"
         (click)="closeJoin()">
      <app-join-campaign-modal
        [consent]="joinConsent"
        [error]="joinError"
        [preselectPcId]="joinPreselectPcId"
        (confirm)="onJoin($event)"
        (acceptConsent)="joinModal.acceptConsent()"
        (declineConsent)="joinModal.declineConsent()"
        (close)="closeJoin()">
      </app-join-campaign-modal>
    </div>

    <!-- Settings slide-over (its own fixed backdrop + panel) -->
    <app-settings-panel *ngIf="isSettingsOpen"></app-settings-panel>

    <!-- App-wide transient notifications (e.g. the DM ended the session) -->
    <app-toast></app-toast>
  `,
  styles: []
})
export class CharactermanagerAppComponent implements OnInit, OnDestroy {
  pcs: PC[] = [];
  isCreateModalOpen = false;
  isCampaignModalOpen = false;
  isJoinModalOpen = false;
  isSettingsOpen = false;
  joinConsent: JoinConsentState | null = null;
  joinError: string | null = null;
  joinPreselectPcId: number | null = null;

  private subs: Subscription[] = [];

  constructor(
    private pcService: PCService,
    private characterModal: CharacterModalService,
    private campaignModal: CampaignModalService,
    public joinModal: JoinModalService,
    private uiState: UiStateService,
    private currentUser: CurrentUserService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Reflect the signed-in user (handles re-login without a full reload).
    this.currentUser.refresh();

    this.subs.push(
      this.pcService.pcs$.subscribe(pcs => { this.pcs = pcs; }),

      this.characterModal.isOpen$.subscribe(open => { this.isCreateModalOpen = open; }),
      this.campaignModal.isOpen$.subscribe(open => { this.isCampaignModalOpen = open; }),
      this.joinModal.isOpen$.subscribe(open => { this.isJoinModalOpen = open; }),
      this.joinModal.consent$.subscribe(consent => { this.joinConsent = consent; }),
      this.joinModal.error$.subscribe(error => { this.joinError = error; }),
      this.joinModal.preselectPcId$.subscribe(id => { this.joinPreselectPcId = id; }),
      this.uiState.settingsOpen$.subscribe(open => { this.isSettingsOpen = open; }),

      this.router.events
        .pipe(filter(e => e instanceof NavigationEnd))
        .subscribe(() => {
          if (this.router.url.includes('/charactermanager')) {
            this.pcService.refreshPCs();
          }
        })
    );

    this.pcService.refreshPCs();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  closeCreate(): void  { this.characterModal.closeCreateModal(); }
  onCreate(draft: Partial<PC>): void { this.characterModal.onCreated(draft); }

  closeCampaign(): void { this.campaignModal.closeCreateModal(); }
  onCreateCampaign(draft: CampaignDraft): void { this.campaignModal.onCreated(draft); }

  closeJoin(): void { this.joinModal.close(); }
  onJoin(req: JoinRequest): void { this.joinModal.onJoin(req); }
}
