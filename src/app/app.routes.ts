import { Routes } from '@angular/router';

import { LoginComponent } from './charactermanager/components/login/login.component';
import { RegisterComponent } from './charactermanager/components/register/register.component';
import { ResetPasswordComponent } from './charactermanager/components/reset-password/reset-password.component';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  { path: '',             redirectTo: 'login', pathMatch: 'full' },
  { path: 'login',        component: LoginComponent,    canActivate: [guestGuard] },
  { path: 'register',     component: RegisterComponent, canActivate: [guestGuard] },
  // No guard: a reset link must work whether or not someone is signed in.
  { path: 'reset-password', component: ResetPasswordComponent },
  // Lazy boundary: importing the routes file (not a module) keeps the whole
  // charactermanager feature in its own chunk.
  {
    path: 'charactermanager',
    canActivate: [authGuard],
    loadChildren: () => import('./charactermanager/charactermanager.routes').then(m => m.CHARACTERMANAGER_ROUTES),
  },
];
