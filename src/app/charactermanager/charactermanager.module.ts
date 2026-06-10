import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';

import { CharactermanagerAppComponent } from './charactermanager-app.component';
import { MainContentComponent } from './components/main-content/main-content.component';
import { SidenavComponent } from './components/sidenav/sidenav.component';
import { CharacterSheetComponent } from './components/character-sheet/character-sheet.component';
import { VitalsStripComponent } from './components/character-sheet/vitals-strip/vitals-strip.component';
import { EmptyStateComponent } from './components/character-sheet/empty-state/empty-state.component';
import { AbilityScoresComponent } from './components/character-sheet/panels/ability-scores/ability-scores.component';
import { SkillsListComponent } from './components/character-sheet/panels/skills-list/skills-list.component';
import { ConditionsPanelComponent } from './components/character-sheet/panels/conditions-panel/conditions-panel.component';
import { EquipmentPanelComponent } from './components/character-sheet/panels/equipment-panel/equipment-panel.component';
import { SpellbookPanelComponent } from './components/character-sheet/panels/spellbook-panel/spellbook-panel.component';
import { FeaturesListComponent } from './components/character-sheet/panels/features-list/features-list.component';
import { CoinPurseComponent } from './components/character-sheet/panels/coin-purse/coin-purse.component';
import { BackgroundStoryComponent } from './components/character-sheet/panels/background-story/background-story.component';
import { CreateCharacterModalComponent } from './components/create-character-modal/create-character-modal.component';
import { DeleteConfirmationModalComponent } from './components/main-content/delete-confirmation-modal/delete-confirmation-modal.component';

// ── DM mode ──────────────────────────────────────────────────────────────
import { SettingsPanelComponent } from './components/settings-panel/settings-panel.component';
import { RoleSwitchComponent } from './components/settings-panel/role-switch/role-switch.component';
import { CampaignSidebarComponent } from './components/campaign-sidebar/campaign-sidebar.component';
import { CampaignDashboardComponent } from './components/campaign-dashboard/campaign-dashboard.component';
import { PartyBoardComponent } from './components/campaign-dashboard/party-board/party-board.component';
import { CampaignChronicleComponent } from './components/campaign-dashboard/campaign-chronicle/campaign-chronicle.component';
import { PartyTreasuryComponent } from './components/campaign-dashboard/party-treasury/party-treasury.component';
import { CreateCampaignModalComponent } from './components/create-campaign-modal/create-campaign-modal.component';

import { MaterialModule } from '../shared/material.module';
import { HttpClientModule } from '@angular/common/http';
import { PCService } from './services/pc.service';
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
    CharacterSheetComponent,
    VitalsStripComponent,
    EmptyStateComponent,
    AbilityScoresComponent,
    SkillsListComponent,
    ConditionsPanelComponent,
    EquipmentPanelComponent,
    SpellbookPanelComponent,
    FeaturesListComponent,
    CoinPurseComponent,
    BackgroundStoryComponent,
    SettingsPanelComponent,
    RoleSwitchComponent,
    CampaignSidebarComponent,
    CampaignDashboardComponent,
    PartyBoardComponent,
    CampaignChronicleComponent,
    PartyTreasuryComponent,
    CreateCampaignModalComponent,
  ],
  imports: [
    CommonModule,
    MaterialModule,
    HttpClientModule,
    FormsModule,
    MatDialogModule,
    RouterModule.forChild(routes)
  ],
  providers: [
    // PCService omitted — it uses providedIn: 'root' and should not be double-provided
    AuthService,
    CharacterModalService,
  ]
})
export class CharactermanagerModule { }
