import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ConfirmService } from '../../modal/confirm.service';
import { CuratedEncountersComponent } from './curated-encounters.component';
import { Campaign } from '../../../models/campaign';
import { Encounter, EncounterSummary } from '../../../models/encounter';
import { NotificationService } from '../../../services/notification.service';

/** Tests the component class directly (no TestBed/DOM), per the app convention. */
describe('CuratedEncountersComponent', () => {
  let confirm: jasmine.Spy;
  let component: CuratedEncountersComponent;
  let service: any;

  const campaign = { id: '1', name: 'The Veiled Compass' } as unknown as Campaign;

  const encounter: Encounter = {
    id: 5, campaignId: 1, name: 'Goblin Ambush', notes: 'They wait in the trees.',
    creatures: [{ id: 9, name: 'Goblin', armorClass: 15, hpMax: 7, quantity: 4 }],
  };

  beforeEach(() => {
    service = jasmine.createSpyObj('CuratedEncounterService',
      ['list', 'create', 'get', 'update', 'delete', 'addCreature', 'updateCreature', 'removeCreature']);
    service.list.and.returnValue(of([] as EncounterSummary[]));
    component = TestBed.runInInjectionContext(() => new CuratedEncountersComponent(service));
    component.campaign = campaign;
    confirm = spyOn(TestBed.inject(ConfirmService), 'confirm').and.returnValue(of(undefined));
  });

  it('a failed list load says so instead of claiming there are none', () => {
    const notify = spyOn(TestBed.inject(NotificationService), 'error');
    service.list.and.returnValue(throwError(() => new Error('down')));
    component.ngOnChanges({ campaign: {} as any });
    expect(component.loadFailed).toBeTrue();
    expect(notify).toHaveBeenCalledWith('Could not load the encounters. Try again.', jasmine.any(Error));

    service.list.and.returnValue(of([] as EncounterSummary[]));
    component.loadEncounters();
    expect(component.loadFailed).toBeFalse();
  });

  it('a failed delete keeps the encounter open and says so', () => {
    const notify = spyOn(TestBed.inject(NotificationService), 'error');
    component.selected = encounter;
    service.delete.and.returnValue(throwError(() => new Error('down')));
    component.deleteEncounter();
    expect(component.selected).toBe(encounter);
    expect(notify).toHaveBeenCalledWith('Could not delete the encounter. Try again.', jasmine.any(Error));
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

  it('addCreature posts the form (AC optional), defaults quantity, and resets the form', () => {
    component.selected = encounter;
    component.cName = '  Goblin Boss ';
    component.cAc = 17;
    component.cHp = 21;
    component.cQty = 1;
    const after = { ...encounter, creatures: [...encounter.creatures,
      { id: 10, name: 'Goblin Boss', armorClass: 17, hpMax: 21, quantity: 1 }] };
    service.addCreature.and.returnValue(of(after));
    component.addCreature();
    expect(service.addCreature).toHaveBeenCalledWith(5, 'Goblin Boss', 17, 21, 1);
    expect(component.selected!.creatures.length).toBe(2);
    expect(component.cName).toBe('');
    expect(component.cAc).toBeNull();
  });

  it('addCreature allows an unknown AC (null) — only the name is required', () => {
    component.selected = encounter;
    component.cName = 'Mysterious Figure';
    component.cAc = null;
    service.addCreature.and.returnValue(of(encounter));
    component.addCreature();
    expect(service.addCreature).toHaveBeenCalledWith(5, 'Mysterious Figure', null, null, 1);
  });

  it('addCreature requires a name', () => {
    component.selected = encounter;
    component.cName = '   ';
    component.cAc = 15;
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
      { id: 1, name: 'Goblin', armorClass: 15, hpMax: 7, quantity: 4 },
      { id: 2, name: 'Boss', armorClass: 17, hpMax: 21, quantity: 1 }] };
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

  it('deleteEncounter() asks first and does nothing when the DM cancels', () => {
    confirm.and.returnValue(of());
    component.selected = encounter;
    component.deleteEncounter();
    expect(confirm).toHaveBeenCalledWith(jasmine.objectContaining({ confirmLabel: jasmine.any(String) }));
    expect(service.delete).not.toHaveBeenCalled();
  });
});
