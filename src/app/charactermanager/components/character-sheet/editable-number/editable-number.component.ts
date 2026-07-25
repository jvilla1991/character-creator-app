import {
  ChangeDetectionStrategy, Component, ElementRef,
  input,
  output,
  viewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';

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
    imports: [FormsModule]
})
export class EditableNumberComponent {
  readonly value = input<number | null | undefined>(0);
  readonly editable = input(false);
  /** Inclusive bounds; null = unbounded on that side. */
  readonly min = input<number | null>(0);
  readonly max = input<number | null>(null);
  /** Accessible label, also used for the click hint. */
  readonly label = input('value');
  /**
   * Opt-in: when true (and editable), a click emits {@link editRequested}
   * instead of opening the inline editor — the parent owns a richer edit
   * surface (e.g. the DM edit modal) instead. Inert when editable is false,
   * so player flows are completely untouched.
   */
  readonly intercept = input(false);

  readonly committed = output<number>();
  readonly editRequested = output<void>();

  readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('input');

  editing = false;
  draft: number | null = null;

  start(): void {
    if (!this.editable()) return;
    if (this.intercept()) {
      this.editRequested.emit();
      return;
    }
    this.draft = this.value() ?? 0;
    this.editing = true;
    // Input renders after this change-detection pass; focus + select on the next tick.
    setTimeout(() => {
      this.inputRef()?.nativeElement.focus();
      this.inputRef()?.nativeElement.select();
    });
  }

  commit(): void {
    if (!this.editing) return;
    this.editing = false;
    if (this.draft === null || this.draft === undefined || isNaN(Number(this.draft))) {
      return; // reject blank / non-numeric — keep the existing value
    }
    const clamped = this.clamp(Math.round(Number(this.draft)));
    if (clamped !== (this.value() ?? 0)) {
      this.committed.emit(clamped);
    }
  }

  cancel(): void {
    this.editing = false;
  }

  private clamp(n: number): number {
    let v = n;
    const min = this.min();
    const max = this.max();
    if (min !== null) v = Math.max(min, v);
    if (max !== null) v = Math.min(max, v);
    return v;
  }
}
