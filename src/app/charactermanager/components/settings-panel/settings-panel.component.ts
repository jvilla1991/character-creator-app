import { Component } from '@angular/core';
import { UiStateService } from '../../services/ui-state.service';
import { PreferencesService, Theme } from '../../services/preferences.service';
import { CurrentUserService } from '../../services/current-user.service';
import { AuthService } from '../../services/auth.service';
import { DicePrefs } from '../../models/campaign';
import { tintFor } from '../../utils/character-math';
import { environment } from '../../../../environments/environment';

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
    standalone: false
})
export class SettingsPanelComponent {
  user = this.currentUser.getUser();
  theme$ = this.prefs.theme$;
  dice$ = this.prefs.dice$;

  // Password sections are meaningless in demo mode (no backend, fake login).
  get demoMode(): boolean { return environment.demoMode; }

  // ── Change password ──
  showChangePassword = false;
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  passwordError = '';
  passwordSaved = false;
  savingPassword = false;

  // ── Admin: reset links ──
  resetUserName = '';
  resetLink = '';
  resetError = '';
  resetLinkCopied = false;
  generatingReset = false;

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
  get userTint(): string { return tintFor({ portraitTint: this.user.tint }); }

  close(): void { this.uiState.closeSettings(); }

  setTheme(theme: Theme): void { this.prefs.setTheme(theme); }

  setDiceStyle(style: DicePrefs['style']): void {
    this.prefs.setDice({ ...this.prefs.dice, style });
  }

  toggleDice(key: 'showMods' | 'advPrompt' | 'critFx'): void {
    const dice = this.prefs.dice;
    this.prefs.setDice({ ...dice, [key]: !dice[key] });
  }

  toggleChangePassword(): void {
    this.showChangePassword = !this.showChangePassword;
    this.passwordError = '';
    this.passwordSaved = false;
  }

  savePassword(): void {
    this.passwordError = '';
    this.passwordSaved = false;
    if (this.newPassword.length < 8) {
      this.passwordError = 'New password must be at least 8 characters.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'New passwords do not match.';
      return;
    }
    this.savingPassword = true;
    this.auth.changePassword(this.currentPassword, this.newPassword).subscribe(response => {
      this.savingPassword = false;
      if (response.success) {
        this.passwordSaved = true;
        this.currentPassword = this.newPassword = this.confirmPassword = '';
      } else {
        // The backend rejects a wrong current password with a 400 + message.
        this.passwordError = 'Could not change password — check your current password.';
      }
    });
  }

  generateResetLink(): void {
    this.resetError = '';
    this.resetLink = '';
    this.resetLinkCopied = false;
    const userName = this.resetUserName.trim();
    if (!userName) return;
    this.generatingReset = true;
    this.auth.issueResetToken(userName).subscribe({
      next: response => {
        this.generatingReset = false;
        // The backend returns only the raw token; the shareable link is
        // composed here so no base-URL config exists server-side.
        this.resetLink = `${location.origin}/reset-password?token=${response.token}`;
      },
      error: () => {
        this.generatingReset = false;
        this.resetError = `No user named “${userName}” was found.`;
      },
    });
  }

  copyResetLink(): void {
    navigator.clipboard?.writeText(this.resetLink).then(() => {
      this.resetLinkCopied = true;
    });
  }

  signOut(): void {
    // Leaving the app entirely — drop any open overlays without juggling history
    // (the redirect to /login discards the pushed entries anyway).
    this.uiState.resetOverlays();
    this.auth.logout();
  }
}
