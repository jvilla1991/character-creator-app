import { Subject, of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { FollowersPanelComponent } from './followers-panel.component';
import { FollowerService } from '../../../../services/follower.service';
import { PC } from '../../../../models/pc';
import { Follower, FollowerKind } from '../../../../models/follower';

describe('FollowersPanelComponent', () => {
  let followerService: jasmine.SpyObj<FollowerService>;
  let component: FollowersPanelComponent;
  let changes: Subject<{ pcId: number }>;

  const pc = (id: number): PC =>
    ({ id, name: 'Throk', clazz: 'Barbarian', level: 4, playerName: 'Ben' } as PC);

  const follower = (id: number, name: string): Follower =>
    ({ id, pcId: 7, name, statBlock: { race: 'Human', clazz: 'Guard', level: 2 } });

  beforeEach(() => {
    changes = new Subject<{ pcId: number }>();
    followerService = jasmine.createSpyObj<FollowerService>('FollowerService', ['list', 'grant', 'dismiss'],
      { changes$: changes });
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

  // A follower granted (or dismissed, or hurt) from somewhere else.
  describe('when FollowerService reports a change', () => {
    beforeEach(() => {
      followerService.list.and.returnValue(of([follower(1, 'Brannoc')]));
      bind(pc(7));
    });

    it("re-lists this character's followers and keeps the grant form's drafts", () => {
      component.openGrantForm();
      component.nameDraft = 'Half-typed';
      followerService.list.and.returnValue(of([follower(1, 'Brannoc'), follower(2, 'Wren')]));

      changes.next({ pcId: 7 });

      expect(component.followers().map(f => f.name)).toEqual(['Brannoc', 'Wren']);
      expect(component.grantFormOpen).toBeTrue();
      expect(component.nameDraft).toBe('Half-typed');
    });

    it("ignores another character's change", () => {
      followerService.list.calls.reset();

      changes.next({ pcId: 8 });

      expect(followerService.list).not.toHaveBeenCalled();
    });

    it('keeps the list when the re-list fails', () => {
      followerService.list.and.returnValue(throwError(() => new Error('offline')));

      changes.next({ pcId: 7 });

      expect(component.followers().map(f => f.name)).toEqual(['Brannoc']);
    });

    it('disarms a pending dismissal of a follower who is already gone', () => {
      component.askDismiss(follower(1, 'Brannoc'));
      followerService.list.and.returnValue(of([]));

      changes.next({ pcId: 7 });

      expect(component.confirmingDismissId()).toBeNull();
    });
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

  describe('kinds', () => {
    const ofKind = (id: number, kind?: FollowerKind): Follower => ({ ...follower(id, 'F' + id), kind });

    it('names each follower\'s kind, and reads one with no kind as granted', () => {
      expect(component.kindLabel(ofKind(1))).toBe('Granted');
      expect(component.kindLabel(ofKind(2, 'DM_GRANT'))).toBe('Granted');
      expect(component.kindLabel(ofKind(3, 'SUMMON'))).toBe('Summon');
      expect(component.kindLabel(ofKind(4, 'FAMILIAR'))).toBe('Familiar');
      expect(component.kindLabel(ofKind(5, 'COMPANION'))).toBe('Companion');
    });

    it('the DM may dismiss every kind', () => {
      component.canGrant = true;
      for (const kind of [undefined, 'DM_GRANT', 'SUMMON', 'FAMILIAR', 'COMPANION'] as const) {
        expect(component.canDismiss(ofKind(1, kind))).withContext(String(kind)).toBeTrue();
      }
    });

    it('the owner may dismiss only their own summon and familiar', () => {
      component.ownSheet = true;
      expect(component.canDismiss(ofKind(1, 'SUMMON'))).toBeTrue();
      expect(component.canDismiss(ofKind(1, 'FAMILIAR'))).toBeTrue();
      expect(component.canDismiss(ofKind(1, 'DM_GRANT'))).toBeFalse();
      expect(component.canDismiss(ofKind(1, 'COMPANION'))).toBeFalse();
      expect(component.canDismiss(ofKind(1))).toBeFalse();
    });

    it('anyone else may dismiss nothing', () => {
      for (const kind of [undefined, 'DM_GRANT', 'SUMMON', 'FAMILIAR', 'COMPANION'] as const) {
        expect(component.canDismiss(ofKind(1, kind))).withContext(String(kind)).toBeFalse();
      }
    });

    it('the owner dismisses their familiar in the same two steps, as a player', () => {
      const pip = ofKind(4, 'FAMILIAR');
      followerService.list.and.returnValue(of([follower(1, 'Brannoc'), pip]));
      followerService.dismiss.and.returnValue(of(undefined));
      bind(pc(7));
      component.ownSheet = true;

      component.askDismiss(pip);
      component.confirmDismiss(pip);

      expect(followerService.dismiss).toHaveBeenCalledWith(7, 4, false);
      expect(component.followers().map(f => f.name)).toEqual(['Brannoc']);
    });

    it('never sends a dismissal the viewer may not make', () => {
      followerService.list.and.returnValue(of([follower(1, 'Brannoc')]));
      bind(pc(7));
      component.ownSheet = true;

      component.confirmDismiss(component.followers()[0]); // a DM grant

      expect(followerService.dismiss).not.toHaveBeenCalled();
      expect(component.followers().length).toBe(1);
    });
  });

  describe('dismissing', () => {
    beforeEach(() => {
      followerService.list.and.returnValue(of([follower(1, 'Brannoc'), follower(2, 'Wisp')]));
      bind(pc(7));
      component.canGrant = true; // the DM: these are grants
    });

    it('takes two steps: arm the row, then confirm', () => {
      followerService.dismiss.and.returnValue(of(undefined));
      const brannoc = component.followers()[0];

      component.askDismiss(brannoc);
      expect(component.confirmingDismissId()).toBe(1);
      expect(followerService.dismiss).not.toHaveBeenCalled();

      component.confirmDismiss(brannoc);
      expect(followerService.dismiss).toHaveBeenCalledWith(7, 1, true);
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

describe('FollowersPanelComponent as rendered', () => {
  const follower = (id: number, name: string, kind?: FollowerKind): Follower =>
    ({ id, pcId: 7, name, kind, statBlock: { race: 'Human', clazz: 'Guard', level: 2 } });

  function render(inputs: { canGrant?: boolean; ownSheet?: boolean }): Array<{ kind: string; dismiss: boolean }> {
    const followerService = jasmine.createSpyObj<FollowerService>('FollowerService', ['list', 'grant', 'dismiss'],
      { changes$: new Subject<{ pcId: number }>() });
    followerService.list.and.returnValue(of([
      follower(1, 'Brannoc'), follower(2, 'Thorn', 'SUMMON'), follower(3, 'Pip', 'FAMILIAR'),
    ]));
    TestBed.configureTestingModule({ providers: [{ provide: FollowerService, useValue: followerService }] });
    const fixture = TestBed.createComponent(FollowersPanelComponent);
    fixture.componentRef.setInput('pc', { id: 7, name: 'Throk', clazz: 'Barbarian', level: 4, playerName: 'Ben' } as PC);
    fixture.componentRef.setInput('canGrant', !!inputs.canGrant);
    fixture.componentRef.setInput('ownSheet', !!inputs.ownSheet);
    fixture.detectChanges();
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.follower-row'));
    return rows.map(row => ({
      kind: row.querySelector('.follower-kind')!.textContent!.trim(),
      dismiss: Array.from(row.querySelectorAll('button')).some(b => b.textContent!.trim() === 'Dismiss'),
    }));
  }

  it('shows each row\'s kind, and the owner a Dismiss on their summon and familiar only', () => {
    expect(render({ ownSheet: true })).toEqual([
      { kind: 'Granted', dismiss: false },
      { kind: 'Summon', dismiss: true },
      { kind: 'Familiar', dismiss: true },
    ]);
  });

  it('shows the DM a Dismiss on every row', () => {
    expect(render({ canGrant: true }).map(r => r.dismiss)).toEqual([true, true, true]);
  });

  it('shows a viewer who is neither no Dismiss at all', () => {
    expect(render({}).map(r => r.dismiss)).toEqual([false, false, false]);
  });
});
