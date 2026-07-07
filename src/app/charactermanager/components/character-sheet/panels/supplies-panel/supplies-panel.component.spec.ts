import { SuppliesPanelComponent } from './supplies-panel.component';
import { PC, PcItem } from '../../../../models/pc';

describe('SuppliesPanelComponent', () => {
  let component: SuppliesPanelComponent;

  const basePc = (inventory: PcItem[] = []): PC =>
    ({ id: 1, name: 'X', clazz: 'Ranger', level: 3, playerName: 'P', inventory } as PC);

  beforeEach(() => {
    component = new SuppliesPanelComponent();
    component.editable = true;
  });

  it('reads charges from the rations/waterskin lines and labels them', () => {
    component.pc = basePc([
      { catalogKey: 'rations', name: 'Ration box', category: 'gear', qty: 3 },
      { catalogKey: 'waterskin', name: 'Water skin', category: 'gear', qty: 5 },
    ]);
    const rows = component.rows;
    expect(rows.map(r => r.label)).toEqual(['Ration box', 'Water skin']);
    expect(rows[0].charges).toBe(3);
    expect(rows[1].charges).toBe(5);
    // capacity is max(charges, 5): 3 charges → 5 pips, 3 filled, none extra
    expect(rows[0].pips).toEqual([
      { filled: true, extra: false }, { filled: true, extra: false }, { filled: true, extra: false },
      { filled: false, extra: false }, { filled: false, extra: false },
    ]);
    expect(rows[0].slots).toBe(0);
  });

  it('charges the free box/skin no slots but bulk-tags every extra serving', () => {
    component.pc = basePc([{ catalogKey: 'rations', name: 'Ration box', category: 'gear', qty: 7 }]);
    const row = component.rows[0];
    expect(row.slots).toBe(2); // 7 − 5 free
    expect(row.pips.length).toBe(7);
    expect(row.pips.filter(p => p.extra).length).toBe(2);
    expect(row.pips[5]).toEqual({ filled: true, extra: true });
  });

  it('shows both supplies at zero when no lines exist yet', () => {
    component.pc = basePc([]);
    const rows = component.rows;
    expect(rows.length).toBe(2);
    expect(rows.every(r => r.charges === 0)).toBeTrue();
    expect(rows.every(r => r.slots === 0)).toBeTrue();
    expect(rows[0].pips.every(p => !p.filled)).toBeTrue();
    expect(rows[0].pips.length).toBe(5);
  });

  it('drops pips (but keeps the count and slot cost) once charges exceed the pip cap', () => {
    component.pc = basePc([{ catalogKey: 'rations', name: 'Ration box', category: 'gear', qty: 20 }]);
    const row = component.rows[0];
    expect(row.charges).toBe(20);
    expect(row.slots).toBe(15);
    expect(row.pips).toEqual([]);
  });

  it('spends a serving without mutating the input PC', () => {
    component.pc = basePc([{ catalogKey: 'rations', name: 'Ration box', category: 'gear', qty: 4 }]);
    const spy = spyOn(component.pcChange, 'emit');

    component.adjust('rations', -1);

    const emitted = spy.calls.mostRecent().args[0] as PC;
    expect(emitted.inventory!.find(i => i.catalogKey === 'rations')!.qty).toBe(3);
    expect(component.pc.inventory![0].qty).toBe(4); // input untouched
  });

  it('creates the line on a restock when none exists', () => {
    component.pc = basePc([]);
    const spy = spyOn(component.pcChange, 'emit');

    component.adjust('waterskin', 1);

    const emitted = spy.calls.mostRecent().args[0] as PC;
    const line = emitted.inventory!.find(i => i.catalogKey === 'waterskin');
    expect(line).toEqual({ catalogKey: 'waterskin', name: 'Water skin', category: 'gear', qty: 1 });
  });

  it('does not go below zero when spending an empty supply', () => {
    component.pc = basePc([{ catalogKey: 'waterskin', name: 'Water skin', category: 'gear', qty: 0 }]);
    const spy = spyOn(component.pcChange, 'emit');

    component.adjust('waterskin', -1);

    const emitted = spy.calls.mostRecent().args[0] as PC;
    expect(emitted.inventory!.find(i => i.catalogKey === 'waterskin')!.qty).toBe(0);
  });
});
