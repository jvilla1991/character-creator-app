import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, output } from '@angular/core';
import { DmEditRequest } from './dm-edit-request';
import { ModalComponent } from '../../modal/modal.component';
import { FormsModule } from '@angular/forms';

/** What the modal hands back on Save: the clamped value and, if the DM typed
 *  one, their own log description (null lets the backend fall back to its
 *  automatic before/after diff). */
export interface DmEditConfirm {
  value: number;
  description: string | null;
}

/**
 * DM edit modal — opened when a DM clicks an intercepted `app-editable-number`
 * on a cross-linked character sheet. Prefills the value and an auto-generated
 * log line ("DM changed AC 15 → 16") that live-updates as the value changes,
 * until the DM hand-edits the description; from then on their text is pinned
 * and clearing the textarea re-arms the auto-fill. Saving with a blank
 * description sends `null` so the backend computes its usual diff instead.
 */
@Component({
    selector: 'app-dm-edit-modal',
    templateUrl: './dm-edit-modal.component.html',
    styleUrls: ['./dm-edit-modal.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ModalComponent, FormsModule]
})
export class DmEditModalComponent implements OnChanges {
  @Input() request!: DmEditRequest;
  readonly confirm = output<DmEditConfirm>();
  readonly close = output<void>();

  readonly descMaxLength = 500;

  valueDraft: number | null = null;
  descDraft = '';
  /** True once the DM has typed something that diverges from the auto-text —
   *  from then on value changes no longer overwrite their words. */
  descTouched = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['request'] && this.request) {
      this.valueDraft = this.request.value;
      this.descTouched = false;
      this.descDraft = this.autoText;
    }
  }

  /** "DM changed AC 15 → 16" — mirrors PcActivityLogService's diffScalar wording. */
  get autoText(): string {
    const before = this.render(this.request.value);
    const after = this.render(this.clamped);
    return `DM changed ${this.request.label} ${before} → ${after}`;
  }

  private render(value: number | null): string {
    return value == null ? '—' : String(value);
  }

  /** The typed value, clamped the same way EditableNumberComponent does (round + min/max). */
  get clamped(): number | null {
    if (this.valueDraft === null || this.valueDraft === undefined || isNaN(Number(this.valueDraft))) {
      return null;
    }
    let v = Math.round(Number(this.valueDraft));
    if (this.request.min !== null) v = Math.max(this.request.min, v);
    if (this.request.max !== null) v = Math.min(this.request.max, v);
    return v;
  }

  /** Under the value field: the saved value, and that the field wants the new
   *  total. Hit points get a worked example, because a DM at the table thinks
   *  "7 damage", not "35". */
  get valueHint(): string {
    const now = this.request.value;
    if (this.request.label !== 'current HP' || now == null) {
      return `Now ${this.render(now)}. Enter the new total.`;
    }
    const of = this.request.max != null ? ` of ${this.request.max}` : '';
    const example = Math.max(0, now - 5);
    return `Now ${now}${of}. Enter the HP they end up with, not the amount: for 5 damage, enter ${example}.`;
  }

  /** Hit points only: what the typed total amounts to ("That is 7 damage."). */
  get deltaHint(): string | null {
    const before = this.request.value;
    const after = this.clamped;
    if (this.request.label !== 'current HP' || before == null || after == null || after === before) {
      return null;
    }
    return after < before
      ? `That is ${before - after} damage.`
      : `That is ${after - before} healing.`;
  }

  get canSave(): boolean {
    return this.clamped !== null && this.clamped !== this.request.value;
  }

  /** Value changed — keep the auto-text in sync unless the DM has hand-edited it. */
  onValueChange(): void {
    if (!this.descTouched) this.descDraft = this.autoText;
  }

  /** Description keystroke — pin it once it diverges from the auto-text; an
   *  empty textarea re-arms auto-fill on the next value change. */
  onDescInput(): void {
    if (this.descDraft.trim() === '') {
      this.descTouched = false;
      return;
    }
    this.descTouched = this.descDraft !== this.autoText;
  }

  save(): void {
    if (!this.canSave || this.clamped === null) return;
    const description = this.descDraft.trim();
    this.confirm.emit({ value: this.clamped, description: description || null });
  }

  cancel(): void {
    this.close.emit();
  }
}
