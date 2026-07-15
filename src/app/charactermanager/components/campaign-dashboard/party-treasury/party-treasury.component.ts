import { Component, Input } from '@angular/core';
import { PC } from '../../../models/pc';
import { goldValue } from '../../../utils/character-math';

interface TreasuryRow { name: string; gp: number; }

/** Party Treasury: each hero's wealth in gp plus a table total. */
@Component({
    selector: 'app-party-treasury',
    templateUrl: './party-treasury.component.html',
    standalone: false
})
export class PartyTreasuryComponent {
  @Input() set members(value: PC[]) {
    this.rows = value.map(m => ({ name: m.name.split(' ')[0], gp: goldValue(m.coins) }));
    this.total = value.reduce((sum, m) => sum + goldValue(m.coins), 0);
  }

  rows: TreasuryRow[] = [];
  total = 0;
}
