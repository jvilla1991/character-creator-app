import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { WEEKDAY_PRESETS, WeekdayPreset } from '../../models/campaign';

/** Week-size bounds, mirroring the server's GameClock constraints. */
export const MIN_WEEK_DAYS = 2;
export const MAX_WEEK_DAYS = 20;

/**
 * Shared editor for a campaign's defined week — an ordered list of weekday
 * names, or null for "no defined week" (free-text weekdays, repetition counts
 * weeks). A select offers the built-in presets (emitted immediately) plus a
 * Custom… option that builds the week one text box at a time: typing into the
 * last box reveals a "+" that spawns the next, and nothing is emitted until the
 * DM clicks Inscribe — which locks the trimmed, deduped ordered list in as the
 * value. Used by the create-campaign modal and the dashboard's week panel.
 */
@Component({
  selector: 'app-week-days-editor',
  templateUrl: './week-days-editor.component.html',
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
  /** True once the custom boxes have been inscribed (locked in) as the value. */
  inscribed = false;

  ngOnChanges(): void {
    if (!this.value?.length) {
      // Choosing Custom… clears the value to null, which echoes straight back
      // here through the parent's binding — don't wipe the in-progress boxes.
      if (this.dirty) return;
      this.choice = '';
      this.customDays = [];
      this.inscribed = false;
      return;
    }
    const preset = this.presets.find(p =>
      p.days.length === this.value!.length &&
      p.days.every((d, i) => d === this.value![i]));
    this.choice = preset ? preset.key : 'custom';
    this.customDays = preset ? [] : [...this.value];
    this.inscribed = !preset; // an existing custom definition IS the locked-in value
  }

  onChoice(choice: string): void {
    this.choice = choice;
    this.inscribed = false;
    if (choice === 'custom') {
      // Seed a box per existing day (dashboard edit flow), else one empty box.
      this.customDays = this.value?.length ? [...this.value] : [''];
      // Custom days aren't the value until inscribed — clear the old definition.
      this.valueChange.emit(null);
      return;
    }
    this.customDays = [];
    if (choice === '') {
      this.valueChange.emit(null);
      return;
    }
    const preset = this.presets.find(p => p.key === choice);
    this.valueChange.emit(preset ? [...preset.days] : null);
  }

  /** A box edit re-opens the week — the days stay pending until re-inscribed. */
  onDayInput(index: number, text: string): void {
    this.customDays[index] = text;
    this.inscribed = false;
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

  get canInscribe(): boolean {
    return this.choice === 'custom' && !this.inscribed
      && this.pendingDays.length >= this.minDays
      && this.pendingDays.length <= this.maxDays;
  }

  /** Lock the custom days in — the ONLY point custom mode emits the value. */
  inscribe(): void {
    if (!this.canInscribe) return;
    const days = this.pendingDays;
    this.customDays = [...days]; // normalize the boxes to what was locked in
    this.inscribed = true;
    this.valueChange.emit(days);
  }

  /** True while custom boxes hold edits that haven't been inscribed yet. */
  get dirty(): boolean {
    return this.choice === 'custom' && !this.inscribed;
  }

  /** The locked-in days for the "Sul · Mol · …" preview (null while pending). */
  get preview(): string[] | null {
    if (this.choice === 'custom') return this.inscribed ? this.pendingDays : null;
    if (this.choice === '') return null;
    return this.presets.find(p => p.key === this.choice)?.days ?? null;
  }

  trackByIndex(index: number): number {
    return index;
  }
}
