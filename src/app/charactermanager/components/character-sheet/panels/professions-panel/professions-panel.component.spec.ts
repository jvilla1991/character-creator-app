import { of, Subject, throwError } from 'rxjs';
import { ProfessionsPanelComponent } from './professions-panel.component';
import { ProfessionService } from '../../../../services/profession.service';
import { GATHERING_PROFESSIONS, PROFESSIONS, ProfessionGrant, meetsProfessionRequirement } from '../../../../models/profession';
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
  it('grants production professions with an alternative tool and excludes duplicates', () => {
    panel.canGrant = true; panel.pc.toolProfs = ['Herbalism Kit']; panel.selected = 'alchemy';
    service.grant.and.returnValue(of({ profession: 'alchemy' }));
    panel.grant();
    expect(service.grant).toHaveBeenCalledWith(1, 'alchemy');
    expect(panel.assignedFor('production').map(p => p.key)).toEqual(['alchemy']);
    expect(panel.availableFor('production').some(p => p.key === 'alchemy')).toBeFalse();
    panel.grant(); expect(service.grant).toHaveBeenCalledTimes(1);
  });
  it('blocks a production grant when its tool proficiency is absent', () => {
    panel.canGrant = true; panel.selected = 'tailoring'; panel.grant();
    expect(service.grant).not.toHaveBeenCalled();
  });
  it('derives Expert and Master ranks without granting recipes or feats', () => {
    panel.pc.level = 9; expect(panel.bonus).toBe(4); expect(panel.rank).toBe('Expert');
    panel.pc.prof = 6; expect(panel.rank).toBe('Master');
    expect(panel.pc.feat).toBeUndefined(); expect(panel.pc.spells).toBeUndefined();
  });
  for (const profession of PROFESSIONS.filter(p => p.category === 'production')) {
    for (const tool of profession.tools ?? []) {
      it(`accepts ${tool} alone for ${profession.name}`, () => {
        panel.pc.toolProfs = ['  ' + tool.toLowerCase().replace(/'/g, '’') + '  '];
        expect(meetsProfessionRequirement(panel.pc, profession)).toBeTrue();
        panel.pc.toolProfs = ["Thieves' Tools"];
        expect(meetsProfessionRequirement(panel.pc, profession)).toBeFalse();
      });
    }
  }
});
