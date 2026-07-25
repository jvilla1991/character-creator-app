import { TestBed } from '@angular/core/testing';
import { UI_ACTIVE_CAMPAIGN_KEY, UI_ROLE_KEY, UiStateService } from './ui-state.service';

// Uses TestBed (not the class-only house style): the service registers
// effect()s in its constructor, which require an injection context, and the
// persistence specs need TestBed.tick() to flush them.
describe('UiStateService', () => {
  const create = (): UiStateService => TestBed.inject(UiStateService);

  const clearStorage = (): void => {
    localStorage.removeItem(UI_ROLE_KEY);
    localStorage.removeItem(UI_ACTIVE_CAMPAIGN_KEY);
  };

  beforeEach(clearStorage);
  afterEach(clearStorage);

  describe('computed role checks', () => {
    it('isPlayer/isDm mirror the role signal', () => {
      const service = create();

      expect(service.isPlayer()).toBeTrue();
      expect(service.isDm()).toBeFalse();

      service.setRole('dm');

      expect(service.isDm()).toBeTrue();
      expect(service.isPlayer()).toBeFalse();
    });
  });

  describe('sessionOverlayVisible', () => {
    it('is true while a session is open, except during a DM→hero cross-link', () => {
      const service = create();
      expect(service.sessionOverlayVisible()).toBeFalse();

      service.openSession('7');
      expect(service.sessionOverlayVisible()).toBeTrue();

      service.viewHeroAsDm();               // the member's sheet takes over
      expect(service.sessionOverlayVisible()).toBeFalse();

      service.returnToCampaign();           // back to the running session
      expect(service.sessionOverlayVisible()).toBeTrue();

      service.closeSession();
      expect(service.sessionOverlayVisible()).toBeFalse();
    });
  });

  describe('persistence effects', () => {
    it('persists role and campaign under the same keys/format as the old setters', () => {
      const service = create();

      service.setRole('dm');
      service.setActiveCampaign('c42');
      TestBed.tick();

      expect(localStorage.getItem(UI_ROLE_KEY)).toBe('dm');
      expect(localStorage.getItem(UI_ACTIVE_CAMPAIGN_KEY)).toBe('c42');
    });

    it('removes the campaign key when the active campaign is cleared', () => {
      const service = create();

      service.setActiveCampaign('c42');
      TestBed.tick();
      service.setActiveCampaign(null);
      TestBed.tick();

      expect(localStorage.getItem(UI_ACTIVE_CAMPAIGN_KEY)).toBeNull();
    });

    it('keeps the persisted role "dm" through a DM→hero cross-link', () => {
      const service = create();
      service.setRole('dm');
      TestBed.tick();

      service.viewHeroAsDm();
      TestBed.tick();

      // The displayed role flips to player, but the persisted (chosen) role
      // must stay 'dm' so a mid-cross-link refresh restores the DM view.
      expect(service.role()).toBe('player');
      expect(localStorage.getItem(UI_ROLE_KEY)).toBe('dm');
    });

    it('rehydrates the persisted role and campaign on construction', () => {
      localStorage.setItem(UI_ROLE_KEY, 'dm');
      localStorage.setItem(UI_ACTIVE_CAMPAIGN_KEY, 'c9');

      const service = create();

      expect(service.role()).toBe('dm');
      expect(service.isDm()).toBeTrue();
      expect(service.activeCampaignId()).toBe('c9');
    });

    it('clearPersistedView drops both keys (sign-out)', () => {
      const service = create();
      service.setRole('dm');
      service.setActiveCampaign('c1');
      TestBed.tick();

      service.clearPersistedView();

      expect(localStorage.getItem(UI_ROLE_KEY)).toBeNull();
      expect(localStorage.getItem(UI_ACTIVE_CAMPAIGN_KEY)).toBeNull();
    });
  });
});
