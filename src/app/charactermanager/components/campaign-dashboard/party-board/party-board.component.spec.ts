import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { PC } from '../../../models/pc';
import { Follower } from '../../../models/follower';
import { FollowerService } from '../../../services/follower.service';
import { BoardFollowerRef, PartyBoardComponent } from './party-board.component';

describe('PartyBoardComponent', () => {
  let fixture: ComponentFixture<PartyBoardComponent>;
  let followerService: jasmine.SpyObj<FollowerService>;
  let changes: Subject<{ pcId: number }>;

  const aria: PC = { id: 7, name: 'Aria', clazz: 'Bard', level: 3, hp: { cur: 20, max: 20 }, ac: 14 } as PC;
  const throk: PC = { id: 8, name: 'Throk', clazz: 'Barbarian', level: 4, hp: { cur: 30, max: 40 }, ac: 15 } as PC;
  const brannoc: Follower = {
    id: 12, pcId: 7, name: 'Brannoc',
    statBlock: {
      clazz: 'Guard', level: 2, hp: { cur: 4, max: 16, temp: 0 }, ac: 16, prof: 2,
      stats: { STR: 14, DEX: 12, CON: 13, INT: 10, WIS: 14, CHA: 10 },
      skills: { Perception: 'prof' }, conditions: ['Prone'],
    },
  };

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const followerRows = (): HTMLElement[] => Array.from(element().querySelectorAll<HTMLElement>('.board-row.follower'));
  const memberRows = (): HTMLElement[] =>
    Array.from(element().querySelectorAll<HTMLElement>('.board-row.member:not(.follower)'));

  /** Aria has Brannoc; Throk has nobody (or whatever `throkList` yields). */
  function render(throkList = of<Follower[]>([])): void {
    followerService.list.and.callFake((pcId: number) => (pcId === 7 ? of([brannoc]) : throkList));
    fixture = TestBed.createComponent(PartyBoardComponent);
    fixture.componentRef.setInput('members', [aria, throk]);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    changes = new Subject<{ pcId: number }>();
    followerService = jasmine.createSpyObj<FollowerService>('FollowerService', ['list'], { changes$: changes });
    await TestBed.configureTestingModule({
      imports: [PartyBoardComponent],
      providers: [{ provide: FollowerService, useValue: followerService }],
    }).compileComponents();
  });

  it("nests each member's followers under that member, expanded", () => {
    render();

    expect(followerService.list).toHaveBeenCalledWith(7);
    expect(followerService.list).toHaveBeenCalledWith(8);
    const rows = Array.from(element().querySelectorAll<HTMLElement>('.board-row.member'));
    expect(rows.map(r => r.querySelector('.board-hero-name')!.textContent)).toEqual(['Aria', 'Brannoc', 'Throk']);
    expect(rows[1].classList).toContain('follower');
    expect(rows[1].querySelector('.nest-crest')!.textContent).toBe('↳');
  });

  it('shows a follower with the same columns as a member', () => {
    render();

    const row = followerRows()[0];
    expect(row.querySelector('.board-hero-sub')!.textContent).toContain('Guard 2');
    expect(row.querySelector('.hp-text')!.textContent).toContain('4/16');
    expect(row.querySelector('.board-hp')!.classList).toContain('bloodied');
    const nums = Array.from(row.querySelectorAll('.board-num')).map(n => n.lastChild!.textContent!.trim());
    expect(nums).toEqual(['16', '14', '12']);   // AC, passive Perception (10+2+2), passive Insight (10+2)
    expect(row.querySelector('.board-cond')!.textContent).toBe('Prone');
  });

  it('gives the toggle only to members who have followers', () => {
    render();

    const [ariaRow, throkRow] = memberRows();
    expect(ariaRow.querySelector('.nest-toggle')).not.toBeNull();
    expect(throkRow.querySelector('.nest-toggle')).toBeNull();
  });

  it('the toggle collapses and expands the follower rows without opening the sheet', () => {
    render();
    const opened = jasmine.createSpy('openHero');
    fixture.componentInstance.openHero.subscribe(opened);
    const toggle = element().querySelector<HTMLButtonElement>('.nest-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toBe('▾');

    toggle.click();
    fixture.detectChanges();

    expect(followerRows().length).toBe(0);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toBe('▸');

    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    toggle.click();
    fixture.detectChanges();

    expect(followerRows().length).toBe(1);
    expect(opened).not.toHaveBeenCalled();
  });

  it('clicking a follower row asks for that follower, not the member', () => {
    render();
    const openedHero = jasmine.createSpy('openHero');
    const openedFollower = jasmine.createSpy('openFollower');
    fixture.componentInstance.openHero.subscribe(openedHero);
    fixture.componentInstance.openFollower.subscribe(openedFollower);

    followerRows()[0].click();

    expect(openedFollower).toHaveBeenCalledOnceWith({ owner: aria, follower: brannoc } as BoardFollowerRef);
    expect(openedHero).not.toHaveBeenCalled();
  });

  it('Enter on a follower row opens it too', () => {
    render();
    const openedFollower = jasmine.createSpy('openFollower');
    fixture.componentInstance.openFollower.subscribe(openedFollower);

    followerRows()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(openedFollower).toHaveBeenCalledOnceWith({ owner: aria, follower: brannoc });
  });

  it("one member's failed fetch leaves the rest of the board standing", () => {
    render(throwError(() => ({ status: 403 })));

    expect(memberRows().length).toBe(2);
    expect(followerRows().length).toBe(1);
  });

  // The DM grants from the member's sheet, which never replaces `members`.
  describe('when FollowerService reports a change', () => {
    const wren: Follower = { id: 13, pcId: 8, name: 'Wren', statBlock: { clazz: 'Scout', level: 1 } };

    it("re-lists that member's followers, and only that member's", () => {
      render();
      followerService.list.calls.reset();
      followerService.list.and.callFake((pcId: number) => of(pcId === 8 ? [wren] : [brannoc]));

      changes.next({ pcId: 8 });
      fixture.detectChanges();

      expect(followerService.list).toHaveBeenCalledOnceWith(8);
      const rows = Array.from(element().querySelectorAll<HTMLElement>('.board-row.member'));
      expect(rows.map(r => r.querySelector('.board-hero-name')!.textContent))
        .toEqual(['Aria', 'Brannoc', 'Throk', 'Wren']);
    });

    it('drops the row of a dismissed follower', () => {
      render();
      followerService.list.and.returnValue(of([]));

      changes.next({ pcId: 7 });
      fixture.detectChanges();

      expect(followerRows().length).toBe(0);
    });

    it('ignores a character who is not on the board', () => {
      render();
      followerService.list.calls.reset();

      changes.next({ pcId: 99 });

      expect(followerService.list).not.toHaveBeenCalled();
    });

    it('keeps the rows it has when the re-list fails', () => {
      render();
      followerService.list.and.returnValue(throwError(() => ({ status: 500 })));

      changes.next({ pcId: 7 });
      fixture.detectChanges();

      expect(followerRows().length).toBe(1);
    });

    it('unfolds a collapsed member who gained a follower', () => {
      render();
      element().querySelector<HTMLButtonElement>('.nest-toggle')!.click();
      fixture.detectChanges();
      expect(followerRows().length).toBe(0);
      const second: Follower = { ...wren, id: 14, pcId: 7 };
      followerService.list.and.returnValue(of([brannoc, second]));

      changes.next({ pcId: 7 });
      fixture.detectChanges();

      expect(followerRows().length).toBe(2);
    });
  });

  it('fetches again when the member list is replaced', () => {
    render();
    followerService.list.calls.reset();

    fixture.componentRef.setInput('members', [aria]);
    fixture.detectChanges();

    expect(followerService.list).toHaveBeenCalledOnceWith(7);
    expect(memberRows().length).toBe(1);
    expect(followerRows().length).toBe(1);
  });
});
