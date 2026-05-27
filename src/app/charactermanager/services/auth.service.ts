import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, delay, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authUrl = 'http://localhost:8085/api/v1/auth';

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

  logout(): void {
    localStorage.removeItem('token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

}
