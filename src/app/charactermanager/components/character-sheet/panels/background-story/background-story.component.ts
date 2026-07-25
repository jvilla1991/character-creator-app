import { Component, input, output } from '@angular/core';
import { PC } from '../../../../models/pc';
import { STANDARD_LANGUAGES } from '../../../../services/dnd-resources.service';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-background-story',
    templateUrl: './background-story.component.html',
    styleUrls: ['./background-story.component.scss'],
    imports: [FormsModule]
})
export class BackgroundStoryComponent {
  readonly pc = input.required<PC>();
  /** True when the viewer is a DM cross-linked into this sheet — reveals the Grant language control. */
  readonly addAllowed = input(false);
  /**
   * A DM-granted language. Emitted as a bare payload rather than a merged PC because a grant
   * must go through GrantService's refetch-merge-save (the sheet's `pc` copy can be stale —
   * PUTting it directly risks clobbering a concurrent player edit). CharacterSheetComponent
   * owns the actual save.
   */
  readonly languageGranted = output<string>();

  get bioFirst(): string { return this.pc().bio?.charAt(0) ?? ''; }
  get bioRest(): string  { return this.pc().bio?.slice(1) ?? ''; }

  get traitEntries(): { key: string; value: string }[] {
    const pc = this.pc();
    if (!pc.traits) return [];
    return Object.entries(pc.traits).map(([key, value]) => ({ key, value }));
  }

  /** Languages the character knows (e.g. ['Common', 'Elvish']) */
  get languages(): string[] {
    return this.pc().languages ?? [];
  }

  /** Tool proficiencies from background and class (e.g. ["Thieves' Tools"]) */
  get toolProficiencies(): string[] {
    return this.pc().toolProfs ?? [];
  }

  get hasProficiencies(): boolean {
    return this.languages.length > 0 || this.toolProficiencies.length > 0;
  }

  // ── DM grant form ────────────────────────────────────────────────────────
  // Free-text with a standard-language typeahead: a DM can grant a standard
  // language or any rare/exotic one (Druidic, Abyssal…) by typing it.

  grantFormOpen = false;
  languageDraft = '';
  languageDropdownOpen = false;

  openGrantForm(): void {
    this.grantFormOpen = true;
  }

  cancelGrant(): void {
    this.resetGrantForm();
  }

  /** Standard languages the PC doesn't know yet, filtered by the current draft. */
  get filteredLanguages(): string[] {
    const known = new Set(this.languages.map(l => l.toLowerCase()));
    const q = this.languageDraft.trim().toLowerCase();
    return STANDARD_LANGUAGES
      .filter(l => !known.has(l.toLowerCase()))
      .filter(l => !q || l.toLowerCase().includes(q));
  }

  /** True when the draft names a language the PC already knows (blocks the grant). */
  get draftAlreadyKnown(): boolean {
    const q = this.languageDraft.trim().toLowerCase();
    return !!q && this.languages.some(l => l.toLowerCase() === q);
  }

  onLanguageFocus(): void { this.languageDropdownOpen = true; }
  onLanguageInput(): void { this.languageDropdownOpen = true; }
  onLanguageBlur(): void  { this.languageDropdownOpen = false; }

  /** Escape closes the dropdown first; a second Escape (dropdown already closed) cancels the form. */
  onLanguageEscape(): void {
    if (this.languageDropdownOpen) {
      this.languageDropdownOpen = false;
      return;
    }
    this.cancelGrant();
  }

  selectLanguage(name: string): void {
    this.languageDraft = name;
    this.languageDropdownOpen = false;
  }

  submitGrant(): void {
    const language = this.languageDraft.trim();
    if (!language || this.draftAlreadyKnown) return;
    this.languageGranted.emit(language);
    this.resetGrantForm();
  }

  private resetGrantForm(): void {
    this.grantFormOpen = false;
    this.languageDraft = '';
    this.languageDropdownOpen = false;
  }
}
