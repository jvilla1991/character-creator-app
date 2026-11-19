import {
  ChangeDetectionStrategy, Component, ElementRef, Input, OnInit, output, viewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../modal/modal.component';
import {
  ADJUSTMENT_LABEL_MAX, ADJUSTMENT_LINES_MAX, ADJUSTMENT_VALUE_MAX,
  BreakdownLine, StatAdjustment, countedSum, markRemoved, removalLabel, signed,
} from '../../../models/stat-adjustment';
import {
  STAT_DEFINITIONS, StatBreakdown, StatDefinition, cleanAdjustments, isValidAdjustment,
} from '../../../utils/stat-breakdown';

/** What the dialog hands back on Save: the new lines, whether the unlabelled
 *  rest of the saved total (if there was one) is still wanted, and the labels
 *  of the calculated lines that are out of the total. */
export interface StatBreakdownSave {
  lines: StatAdjustment[];
  keepUnlabelled: boolean;
  removed: string[];
}

/** A line being typed: the amount is null while the field is empty. */
interface DraftLine {
  value: number | null;
  label: string;
}

/**
 * Shows how a calculated number on the sheet is put together: the lines the
 * app works out, then the labelled lines a DM added ("+1 Taunka"), then the
 * total. Read-only for a player. With `editable` the viewer can add, change
 * and remove the adjustment lines. The automatic lines are never editable, but
 * where the number's definition allows it they can be taken out of the total
 * and put back; a line taken out stays listed as not counted.
 *
 * Knows nothing about Armor Class: everything it shows comes from the
 * {@link StatBreakdown} it is given, so any number with a definition in
 * `utils/stat-breakdown.ts` can open it (a spell level's slot maximum does).
 *
 * The breakdown is read once, when the dialog opens. The sheet refreshes
 * itself in the background during a session, and a refresh must not throw
 * away lines the DM is half-way through typing.
 */
@Component({
  selector: 'app-stat-breakdown-modal',
  templateUrl: './stat-breakdown-modal.component.html',
  styleUrls: ['./stat-breakdown-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, FormsModule],
})
export class StatBreakdownModalComponent implements OnInit {
  @Input({ required: true }) breakdown!: StatBreakdown;
  /** Whether the viewer may change the adjustment lines. */
  @Input() editable = false;

  readonly save = output<StatBreakdownSave>();
  readonly close = output<void>();

  readonly labelMax = ADJUSTMENT_LABEL_MAX;
  readonly valueMax = ADJUSTMENT_VALUE_MAX;
  readonly signed = signed;

  private readonly labelInputs = viewChildren<ElementRef<HTMLInputElement>>('labelInput');

  drafts: DraftLine[] = [];
  /** False once the DM removed the unlabelled rest or turned it into a line. */
  keepUnlabelled = true;
  /** Labels of the calculated lines that are out of the total, as they would be saved. */
  removed: string[] = [];

  ngOnInit(): void {
    this.drafts = this.breakdown.adjustments.map(line => ({ ...line }));
    this.removed = [...(this.breakdown.removed ?? [])];
  }

  get definition(): StatDefinition {
    return STAT_DEFINITIONS[this.breakdown.stat];
  }

  /** The unlabelled rest still counted in the total; 0 once dealt with. */
  get unlabelled(): number {
    return this.keepUnlabelled ? this.breakdown.unlabelled : 0;
  }

  /** The calculated lines, each marked by whether it is out of the total right now. */
  get autoLines(): BreakdownLine[] {
    const plain = this.breakdown.auto.map(({ removed, ...line }) => line);
    return markRemoved(plain, this.removed);
  }

  /** The viewer may take calculated lines out of this number and put them back. */
  get canRemoveLines(): boolean {
    return this.editable && !!this.definition.removable;
  }

  /** The total as it would be saved right now; unfinished lines count as 0. */
  get total(): number {
    const lines = this.drafts.reduce(
      (sum, line) => sum + (this.isWholeNumber(line.value) ? Number(line.value) : 0), 0);
    return countedSum(this.autoLines) + lines + this.unlabelled;
  }

  get canAddLine(): boolean {
    return this.drafts.length < ADJUSTMENT_LINES_MAX;
  }

  /** Every line is complete, and something actually differs from what was opened. */
  get canSave(): boolean {
    if (!this.drafts.every(line => this.isComplete(line))) return false;
    const before = JSON.stringify(this.breakdown.adjustments);
    const after = JSON.stringify(this.cleaned);
    return before !== after || this.unlabelled !== this.breakdown.unlabelled || this.removedChanged;
  }

  /** The set of removed lines differs from what was opened (order aside). */
  private get removedChanged(): boolean {
    const sorted = (labels: string[]) => JSON.stringify([...labels].sort());
    return sorted(this.removed) !== sorted(this.breakdown.removed ?? []);
  }

  /** Why Save is unavailable while a line is unfinished; null when every line is fine. */
  get lineProblem(): string | null {
    const unfinished = this.drafts.find(line => !this.isComplete(line));
    if (!unfinished) return null;
    if (!this.isWholeNumber(unfinished.value) || Number(unfinished.value) === 0) {
      return 'Each line needs a whole number other than 0, such as 1 or -2.';
    }
    if (Math.abs(Number(unfinished.value)) > ADJUSTMENT_VALUE_MAX) {
      return `An amount can be at most ${ADJUSTMENT_VALUE_MAX} either way.`;
    }
    return 'Each line needs a label that says where it comes from.';
  }

  private get cleaned(): StatAdjustment[] {
    return cleanAdjustments(this.drafts.map(line => ({ value: Number(line.value), label: line.label })));
  }

  private isWholeNumber(value: number | null): boolean {
    return value !== null && value !== undefined && String(value) !== '' && Number.isInteger(Number(value));
  }

  private isComplete(line: DraftLine): boolean {
    return this.isWholeNumber(line.value)
      && isValidAdjustment({ value: Number(line.value), label: line.label ?? '' });
  }

  addLine(value: number | null = 1): void {
    if (!this.canAddLine) return;
    this.drafts = [...this.drafts, { value, label: '' }];
    // The new row renders after this pass; put the cursor in its label next tick.
    setTimeout(() => this.labelInputs().at(-1)?.nativeElement.focus());
  }

  removeLine(index: number): void {
    this.drafts = this.drafts.filter((_, i) => i !== index);
  }

  /** Take a calculated line out of the total. It stays listed, and can be put back. */
  removeAutoLine(index: number): void {
    const line = this.autoLines[index];
    const label = line ? removalLabel(line.label) : '';
    if (!this.canRemoveLines || !line || line.removed || !label) return;
    this.removed = [...this.removed, label];
  }

  /** Count a removed calculated line again. */
  restoreAutoLine(index: number): void {
    const line = this.autoLines[index];
    if (!this.canRemoveLines || !line?.removed) return;
    const at = this.removed.indexOf(removalLabel(line.label));
    this.removed = this.removed.filter((_, i) => i !== at);
  }

  /** Turn the unlabelled rest into a real line the DM can name. */
  labelUnlabelled(): void {
    if (!this.canAddLine || this.unlabelled === 0) return;
    const value = this.unlabelled;
    this.keepUnlabelled = false;
    this.addLine(value);
  }

  /** Drop the unlabelled rest: the total falls back to what the lines add up to. */
  removeUnlabelled(): void {
    this.keepUnlabelled = false;
  }

  submit(): void {
    if (!this.editable || !this.canSave) return;
    this.save.emit({ lines: this.cleaned, keepUnlabelled: this.keepUnlabelled, removed: [...this.removed] });
  }

  cancel(): void {
    this.close.emit();
  }
}
