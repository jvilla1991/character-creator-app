import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CharactermanagerAppComponent } from './charactermanager-app.component';
import { MainContentComponent } from './components/main-content/main-content.component';
import { characterResolver } from './resolvers/character.resolver';
import { AuthService } from './services/auth.service';
import { CharacterModalService } from './services/character-modal.service';

const routes: Routes = [
  {
    path: '', component: CharactermanagerAppComponent,
    children: [
      { path: ':id', component: MainContentComponent, resolve: { pc: characterResolver } },
      { path: '',    component: MainContentComponent },
    ]
  },
  { path: '**', redirectTo: '' }
];

// Thin shell: every component is standalone and carries its own imports, so this
// module no longer declares (or needs to import) any of them. It only exists to
// keep the lazy `loadChildren` boundary and the feature-scoped providers.
// Deliberately NOT importing the standalone components here — a static module
// reference would pull @defer'd panels (spellbook, curated shops/encounters/loot)
// back into the eager chunk and defeat their lazy chunk-splitting.
// Converting to loadChildren-of-routes/provideRouter is a follow-up branch.
@NgModule({
    imports: [RouterModule.forChild(routes)],
    providers: [
        AuthService,
        CharacterModalService,
    ] })
export class CharactermanagerModule { }
