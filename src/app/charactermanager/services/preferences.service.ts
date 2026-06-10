import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DicePrefs } from '../models/campaign';

export type Theme = 'midnight' | 'candlelit' | 'vellum';

const THEME_KEY = 'tm_theme';
const DICE_KEY = 'tm_dice';

const DEFAULT_DICE: DicePrefs = { style: 'digital', showMods: true, advPrompt: true, critFx: true };
const THEMES: Theme[] = ['midnight', 'candlelit', 'vellum'];

/**
 * User preferences that survive reloads: the active theme (written to
 * `data-theme` on <html>) and dice-rolling options. Persisted to localStorage.
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

  private applyTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  private loadTheme(): Theme {
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    return stored && THEMES.includes(stored) ? stored : 'midnight';
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
