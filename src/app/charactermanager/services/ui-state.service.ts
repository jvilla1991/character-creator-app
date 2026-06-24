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

  // The live session currently open as a full-screen overlay (null = none).
  // Drives Session Mode, which layers over both the Player and DM views.
  private activeSessionIdSubject = new BehaviorSubject<string | null>(null);
  activeSessionId$ = this.activeSessionIdSubject.asObservable();

  // True while a DM is viewing one of their campaign members' sheets (reached by
  // clicking a hero on the campaign dashboard). Drives the "back to campaign" bar.
  private dmReturnSubject = new BehaviorSubject<boolean>(false);
  dmReturn$ = this.dmReturnSubject.asObservable();

  get role(): Role { return this.roleSubject.getValue(); }

  setRole(role: Role): void {
    // A manual role switch ends any campaign cross-link.
    this.dmReturnSubject.next(false);
    this.roleSubject.next(role);
  }

  setActiveCampaign(id: string | null): void { this.activeCampaignIdSubject.next(id); }

  openSettings(): void  { this.settingsOpenSubject.next(true); }
  closeSettings(): void { this.settingsOpenSubject.next(false); }

  openSession(sessionId: string): void { this.activeSessionIdSubject.next(sessionId); }
  closeSession(): void { this.activeSessionIdSubject.next(null); }

  /** DM opens a campaign member's sheet; remembers to offer a way back. */
  viewHeroAsDm(): void {
    this.dmReturnSubject.next(true);
    this.roleSubject.next('player');
  }

  /** Return from a cross-linked hero sheet to the DM campaign dashboard. */
  returnToCampaign(): void {
    this.dmReturnSubject.next(false);
    this.roleSubject.next('dm');
  }
}
