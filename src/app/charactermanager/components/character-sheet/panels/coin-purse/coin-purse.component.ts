import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PC } from '../../../../models/pc';
import { DmEditRequest } from '../../dm-edit-modal/dm-edit-request';

@Component({
    selector: 'app-coin-purse',
    templateUrl: './coin-purse.component.html',
    styleUrls: ['./coin-purse.component.scss'],
    standalone: false
})
export class CoinPurseComponent {
  @Input() pc!: PC;
  /** DM cross-link: makes each coin amount click-to-edit. */
  @Input() editable = false;
  @Output() pcChange = new EventEmitter<PC>();
  /** A DM clicked an intercepted coin amount — the parent opens the DM edit modal. */
  @Output() editRequested = new EventEmitter<DmEditRequest>();

  readonly coinTypes = [
    { key: 'cp', label: 'Copper' },
    { key: 'sp', label: 'Silver' },
    { key: 'ep', label: 'Electrum' },
    { key: 'gp', label: 'Gold' },
    { key: 'pp', label: 'Platinum' },
  ];

  get gpEquiv(): string {
    if (!this.pc.coins) return '0.00';
    const { cp, sp, ep, gp, pp } = this.pc.coins;
    return (cp / 100 + sp / 10 + ep / 2 + gp + pp * 10).toFixed(2);
  }

  coinAmt(key: string): number {
    return (this.pc.coins as any)?.[key] ?? 0;
  }

  /** Pure builder: apply one coin denomination. */
  private buildCoin(key: string, value: number): PC {
    const coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, ...(this.pc.coins ?? {}) };
    (coins as any)[key] = value;
    return { ...this.pc, coins };
  }

  /** Edit one coin denomination; the gp-equivalent recomputes on the refresh. */
  setCoin(key: string, value: number): void {
    this.pcChange.emit(this.buildCoin(key, value));
  }

  /** DM clicked (intercepted) a coin amount — request the edit modal instead of the inline editor.
   *  Label is the denomination key itself (cp/sp/ep/gp/pp) — the backend's own diff only ever
   *  summarizes the whole purse ("DM changed coins X → Y"), never a single denomination. */
  requestCoin(key: string): void {
    this.editRequested.emit({
      label: key,
      value: this.coinAmt(key),
      min: 0,
      max: null,
      apply: v => this.buildCoin(key, v),
    });
  }
}
