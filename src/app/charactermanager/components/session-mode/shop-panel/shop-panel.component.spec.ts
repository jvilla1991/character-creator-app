import { of, throwError } from 'rxjs';
import { ShopPanelComponent } from './shop-panel.component';
import { SessionState, ParticipantView } from '../../../models/session';
import { ShopItem, ShopView } from '../../../models/shop';
import { PC } from '../../../models/pc';

/**
 * Tests the component class directly (no TestBed/DOM) — the convention used by
 * other components in this app.
 */
describe('ShopPanelComponent', () => {
  let component: ShopPanelComponent;
  let shopService: any;
  let curatedShopService: any;
  let pcService: any;
  let notifications: any;

  const longsword: ShopItem = {
    itemKey: 'longsword', name: 'Longsword', category: 'WEAPON', costCp: 1500,
    weight: 3, details: { damage: '1d8 slashing', properties: ['versatile (1d10)'] }, stock: null,
  };

  function participant(over: Partial<ParticipantView>): ParticipantView {
    return {
      participantId: 1, pcId: 7, npc: false, ownedByMe: false, currentTurn: false,
      name: 'Aria', clazz: 'Fighter', level: 3, portraitTint: null, portraitInitials: null,
      initiative: null, initRolled: false, dexModifier: null, orderIndex: 0, hpMax: null,
      hpCurrent: null, hpTemp: null, ac: null, conditions: [], survival: null, spellSlots: null,
      deathSaveSuccesses: 0, deathSaveFailures: 0,
      ...over,
    };
  }

  function state(over: Partial<SessionState>): SessionState {
    return {
      sessionId: 1, campaignId: 1, status: 'ACTIVE', round: 1, activeParticipantId: null,
      onDeckParticipantId: null, version: 1, dm: false, enemiesHidden: true, turnSound: null,
      shopOpen: false, shopForMe: false, shopCategory: null, lootStatus: null, lootName: null,
      myXp: null, gameTime: null, location: null, weekDays: null, participants: [], ...over,
    };
  }

  beforeEach(() => {
    shopService = jasmine.createSpyObj('ShopService',
      ['openShop', 'openCuratedShop', 'setAttendees', 'closeShop', 'getShop', 'purchase']);
    curatedShopService = jasmine.createSpyObj('CuratedShopService', ['list']);
    pcService = jasmine.createSpyObj('PCService', ['getPCById', 'patchLocalPC']);
    notifications = jasmine.createSpyObj('NotificationService', ['notify']);
    component = new ShopPanelComponent(shopService, curatedShopService, pcService, notifications);
  });

  it('myCoinsCp sums the purse in copper', () => {
    pcService.getPCById.and.returnValue({ id: 7, coins: { cp: 5, sp: 0, ep: 0, gp: 2, pp: 0 } } as PC);
    component.state = state({ participants: [participant({ ownedByMe: true })] });
    expect(component.myCoinsCp).toBe(205); // 2 gp + 5 cp
  });

  it('canAfford reflects the purse', () => {
    pcService.getPCById.and.returnValue({ id: 7, coins: { gp: 10 } } as PC);
    component.state = state({ participants: [participant({ ownedByMe: true })] });
    expect(component.canAfford(longsword)).toBeFalse(); // 1000 < 1500
    pcService.getPCById.and.returnValue({ id: 7, coins: { gp: 20 } } as PC);
    expect(component.canAfford(longsword)).toBeTrue();
  });

  it('roster excludes NPCs and missing pcIds', () => {
    component.state = state({
      participants: [
        participant({ participantId: 1, pcId: 7 }),
        participant({ participantId: 2, pcId: null, npc: true, name: 'Goblin' }),
      ],
    });
    expect(component.roster.map(p => p.name)).toEqual(['Aria']);
  });

  it('openShop sends the selected roster pcIds', () => {
    const view: ShopView = { shopId: 10, sessionId: 1, category: 'WEAPON', settlement: 'Phandalin', attendeePcIds: [7], items: [] };
    shopService.openShop.and.returnValue(of(view));
    component.state = state({ dm: true, participants: [participant({ pcId: 7 }), participant({ participantId: 2, pcId: 8, name: 'Borin' })] });
    component.settlement = 'Phandalin';
    component.selected = { 7: true, 8: false };

    component.openShop();

    expect(shopService.openShop).toHaveBeenCalledWith(1, 'WEAPON', 'Phandalin', [7]);
    expect(component.shop).toBe(view);
  });

  it('openShop sends the chosen category (armor / components)', () => {
    const view: ShopView = { shopId: 11, sessionId: 1, category: 'ARMOR', settlement: '', attendeePcIds: [], items: [] };
    shopService.openShop.and.returnValue(of(view));
    component.state = state({ dm: true, participants: [participant({ pcId: 7 })] });
    component.selected = { 7: true };

    component.category = 'ARMOR';
    component.openShop();
    expect(shopService.openShop).toHaveBeenCalledWith(1, 'ARMOR', '', [7]);

    component.category = 'MATERIAL_COMPONENT';
    component.openShop();
    expect(shopService.openShop).toHaveBeenCalledWith(1, 'MATERIAL_COMPONENT', '', [7]);
  });

  it('itemMeta adapts to category', () => {
    expect(component.itemMeta(longsword)).toBe('1d8 slashing · versatile (1d10)');

    const plate: ShopItem = {
      itemKey: 'plate', name: 'Plate Armor', category: 'ARMOR', costCp: 150000, weight: 65,
      details: { armorClass: '18', armorCategory: 'heavy' }, stock: null,
    };
    expect(component.itemMeta(plate)).toBe('18 · heavy');

    const revivify: ShopItem = {
      itemKey: 'mc-revivify', name: 'Diamonds (Revivify)', category: 'MATERIAL_COMPONENT',
      costCp: 30000, weight: null, details: { spell: 'Revivify', consumedOnCast: true }, stock: null,
    };
    expect(component.itemMeta(revivify)).toBe('Revivify · consumed on cast');

    const identify: ShopItem = {
      itemKey: 'mc-identify', name: 'Pearl (Identify)', category: 'MATERIAL_COMPONENT',
      costCp: 10000, weight: null, details: { spell: 'Identify', consumedOnCast: false }, stock: null,
    };
    expect(component.itemMeta(identify)).toBe('Identify · reusable');
  });

  it('categoryLabel is singular per category', () => {
    expect(component.categoryLabel('WEAPON')).toBe('Weapon');
    expect(component.categoryLabel('ARMOR')).toBe('Armor');
    expect(component.categoryLabel('MATERIAL_COMPONENT')).toBe('Component');
  });

  it('openShop activates a curated shop when source is curated', () => {
    const view = { shopId: 10, sessionId: 1, category: null, settlement: 'Phandalin',
      attendeePcIds: [7], items: [], curatedShopId: 50, shopName: 'The Smithy' } as unknown as ShopView;
    shopService.openCuratedShop.and.returnValue(of(view));
    component.state = state({ dm: true, participants: [participant({ pcId: 7 })] });
    component.source = 'curated';
    component.curatedShopId = 50;
    component.settlement = 'Phandalin';
    component.selected = { 7: true };

    component.openShop();

    expect(shopService.openCuratedShop).toHaveBeenCalledWith(1, 50, 'Phandalin', [7]);
    expect(shopService.openShop).not.toHaveBeenCalled();
    expect(component.shop).toBe(view);
  });

  it('canOpen requires a chosen curated shop', () => {
    component.source = 'standard';
    expect(component.canOpen).toBeTrue();
    component.source = 'curated';
    component.curatedShopId = null;
    expect(component.canOpen).toBeFalse();
    component.curatedShopId = 50;
    expect(component.canOpen).toBeTrue();
  });

  it('shopTitle prefers the curated name, else the category', () => {
    expect(component.shopTitle({ shopName: 'The Smithy' } as ShopView)).toBe('The Smithy');
    expect(component.shopTitle({ category: 'ARMOR' } as ShopView)).toBe('Armor Shop');
  });

  it('loads the DM’s curated shops once per campaign', () => {
    curatedShopService.list.and.returnValue(of([{ id: 50, name: 'The Smithy' }]));
    component.state = state({ dm: true });
    component.ngOnChanges();
    component.ngOnChanges(); // same campaign — must not reload
    expect(curatedShopService.list).toHaveBeenCalledTimes(1);
    expect(component.curatedShops.length).toBe(1);
  });

  it('buy purchases, patches the local PC, and notifies', () => {
    pcService.getPCById.and.returnValue({ id: 7, coins: { gp: 20 } } as PC);
    shopService.purchase.and.returnValue(of({
      coins: { cp: 0, sp: 0, ep: 0, gp: 5, pp: 0 },
      inventory: [{ catalogKey: 'longsword', name: 'Longsword', category: 'weapon', qty: 1 }],
      totalCostCp: 1500,
    }));
    component.state = state({ participants: [participant({ ownedByMe: true, pcId: 7 })] });

    component.buy(longsword);

    expect(shopService.purchase).toHaveBeenCalledWith(1, 7, 'longsword', 1);
    expect(pcService.patchLocalPC).toHaveBeenCalledWith(7, jasmine.objectContaining({
      coins: jasmine.objectContaining({ gp: 5 }),
    }));
    expect(notifications.notify).toHaveBeenCalled();
    expect(component.busyItem).toBeNull();
  });

  it('buy surfaces a friendly message on 409 insufficient funds', () => {
    pcService.getPCById.and.returnValue({ id: 7, coins: { gp: 20 } } as PC);
    shopService.purchase.and.returnValue(throwError(() => ({ status: 409 })));
    component.state = state({ participants: [participant({ ownedByMe: true, pcId: 7 })] });

    component.buy(longsword);

    expect(notifications.notify).toHaveBeenCalledWith('Not enough coin for that purchase.');
    expect(pcService.patchLocalPC).not.toHaveBeenCalled();
    expect(component.busyItem).toBeNull();
  });

  it('fetches the catalog once when a shop becomes visible', () => {
    shopService.getShop.and.returnValue(of({ shopId: 10, items: [] } as any));
    component.state = state({ shopOpen: true, shopForMe: true, shopCategory: 'WEAPON' });

    component.ngOnChanges();
    component.ngOnChanges(); // a second poll with the same shop must not refetch

    expect(shopService.getShop).toHaveBeenCalledTimes(1);
  });

  it('clears the shop when it closes', () => {
    component.shop = { shopId: 10 } as any;
    component.state = state({ shopOpen: false, shopForMe: false });
    component.ngOnChanges();
    expect(component.shop).toBeNull();
  });
});
