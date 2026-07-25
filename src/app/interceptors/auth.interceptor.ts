import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../charactermanager/services/auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);

  // Never attach a token to auth-service requests (login, register, etc.)
  const isAuthEndpoint = request.url.includes('/api/v1/auth/');
  if (isAuthEndpoint) return next(request);

  const token = authService.getToken();

  // A valid JWT always contains exactly two '.' characters (header.payload.signature).
  // Guard against stale non-JWT values (e.g. old demo-mode tokens) so we never
  // send a malformed Authorization header to the backend.
  const isJwt = token && token.split('.').length === 3;

  const outgoing = isJwt
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(outgoing).pipe(
    catchError((err: HttpErrorResponse) => {
      const isExpiredJwt =
        (err.status === 401 || err.status === 400) &&
        typeof err.error?.message === 'string' &&
        err.error.message.includes('JWT expired');

      if (isExpiredJwt) {
        authService.logout();
      }

      return throwError(() => err);
    })
  );
};
