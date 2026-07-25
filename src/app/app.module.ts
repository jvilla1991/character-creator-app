import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { Routes, RouterModule } from '@angular/router';

import { AppComponent } from './app.component';
import { LoginComponent } from './charactermanager/components/login/login.component';
import { RegisterComponent } from './charactermanager/components/register/register.component';
import { ResetPasswordComponent } from './charactermanager/components/reset-password/reset-password.component';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './interceptors/auth.interceptor';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';


const routes: Routes = [
  { path: '',             redirectTo: 'login', pathMatch: 'full' },
  { path: 'login',        component: LoginComponent,    canActivate: [guestGuard] },
  { path: 'register',     component: RegisterComponent, canActivate: [guestGuard] },
  // No guard: a reset link must work whether or not someone is signed in.
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'charactermanager', canActivate: [authGuard], loadChildren: () => import('./charactermanager/charactermanager.module').then(m => m.CharactermanagerModule) }
];

// Thin shell: nothing is declared here anymore — every component is standalone
// and brings its own imports (the auth screens pull in ReactiveFormsModule
// directives themselves). The routes above reference the standalone components
// directly, so none of them need to appear in `imports`. The module only wires
// up bootstrap + root routing; converting to bootstrapApplication/provideRouter
// is a follow-up branch.
@NgModule({ bootstrap: [AppComponent], imports: [BrowserModule,
        RouterModule.forRoot(routes)], providers: [
        provideHttpClient(withInterceptors([authInterceptor]))
    ] })
export class AppModule { }
