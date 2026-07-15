import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { WEEKDAY_PRESETS, WeekdayPreset } from '../../models/campaign';

/** Week-size bounds, mirroring the server's GameClock constraints. */
export const MIN_WEEK_DAYS = 2;
export const MAX_WEEK_DAYS = 20;

/**
 * Shared editor for a campaign's defined week — an ordered list of weekday
 * names, or null for "no defined week" (free-text weekdays, repetition counts
 * weeks). A select offers the built-in presets plus a Custom… option that
 * builds the week one text box at a time: typing into the last box reveals a
 * "+" that spawns the next. The editor emits continuously — the ordered,
 * trimmed, deduped list once at least {@link MIN_WEEK_DAYS} days are named,
 * null otherwise — and the surrounding screen's own action (the modal's
 * submit, the dashboard panel's Save) is what locks the days in. Used by the
 * create-campaign modal and the dashboard's week panel.
 */
@Component({
    selector: 'app-week-days-editor',
    templateUrl: './week-days-editor.component.html',
    standalone: false
})
export class WeekDaysEditorComponent implements OnChanges {
  @Input() value: string[] | null = null;
  @Output() valueChange = new EventEmitter<string[] | null>();

  readonly presets: WeekdayPreset[] = WEEKDAY_PRESETS;
  readonly minDays = MIN_WEEK_DAYS;
  readonly maxDays = MAX_WEEK_DAYS;

  /** '' = no defined week; a preset key; or 'custom'. */
  choice = '';
  /** One entry per text box in custom mode, in week order. */
  customDays: string[] = [];

  /** What was last emitted — undefined until the first emission. */
  private lastEmitted: string[] | null | undefined;

  ngOnChanges(): void {
    // Live emission echoes straight back here through the parent's binding —
    // only a genuinely external value change may reset the boxes.
    if (this.isEcho()) return;
    if (!this.value?.length) {
      this.choice = '';
      this.customDays = [];
      return;
    }
    const preset = this.presets.find(p =>
      p.days.length === this.value!.length &&
      p.days.every((d, i) => d === this.value![i]));
    this.choice = preset ? preset.key : 'custom';
    this.customDays = preset ? [] : [...this.value];
  }

  /** True when the incoming value is just the parent echoing our own emission. */
  private isEcho(): boolean {
    if (this.lastEmitted === undefined) return false;
    if (this.value === this.lastEmitted) return true; // same reference, or both null
    return Array.isArray(this.value) && Array.isArray(this.lastEmitted)
      && this.value.length === this.lastEmitted.length
      && this.value.every((d, i) => d === (this.lastEmitted as string[])[i]);
  }

  onChoice(choice: string): void {
    this.choice = choice;
    if (choice === 'custom') {
      // Seed a box per existing day (dashboard edit flow), else one empty box.
      this.customDays = this.value?.length ? [...this.value] : [''];
      this.emitCurrent();
      return;
    }
    this.customDays = [];
    if (choice === '') {
      this.emit(null);
      return;
    }
    const preset = this.presets.find(p => p.key === choice);
    this.emit(preset ? [...preset.days] : null);
  }

  onDayInput(index: number, text: string): void {
    this.customDays[index] = text;
    this.emitCurrent();
  }

  /** The "+" under the last box: shown once that box has content, capped at {@link MAX_WEEK_DAYS}. */
  get canAddDay(): boolean {
    return this.choice === 'custom'
      && this.customDays.length > 0
      && this.customDays.length < this.maxDays
      && this.customDays[this.customDays.length - 1].trim().length > 0;
  }

  addDay(): void {
    if (!this.canAddDay) return;
    this.customDays = [...this.customDays, ''];
  }

  /** The non-blank, trimmed, case-insensitively deduped names the boxes hold, in order. */
  get pendingDays(): string[] {
    const seen = new Set<string>();
    const days: string[] = [];
    for (const raw of this.customDays) {
      const day = raw.trim();
      if (!day || seen.has(day.toLowerCase())) continue;
      seen.add(day.toLowerCase());
      days.push(day);
    }
    return days;
  }

  /** True while custom boxes name fewer than the minimum days (nothing usable yet). */
  get incomplete(): boolean {
    return this.choice === 'custom' && this.pendingDays.length < this.minDays;
  }

  /** The days the current selection resolves to, for the "Sul · Mol · …" preview. */
  get preview(): string[] | null {
    if (this.choice === 'custom') return this.incomplete ? null : this.pendingDays;
    if (this.choice === '') return null;
    return this.presets.find(p => p.key === this.choice)?.days ?? null;
  }

  /** Emit the boxes' current value: the named days once valid, null otherwise. */
  private emitCurrent(): void {
    const days = this.pendingDays;
    this.emit(days.length >= this.minDays && days.length <= this.maxDays ? days : null);
  }

  private emit(days: string[] | null): void {
    this.lastEmitted = days;
    this.valueChange.emit(days);
  }

  trackByIndex(index: number): number {
    return index;
  }
}
