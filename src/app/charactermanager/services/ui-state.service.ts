import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Role = 'player' | 'dm';

/**
 * Holds app-level UI state that is *not* a route: the Player/DM role, which
 * campaign is selected in DM mode, and whether the settings slide-over is open.
 *
 * The active *character* deliberately stays in PCService (single source of
 * truth); the DM→player cross-link just calls PCService.setActivePC together
 * with setRole('player') here.
 */
@Injectable({ providedIn: 'root' })
export class UiStateService {
  private roleSubject = new BehaviorSubject<Role>('player');
  role$ = this.roleSubject.asObservable();

  private activeCampaignIdSubject = new BehaviorSubject<string | null>(null);
  activeCampaignId$ = this.activeCampaignIdSubject.asObservable();

  private settingsOpenSubject = new BehaviorSubject<boolean>(false);
  settingsOpen$ = this.settingsOpenSubject.asObservable();

  get role(): Role { return this.roleSubject.getValue(); }

  setRole(role: Role): void { this.roleSubject.next(role); }

  setActiveCampaign(id: string | null): void { this.activeCampaignIdSubject.next(id); }

  openSettings(): void  { this.settingsOpenSubject.next(true); }
  closeSettings(): void { this.settingsOpenSubject.next(false); }
}
