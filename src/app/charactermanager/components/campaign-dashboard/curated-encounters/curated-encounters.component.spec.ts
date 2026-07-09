import { of, throwError } from 'rxjs';
import { CuratedEncountersComponent } from './curated-encounters.component';
import { Campaign } from '../../../models/campaign';
import { Encounter, EncounterSummary } from '../../../models/encounter';

/** Tests the component class directly (no TestBed/DOM), per the app convention. */
describe('CuratedEncountersComponent', () => {
  let component: CuratedEncountersComponent;
  let service: any;
  let shopService: any;

  const campaign = { id: '1', name: 'The Veiled Compass' } as unknown as Campaign;

  const encounter: Encounter = {
    id: 5, campaignId: 1, name: 'Goblin Ambush', notes: 'They wait in the trees.',
    creatures: [{ id: 9, name: 'Goblin', dexModifier: 2, hpMax: 7, quantity: 4 }],
    lootCoinCp: 0, lootItems: [],
  };

  beforeEach(() => {
    service = jasmine.createSpyObj('CuratedEncounterService',
      ['list', 'create', 'get', 'update', 'delete', 'addCreature', 'updateCreature', 'removeCreature',
       'addLootItem', 'updateLootItem', 'removeLootItem', 'setLootCoins', 'importLoot']);
    service.list.and.returnValue(of([] as EncounterSummary[]));
    shopService = jasmine.createSpyObj('ShopService', ['getCatalog']);
    shopService.getCatalog.and.returnValue(of([]));
    component = new CuratedEncountersComponent(service, shopService);
    component.campaign = campaign;
  });

  it('loads encounters when the campaign changes', () => {
    const summaries: EncounterSummary[] = [
      { id: 5, campaignId: 1, name: 'Goblin Ambush', notes: null, creatureCount: 1 }];
    service.list.and.returnValue(of(summaries));
    component.ngOnChanges({ campaign: {} as any });
    expect(service.list).toHaveBeenCalledWith('1');
    expect(component.encounters).toEqual(summaries);
    expect(component.selected).toBeNull();
  });

  it('createEncounter posts the name and selects the new encounter', () => {
    service.create.and.returnValue(of(encounter));
    component.newName = '  Goblin Ambush  ';
    component.createEncounter();
    expect(service.create).toHaveBeenCalledWith('1', 'Goblin Ambush', '');
    expect(component.selected).toBe(encounter);
    expect(component.notesDraft).toBe('They wait in the trees.');
    expect(component.newName).toBe('');
  });

  it('createEncounter ignores a blank name', () => {
    component.newName = '   ';
    component.createEncounter();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('open loads the full encounter and seeds the notes draft', () => {
    service.get.and.returnValue(of(encounter));
    component.open({ id: 5 } as EncounterSummary);
    expect(service.get).toHaveBeenCalledWith(5);
    expect(component.selected).toBe(encounter);
    expect(component.notesDraft).toBe('They wait in the trees.');
  });

  it('addCreature posts the form, defaults quantity, and resets the form', () => {
    component.selected = encounter;
    component.cName = '  Goblin Boss ';
    component.cDex = 1;
    component.cHp = 21;
    component.cQty = 1;
    const after = { ...encounter, creatures: [...encounter.creatures,
      { id: 10, name: 'Goblin Boss', dexModifier: 1, hpMax: 21, quantity: 1 }] };
    service.addCreature.and.returnValue(of(after));
    component.addCreature();
    expect(service.addCreature).toHaveBeenCalledWith(5, 'Goblin Boss', 1, 21, 1);
    expect(component.selected!.creatures.length).toBe(2);
    expect(component.cName).toBe('');
    expect(component.cDex).toBeNull();
  });

  it('addCreature requires a name and DEX modifier', () => {
    component.selected = encounter;
    component.cName = 'Goblin';
    component.cDex = null;
    component.addCreature();
    expect(service.addCreature).not.toHaveBeenCalled();
  });

  it('saveNotes sends the draft with the unchanged name', () => {
    component.selected = encounter;
    component.notesDraft = 'New tactics';
    service.update.and.returnValue(of({ ...encounter, notes: 'New tactics' }));
    component.saveNotes();
    expect(service.update).toHaveBeenCalledWith(5, 'Goblin Ambush', 'New tactics');
    expect(component.selected!.notes).toBe('New tactics');
  });

  it('removeCreature updates the selected encounter', () => {
    component.selected = encounter;
    const after = { ...encounter, creatures: [] };
    service.removeCreature.and.returnValue(of(after));
    component.removeCreature(encounter.creatures[0]);
    expect(service.removeCreature).toHaveBeenCalledWith(5, 9);
    expect(component.selected!.creatures.length).toBe(0);
  });

  it('totalCombatants sums the quantities', () => {
    const e = { ...encounter, creatures: [
      { id: 1, name: 'Goblin', dexModifier: 2, hpMax: 7, quantity: 4 },
      { id: 2, name: 'Boss', dexModifier: 1, hpMax: 21, quantity: 1 }] };
    expect(component.totalCombatants(e)).toBe(5);
  });

  it('deleteEncounter clears selection and reloads', () => {
    component.selected = encounter;
    service.delete.and.returnValue(of(void 0));
    component.deleteEncounter();
    expect(service.delete).toHaveBeenCalledWith(5);
    expect(component.selected).toBeNull();
    expect(service.list).toHaveBeenCalled(); // back() reloads
  });

  // ── Loot editor ────────────────────────────────────────────────────────────

  it('addLootItem posts a catalog line and resets the form', () => {
    component.selected = encounter;
    component.lootMode = 'catalog';
    component.lootItemKey = 'longsword';
    component.lootQty = 2;
    const after = { ...encounter, lootItems: [
      { id: 1, catalogItemKey: 'longsword', name: 'Longsword', custom: false, customNotes: null, qty: 2 }] };
    service.addLootItem.and.returnValue(of(after));
    component.addLootItem();
    expect(service.addLootItem).toHaveBeenCalledWith(5, 'longsword', null, null, 2);
    expect(component.selected!.lootItems.length).toBe(1);
    expect(component.lootItemKey).toBe('');
    expect(component.lootQty).toBe(1);
  });

  it('addLootItem posts a custom line with notes', () => {
    component.selected = encounter;
    component.lootMode = 'custom';
    component.lootCustomName = '  Cloak of Elvenkind ';
    component.lootCustomNotes = ' Advantage on Stealth. ';
    service.addLootItem.and.returnValue(of(encounter));
    component.addLootItem();
    expect(service.addLootItem).toHaveBeenCalledWith(5, null, 'Cloak of Elvenkind', 'Advantage on Stealth.', 1);
  });

  it('addLootItem requires a selection for its mode', () => {
    component.selected = encounter;
    component.lootMode = 'catalog';
    component.lootItemKey = '';
    component.addLootItem();
    component.lootMode = 'custom';
    component.lootCustomName = '   ';
    component.addLootItem();
    expect(service.addLootItem).not.toHaveBeenCalled();
  });

  it('saveLootCoins sends the gp draft and reselects', () => {
    component.selected = encounter;
    component.coinGpDraft = 125.5;
    const after = { ...encounter, lootCoinCp: 12550 };
    service.setLootCoins.and.returnValue(of(after));
    component.saveLootCoins();
    expect(service.setLootCoins).toHaveBeenCalledWith(5, 125.5);
    expect(component.coinGpDraft).toBe(125.5); // re-derived from the response
  });

  it('importLoot rejects malformed JSON client-side', () => {
    component.selected = encounter;
    component.lootImportDraft = '{not json';
    component.importLoot();
    expect(service.importLoot).not.toHaveBeenCalled();
    expect(component.lootImportError).toContain('Not valid JSON');
  });

  it('importLoot posts a parsed payload and closes the import box', () => {
    component.selected = encounter;
    component.lootImportOpen = true;
    component.lootImportDraft = JSON.stringify({ coinGp: 10, items: [{ key: 'longsword' }] });
    service.importLoot.and.returnValue(of(encounter));
    component.importLoot();
    expect(service.importLoot).toHaveBeenCalledWith(5, {
      coinGp: 10, items: [{ key: 'longsword', name: null, notes: null, qty: null }] });
    expect(component.lootImportOpen).toBeFalse();
    expect(component.lootImportDraft).toBe('');
  });

  it('importLoot surfaces the server message on failure', () => {
    component.selected = encounter;
    component.lootImportDraft = JSON.stringify({ items: [{ key: 'vorpal-blade' }] });
    service.importLoot.and.returnValue(
      throwError(() => ({ error: { message: 'Unknown catalog keys: vorpal-blade' } })));
    component.importLoot();
    expect(component.lootImportError).toBe('Unknown catalog keys: vorpal-blade');
  });
});
