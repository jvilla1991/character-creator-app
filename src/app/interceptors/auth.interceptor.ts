import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../charactermanager/services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.getToken();

    // A valid JWT always contains exactly two '.' characters (header.payload.signature).
    // Guard against stale non-JWT values (e.g. old demo-mode tokens) so we never
    // send a malformed Authorization header to the backend.
    const isJwt = token && token.split('.').length === 3;

    if (isJwt) {
      const authRequest = request.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
      return next.handle(authRequest);
    }

    return next.handle(request);
  }
}
