import { Routes } from '@angular/router';

import { CharactermanagerAppComponent } from './charactermanager-app.component';
import { MainContentComponent } from './components/main-content/main-content.component';
import { characterResolver } from './resolvers/character.resolver';
import { AuthService } from './services/auth.service';
import { CharacterModalService } from './services/character-modal.service';

// Direct `component:` references are deliberate: this file is only reached via
// `loadChildren`, so every component referenced here already rides the lazy
// charactermanager chunk — `loadComponent` would not split anything further
// (MainContentComponent is shared by two routes and CharactermanagerAppComponent
// statically imports the shell components). The @defer'd panels (spellbook,
// curated shops/encounters/loot) keep their own chunks independently of this.
export const CHARACTERMANAGER_ROUTES: Routes = [
  {
    path: '',
    component: CharactermanagerAppComponent,
    // Route-level providers create an environment injector for this subtree —
    // the same scoping the old CharactermanagerModule `providers` array gave:
    // CharacterModalService (no providedIn) only exists inside the feature, and
    // AuthService keeps its (stateless, localStorage-backed) feature instance
    // alongside the root one that guards/interceptor use.
    providers: [
      AuthService,
      CharacterModalService,
    ],
    children: [
      { path: ':id', component: MainContentComponent, resolve: { pc: characterResolver } },
      { path: '',    component: MainContentComponent },
    ],
  },
  { path: '**', redirectTo: '' },
];
