import { Component, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { PC } from './models/pc';
import { PCService } from './services/pc.service';
import { CharacterModalService } from './services/character-modal.service';
import { CampaignModalService } from './services/campaign-modal.service';
import { JoinConsentState, JoinModalService, JoinRequest } from './services/join-modal.service';
import { UiStateService } from './services/ui-state.service';
import { CurrentUserService } from './services/current-user.service';
import { CampaignDraft } from './models/campaign';
import { SidenavComponent } from './components/sidenav/sidenav.component';
import { CreateCharacterModalComponent } from './components/create-character-modal/create-character-modal.component';
import { CreateCampaignModalComponent } from './components/create-campaign-modal/create-campaign-modal.component';
import { JoinCampaignModalComponent } from './components/join-campaign-modal/join-campaign-modal.component';
import { SettingsPanelComponent } from './components/settings-panel/settings-panel.component';
import { ToastComponent } from './components/toast/toast.component';

@Component({
    selector: 'app-charactermanager-app',
    template: `
    <app-sidenav [pcs]="pcs"></app-sidenav>
    
    <!-- Create-character overlay — position: fixed, inset 0, blurred backdrop -->
    @if (isCreateModalOpen) {
      <div
        class="modal-backdrop"
        (click)="closeCreate()">
        <app-create-character-modal
          (click)="$event.stopPropagation()"
          (confirm)="onCreate($event)"
          (close)="closeCreate()">
        </app-create-character-modal>
      </div>
    }
    
    <!-- Create-campaign overlay (DM mode) -->
    @if (isCampaignModalOpen) {
      <div
        class="modal-backdrop"
        (click)="closeCampaign()">
        <app-create-campaign-modal
          (confirm)="onCreateCampaign($event)"
          (close)="closeCampaign()">
        </app-create-campaign-modal>
      </div>
    }
    
    <!-- Join-campaign overlay (player mode) -->
    @if (isJoinModalOpen) {
      <div
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
    }
    
    <!-- Settings slide-over (its own fixed backdrop + panel) -->
    @if (isSettingsOpen()) {
      <app-settings-panel></app-settings-panel>
    }
    
    <!-- App-wide transient notifications (e.g. the DM ended the session) -->
    <app-toast></app-toast>
    `,
    styles: [],
    imports: [SidenavComponent, CreateCharacterModalComponent, CreateCampaignModalComponent, JoinCampaignModalComponent, SettingsPanelComponent, ToastComponent]
})
export class CharactermanagerAppComponent implements OnInit {
  pcs: PC[] = [];
  isCreateModalOpen = false;
  isCampaignModalOpen = false;
  isJoinModalOpen = false;
  readonly isSettingsOpen = this.uiState.settingsOpen;
  joinConsent: JoinConsentState | null = null;
  joinError: string | null = null;
  joinPreselectPcId: number | null = null;

  constructor(
    private pcService: PCService,
    private characterModal: CharacterModalService,
    private campaignModal: CampaignModalService,
    public joinModal: JoinModalService,
    private uiState: UiStateService,
    private currentUser: CurrentUserService,
    private router: Router,
    private destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    // Reflect the signed-in user (handles re-login without a full reload).
    this.currentUser.refresh();

    this.pcService.pcs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(pcs => { this.pcs = pcs; });

    this.characterModal.isOpen$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(open => { this.isCreateModalOpen = open; });
    this.campaignModal.isOpen$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(open => { this.isCampaignModalOpen = open; });
    this.joinModal.isOpen$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(open => { this.isJoinModalOpen = open; });
    this.joinModal.consent$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(consent => { this.joinConsent = consent; });
    this.joinModal.error$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(error => { this.joinError = error; });
    this.joinModal.preselectPcId$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(id => { this.joinPreselectPcId = id; });

    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.router.url.includes('/charactermanager')) {
          this.pcService.refreshPCs();
        }
      });

    this.pcService.refreshPCs();
  }

  closeCreate(): void  { this.characterModal.closeCreateModal(); }
  onCreate(draft: Partial<PC>): void { this.characterModal.onCreated(draft); }

  closeCampaign(): void { this.campaignModal.closeCreateModal(); }
  onCreateCampaign(draft: CampaignDraft): void { this.campaignModal.onCreated(draft); }

  closeJoin(): void { this.joinModal.close(); }
  onJoin(req: JoinRequest): void { this.joinModal.onJoin(req); }
}
