import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { Routes, RouterModule } from '@angular/router';

import { AppComponent } from './app.component';
import { LoginComponent } from './charactermanager/components/login/login.component';
import { RegisterComponent } from './charactermanager/components/register/register.component';
import { FormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { AuthGuard } from './guards/auth.guard';
import { GuestGuard } from './guards/guest.guard';


const routes: Routes = [
  { path: '',             redirectTo: 'login', pathMatch: 'full' },
  { path: 'login',        component: LoginComponent,    canActivate: [GuestGuard] },
  { path: 'register',     component: RegisterComponent, canActivate: [GuestGuard] },
  { path: 'charactermanager', canActivate: [AuthGuard], loadChildren: () => import('./charactermanager/charactermanager.module').then(m => m.CharactermanagerModule) }
];

@NgModule({ declarations: [
        AppComponent,
        LoginComponent,
        RegisterComponent,
    ],
    bootstrap: [AppComponent], imports: [BrowserModule,
        FormsModule,
        RouterModule.forRoot(routes)], providers: [
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        provideHttpClient(withInterceptorsFromDi())
    ] })
export class AppModule { }
