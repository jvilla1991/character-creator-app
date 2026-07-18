import { of, throwError } from 'rxjs';
import { CuratedLootComponent } from './curated-loot.component';
import { Campaign } from '../../../models/campaign';
import { CuratedLoot, CuratedLootSummary } from '../../../models/curated-loot';
import { AuthoredItem } from '../../item-composer/authored-item';

/** Tests the component class directly (no TestBed/DOM), per the app convention. */
describe('CuratedLootComponent', () => {
  let component: CuratedLootComponent;
  let service: any;

  const campaign = { id: '1', name: 'The Veiled Compass' } as unknown as Campaign;

  const loot: CuratedLoot = {
    id: 5, campaignId: 1, name: 'Goblin Ambush spoils', notes: 'Behind the waterfall.',
    coinCp: 12550,
    items: [
      { id: 1, catalogItemKey: 'longsword', name: 'Longsword', custom: false, customNotes: null, qty: 2 },
      { id: 2, catalogItemKey: null, name: 'Flametongue', custom: true, customNotes: 'Ignites.',
        category: 'weapon', unitCostCp: 500000, weight: 3, damage: '1d8 slashing + 2d6 fire', qty: 1 },
    ],
  };

  beforeEach(() => {
    service = jasmine.createSpyObj('CuratedLootService',
      ['list', 'create', 'get', 'update', 'delete', 'addItem', 'updateItem', 'removeItem',
       'setCoins', 'importLoot']);
    service.list.and.returnValue(of([] as CuratedLootSummary[]));
    component = new CuratedLootComponent(service);
    component.campaign = campaign;
  });

  it('loads loot lists when the campaign changes', () => {
    const summaries: CuratedLootSummary[] = [
      { id: 5, campaignId: 1, name: 'Goblin Ambush spoils', notes: null, coinCp: 12550, itemCount: 2 }];
    service.list.and.returnValue(of(summaries));
    component.ngOnChanges({ campaign: {} as any });
    expect(service.list).toHaveBeenCalledWith('1');
    expect(component.lists).toEqual(summaries);
    expect(component.selected).toBeNull();
  });

  it('createList posts the name and selects the new list', () => {
    service.create.and.returnValue(of(loot));
    component.newName = '  Goblin Ambush spoils  ';
    component.createList();
    expect(service.create).toHaveBeenCalledWith('1', 'Goblin Ambush spoils', null);
    expect(component.selected).toBe(loot);
    expect(component.coinGpDraft).toBe(125.5); // derived from coinCp
  });

  it('open loads the full list and seeds the drafts', () => {
    service.get.and.returnValue(of(loot));
    component.open({ id: 5 } as CuratedLootSummary);
    expect(service.get).toHaveBeenCalledWith(5);
    expect(component.selected).toBe(loot);
    expect(component.notesDraft).toBe('Behind the waterfall.');
  });

  it('onItemAuthored forwards the composer payload to addItem', () => {
    component.selected = loot;
    const after = { ...loot, items: [...loot.items] };
    service.addItem.and.returnValue(of(after));
    const authored: AuthoredItem = {
      kind: 'custom', name: 'Mithral Plate', category: 'armor', qty: 1, armorClass: '18',
    };
    component.onItemAuthored(authored);
    expect(service.addItem).toHaveBeenCalledWith(5, authored);
    expect(component.selected).toBe(after);
  });

  it('changeQty persists a positive quantity and ignores invalid ones', () => {
    component.selected = loot;
    service.updateItem.and.returnValue(of(loot));
    component.changeQty(loot.items[0], 3);
    expect(service.updateItem).toHaveBeenCalledWith(5, 1, 3, null, null);

    component.changeQty(loot.items[0], 0);
    expect(service.updateItem).toHaveBeenCalledTimes(1);
  });

  it('saveCoins sends the gp draft', () => {
    component.selected = loot;
    component.coinGpDraft = 10;
    service.setCoins.and.returnValue(of({ ...loot, coinCp: 1000 }));
    component.saveCoins();
    expect(service.setCoins).toHaveBeenCalledWith(5, 10);
  });

  it('itemMeta summarizes a custom line’s attributes', () => {
    expect(component.itemMeta(loot.items[1]))
      .toBe('weapon · 1d8 slashing + 2d6 fire · 3 lb · 5000 gp · Ignites.');
    expect(component.itemMeta(loot.items[0])).toBe('Catalog item');
  });

  it('importLoot rejects malformed JSON client-side', () => {
    component.selected = loot;
    component.lootImportDraft = '{not json';
    component.importLoot();
    expect(service.importLoot).not.toHaveBeenCalled();
    expect(component.lootImportError).toContain('Not valid JSON');
  });

  it('importLoot posts a parsed payload and closes the import box', () => {
    component.selected = loot;
    component.lootImportOpen = true;
    component.lootImportDraft = JSON.stringify({ coinGp: 10, items: [{ key: 'longsword' }] });
    service.importLoot.and.returnValue(of(loot));
    component.importLoot();
    expect(service.importLoot).toHaveBeenCalledWith(5, {
      coinGp: 10, items: [{ key: 'longsword', name: null, notes: null, qty: null }] });
    expect(component.lootImportOpen).toBeFalse();
    expect(component.lootImportDraft).toBe('');
  });

  it('importLoot surfaces the server message on failure', () => {
    component.selected = loot;
    component.lootImportDraft = JSON.stringify({ items: [{ key: 'vorpal-blade' }] });
    service.importLoot.and.returnValue(
      throwError(() => ({ error: { message: 'Unknown catalog keys: vorpal-blade' } })));
    component.importLoot();
    expect(component.lootImportError).toBe('Unknown catalog keys: vorpal-blade');
  });

  it('deleteList clears selection and reloads', () => {
    component.selected = loot;
    service.delete.and.returnValue(of(void 0));
    component.deleteList();
    expect(service.delete).toHaveBeenCalledWith(5);
    expect(component.selected).toBeNull();
    expect(service.list).toHaveBeenCalled(); // back() reloads
  });
});
