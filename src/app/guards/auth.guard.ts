import { Injectable } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { AuthService } from '../charactermanager/services/auth.service';

/**
 * Protects the in-app /charactermanager route: a signed-in user is let through,
 * anyone else is bounced to the login screen. Pairs with GuestGuard so the
 * browser Back button can never land on a screen the auth state forbids.
 */
@Injectable({ providedIn: 'root' })
export class AuthGuard  {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    return this.auth.isAuthenticated() ? true : this.router.parseUrl('/login');
  }
}
