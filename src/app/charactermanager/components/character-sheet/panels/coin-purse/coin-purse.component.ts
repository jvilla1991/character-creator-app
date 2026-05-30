import { Component, Input } from '@angular/core';
import { PC } from '../../../../models/pc';

@Component({
  selector: 'app-coin-purse',
  templateUrl: './coin-purse.component.html',
  styleUrls: ['./coin-purse.component.scss']
})
export class CoinPurseComponent {
  @Input() pc!: PC;

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
}
