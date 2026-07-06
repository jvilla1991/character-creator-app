import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Role = 'player' | 'dm';

// Persisted so a browser refresh keeps a DM on their campaign dashboard rather
// than resetting to the default player/character view. Cleared on sign-out (see
// AuthService.logout) so the next user starts fresh as a player.
export const UI_ROLE_KEY = 'tm_role';
export const UI_ACTIVE_CAMPAIGN_KEY = 'tm_active_campaign';

/**
 * In-app, full-screen-ish views that are *not* routes but should still respond
 * to the browser Back button: the live-session overlay, the settings slide-over,
 * and a DM cross-linked into a member's sheet. Each one pushes a single history
 * entry when opened; pressing Back (or an in-app close button) unwinds exactly
 * one. See the history plumbing at the bottom of this service.
 */
type Overlay = 'session' | 'settings' | 'dmHero';

/**
 * Holds app-level UI state that is *not* a route: the Player/DM role, which
 * campaign is selected in DM mode, and whether the settings slide-over is open.
 *
 * The active *character* deliberately stays in PCService (single source of
 * truth); the DM→player cross-link just calls PCService.setActivePC together
 * with viewHeroAsDm() here.
 *
 * Because none of these views are real routes, the browser history would only
 * ever hold [..., /login, /charactermanager] and Back would jump straight out of
 * the app. To fix that this service mirrors each open overlay with a real
 * history entry, so Back closes the overlay instead of leaving the route.
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

  // Overlays we've pushed a browser-history entry for, oldest first. Mirrors the
  // history entries we created so that Back and our own close buttons stay in
  // lock-step.
  private overlayStack: Overlay[] = [];
  // Number of upcoming popstate events that we triggered ourselves (via
  // history.back() from an in-app close) and must therefore ignore.
  private selfPops = 0;

  constructor() {
    window.addEventListener('popstate', this.onPopState);
    this.rehydrate();
  }

  /** Restore the persisted role/campaign so a refresh keeps a DM in place. */
  private rehydrate(): void {
    try {
      const campaign = localStorage.getItem(UI_ACTIVE_CAMPAIGN_KEY);
      if (campaign) this.activeCampaignIdSubject.next(campaign);
      const role = localStorage.getItem(UI_ROLE_KEY);
      if (role === 'dm' || role === 'player') this.roleSubject.next(role);
    } catch { /* storage unavailable — fall back to the player default */ }
  }

  private persist(key: string, value: string | null): void {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch { /* ignore — persistence is best-effort */ }
  }
  // True while a DM is viewing one of their campaign members' sheets (reached by
  // clicking a hero on the campaign dashboard). Drives the "back to campaign" bar.
  private dmReturnSubject = new BehaviorSubject<boolean>(false);
  dmReturn$ = this.dmReturnSubject.asObservable();

  get role(): Role { return this.roleSubject.getValue(); }

  setRole(role: Role): void {
    // A manual role switch ends any campaign cross-link.
    this.dmReturnSubject.next(false);
    this.roleSubject.next(role);
    this.persist(UI_ROLE_KEY, role);
  }

  setActiveCampaign(id: string | null): void {
    this.activeCampaignIdSubject.next(id);
    this.persist(UI_ACTIVE_CAMPAIGN_KEY, id);
  }

  /** Forget the persisted DM role/campaign (sign-out) so the next user is a player. */
  clearPersistedView(): void {
    this.persist(UI_ROLE_KEY, null);
    this.persist(UI_ACTIVE_CAMPAIGN_KEY, null);
  }

  // ── Settings slide-over ───────────────────────────────────────────────────
  openSettings(): void {
    if (this.settingsOpenSubject.getValue()) return;     // guard a double-open
    this.settingsOpenSubject.next(true);
    this.pushOverlay('settings');
  }

  closeSettings(): void {
    if (!this.settingsOpenSubject.getValue()) return;
    this.settingsOpenSubject.next(false);
    this.unwind('settings');
  }

  // ── Live session overlay ──────────────────────────────────────────────────
  openSession(sessionId: string): void {
    const firstOpen = this.activeSessionIdSubject.getValue() === null;
    this.activeSessionIdSubject.next(sessionId);
    if (firstOpen) this.pushOverlay('session');          // guard against re-push
  }

  closeSession(): void {
    if (this.activeSessionIdSubject.getValue() === null) return;
    this.activeSessionIdSubject.next(null);
    this.unwind('session');
  }

  // ── DM → hero cross-link ──────────────────────────────────────────────────
  /**
   * A DM opens one of their campaign members' sheets (which switches the main
   * view to Player mode). Recorded as an overlay so Back returns the DM to their
   * campaign dashboard rather than leaving the app.
   */
  viewHeroAsDm(): void {
    this.dmReturnSubject.next(true);     // show the in-app "back to campaign" bar
    this.roleSubject.next('player');
    if (this.overlayStack[this.overlayStack.length - 1] !== 'dmHero') {
      this.pushOverlay('dmHero');        // and let the browser Back button return too
    }
  }

  /**
   * In-app "Back to campaign" button (the dm-return bar). Mirrors the browser-Back
   * path in applyClose('dmHero'), but since we're initiating the close ourselves we
   * also unwind the matching history entry so the browser stays in lock-step.
   */
  returnToCampaign(): void {
    this.dmReturnSubject.next(false);
    this.roleSubject.next('dm');
    this.unwind('dmHero');
  }

  /**
   * Tear down every overlay *without* touching history — used on sign-out, when
   * we navigate away from the app entirely and the pushed entries get discarded
   * with the forward history anyway.
   */
  resetOverlays(): void {
    this.overlayStack = [];
    this.settingsOpenSubject.next(false);
    this.activeSessionIdSubject.next(null);
  }

  // ── history plumbing ──────────────────────────────────────────────────────
  private onPopState = (): void => {
    // A history.back() that we issued ourselves — the matching close already ran.
    if (this.selfPops > 0) { this.selfPops--; return; }
    // The user pressed Back: undo the topmost overlay we own. If we own none,
    // do nothing and let the router handle it (e.g. leaving the app, where the
    // auth guard then bounces an authenticated user straight back in).
    const top = this.overlayStack.pop();
    if (top) this.applyClose(top);
  };

  private pushOverlay(kind: Overlay): void {
    this.overlayStack.push(kind);
    history.pushState({ tmOverlay: kind }, '');
  }

  /**
   * Programmatic close (an in-app Close/Back button already flipped the state):
   * drop our matching history entry so the browser stays in sync. The popstate
   * this triggers is ours, so onPopState ignores it (selfPops).
   */
  private unwind(kind: Overlay): void {
    const i = this.overlayStack.lastIndexOf(kind);
    if (i === -1) return;                       // Back already consumed it
    if (i === this.overlayStack.length - 1) {
      // Only the newest entry can be unwound through the browser, since Back
      // always pops the most recent history entry.
      this.overlayStack.pop();
      this.selfPops++;
      history.back();
    } else {
      // Rare: closed out of order (e.g. an overlay underneath a still-open one).
      // Just forget our record; its stale history entry becomes a harmless no-op.
      this.overlayStack.splice(i, 1);
    }
  }

  /** Reverse an overlay's state. Invoked when the user pressed browser Back. */
  private applyClose(kind: Overlay): void {
    switch (kind) {
      case 'settings':
        this.settingsOpenSubject.next(false);
        break;
      case 'session':
        // SessionMode's ngOnDestroy stops polling and clears the snapshot when
        // the overlay leaves the DOM; we only drop the route-level flag here.
        this.activeSessionIdSubject.next(null);
        break;
      case 'dmHero':
        // Back from a cross-linked hero sheet returns the DM to their dashboard
        // and hides the in-app "back to campaign" bar.
        this.dmReturnSubject.next(false);
        this.roleSubject.next('dm');
        break;
    }
  }
}
