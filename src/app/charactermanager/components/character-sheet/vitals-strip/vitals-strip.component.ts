import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PC } from '../../../models/pc';
import { hitDieFor, fmtMod } from '../../../utils/character-math';

@Component({
  selector: 'app-vitals-strip',
  templateUrl: './vitals-strip.component.html',
  styleUrls: ['./vitals-strip.component.scss']
})
export class VitalsStripComponent {
  @Input() pc!: PC;
  /** Emits a signed HP delta (+1, -1, +5, -5). Parent clamps and persists. */
  @Output() hpChange = new EventEmitter<number>();

  get hpPct(): number {
    if (!this.pc.hp) return 0;
    return Math.max(0, Math.min(100, (this.pc.hp.cur / this.pc.hp.max) * 100));
  }

  get hitDie(): number { return hitDieFor(this.pc.clazz); }

  fmtMod(n: number): string { return fmtMod(n); }
}
