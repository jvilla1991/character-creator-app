import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { WEEKDAY_PRESETS, WeekdayPreset } from '../../models/campaign';

/**
 * Shared editor for a campaign's defined week — an ordered list of weekday
 * names, or null for "no defined week" (free-text weekdays, repetition counts
 * weeks). A select offers the built-in presets plus a Custom… option that opens
 * a comma-separated input; every change emits the trimmed, deduped ordered list
 * (or null). Used by the create-campaign modal and the dashboard's week panel.
 */
@Component({
  selector: 'app-week-days-editor',
  templateUrl: './week-days-editor.component.html',
})
export class WeekDaysEditorComponent implements OnChanges {
  @Input() value: string[] | null = null;
  @Output() valueChange = new EventEmitter<string[] | null>();

  readonly presets: WeekdayPreset[] = WEEKDAY_PRESETS;

  /** '' = no defined week; a preset key; or 'custom'. */
  choice = '';
  customText = '';

  ngOnChanges(): void {
    if (!this.value?.length) {
      this.choice = '';
      this.customText = '';
      return;
    }
    const preset = this.presets.find(p =>
      p.days.length === this.value!.length &&
      p.days.every((d, i) => d === this.value![i]));
    this.choice = preset ? preset.key : 'custom';
    this.customText = preset ? '' : this.value.join(', ');
  }

  onChoice(choice: string): void {
    this.choice = choice;
    if (choice === '') {
      this.valueChange.emit(null);
      return;
    }
    if (choice === 'custom') {
      this.customText = this.value?.join(', ') ?? '';
      this.valueChange.emit(this.parseCustom(this.customText));
      return;
    }
    const preset = this.presets.find(p => p.key === choice);
    this.valueChange.emit(preset ? [...preset.days] : null);
  }

  onCustomText(text: string): void {
    this.customText = text;
    this.valueChange.emit(this.parseCustom(text));
  }

  /** The days the current selection resolves to, for the "Sul · Mol · …" preview. */
  get preview(): string[] | null {
    if (this.choice === '') return null;
    if (this.choice === 'custom') return this.parseCustom(this.customText);
    return this.presets.find(p => p.key === this.choice)?.days ?? null;
  }

  /** Comma-separated names → trimmed, deduped (case-insensitive) ordered list, or null. */
  private parseCustom(text: string): string[] | null {
    const seen = new Set<string>();
    const days: string[] = [];
    for (const part of text.split(',')) {
      const day = part.trim();
      if (!day || seen.has(day.toLowerCase())) continue;
      seen.add(day.toLowerCase());
      days.push(day);
    }
    return days.length ? days : null;
  }
}
