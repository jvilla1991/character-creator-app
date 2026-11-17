import { of, Subject, throwError } from 'rxjs';
import { ProfessionsPanelComponent } from './professions-panel.component';
import { ProfessionService } from '../../../../services/profession.service';
import { GATHERING_PROFESSIONS, ProfessionGrant, meetsProfessionRequirement } from '../../../../models/profession';
import { PC } from '../../../../models/pc';

describe('ProfessionsPanelComponent', () => {
  let service: jasmine.SpyObj<ProfessionService>;
  let panel: ProfessionsPanelComponent;
  beforeEach(() => {
    service = jasmine.createSpyObj('ProfessionService', ['list', 'grant', 'revoke']);
    service.list.and.returnValue(of([]));
    panel = new ProfessionsPanelComponent(service);
    panel.pc = { id: 1, level: 5, name: 'Test' } as PC;
    panel.ngOnChanges();
  });
  it('does not allow players to grant or revoke', () => {
    panel.selected = 'fishing'; panel.grant(); panel.confirming = 'fishing'; panel.revoke('fishing');
    expect(service.grant).not.toHaveBeenCalled(); expect(service.revoke).not.toHaveBeenCalled();
  });
  it('checks prerequisites including expertise and curly apostrophes', () => {
    panel.pc.skills = { History: 'expert' }; panel.pc.toolProfs = [' mason’s tools '];
    const allowed = GATHERING_PROFESSIONS.filter(p => meetsProfessionRequirement(panel.pc, p)).map(p => p.key);
    expect(allowed).toEqual(['archaeology', 'fishing', 'mining']);
    expect(panel.bonus).toBe(3);
  });
  it('retains the list on failed revoke and shows an error', () => {
    panel.canGrant = true; panel.grants.set([{ profession: 'fishing' }]); panel.confirming = 'fishing';
    service.revoke.and.returnValue(throwError(() => new Error('offline'))); panel.revoke('fishing');
    expect(panel.assigned.length).toBe(1); expect(panel.error()).toContain('Could not revoke'); expect(panel.saving()).toBeFalse();
  });
  it('ignores a delayed response after switching characters', () => {
    const pending = new Subject<ProfessionGrant[]>(); service.list.and.returnValue(pending); panel.load();
    service.list.and.returnValue(of([])); panel.pc = { ...panel.pc, id: 2 }; panel.ngOnChanges();
    pending.next([{ profession: 'fishing' }]); expect(panel.grants()).toEqual([]);
  });
  it('blocks grants after a failed load', () => {
    service.list.and.returnValue(throwError(() => new Error('offline'))); panel.load();
    panel.canGrant = true; panel.selected = 'fishing'; panel.grant();
    expect(service.grant).not.toHaveBeenCalled(); expect(panel.loaded()).toBeFalse();
  });
});
