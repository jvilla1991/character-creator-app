import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../charactermanager/services/auth.service';

/**
 * Protects the in-app /charactermanager route: a signed-in user is let through,
 * anyone else is bounced to the login screen. Pairs with guestGuard so the
 * browser Back button can never land on a screen the auth state forbids.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? true : inject(Router).parseUrl('/login');
};
