import { SuppliesPanelComponent } from './supplies-panel.component';
import { PC, PcItem } from '../../../../models/pc';

describe('SuppliesPanelComponent', () => {
  let component: SuppliesPanelComponent;

  const basePc = (inventory: PcItem[] = []): PC =>
    ({ id: 1, name: 'X', clazz: 'Ranger', level: 3, playerName: 'P', inventory } as PC);

  const kit = (over: Partial<Record<string, number>> = {}): PcItem[] => [
    { catalogKey: 'ration-box', name: 'Ration box', category: 'gear', qty: over['ration-box'] ?? 1 },
    { catalogKey: 'waterskin', name: 'Waterskin', category: 'gear', qty: over['waterskin'] ?? 1 },
    { catalogKey: 'rations', name: 'Rations (1 day)', category: 'gear', qty: over['rations'] ?? 5 },
    { catalogKey: 'water', name: 'Water', category: 'gear', qty: over['water'] ?? 5 },
  ];

  beforeEach(() => {
    component = new SuppliesPanelComponent();
    component.editable = true;
  });

  it('shows a Rations and a Water track with capacity = containers × 5', () => {
    component.pc = basePc(kit({ rations: 3, water: 4 }));
    const rows = component.rows;
    expect(rows.map(r => r.label)).toEqual(['Rations', 'Water']);
    expect(rows[0].charges).toBe(3);
    expect(rows[0].capacity).toBe(5);
    expect(rows[1].charges).toBe(4);
    expect(rows[1].capacity).toBe(5);
    // pips draw the capacity: 3 filled of 5
    expect(rows[0].pips).toEqual([
      { filled: true }, { filled: true }, { filled: true },
      { filled: false }, { filled: false },
    ]);
  });

  it('a second ration box raises the rations track to 10 pips', () => {
    component.pc = basePc(kit({ 'ration-box': 2, rations: 7 }));
    const row = component.rows[0];
    expect(row.capacity).toBe(10);
    expect(row.pips.length).toBe(10);
    expect(row.pips.filter(p => p.filled).length).toBe(7);
  });

  it('normalizes legacy data on read: implied box, waterskin charges become water', () => {
    // Old model: no box; waterskin qty WAS the water charges.
    component.pc = basePc([
      { catalogKey: 'rations', name: 'Ration box', category: 'gear', qty: 3 },
      { catalogKey: 'waterskin', name: 'Water skin', category: 'gear', qty: 7 },
    ]);
    const rows = component.rows;
    expect(rows[0].charges).toBe(3);
    expect(rows[0].capacity).toBe(5);  // the implied free box
    expect(rows[1].charges).toBe(7);
    expect(rows[1].capacity).toBe(10); // ceil(7/5) = 2 skins
  });

  it('drops pips (but keeps the counts) once the capacity exceeds the pip cap', () => {
    component.pc = basePc(kit({ 'ration-box': 4, rations: 20 }));
    const row = component.rows[0];
    expect(row.charges).toBe(20);
    expect(row.capacity).toBe(20);
    expect(row.pips).toEqual([]);
  });

  it('spends a serving without mutating the input PC', () => {
    component.pc = basePc(kit({ rations: 4 }));
    const spy = spyOn(component.pcChange, 'emit');

    component.adjust('rations', -1);

    const emitted = spy.calls.mostRecent().args[0] as PC;
    expect(emitted.inventory!.find(i => i.catalogKey === 'rations')!.qty).toBe(3);
    expect(component.pc.inventory!.find(i => i.catalogKey === 'rations')!.qty).toBe(4); // input untouched
  });

  it('restock stops at capacity — the + is a no-op when the containers are full', () => {
    component.pc = basePc(kit({ rations: 5 }));
    const spy = spyOn(component.pcChange, 'emit');

    component.adjust('rations', 1);

    expect(spy).not.toHaveBeenCalled(); // 5 of 5 — buy another box instead
  });

  it('restocks water free up to the skins\' capacity', () => {
    component.pc = basePc(kit({ water: 0 }));
    const spy = spyOn(component.pcChange, 'emit');

    component.adjust('water', 1);

    const emitted = spy.calls.mostRecent().args[0] as PC;
    expect(emitted.inventory!.find(i => i.catalogKey === 'water')!.qty).toBe(1);
  });

  it('creates the charge line on a restock when only the container exists', () => {
    component.pc = basePc([
      { catalogKey: 'ration-box', name: 'Ration box', category: 'gear', qty: 1 },
    ]);
    const spy = spyOn(component.pcChange, 'emit');

    component.adjust('rations', 1);

    const emitted = spy.calls.mostRecent().args[0] as PC;
    const line = emitted.inventory!.find(i => i.catalogKey === 'rations');
    expect(line!.qty).toBe(1);
    expect(line!.category).toBe('gear');
  });

  it('does not go below zero when spending an empty supply', () => {
    component.pc = basePc(kit({ water: 0 }));
    const spy = spyOn(component.pcChange, 'emit');

    component.adjust('water', -1);

    expect(spy).not.toHaveBeenCalled(); // already empty — nothing to persist
  });

  it('keeps a spent line at qty 0 rather than removing it', () => {
    component.pc = basePc(kit({ rations: 1 }));
    const spy = spyOn(component.pcChange, 'emit');

    component.adjust('rations', -1);

    const emitted = spy.calls.mostRecent().args[0] as PC;
    const lines = emitted.inventory!.filter(i => i.catalogKey === 'rations');
    expect(lines.length).toBe(1);
    expect(lines[0].qty).toBe(0);
  });
});
