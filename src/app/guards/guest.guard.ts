import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../charactermanager/services/auth.service';

/**
 * Guards the login/register screens against an already signed-in user. This is
 * what makes browser Back safe: when Back lands on /login, the guard immediately
 * redirects an authenticated user back into the app, so the login form is never
 * shown to someone who is already logged in.
 */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).parseUrl('/charactermanager') : true;
};
