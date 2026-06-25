import { Component } from '@angular/core';
import { UiStateService } from '../../services/ui-state.service';
import { PreferencesService, Theme } from '../../services/preferences.service';
import { CurrentUserService } from '../../services/current-user.service';
import { AuthService } from '../../services/auth.service';
import { DicePrefs } from '../../models/campaign';
import { tintFor } from '../../utils/character-math';

interface ThemeSwatch {
  id: Theme;
  label: string;
  bg: string;
  gold: string;
  accent: string;
}

/**
 * Left slide-over with the role toggle (View As), account fields, theme
 * swatches and dice preferences. Opened from the sidebar account-row gear.
 */
@Component({
  selector: 'app-settings-panel',
  templateUrl: './settings-panel.component.html',
})
export class SettingsPanelComponent {
  user = this.currentUser.getUser();
  theme$ = this.prefs.theme$;
  dice$ = this.prefs.dice$;

  readonly themes: ThemeSwatch[] = [
    { id: 'midnight',  label: 'Midnight',  bg: '#0d1224', gold: '#d4b06a', accent: '#8fb4ff' },
    { id: 'candlelit', label: 'Candlelit', bg: '#221808', gold: '#e8b860', accent: '#d8a868' },
    { id: 'vellum',    label: 'Vellum',    bg: '#e4d6b2', gold: '#8a5e22', accent: '#2a4a8a' },
  ];

  constructor(
    private uiState: UiStateService,
    private prefs: PreferencesService,
    private currentUser: CurrentUserService,
    private auth: AuthService,
  ) {}

  /** Background tint for the header portrait, reusing the shared util. */
  get userTint(): string { return tintFor({ portraitTint: this.user.tint } as any); }

  close(): void { this.uiState.closeSettings(); }

  setTheme(theme: Theme): void { this.prefs.setTheme(theme); }

  setDiceStyle(style: DicePrefs['style']): void {
    this.prefs.setDice({ ...this.prefs.dice, style });
  }

  toggleDice(key: 'showMods' | 'advPrompt' | 'critFx'): void {
    const dice = this.prefs.dice;
    this.prefs.setDice({ ...dice, [key]: !dice[key] });
  }

  signOut(): void {
    // Leaving the app entirely — drop any open overlays without juggling history
    // (the redirect to /login discards the pushed entries anyway).
    this.uiState.resetOverlays();
    this.auth.logout();
  }
}
