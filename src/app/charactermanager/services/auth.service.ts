import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, delay, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

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
      return of(mockResponse);
    }

    return this.http.post<any>(this.authUrl + '/authenticate', { userName, password }).pipe(
      tap(response => {
        console.log(response);
        if (response.success) {
          localStorage.setItem('token', response.token);
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
        }
      }),
      catchError(err => of({ success: false, error: err }))
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
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
