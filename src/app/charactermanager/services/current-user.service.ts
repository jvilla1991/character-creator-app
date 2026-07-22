import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CurrentUser } from '../models/campaign';
import { AuthService } from './auth.service';

/** Response from the auth service's /authorize endpoint (field naming varies). */
interface AuthorizeResponse {
  email?: string;
  userName?: string;
  username?: string;
  roles?: string[];
}

/**
 * The signed-in user shown in the account row / settings header.
 *
 * The display name is the username captured at login (also the JWT subject); the
 * email is enriched from the auth service's /authorize endpoint when available.
 * A single object reference is mutated in place so views that read {@link getUser}
 * pick up the values via change detection without re-querying.
 */
@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private user: CurrentUser = {
    name: 'Adventurer',
    email: '',
    initials: 'AD',
    tint: 'gold',
  };

  constructor(private http: HttpClient, private auth: AuthService) {
    this.refresh();
  }

  getUser(): CurrentUser {
    return this.user;
  }

  /**
   * Populate the account display from the current session: the username is the
   * display name immediately; the email (and any fuller name) is filled in from
   * the auth service. Safe to call again on re-entering the app shell.
   */
  refresh(): void {
    const username = this.auth.getUsername();
    this.user.name = username || 'Adventurer';
    this.user.initials = this.initialsOf(this.user.name);
    this.user.email = '';
    this.user.isAdmin = false;

    if (environment.demoMode) return;

    const token = this.auth.getToken();
    if (!token) return;
    // The auth interceptor skips /api/v1/auth/* URLs, so attach the token here.
    this.http.get<AuthorizeResponse>(`${environment.authApiUrl}/api/v1/auth/authorize`, {
      headers: { Authorization: `Bearer ${token}` },
    }).subscribe({
      next: dto => {
        if (dto?.email) this.user.email = dto.email;
        const name = dto?.userName ?? dto?.username;
        if (name) {
          this.user.name = name;
          this.user.initials = this.initialsOf(name);
        }
        this.user.isAdmin = dto?.roles?.includes('ADMIN') ?? false;
      },
      error: () => { /* keep the username-derived display, no email */ },
    });
  }

  /** Up to two uppercase initials from a name ("john smith" → "JS", "dm" → "DM"). */
  private initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.trim().slice(0, 2);
    return letters.toUpperCase();
  }
}
