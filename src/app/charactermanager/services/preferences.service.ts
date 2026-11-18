import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DicePrefs } from '../models/campaign';

export type Theme = 'midnight' | 'candlelit' | 'vellum';

const THEME_KEY = 'tm_theme';
const DICE_KEY = 'tm_dice';
const LOCKED_FEATURES_KEY = 'tm_locked_features';

const DEFAULT_DICE: DicePrefs = { style: 'digital', showMods: true, advPrompt: true, critFx: true };
const THEMES: Theme[] = ['midnight', 'candlelit', 'vellum'];

/**
 * User preferences that survive reloads: the active theme (written to
 * `data-theme` on <html>), dice-rolling options, and whether character sheets
 * show the class features a character has yet to unlock. Persisted to
 * localStorage.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private themeSubject = new BehaviorSubject<Theme>(this.loadTheme());
  theme$ = this.themeSubject.asObservable();

  private diceSubject = new BehaviorSubject<DicePrefs>(this.loadDice());
  dice$ = this.diceSubject.asObservable();

  constructor() {
    // Apply the persisted theme immediately so the first paint is correct.
    this.applyTheme(this.themeSubject.getValue());
  }

  /**
   * Whether the Class Features panel lists the features still to be unlocked.
   * One setting for every character sheet in this browser; shown by default.
   */
  readonly showLockedFeatures = signal(this.loadShowLockedFeatures());

  get theme(): Theme { return this.themeSubject.getValue(); }
  get dice(): DicePrefs { return this.diceSubject.getValue(); }

  setTheme(theme: Theme): void {
    this.applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
    this.themeSubject.next(theme);
  }

  setDice(dice: DicePrefs): void {
    localStorage.setItem(DICE_KEY, JSON.stringify(dice));
    this.diceSubject.next(dice);
  }

  setShowLockedFeatures(show: boolean): void {
    this.showLockedFeatures.set(show);
    try {
      localStorage.setItem(LOCKED_FEATURES_KEY, show ? 'shown' : 'hidden');
    } catch {
      // Storage unavailable (private window, blocked site data): the choice
      // still holds for this visit, it just is not remembered.
    }
  }

  private applyTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  private loadTheme(): Theme {
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    return stored && THEMES.includes(stored) ? stored : 'midnight';
  }

  private loadShowLockedFeatures(): boolean {
    try {
      return localStorage.getItem(LOCKED_FEATURES_KEY) !== 'hidden';
    } catch {
      return true;
    }
  }

  private loadDice(): DicePrefs {
    try {
      const raw = localStorage.getItem(DICE_KEY);
      return raw ? { ...DEFAULT_DICE, ...JSON.parse(raw) } : { ...DEFAULT_DICE };
    } catch {
      return { ...DEFAULT_DICE };
    }
  }
}
