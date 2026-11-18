import { PreferencesService } from './preferences.service';

describe('PreferencesService: locked class features', () => {
  const KEY = 'tm_locked_features';

  beforeEach(() => localStorage.removeItem(KEY));
  afterEach(() => localStorage.removeItem(KEY));

  it('shows locked features by default', () => {
    expect(new PreferencesService().showLockedFeatures()).toBeTrue();
  });

  it('remembers a collapsed list across visits', () => {
    new PreferencesService().setShowLockedFeatures(false);
    expect(localStorage.getItem(KEY)).toBe('hidden');
    // A later visit builds the service afresh and reads the stored choice.
    expect(new PreferencesService().showLockedFeatures()).toBeFalse();
  });

  it('remembers re-expanding the list', () => {
    const prefs = new PreferencesService();
    prefs.setShowLockedFeatures(false);
    prefs.setShowLockedFeatures(true);
    expect(prefs.showLockedFeatures()).toBeTrue();
    expect(new PreferencesService().showLockedFeatures()).toBeTrue();
  });

  it('keeps the choice for this visit when storage is unavailable', () => {
    const prefs = new PreferencesService();
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    prefs.setShowLockedFeatures(false);
    expect(prefs.showLockedFeatures()).toBeFalse();
  });
});
