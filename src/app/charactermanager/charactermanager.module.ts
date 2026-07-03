import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';

import { CharactermanagerAppComponent } from './charactermanager-app.component';
import { MainContentComponent } from './components/main-content/main-content.component';
import { SidenavComponent } from './components/sidenav/sidenav.component';
import { CharacterSheetComponent } from './components/character-sheet/character-sheet.component';
import { VitalsStripComponent } from './components/character-sheet/vitals-strip/vitals-strip.component';
import { EditableNumberComponent } from './components/character-sheet/editable-number/editable-number.component';
import { EmptyStateComponent } from './components/character-sheet/empty-state/empty-state.component';
import { AbilityScoresComponent } from './components/character-sheet/panels/ability-scores/ability-scores.component';
import { SkillsListComponent } from './components/character-sheet/panels/skills-list/skills-list.component';
import { ConditionsPanelComponent } from './components/character-sheet/panels/conditions-panel/conditions-panel.component';
import { EquipmentPanelComponent } from './components/character-sheet/panels/equipment-panel/equipment-panel.component';
import { InventoryPanelComponent } from './components/character-sheet/panels/inventory-panel/inventory-panel.component';
import { SurvivalPanelComponent } from './components/character-sheet/panels/survival-panel/survival-panel.component';
import { SpellbookPanelComponent } from './components/character-sheet/panels/spellbook-panel/spellbook-panel.component';
import { FeaturesListComponent } from './components/character-sheet/panels/features-list/features-list.component';
import { CoinPurseComponent } from './components/character-sheet/panels/coin-purse/coin-purse.component';
import { BackgroundStoryComponent } from './components/character-sheet/panels/background-story/background-story.component';
import { CreateCharacterModalComponent } from './components/create-character-modal/create-character-modal.component';
import { IdentityStepComponent } from './components/create-character-modal/steps/identity-step/identity-step.component';
import { SpeciesStepComponent } from './components/create-character-modal/steps/species-step/species-step.component';
import { ClassStepComponent } from './components/create-character-modal/steps/class-step/class-step.component';
import { BackgroundStepComponent } from './components/create-character-modal/steps/background-step/background-step.component';
import { ProficienciesStepComponent } from './components/create-character-modal/steps/proficiencies-step/proficiencies-step.component';
import { AbilityScoresStepComponent } from './components/create-character-modal/steps/ability-scores-step/ability-scores-step.component';
import { SpellsStepComponent } from './components/create-character-modal/steps/spells-step/spells-step.component';
import { EquipmentStepComponent } from './components/create-character-modal/steps/equipment-step/equipment-step.component';
import { ReviewStepComponent } from './components/create-character-modal/steps/review-step/review-step.component';
import { DeleteConfirmationModalComponent } from './components/main-content/delete-confirmation-modal/delete-confirmation-modal.component';
import { DiceRollerModalComponent } from './components/dice-roller-modal/dice-roller-modal.component';
import { LevelUpModalComponent } from './components/level-up-modal/level-up-modal.component';

// ── DM mode ──────────────────────────────────────────────────────────────
import { SettingsPanelComponent } from './components/settings-panel/settings-panel.component';
import { RoleSwitchComponent } from './components/settings-panel/role-switch/role-switch.component';
import { CampaignSidebarComponent } from './components/campaign-sidebar/campaign-sidebar.component';
import { CampaignDashboardComponent } from './components/campaign-dashboard/campaign-dashboard.component';
import { PartyBoardComponent } from './components/campaign-dashboard/party-board/party-board.component';
import { PartyTreasuryComponent } from './components/campaign-dashboard/party-treasury/party-treasury.component';
import { CampaignNotesComponent } from './components/campaign-dashboard/campaign-notes/campaign-notes.component';
import { CuratedShopsComponent } from './components/campaign-dashboard/curated-shops/curated-shops.component';
import { CuratedEncountersComponent } from './components/campaign-dashboard/curated-encounters/curated-encounters.component';
import { CreateCampaignModalComponent } from './components/create-campaign-modal/create-campaign-modal.component';
import { JoinCampaignModalComponent } from './components/join-campaign-modal/join-campaign-modal.component';

// ── Session Mode ───────────────────────────────────────────────────────────
import { SessionModeComponent } from './components/session-mode/session-mode.component';
import { InitiativePanelComponent } from './components/session-mode/initiative-panel/initiative-panel.component';
import { ShopPanelComponent } from './components/session-mode/shop-panel/shop-panel.component';
import { EncounterLoaderComponent } from './components/session-mode/encounter-loader/encounter-loader.component';
import { SessionLiveBannerComponent } from './components/session-live-banner/session-live-banner.component';
import { ToastComponent } from './components/toast/toast.component';

import { DragDropModule } from '@angular/cdk/drag-drop';
import { MaterialModule } from '../shared/material.module';
import { HttpClientModule } from '@angular/common/http';
import { AuthService } from './services/auth.service';
import { CharacterModalService } from './services/character-modal.service';
import { FormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';

const routes: Routes = [
  {
    path: '', component: CharactermanagerAppComponent,
    children: [
      { path: ':id', component: MainContentComponent },
      { path: '',    component: MainContentComponent },
    ]
  },
  { path: '**', redirectTo: '' }
];

@NgModule({
  declarations: [
    CharactermanagerAppComponent,
    MainContentComponent,
    SidenavComponent,
    DeleteConfirmationModalComponent,
    CreateCharacterModalComponent,
    IdentityStepComponent,
    SpeciesStepComponent,
    ClassStepComponent,
    BackgroundStepComponent,
    ProficienciesStepComponent,
    AbilityScoresStepComponent,
    SpellsStepComponent,
    EquipmentStepComponent,
    ReviewStepComponent,
    DiceRollerModalComponent,
    LevelUpModalComponent,
    CharacterSheetComponent,
    VitalsStripComponent,
    EditableNumberComponent,
    EmptyStateComponent,
    AbilityScoresComponent,
    SkillsListComponent,
    ConditionsPanelComponent,
    EquipmentPanelComponent,
    InventoryPanelComponent,
    SurvivalPanelComponent,
    SpellbookPanelComponent,
    FeaturesListComponent,
    CoinPurseComponent,
    BackgroundStoryComponent,
    SettingsPanelComponent,
    RoleSwitchComponent,
    CampaignSidebarComponent,
    CampaignDashboardComponent,
    PartyBoardComponent,
    PartyTreasuryComponent,
    CampaignNotesComponent,
    CuratedShopsComponent,
    CuratedEncountersComponent,
    CreateCampaignModalComponent,
    JoinCampaignModalComponent,
    SessionModeComponent,
    InitiativePanelComponent,
    ShopPanelComponent,
    EncounterLoaderComponent,
    SessionLiveBannerComponent,
    ToastComponent,
  ],
  imports: [
    CommonModule,
    MaterialModule,
    DragDropModule,
    HttpClientModule,
    FormsModule,
    MatDialogModule,
    RouterModule.forChild(routes)
  ],
  providers: [
    AuthService,
    CharacterModalService,
  ]
})
export class CharactermanagerModule { }
