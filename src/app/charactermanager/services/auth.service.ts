import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, delay, Observable, of, tap } from 'rxjs';
import { environment, DEMO_MODE_KEY } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authUrl = `${environment.authApiUrl}/api/v1/auth`;

  constructor(private router: Router, private http: HttpClient) {}

  login(userName: string, password: string): Observable<any> {
    if (environment.demoMode) {
      const mockResponse = {
        success: true,
        token: 'demo-token-' + Date.now()
      };
      localStorage.setItem('token', mockResponse.token);
      localStorage.setItem('username', userName);
      return of(mockResponse);
    }

    return this.http.post<any>(this.authUrl + '/authenticate', { userName, password }).pipe(
      tap(response => {
        console.log(response);
        if (response.success) {
          localStorage.setItem('token', response.token);
          localStorage.setItem('username', userName);
        }
      }),
      catchError(() => of({ success: false }))
    );
  }

  register(firstName: string, lastName: string, email: string, userName: string, password: string): Observable<any> {
    return this.http.post<any>(this.authUrl + '/register', { firstName, lastName, email, userName, password }).pipe(
      tap(response => {
        if (response?.success) {
          localStorage.setItem('token', response.token);
          localStorage.setItem('username', userName);
        }
      }),
      catchError(err => of({ success: false, error: err }))
    );
  }

  /**
   * Opt this browser into demo mode (used by the login screen's "Explore the
   * Demo" button). The app then runs on in-memory seed data with no backend.
   * A fake non-JWT token keeps the route guard / interceptor happy. logout()
   * clears both, so leaving the demo restores normal backend-backed behaviour.
   */
  enterDemoMode(): void {
    localStorage.setItem(DEMO_MODE_KEY, 'true');
    localStorage.setItem('token', 'demo-token-' + Date.now());
  }

  logout(): void {
    const wasDemo = localStorage.getItem(DEMO_MODE_KEY) === 'true';
    localStorage.removeItem('token');
    localStorage.removeItem(DEMO_MODE_KEY);
    // Demo-seeded singletons (PCService, CampaignService) read demoMode once at
    // construction. A full reload tears them down so a later real login starts
    // from a clean, backend-backed state instead of leftover demo data.
    if (wasDemo) {
      window.location.assign('/login');
      return;
    }
    localStorage.removeItem('username');
    this.router.navigate(['/login']);
  }

  /** The signed-in user's username, captured at login/registration. */
  getUsername(): string | null {
    return localStorage.getItem('username');
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    // For demo tokens (non-JWT) treat as always valid
    if (token.split('.').length !== 3) return true;
    const exp = this.getTokenExpiry(token);
    return exp === null || exp > Date.now();
  }

  getToken(): string | null {
    const token = localStorage.getItem('token');
    // Evict expired tokens eagerly so nothing else has to check
    if (token && token.split('.').length === 3) {
      const exp = this.getTokenExpiry(token);
      if (exp !== null && exp <= Date.now()) {
        localStorage.removeItem('token');
        return null;
      }
    }
    return token;
  }

  private getTokenExpiry(token: string): number | null {
    try {
      // JWT uses base64url — replace chars that atob doesn't handle
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }

}
