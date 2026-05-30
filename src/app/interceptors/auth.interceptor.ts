import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../charactermanager/services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Never attach a token to auth-service requests (login, register, etc.)
    const isAuthEndpoint = request.url.includes('/api/v1/auth/');
    if (isAuthEndpoint) return next.handle(request);

    const token = this.authService.getToken();

    // A valid JWT always contains exactly two '.' characters (header.payload.signature).
    // Guard against stale non-JWT values (e.g. old demo-mode tokens) so we never
    // send a malformed Authorization header to the backend.
    const isJwt = token && token.split('.').length === 3;

    const outgoing = isJwt
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

    return next.handle(outgoing).pipe(
      catchError((err: HttpErrorResponse) => {
        const isExpiredJwt =
          (err.status === 401 || err.status === 400) &&
          typeof err.error?.message === 'string' &&
          err.error.message.includes('JWT expired');

        if (isExpiredJwt) {
          this.authService.logout();
        }

        return throwError(() => err);
      })
    );
  }
}
