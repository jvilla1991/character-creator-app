import { of, throwError } from 'rxjs';
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
      myXp: null, gameTime: null, location: null, weekDays: null, participants: [], rolls: [], ...over,
    };
  }

  function pool(over: Partial<LootView> = {}): LootView {
    return {
      id: 20, sessionId: 1, name: 'Goblin Ambush', dropped: true,
      coinCpTotal: 12550, coinCpRemaining: 12550,
      items: [{ id: 30, catalogItemKey: 'longsword', name: 'Longsword', custom: false,
                customNotes: null, qty: 2, qtyRemaining: 2 }],
      ...over,
    };
  }

  beforeEach(() => {
    lootService = jasmine.createSpyObj('LootService',
      ['open', 'drop', 'close', 'addItem', 'updateItem', 'removeItem', 'setCoins',
       'getLoot', 'claimItem', 'claimCoins']);
    curatedLootService = jasmine.createSpyObj('CuratedLootService', ['list']);
    curatedLootService.list.and.returnValue(of([]));
    pcService = jasmine.createSpyObj('PCService', ['getPCById', 'patchLocalPC']);
    notifications = jasmine.createSpyObj('NotificationService', ['notify']);
    component = new LootPanelComponent(
      lootService, curatedLootService, pcService, notifications);
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
    component.ngOnChanges(); // someone claimed — version bumped
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

  // ── player claims ───────────────────────────────────────────────────────────

  it('claim mirrors coins/inventory into the PC store and replaces the pool', () => {
    const remaining = pool({ items: [{ id: 30, catalogItemKey: 'longsword', name: 'Longsword',
      custom: false, customNotes: null, qty: 2, qtyRemaining: 1 }] });
    const result = {
      coins: { cp: 0, sp: 0, ep: 0, gp: 5, pp: 0 },
      inventory: [{ name: 'Longsword', category: 'weapon', qty: 1 }],
      loot: remaining,
    };
    lootService.claimItem.and.returnValue(of(result));
    component.state = state({ lootStatus: 'DROPPED',
      participants: [participant({ ownedByMe: true, pcId: 7 })] });
    component.loot = pool();

    component.claim(component.loot.items[0]);

    expect(lootService.claimItem).toHaveBeenCalledWith(1, 7, 30, 1);
    expect(pcService.patchLocalPC).toHaveBeenCalledWith(7,
      { coins: result.coins, inventory: result.inventory });
    expect(component.loot).toBe(remaining);
    expect(notifications.notify).toHaveBeenCalledWith('Claimed Longsword.');
  });

  it('claim clamps the requested qty to what remains', () => {
    lootService.claimItem.and.returnValue(of({ coins: {}, inventory: [], loot: pool() }));
    component.state = state({ lootStatus: 'DROPPED',
      participants: [participant({ ownedByMe: true, pcId: 7 })] });
    component.loot = pool();
    component.claimQty[30] = 99;
    component.claim(component.loot.items[0]);
    expect(lootService.claimItem).toHaveBeenCalledWith(1, 7, 30, 2); // only 2 remain
  });

  it('a lost race (409) shows a toast and refetches the pool', () => {
    lootService.claimItem.and.returnValue(throwError(() => ({ status: 409 })));
    lootService.getLoot.and.returnValue(of(pool({ items: [] })));
    component.state = state({ lootStatus: 'DROPPED',
      participants: [participant({ ownedByMe: true, pcId: 7 })] });
    component.loot = pool();

    component.claim(component.loot.items[0]);

    expect(notifications.notify).toHaveBeenCalledWith('Someone got there first.');
    expect(lootService.getLoot).toHaveBeenCalled();
    expect(component.busyItemId).toBeNull();
  });

  it('takeCoins converts gp to copper and credits the purse', () => {
    const result = { coins: { cp: 0, sp: 0, ep: 0, gp: 26, pp: 0 }, inventory: [],
      loot: pool({ coinCpRemaining: 10050 }) };
    lootService.claimCoins.and.returnValue(of(result));
    component.state = state({ lootStatus: 'DROPPED',
      participants: [participant({ ownedByMe: true, pcId: 7 })] });
    component.loot = pool();
    component.takeGp = 25;

    component.takeCoins();

    expect(lootService.claimCoins).toHaveBeenCalledWith(1, 7, { cp: 2500 });
    expect(pcService.patchLocalPC).toHaveBeenCalledWith(7, { coins: result.coins });
    expect(component.takeGp).toBeNull();
  });

  it('takeCoins ignores a non-positive amount', () => {
    component.state = state({ lootStatus: 'DROPPED',
      participants: [participant({ ownedByMe: true, pcId: 7 })] });
    component.loot = pool();
    component.takeGp = 0;
    component.takeCoins();
    expect(lootService.claimCoins).not.toHaveBeenCalled();
  });

  it('claim does nothing without an owned seated PC', () => {
    component.state = state({ lootStatus: 'DROPPED', participants: [participant()] }); // not mine
    component.loot = pool();
    component.claim(component.loot.items[0]);
    expect(lootService.claimItem).not.toHaveBeenCalled();
  });
});
