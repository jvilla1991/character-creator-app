import { TestBed } from '@angular/core/testing';
import { LEVEL_UP_ANSWERED_KEY, LevelUpPromptService } from './level-up-prompt.service';
import { PC } from '../models/pc';

describe('LevelUpPromptService', () => {
  let service: LevelUpPromptService;

  const pc = (over: Partial<PC> = {}): PC =>
    ({ id: 7, name: 'Aria', level: 3, xp: 0, pendingLevelGrant: false, ...over } as PC);

  const fresh = (): LevelUpPromptService => {
    TestBed.resetTestingModule();
    return TestBed.inject(LevelUpPromptService);
  };

  beforeEach(() => {
    localStorage.removeItem(LEVEL_UP_ANSWERED_KEY);
    service = fresh();
  });

  let afterEachCleanup: (() => void) | null = null;

  afterEach(() => {
    afterEachCleanup?.();
    afterEachCleanup = null;
    localStorage.removeItem(LEVEL_UP_ANSWERED_KEY);
  });

  it('prompts when the DM granted a level-up', () => {
    service.evaluate(pc({ pendingLevelGrant: true }));

    expect(service.prompt()).toEqual(jasmine.objectContaining(
      { pcId: 7, name: 'Aria', targetLevel: 4, reason: 'grant' }));
  });

  it('prompts when XP crosses the next threshold', () => {
    service.evaluate(pc({ xp: 2_700 })); // L4 threshold

    expect(service.prompt()).toEqual(jasmine.objectContaining({ targetLevel: 4, reason: 'xp' }));
  });

  it('does not prompt below the threshold with no grant', () => {
    service.evaluate(pc({ xp: 2_699 }));

    expect(service.prompt()).toBeNull();
  });

  it('never prompts a level-20 character, even with a grant', () => {
    service.evaluate(pc({ level: 20, xp: 999_999, pendingLevelGrant: true }));

    expect(service.prompt()).toBeNull();
  });

  it('"Later" closes the prompt and it does not return for that level', () => {
    service.evaluate(pc({ pendingLevelGrant: true }));
    service.later();
    expect(service.prompt()).toBeNull();

    service.evaluate(pc({ pendingLevelGrant: true }));
    expect(service.prompt()).toBeNull();
  });

  it('remembers the answer across a reload (localStorage)', () => {
    service.evaluate(pc({ pendingLevelGrant: true }));
    service.later();

    const reloaded = fresh();
    reloaded.evaluate(pc({ pendingLevelGrant: true }));

    expect(reloaded.prompt()).toBeNull();
  });

  it('prompts again once the level has changed', () => {
    service.evaluate(pc({ pendingLevelGrant: true }));
    service.later();

    // Levelled from the sheet to 4, then ready for 5.
    service.evaluate(pc({ level: 4, xp: 6_500 }));

    expect(service.prompt()).toEqual(jasmine.objectContaining({ targetLevel: 5, reason: 'xp' }));
  });

  it('forgets the answer when the character is seen not ready, so a fresh grant prompts', () => {
    service.evaluate(pc({ pendingLevelGrant: true }));
    service.later();

    service.evaluate(pc({ pendingLevelGrant: false })); // DM revoked the grant
    expect(localStorage.getItem(LEVEL_UP_ANSWERED_KEY)).toBeNull();

    service.evaluate(pc({ pendingLevelGrant: true })); // re-granted
    expect(service.prompt()).toEqual(jasmine.objectContaining({ targetLevel: 4, reason: 'grant' }));
  });

  it('closes an open prompt when the grant is revoked before the player answers', () => {
    service.evaluate(pc({ pendingLevelGrant: true }));
    service.evaluate(pc({ pendingLevelGrant: false }));

    expect(service.prompt()).toBeNull();
  });

  it('"Level Up Now" opens the modal for that character and answers the prompt', () => {
    const ready = pc({ pendingLevelGrant: true });
    service.evaluate(ready);
    service.levelUpNow();

    expect(service.prompt()).toBeNull();
    expect(service.levelUp()).toEqual({ pc: ready, asDm: false });

    // Cancelling the modal doesn't bring the prompt back for this level.
    service.closeLevelUp();
    service.evaluate(ready);
    expect(service.prompt()).toBeNull();
  });

  it('does not stack a prompt over an open level-up modal', () => {
    service.openLevelUp(pc(), false);
    service.evaluate(pc({ pendingLevelGrant: true }));

    expect(service.prompt()).toBeNull();
  });

  it('offers the next level once the modal closes when it came due while the modal was open', () => {
    service.evaluate(pc({ pendingLevelGrant: true }));
    service.levelUpNow();

    // The commit lands with enough XP for one more level, before the modal closes.
    service.evaluate(pc({ level: 4, xp: 6_500 }));
    expect(service.prompt()).toBeNull();

    service.closeLevelUp();
    expect(service.prompt()).toEqual(jasmine.objectContaining({ targetLevel: 5, reason: 'xp' }));
  });

  it('does not offer a held level the character was later seen not ready for', () => {
    service.openLevelUp(pc(), false);
    service.evaluate(pc({ pendingLevelGrant: true }));
    service.evaluate(pc({ pendingLevelGrant: false })); // DM revoked it meanwhile

    service.closeLevelUp();
    expect(service.prompt()).toBeNull();
  });

  it('chains DM grants: grant, level up, grant again prompts for the next level', () => {
    service.evaluate(pc({ pendingLevelGrant: true }));
    service.levelUpNow();
    service.evaluate(pc({ level: 4, pendingLevelGrant: false })); // the commit consumed the grant
    service.closeLevelUp();
    expect(service.prompt()).toBeNull();

    service.evaluate(pc({ level: 4, pendingLevelGrant: true })); // the DM grants again

    expect(service.prompt()).toEqual(jasmine.objectContaining({ targetLevel: 5, reason: 'grant' }));
  });

  it('openLevelUp keeps the DM flag for the cross-link path', () => {
    const member = pc();
    service.openLevelUp(member, true);

    expect(service.levelUp()).toEqual({ pc: member, asDm: true });
  });

  it('tolerates localStorage failures and still honours "Later" for the page', () => {
    const spies = [
      spyOn(Storage.prototype, 'getItem').and.throwError('denied'),
      spyOn(Storage.prototype, 'setItem').and.throwError('denied'),
      spyOn(Storage.prototype, 'removeItem').and.throwError('denied'),
    ];
    // afterEach's cleanup runs before Jasmine removes spies — let it through then.
    afterEachCleanup = () => spies.forEach(s => s.and.callThrough());
    const s = fresh();

    expect(() => s.evaluate(pc({ pendingLevelGrant: true }))).not.toThrow();
    expect(s.prompt()).not.toBeNull();
    expect(() => s.later()).not.toThrow();

    s.evaluate(pc({ pendingLevelGrant: true }));
    expect(s.prompt()).toBeNull();
    expect(() => s.evaluate(pc({ pendingLevelGrant: false }))).not.toThrow();
  });

  it('ignores corrupt stored data', () => {
    localStorage.setItem(LEVEL_UP_ANSWERED_KEY, '{not json');
    const s = fresh();

    s.evaluate(pc({ pendingLevelGrant: true }));

    expect(s.prompt()).not.toBeNull();
  });
});
