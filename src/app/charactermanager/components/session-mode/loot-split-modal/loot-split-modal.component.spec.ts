import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LootSplitModalComponent } from './loot-split-modal.component';
import { LootBallot, LootView } from '../../../models/loot';

describe('LootSplitModalComponent', () => {
  let fixture: ComponentFixture<LootSplitModalComponent>;
  let component: LootSplitModalComponent;

  function pool(over: Partial<LootView> = {}): LootView {
    return {
      id: 20, sessionId: 1, name: 'Sunken Vault', dropped: true,
      coinCpTotal: 24000, coinCpRemaining: 24000,
      items: [
        { id: 30, catalogItemKey: 'longsword', name: 'Longsword', custom: false, customNotes: null,
          qty: 1, qtyRemaining: 1, valueCp: 1500 },
        { id: 31, catalogItemKey: null, name: 'Potion of Healing', custom: true, customNotes: null,
          qty: 3, qtyRemaining: 3, valueCp: 5000 },
      ],
      phase: 'SPLITTING',
      recipients: [
        { participantId: 101, pcId: 7, name: 'Thessaly', mine: false },
        { participantId: 102, pcId: 8, name: 'Quill', mine: true },
      ],
      allocations: [], coinShares: [], ballots: [], majorityNeeded: 2,
      ...over,
    };
  }

  function ballot(participantId: number, name: string, vote: boolean | null, pvp: boolean | null, mine = false): LootBallot {
    return { participantId, name, vote, pvp, mine };
  }

  function render(view: LootView): void {
    fixture.componentRef.setInput('loot', view);
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function button(label: string): HTMLButtonElement {
    const found = fixture.debugElement.queryAll(By.css('button'))
      .map(d => d.nativeElement as HTMLButtonElement)
      .find(b => b.textContent!.trim().startsWith(label));
    if (!found) throw new Error(`No button "${label}"`);
    return found;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LootSplitModalComponent] }).compileComponents();
    fixture = TestBed.createComponent(LootSplitModalComponent);
    component = fixture.componentInstance;
  });

  describe('splitting', () => {
    it('lists the pile with stack counts and every character card', () => {
      render(pool());
      expect(component.pile().map(i => i.name)).toEqual(['Longsword', 'Potion of Healing']);
      expect(text()).toContain('×3');
      expect(component.cards().map(c => c.recipient.name)).toEqual(['Thessaly', 'Quill']);
    });

    it('pick then give emits a pile → character move and clears the pick', () => {
      render(pool());
      const moves: unknown[] = [];
      component.move.subscribe(m => moves.push(m));

      component.pick(component.pile()[1]);
      fixture.detectChanges();
      button('Give Potion of Healing to Thessaly').click();

      expect(moves).toEqual([{ lootItemId: 31, fromParticipantId: null, toParticipantId: 101 }]);
      expect(component.selectedId()).toBeNull();
    });

    it('returning a line emits a character → pile move', () => {
      render(pool({ allocations: [{ participantId: 102, lootItemId: 30, qty: 1 }],
        items: [{ id: 30, catalogItemKey: 'longsword', name: 'Longsword', custom: false, customNotes: null,
                  qty: 1, qtyRemaining: 0, valueCp: 1500 }] }));
      const moves: unknown[] = [];
      component.move.subscribe(m => moves.push(m));

      const card = component.cards()[1];
      component.returnToPile(card, card.lines[0]);

      expect(moves).toEqual([{ lootItemId: 30, fromParticipantId: 102, toParticipantId: null }]);
    });

    it('a share is valued by its items and coins', () => {
      render(pool({ allocations: [{ participantId: 101, lootItemId: 31, qty: 2 }],
        coinShares: [{ participantId: 101, coinCp: 6000 }] }));
      expect(component.cards()[0].valueCp).toBe(2 * 5000 + 6000);
    });

    it('coin steppers move 10 gp, capped by the pile, never below zero', () => {
      render(pool({ coinCpRemaining: 400, coinShares: [{ participantId: 101, coinCp: 500 }] }));
      const changes: unknown[] = [];
      component.coinChange.subscribe(c => changes.push(c));

      component.moreCoins(component.cards()[0]); // only 4 gp left in the pile
      component.lessCoins(component.cards()[0]); // 5 gp − 10 gp clamps to 0
      component.lessCoins(component.cards()[1]); // has none — no-op

      expect(changes).toEqual([
        { participantId: 101, coinCp: 900 },
        { participantId: 101, coinCp: 0 },
      ]);
    });

    it('the vote button stays locked until the pile is empty', () => {
      render(pool());
      expect(button('Send split to vote').disabled).toBeTrue();
      expect(component.pileStatus()).toContain('4 items');

      render(pool({ coinCpRemaining: 0, items: [
        { id: 30, catalogItemKey: 'longsword', name: 'Longsword', custom: false, customNotes: null,
          qty: 1, qtyRemaining: 0, valueCp: 1500 }] }));
      expect(button('Send split to vote').disabled).toBeFalse();
    });

    it('a picked item that someone else moved is unpicked', () => {
      render(pool());
      component.pick(component.pile()[0]);
      render(pool({ items: [pool().items[1]] }));
      expect(component.selectedId()).toBeNull();
    });
  });

  describe('voting', () => {
    it('asks for a ✓ or ✗ first', () => {
      render(pool({ phase: 'VOTING', ballots: [
        ballot(101, 'Thessaly', true, null), ballot(102, 'Quill', null, null, true)] }));
      const casts: unknown[] = [];
      component.ballotCast.subscribe(b => casts.push(b));

      expect(component.needBallot()).toBeTrue();
      button('✗ Object').click();

      expect(casts).toEqual([{ vote: false, pvp: null }]);
    });

    it('after a ✗, asks about PvP', () => {
      render(pool({ phase: 'VOTING', ballots: [
        ballot(101, 'Thessaly', true, null), ballot(102, 'Quill', false, null, true)] }));
      const casts: unknown[] = [];
      component.ballotCast.subscribe(b => casts.push(b));

      expect(component.needPvpChoice()).toBeTrue();
      expect(text()).toContain('Settle it with steel?');
      button('Yes, PvP').click();
      button('No, just object').click();

      expect(casts).toEqual([{ vote: false, pvp: true }, { vote: false, pvp: false }]);
    });

    it('a settled ballot waits on the others and can be taken back', () => {
      render(pool({ phase: 'VOTING', ballots: [
        ballot(101, 'Thessaly', null, null), ballot(102, 'Quill', true, null, true)] }));
      const casts: unknown[] = [];
      component.ballotCast.subscribe(b => casts.push(b));

      expect(component.waiting()).toBeTrue();
      expect(text()).toContain('Waiting on Thessaly');
      button('Change my vote').click();

      expect(casts).toEqual([{ vote: null, pvp: null }]);
    });

    it('tallies votes; a ✗ still deciding on PvP counts as pending', () => {
      render(pool({ phase: 'VOTING', ballots: [
        ballot(101, 'Thessaly', true, null), ballot(102, 'Quill', false, null, true)] }));
      expect(component.agreeCount()).toBe(1);
      expect(component.objectCount()).toBe(0); // not counted twice
      expect(component.pendingCount()).toBe(1);
    });

    it('flags a PvP ballot on its card', () => {
      render(pool({ phase: 'VOTING', ballots: [
        ballot(101, 'Thessaly', false, true), ballot(102, 'Quill', true, null, true)] }));
      expect(text()).toContain('Wants PvP');
    });
  });

  it('dismissing only minimizes', () => {
    render(pool());
    let minimized = false;
    component.minimize.subscribe(() => (minimized = true));
    (fixture.debugElement.query(By.css('.modal-close')).nativeElement as HTMLButtonElement).click();
    expect(minimized).toBeTrue();
  });
});
