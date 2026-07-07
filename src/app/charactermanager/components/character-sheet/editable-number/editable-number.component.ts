import {
  ChangeDetectionStrategy, Component, ElementRef, EventEmitter,
  Input, Output, ViewChild,
} from '@angular/core';

/**
 * A single number shown inline that a DM can click to edit. Mirrors the sheet's
 * name-edit pattern (click → input → commit on blur/Enter, Escape cancels) but
 * for numeric values, and keeps the clamping rules in one place.
 *
 * Presentational: the parent supplies the display text via content projection
 * (so it can format freely, e.g. "+4"), passes the raw {@link value} for the
 * editor, and reacts to {@link committed}. When {@link editable} is false it
 * renders the projected content unchanged — no affordance, no behaviour.
 */
@Component({
  selector: 'app-editable-number',
  templateUrl: './editable-number.component.html',
  styleUrls: ['./editable-number.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditableNumberComponent {
  @Input() value: number | null | undefined = 0;
  @Input() editable = false;
  /** Inclusive bounds; null = unbounded on that side. */
  @Input() min: number | null = 0;
  @Input() max: number | null = null;
  /** Accessible label, also used for the click hint. */
  @Input() label = 'value';
  /**
   * Opt-in: when true (and editable), a click emits {@link editRequested}
   * instead of opening the inline editor — the parent owns a richer edit
   * surface (e.g. the DM edit modal) instead. Inert when editable is false,
   * so player flows are completely untouched.
   */
  @Input() intercept = false;

  @Output() committed = new EventEmitter<number>();
  @Output() editRequested = new EventEmitter<void>();

  @ViewChild('input') inputRef?: ElementRef<HTMLInputElement>;

  editing = false;
  draft: number | null = null;

  start(): void {
    if (!this.editable) return;
    if (this.intercept) {
      this.editRequested.emit();
      return;
    }
    this.draft = this.value ?? 0;
    this.editing = true;
    // Input renders after this change-detection pass; focus + select on the next tick.
    setTimeout(() => {
      this.inputRef?.nativeElement.focus();
      this.inputRef?.nativeElement.select();
    });
  }

  commit(): void {
    if (!this.editing) return;
    this.editing = false;
    if (this.draft === null || this.draft === undefined || isNaN(Number(this.draft))) {
      return; // reject blank / non-numeric — keep the existing value
    }
    const clamped = this.clamp(Math.round(Number(this.draft)));
    if (clamped !== (this.value ?? 0)) {
      this.committed.emit(clamped);
    }
  }

  cancel(): void {
    this.editing = false;
  }

  private clamp(n: number): number {
    let v = n;
    if (this.min !== null) v = Math.max(this.min, v);
    if (this.max !== null) v = Math.min(this.max, v);
    return v;
  }
}
