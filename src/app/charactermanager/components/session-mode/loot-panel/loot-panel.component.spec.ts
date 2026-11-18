import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { LootPanelComponent } from './loot-panel.component';
import { SessionState, ParticipantView } from '../../../models/session';
import { LootView } from '../../../models/loot';
import { PC } from '../../../models/pc';

/** Tests the component class directly (no TestBed/DOM), per the app convention. */
describe('LootPanelComponent', () => {
  let component: LootPanelComponent;
  let lootService: jasmine.SpyObj<any>;
  let curatedLootService: jasmine.SpyObj<any>;
  let pcService: jasmine.SpyObj<any>;
  let notifications: jasmine.SpyObj<any>;

  function participant(over: Partial<ParticipantView> = {}): ParticipantView {
    return {
      participantId: 1, pcId: 7, npc: false, ownedByMe: false, currentTurn: false,
      name: 'Aria', clazz: 'Fighter', level: 3, portraitTint: null, portraitInitials: null,
      initiative: null, initRolled: false, orderIndex: 0, hpMax: null,
      hpCurrent: null, hpTemp: null, ac: null, conditions: [], survival: null, spellSlots: null,
      deathSaveSuccesses: 0, deathSaveFailures: 0,
      hitDiceUsed: null, inspirationPips: null, heroicInspiration: null,
      ...over,
    };
  }

  function state(over: Partial<SessionState>): SessionState {
    return {
      sessionId: 1, campaignId: 1, status: 'ACTIVE', round: 1, activeParticipantId: null,
      onDeckParticipantId: null, version: 1, dm: false, enemiesHidden: true, enemyHpHidden: false,
      shortRestOpen: false, turnSound: null,
      shopOpen: false, shopForMe: false, shopCategory: null, lootStatus: null, lootName: null,
      myXp: null, myLevelGrant: null, gameTime: null, location: null, weekDays: null, participants: [], rolls: [],
      restVote: null, lootResult: null, ...over,
    };
  }

  function pool(over: Partial<LootView> = {}): LootView {
    return {
      id: 20, sessionId: 1, name: 'Goblin Ambush', dropped: true,
      coinCpTotal: 12550, coinCpRemaining: 12550,
      items: [{ id: 30, catalogItemKey: 'longsword', name: 'Longsword', custom: false,
                customNotes: null, qty: 2, qtyRemaining: 2, valueCp: 1500 }],
      phase: 'SPLITTING',
      recipients: [
        { participantId: 1, pcId: 7, name: 'Aria', mine: true },
        { participantId: 2, pcId: 8, name: 'Brakka', mine: false },
      ],
      allocations: [], coinShares: [], ballots: [], majorityNeeded: 2,
      ...over,
    };
  }

  beforeEach(() => {
    lootService = jasmine.createSpyObj('LootService',
      ['open', 'drop', 'close', 'addItem', 'updateItem', 'removeItem', 'setCoins',
       'getLoot', 'assign', 'setCoinShare', 'splitCoinsEvenly', 'propose', 'vote', 'override']);
    lootService.getLoot.and.returnValue(of(null)); // tests that care about the pool stub their own
    curatedLootService = jasmine.createSpyObj('CuratedLootService', ['list']);
    curatedLootService.list.and.returnValue(of([]));
    pcService = jasmine.createSpyObj('PCService', ['getPCById', 'patchLocalPC', 'refreshPC']);
    notifications = jasmine.createSpyObj('NotificationService', ['notify']);
    component = TestBed.runInInjectionContext(() => new LootPanelComponent(
      lootService, curatedLootService, pcService, notifications));
  });

  // ── poll-driven fetch ───────────────────────────────────────────────────────

  it('fetches the pool when lootStatus is set, and refetches on version change', () => {
    lootService.getLoot.and.returnValue(of(pool()));
    component.state = state({ lootStatus: 'DROPPED', version: 1 });
    component.ngOnChanges();
    expect(lootService.getLoot).toHaveBeenCalledTimes(1);

    component.ngOnChanges(); // same version — no refetch
    expect(lootService.getLoot).toHaveBeenCalledTimes(1);

    component.state = state({ lootStatus: 'DROPPED', version: 2 });
    component.ngOnChanges(); // someone moved an item — version bumped
    expect(lootService.getLoot).toHaveBeenCalledTimes(2);
  });

  it('clears the pool when lootStatus goes null', () => {
    lootService.getLoot.and.returnValue(of(pool()));
    component.state = state({ lootStatus: 'DROPPED' });
    component.ngOnChanges();
    expect(component.loot).not.toBeNull();

    component.state = state({ lootStatus: null });
    component.ngOnChanges();
    expect(component.loot).toBeNull();
  });

  it('loads the DM curated loot lists once per campaign', () => {
    lootService.getLoot.and.returnValue(of(null));
    component.state = state({ dm: true, lootStatus: null });
    component.ngOnChanges();
    component.ngOnChanges();
    expect(curatedLootService.list).toHaveBeenCalledTimes(1);
  });

  // ── DM flows ────────────────────────────────────────────────────────────────

  it('prepare seeds from the chosen curated loot list', () => {
    const draft = pool({ dropped: false });
    lootService.open.and.returnValue(of(draft));
    component.state = state({ dm: true });
    component.source = 'list';
    component.lootListId = 5;
    component.prepare();
    expect(lootService.open).toHaveBeenCalledWith(1, 5, null);
    expect(component.loot).toBe(draft);
    expect(component.coinGpDraft).toBe(125.5);
  });

  it('prepare from scratch sends no loot list', () => {
    lootService.open.and.returnValue(of(pool({ dropped: false, coinCpTotal: 0, coinCpRemaining: 0, items: [] })));
    component.state = state({ dm: true });
    component.source = 'scratch';
    component.nameDraft = ' Bandit spoils ';
    component.prepare();
    expect(lootService.open).toHaveBeenCalledWith(1, null, 'Bandit spoils');
  });

  it('onItemAuthored forwards the composer payload to the pool add endpoint', () => {
    const updated = pool();
    lootService.addItem.and.returnValue(of(updated));
    component.state = state({ dm: true });
    component.loot = pool({ items: [] });

    const authored = { kind: 'custom' as const, name: 'Flametongue', category: 'weapon' as const,
      qty: 1, valueGp: 50, weight: 3, damage: '1d8 slashing + 2d6 fire' };
    component.onItemAuthored(authored);

    expect(lootService.addItem).toHaveBeenCalledWith(1, authored);
    expect(component.loot).toBe(updated);
  });

  it('drop publishes the pool', () => {
    lootService.drop.and.returnValue(of(pool()));
    component.state = state({ dm: true });
    component.drop();
    expect(lootService.drop).toHaveBeenCalledWith(1);
    expect(component.loot!.dropped).toBeTrue();
  });

  it('close discards the pool and resets the fetch key', () => {
    lootService.close.and.returnValue(of(void 0));
    component.state = state({ dm: true });
    component.loot = pool();
    component.close();
    expect(lootService.close).toHaveBeenCalledWith(1);
    expect(component.loot).toBeNull();
  });

  // ── party split ─────────────────────────────────────────────────────────────

  function seatedPlayer(over: Partial<SessionState> = {}): SessionState {
    return state({ lootStatus: 'DROPPED', participants: [participant({ ownedByMe: true, pcId: 7 })], ...over });
  }

  it('a move goes to the assign endpoint and the returned pool replaces ours', () => {
    const moved = pool({ allocations: [{ participantId: 2, lootItemId: 30, qty: 1 }] });
    lootService.assign.and.returnValue(of(moved));
    component.state = seatedPlayer();
    component.loot = pool();

    component.onMove({ lootItemId: 30, fromParticipantId: null, toParticipantId: 2 });

    expect(lootService.assign).toHaveBeenCalledWith(1, 30, null, 2);
    expect(component.loot).toBe(moved);
    expect(component.busy).toBeFalse();
  });

  it('a lost race (409) shows the server message and refetches the pool', () => {
    lootService.assign.and.returnValue(throwError(() => ({ status: 409, error: { message: 'That item already moved' } })));
    lootService.getLoot.and.returnValue(of(pool()));
    component.state = seatedPlayer();
    component.loot = pool();

    component.onMove({ lootItemId: 30, fromParticipantId: null, toParticipantId: 2 });

    expect(notifications.notify).toHaveBeenCalledWith('That item already moved');
    expect(lootService.getLoot).toHaveBeenCalled();
    expect(component.busy).toBeFalse();
  });

  it('coin, even-split, propose and ballot actions hit their endpoints', () => {
    lootService.setCoinShare.and.returnValue(of(pool()));
    lootService.splitCoinsEvenly.and.returnValue(of(pool()));
    lootService.propose.and.returnValue(of(pool({ phase: 'VOTING' })));
    lootService.vote.and.returnValue(of(pool({ phase: 'VOTING' })));
    component.state = seatedPlayer();
    component.loot = pool();

    component.onCoinChange({ participantId: 1, coinCp: 1000 });
    component.onSplitEvenly();
    component.onPropose();
    component.onBallot({ vote: false, pvp: true });

    expect(lootService.setCoinShare).toHaveBeenCalledWith(1, 1, 1000);
    expect(lootService.splitCoinsEvenly).toHaveBeenCalledWith(1);
    expect(lootService.propose).toHaveBeenCalledWith(1);
    expect(lootService.vote).toHaveBeenCalledWith(1, false, true);
  });

  it('a vote that resolves the split (204) clears the pool', () => {
    lootService.vote.and.returnValue(of(null));
    component.state = seatedPlayer();
    component.loot = pool({ phase: 'VOTING' });

    component.onBallot({ vote: true, pvp: null });

    expect(component.loot).toBeNull();
  });

  it('shows the split modal to a seated player, and minimizing hides it until the phase moves', () => {
    lootService.getLoot.and.returnValue(of(pool()));
    component.state = seatedPlayer();
    component.ngOnChanges();
    expect(component.showSplitModal).toBeTrue();

    component.minimize();
    expect(component.showSplitModal).toBeFalse();

    lootService.getLoot.and.returnValue(of(pool({ phase: 'VOTING' })));
    component.state = seatedPlayer({ version: 2 });
    component.ngOnChanges(); // the vote opened — the modal pops back up
    expect(component.showSplitModal).toBeTrue();
  });

  it('never shows the split modal to the DM', () => {
    lootService.getLoot.and.returnValue(of(pool()));
    component.state = state({ dm: true, lootStatus: 'DROPPED' });
    component.ngOnChanges();
    expect(component.showSplitModal).toBeFalse();
  });

  it('the DM override goes to the override endpoint', () => {
    lootService.override.and.returnValue(of(null));
    component.state = state({ dm: true, lootStatus: 'DROPPED' });
    component.loot = pool();

    component.overrideSplit('APPROVE');

    expect(lootService.override).toHaveBeenCalledWith(1, 'APPROVE');
    expect(component.loot).toBeNull();
  });

  // ── outcome ─────────────────────────────────────────────────────────────────

  function result(outcome: 'APPROVED' | 'PVP' | 'NO_MAJORITY', id = 5) {
    return { id, outcome, lootName: 'Goblin Ambush', pvpCallers: outcome === 'PVP' ? ['Brakka'] : [],
      agreeCount: 2, objectCount: 1, createdAt: new Date().toISOString() };
  }

  it('an approved split shows the outcome with who got what, and refreshes my sheet', () => {
    const voted = pool({ phase: 'VOTING', coinCpRemaining: 0,
      items: [{ id: 30, catalogItemKey: 'longsword', name: 'Longsword', custom: false,
                customNotes: null, qty: 2, qtyRemaining: 0, valueCp: 1500 }],
      allocations: [{ participantId: 1, lootItemId: 30, qty: 2 }],
      coinShares: [{ participantId: 2, coinCp: 12550 }] });
    lootService.getLoot.and.returnValue(of(voted));
    component.state = seatedPlayer({ version: 3 });
    component.ngOnChanges();

    component.state = seatedPlayer({ version: 4, lootStatus: null, lootResult: result('APPROVED') });
    component.ngOnChanges();

    expect(component.outcome!.result.outcome).toBe('APPROVED');
    expect(component.outcome!.shares).toEqual([
      { participantId: 1, name: 'Aria', share: 'Longsword ×2' },
      { participantId: 2, name: 'Brakka', share: jasmine.stringContaining('gp') },
    ]);
    expect(pcService.refreshPC).toHaveBeenCalledWith(7);
    expect(notifications.notify).toHaveBeenCalledWith('Loot split approved 2–1.');
  });

  it('a PvP cancel shows the outcome naming who drew steel; the DM only gets a toast', () => {
    component.state = seatedPlayer({ lootResult: null });
    component.ngOnChanges();
    component.state = seatedPlayer({ version: 2, lootStatus: null, lootResult: result('PVP') });
    component.ngOnChanges();
    expect(component.outcomeMessage(component.outcome!.result)).toContain('Brakka chose PvP');
    expect(pcService.refreshPC).not.toHaveBeenCalled();

    const dmPanel = TestBed.runInInjectionContext(() => new LootPanelComponent(
      lootService, curatedLootService, pcService, notifications));
    dmPanel.state = state({ dm: true, lootResult: null });
    dmPanel.ngOnChanges();
    dmPanel.state = state({ dm: true, version: 2, lootResult: result('PVP', 6) });
    dmPanel.ngOnChanges();
    expect(dmPanel.outcome).toBeNull();
    expect(notifications.notify).toHaveBeenCalledWith('Brakka called PvP — the loot is back in your draft.');
  });

  it('a no-majority result only toasts (the split re-opens in the modal)', () => {
    component.state = seatedPlayer({ lootResult: null });
    component.ngOnChanges();
    component.state = seatedPlayer({ version: 2, lootResult: result('NO_MAJORITY') });
    component.ngOnChanges();
    expect(component.outcome).toBeNull();
    expect(notifications.notify).toHaveBeenCalledWith('No majority (2–1) — back to the pile.');
  });

  it('a stale outcome seen on first load (a reload) is not announced', () => {
    const old = { ...result('APPROVED'), createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() };
    component.state = seatedPlayer({ lootStatus: null, lootResult: old });
    component.ngOnChanges();
    expect(component.outcome).toBeNull();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('announces each result once', () => {
    component.state = seatedPlayer({ lootResult: null });
    component.ngOnChanges();
    component.state = seatedPlayer({ version: 2, lootResult: result('NO_MAJORITY') });
    component.ngOnChanges();
    component.state = seatedPlayer({ version: 3, lootResult: result('NO_MAJORITY') });
    component.ngOnChanges();
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });
});
