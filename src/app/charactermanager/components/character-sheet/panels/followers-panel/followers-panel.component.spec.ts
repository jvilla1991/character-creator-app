import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { FollowersPanelComponent } from './followers-panel.component';
import { FollowerService } from '../../../../services/follower.service';
import { PC } from '../../../../models/pc';
import { Follower } from '../../../../models/follower';

describe('FollowersPanelComponent', () => {
  let followerService: jasmine.SpyObj<FollowerService>;
  let component: FollowersPanelComponent;

  const pc = (id: number): PC =>
    ({ id, name: 'Throk', clazz: 'Barbarian', level: 4, playerName: 'Ben' } as PC);

  const follower = (id: number, name: string): Follower =>
    ({ id, pcId: 7, name, statBlock: { race: 'Human', clazz: 'Guard', level: 2 } });

  beforeEach(() => {
    followerService = jasmine.createSpyObj<FollowerService>('FollowerService', ['list', 'grant', 'dismiss']);
    followerService.list.and.returnValue(of([]));
    component = TestBed.runInInjectionContext(() => new FollowersPanelComponent(followerService));
  });

  function bind(newPc: PC, previous?: PC): void {
    component.pc = newPc;
    component.ngOnChanges({ pc: new SimpleChange(previous, newPc, previous == null) });
  }

  it('loads the followers when a character binds', () => {
    followerService.list.and.returnValue(of([follower(1, 'Brannoc')]));

    bind(pc(7));

    expect(followerService.list).toHaveBeenCalledWith(7);
    expect(component.followers().map(f => f.name)).toEqual(['Brannoc']);
    expect(component.loading()).toBeFalse();
  });

  it('does not reload for same-character change events, but does for a new character', () => {
    bind(pc(7));
    bind(pc(7), pc(7));
    expect(followerService.list).toHaveBeenCalledTimes(1);

    bind(pc(8), pc(7));
    expect(followerService.list).toHaveBeenCalledTimes(2);
  });

  it('leaves the list empty when it cannot be read', () => {
    followerService.list.and.returnValue(throwError(() => new Error('403')));

    bind(pc(7));

    expect(component.followers()).toEqual([]);
    expect(component.loading()).toBeFalse();
  });

  it('summarizes a follower as species, role and level', () => {
    expect(component.summaryFor(follower(1, 'Brannoc'))).toBe('Human Guard · Level 2');
    expect(component.summaryFor({ id: 2, pcId: 7, name: 'Wisp', statBlock: {} })).toBe('Level 1');
  });

  describe('granting', () => {
    beforeEach(() => {
      bind(pc(7));
      component.openGrantForm();
    });

    it('parses the JSON, grants the follower and closes the form', () => {
      followerService.grant.and.returnValue(of(follower(5, 'Brannoc')));
      component.nameDraft = '  Brannoc ';
      component.statBlockDraft = '{ "clazz": "Guard", "hp": 16 }';

      component.submitGrant();

      expect(followerService.grant).toHaveBeenCalledWith(7, 'Brannoc',
        jasmine.objectContaining({ clazz: 'Guard', hp: { max: 16, cur: 16, temp: 0 } }));
      expect(component.followers().map(f => f.id)).toEqual([5]);
      expect(component.grantFormOpen).toBeFalse();
      expect(component.nameDraft).toBe('');
      expect(component.statBlockDraft).toBe('');
    });

    it('shows the parse error and sends nothing for bad JSON', () => {
      component.nameDraft = 'Brannoc';
      component.statBlockDraft = '{ "ac": ';

      component.submitGrant();

      expect(followerService.grant).not.toHaveBeenCalled();
      expect(component.formError()).toContain('not valid JSON');
      expect(component.grantFormOpen).toBeTrue(); // the DM's draft is kept
    });

    it('does nothing without both a name and a stat block', () => {
      component.statBlockDraft = '{}';
      component.submitGrant();
      component.nameDraft = 'Brannoc';
      component.statBlockDraft = '   ';
      component.submitGrant();

      expect(followerService.grant).not.toHaveBeenCalled();
    });

    it('keeps the form open with the server\'s message when the grant is refused', () => {
      followerService.grant.and.returnValue(
        throwError(() => ({ error: { message: 'A character can have at most 20 followers' } })));
      component.nameDraft = 'Brannoc';
      component.statBlockDraft = '{}';

      component.submitGrant();

      expect(component.formError()).toBe('A character can have at most 20 followers');
      expect(component.grantFormOpen).toBeTrue();
      expect(component.saving()).toBeFalse();
    });

    it('insertExample fills the editor with a stat block that parses', () => {
      component.insertExample();
      component.nameDraft = 'Brannoc';
      followerService.grant.and.returnValue(of(follower(5, 'Brannoc')));

      component.submitGrant();

      expect(followerService.grant).toHaveBeenCalled();
      expect(component.formError()).toBeNull();
    });
  });

  describe('dismissing', () => {
    beforeEach(() => {
      followerService.list.and.returnValue(of([follower(1, 'Brannoc'), follower(2, 'Wisp')]));
      bind(pc(7));
    });

    it('takes two steps: arm the row, then confirm', () => {
      followerService.dismiss.and.returnValue(of(undefined));
      const brannoc = component.followers()[0];

      component.askDismiss(brannoc);
      expect(component.confirmingDismissId()).toBe(1);
      expect(followerService.dismiss).not.toHaveBeenCalled();

      component.confirmDismiss(brannoc);
      expect(followerService.dismiss).toHaveBeenCalledWith(7, 1);
      expect(component.followers().map(f => f.name)).toEqual(['Wisp']);
      expect(component.confirmingDismissId()).toBeNull();
    });

    it('cancelDismiss disarms the row without removing anything', () => {
      component.askDismiss(component.followers()[0]);
      component.cancelDismiss();

      expect(component.confirmingDismissId()).toBeNull();
      expect(component.followers().length).toBe(2);
    });

    it('keeps the follower listed when the dismissal fails', () => {
      spyOn(console, 'error');
      followerService.dismiss.and.returnValue(throwError(() => new Error('500')));

      component.confirmDismiss(component.followers()[0]);

      expect(component.followers().length).toBe(2);
      expect(component.saving()).toBeFalse();
    });
  });
});
