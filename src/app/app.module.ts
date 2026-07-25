import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { Routes, RouterModule } from '@angular/router';

import { AppComponent } from './app.component';
import { LoginComponent } from './charactermanager/components/login/login.component';
import { RegisterComponent } from './charactermanager/components/register/register.component';
import { ResetPasswordComponent } from './charactermanager/components/reset-password/reset-password.component';
import { ReactiveFormsModule } from '@angular/forms';
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

@NgModule({ declarations: [
        AppComponent,
        LoginComponent,
        RegisterComponent,
        ResetPasswordComponent,
    ],
    bootstrap: [AppComponent], imports: [BrowserModule,
        // Auth screens (login / register / reset-password) use typed reactive
        // forms; nothing declared here uses ngModel, so FormsModule is gone.
        ReactiveFormsModule,
        RouterModule.forRoot(routes)], providers: [
        provideHttpClient(withInterceptors([authInterceptor]))
    ] })
export class AppModule { }
