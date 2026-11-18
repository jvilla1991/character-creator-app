import { InventoryPanelComponent } from './inventory-panel.component';
import { TestBed } from '@angular/core/testing';
import { PC, PcItem } from '../../../../models/pc';
import { CatalogItem } from '../../../../models/shop';

describe('InventoryPanelComponent', () => {
  let component: InventoryPanelComponent;

  const basePc = (inventory: PcItem[] = []): PC =>
    ({ id: 1, name: 'X', clazz: 'Fighter', level: 4, playerName: 'P', inventory } as PC);

  beforeEach(() => {
    component = TestBed.runInInjectionContext(() => new InventoryPanelComponent());
    component.editable = true;
  });

  it('gives the full-inventory index and freezes the inventory seen when opening', () => {
    const supplies: PcItem = { name: 'Rations', category: 'gear', qty: 3, catalogKey: 'rations' };
    const sword: PcItem = { name: 'Sword', category: 'weapon', qty: 2 };
    component.pc = basePc([supplies, sword]);
    component.giveAllowed = true;
    component.openGive(component.items[0]);
    expect(component.giveSelection!.index).toBe(1);
    sword.qty = 5;
    expect(component.giveSelection!.pc.inventory![1].qty).toBe(2);
  });

  it('does not open Give for dropped items or read-only inventories', () => {
    const item: PcItem = { name: 'Sword', category: 'weapon', qty: 1, status: 'dropped' };
    component.pc = basePc([item]);
    component.giveAllowed = true;
    component.openGive(item);
    expect(component.giveSelection).toBeNull();
    item.status = undefined;
    component.editable = false;
    component.openGive(item);
    expect(component.giveSelection).toBeNull();
  });

  it('reports a completed transfer without emitting a second PC save', () => {
    const save = spyOn(component.pcChange, 'emit');
    const transferred = spyOn(component.inventoryTransferred, 'emit');
    component.onTransferred({ inventory: [], ac: 12 });
    expect(save).not.toHaveBeenCalled();
    expect(transferred).toHaveBeenCalledWith({ inventory: [], ac: 12 });
    expect(component.transferMessage).toBe('Item transferred.');
  });

  it('flags a line as dropped without removing it, and without mutating the input', () => {
    component.pc = basePc([{ name: 'Torch', category: 'gear', qty: 2 }]);
    const spy = spyOn(component.pcChange, 'emit');

    component.dropItem(0);

    const emitted = spy.calls.mostRecent().args[0] as PC;
    expect(emitted.inventory!.length).toBe(1);
    expect(emitted.inventory![0].status).toBe('dropped');
    expect(component.pc.inventory![0].status).toBeUndefined(); // original untouched
  });

  it('discards ONE unit of a dropped stack, keeping the rest of the line', () => {
    component.pc = basePc([{ name: 'Arrows', category: 'gear', qty: 20, status: 'dropped' }]);
    const spy = spyOn(component.pcChange, 'emit');

    component.discardItem(0);

    const emitted = spy.calls.mostRecent().args[0] as PC;
    expect(emitted.inventory!.length).toBe(1);
    expect(emitted.inventory![0].qty).toBe(19);
    expect(emitted.inventory![0].status).toBe('dropped');
    expect(component.pc.inventory![0].qty).toBe(20); // original untouched
  });

  it('removes the line once the last unit is discarded', () => {
    component.pc = basePc([{ name: 'Torch', category: 'gear', qty: 1, status: 'dropped' }]);
    const spy = spyOn(component.pcChange, 'emit');

    component.discardItem(0);

    expect((spy.calls.mostRecent().args[0] as PC).inventory!.length).toBe(0);
  });

  it('treats a qty-less legacy line as a single unit and removes it', () => {
    component.pc = basePc([{ name: 'Relic', category: 'treasure', status: 'dropped' } as PcItem]);
    const spy = spyOn(component.pcChange, 'emit');

    component.discardItem(0);

    expect((spy.calls.mostRecent().args[0] as PC).inventory!.length).toBe(0);
  });

  it('toggles the equipped display flag', () => {
    component.pc = basePc([{ name: 'Shield', category: 'armor', qty: 1 }]);
    const spy = spyOn(component.pcChange, 'emit');

    component.toggleEquipped(0);

    expect((spy.calls.mostRecent().args[0] as PC).inventory![0].equipped).toBe(true);
  });

  it('recomputes AC when armor with a catalog formula is equipped', () => {
    // DEX defaults to 10 (+0), so leather (11 + Dex) resolves to AC 11.
    component.pc = basePc([{ name: 'Leather Armor', category: 'armor', qty: 1, armorClass: '11 + Dex modifier' }]);
    component.pc.ac = 10;
    const spy = spyOn(component.pcChange, 'emit');

    component.toggleEquipped(0);

    const emitted = spy.calls.mostRecent().args[0] as PC;
    expect(emitted.inventory![0].equipped).toBe(true);
    expect(emitted.ac).toBe(11);
  });

  // --- Legacy starting equipment (pc.weapons / pc.gear) folded into the list ---

  describe('legacy starting equipment', () => {
    const potion: PcItem = { name: 'Potion', category: 'gear', qty: 2 };
    const rations: PcItem = { catalogKey: 'rations', name: 'Rations (1 day)', category: 'gear', qty: 5 };

    const legacyPc = (inventory: PcItem[] = [potion]): PC => ({
      ...basePc(inventory),
      weapons: [{ name: 'Mace', dmg: '1d6+2', magic: true }],
      gear: [{ name: 'Chain Mail', equipped: true }, { name: 'Rope' }],
    });

    it('lists the legacy lines after the inventory lines, leaving inventory positions unchanged', () => {
      component.pc = legacyPc();

      expect(component.items.map(i => i.name)).toEqual(['Potion', 'Mace', 'Chain Mail', 'Rope']);
      expect(component.items[0]).toBe(potion); // real lines keep their identity and index
      expect(component.items[1]).toEqual({ name: 'Mace', category: 'weapon', qty: 1, damage: '1d6+2', notes: 'magic' });
      expect(component.items[2]).toEqual({ name: 'Chain Mail', category: 'gear', qty: 1, equipped: true });
    });

    it('still hides supply lines, with the legacy lines after the remaining inventory', () => {
      component.pc = legacyPc([rations, potion]);
      expect(component.items.map(i => i.name)).toEqual(['Potion', 'Mace', 'Chain Mail', 'Rope']);
    });

    it('returns the same list and line objects on every read for the same pc', () => {
      component.pc = legacyPc();

      const first = component.items;
      const second = component.items;

      expect(second).toBe(first);
      expect(second[1]).toBe(first[1]); // the built legacy line is not rebuilt
    });

    it('keeps the legacy line objects when the host passes a new PC around the same arrays', () => {
      const pc = legacyPc();
      component.pc = pc;
      const mace = component.items[1];

      component.pc = { ...pc, hp: { cur: 3, max: 10, temp: 0 } }; // unrelated change, same arrays

      expect(component.items[1]).toBe(mace);
    });

    it('rebuilds the list when the pc carries different arrays', () => {
      component.pc = legacyPc();
      const first = component.items;

      component.pc = { ...legacyPc(), weapons: [] };

      expect(component.items).not.toBe(first);
      expect(component.items.map(i => i.name)).toEqual(['Potion', 'Chain Mail', 'Rope']);
    });

    it('never offers a legacy line for sale — it has no catalog key or price', () => {
      component.pc = legacyPc();
      component.shopOpenForMe = true;
      component.shopCategory = null;

      expect(component.canSell(component.items[1])).toBe(false);
      expect(component.canSell(component.items[2])).toBe(false);
    });

    it('dropping a legacy line persists it as a dropped inventory line and empties the legacy arrays', () => {
      component.pc = legacyPc();
      const spy = spyOn(component.pcChange, 'emit');

      component.dropItem(1); // the Mace

      const emitted = spy.calls.mostRecent().args[0] as PC;
      expect(emitted.weapons).toEqual([]);
      expect(emitted.gear).toEqual([]);
      expect(emitted.inventory!.map(i => i.name)).toEqual(['Potion', 'Mace', 'Chain Mail', 'Rope']);
      expect(emitted.inventory![1].status).toBe('dropped');
      expect(emitted.inventory![2].status).toBeUndefined(); // the other legacy lines ride along untouched
      // the input PC is untouched
      expect(component.pc.weapons!.length).toBe(1);
      expect(component.pc.gear!.length).toBe(2);
      expect(component.pc.inventory!.length).toBe(1);
    });

    it('discarding a dropped legacy line removes it for good, without duplicating the rest', () => {
      component.pc = legacyPc();
      const spy = spyOn(component.pcChange, 'emit');

      component.dropItem(3); // the Rope
      // The host saves and hands the consolidated PC back.
      component.pc = spy.calls.mostRecent().args[0] as PC;
      expect(component.items.map(i => i.name)).toEqual(['Potion', 'Mace', 'Chain Mail', 'Rope']);

      component.discardItem(3);

      const emitted = spy.calls.mostRecent().args[0] as PC;
      expect(emitted.inventory!.map(i => i.name)).toEqual(['Potion', 'Mace', 'Chain Mail']);
      expect(emitted.weapons).toEqual([]);
      expect(emitted.gear).toEqual([]);
    });

    it('toggling equipped on a legacy line persists the flag on the folded line', () => {
      component.pc = legacyPc();
      const spy = spyOn(component.pcChange, 'emit');

      component.toggleEquipped(1); // equip the Mace
      let emitted = spy.calls.mostRecent().args[0] as PC;
      expect(emitted.inventory![1]).toEqual(
        { name: 'Mace', category: 'weapon', qty: 1, damage: '1d6+2', notes: 'magic', equipped: true });
      expect(emitted.weapons).toEqual([]);
      expect(emitted.gear).toEqual([]);

      component.toggleEquipped(2); // unequip the Chain Mail (legacy gear flagged equipped)
      emitted = spy.calls.mostRecent().args[0] as PC;
      expect(emitted.inventory![2].equipped).toBe(false);
    });

    it('editing a real inventory line folds the legacy lines in too', () => {
      component.pc = legacyPc();
      const spy = spyOn(component.pcChange, 'emit');

      component.dropItem(0); // the Potion

      const emitted = spy.calls.mostRecent().args[0] as PC;
      expect(emitted.inventory!.map(i => i.name)).toEqual(['Potion', 'Mace', 'Chain Mail', 'Rope']);
      expect(emitted.inventory![0].status).toBe('dropped');
      expect(emitted.weapons).toEqual([]);
      expect(emitted.gear).toEqual([]);
    });

    it('keeps the supply lines when a legacy line is edited', () => {
      component.pc = legacyPc([rations, potion]);
      const spy = spyOn(component.pcChange, 'emit');

      component.toggleEquipped(1); // the Mace

      const emitted = spy.calls.mostRecent().args[0] as PC;
      // managed lines first, the Supplies pane's lines re-appended after them
      expect(emitted.inventory!.map(i => i.name)).toEqual(['Potion', 'Mace', 'Chain Mail', 'Rope', 'Rations (1 day)']);
      expect(emitted.inventory![4]).toEqual(rations);
    });

    it('does not touch AC when the fold-in happens — legacy lines carry no armor formula', () => {
      component.pc = { ...legacyPc(), ac: 18 }; // hand-set AC for the legacy Chain Mail
      const spy = spyOn(component.pcChange, 'emit');

      component.toggleEquipped(2); // unequip the legacy Chain Mail
      expect((spy.calls.mostRecent().args[0] as PC).ac).toBe(18);

      component.dropItem(1);
      expect((spy.calls.mostRecent().args[0] as PC).ac).toBe(18);
    });

    it('counts no weight for legacy lines', () => {
      component.pc = legacyPc([{ name: 'Sword', category: 'weapon', qty: 1, weight: 3 }]);
      expect(component.totalWeight).toBe(3);
    });

    describe('giving a legacy line', () => {
      let spy: jasmine.Spy;

      beforeEach(() => {
        component.giveAllowed = true;
        spy = spyOn(component.pcChange, 'emit');
      });

      it('folds the starting gear in first, then opens Give once the saved character comes back', () => {
        component.pc = legacyPc([rations, potion]);

        component.openGive(component.items[1]); // Mace — not in pc.inventory yet

        // No dialog yet: the transfer endpoint needs the line saved first.
        expect(component.giveSelection).toBeNull();
        const saved = spy.calls.mostRecent().args[0] as PC;
        expect(saved.inventory!.map(i => i.name)).toEqual(['Potion', 'Mace', 'Chain Mail', 'Rope', 'Rations (1 day)']);
        expect(saved.weapons).toEqual([]);
        expect(saved.gear).toEqual([]);

        component.pc = saved; // the host hands back the persisted character

        expect(component.giveSelection!.index).toBe(1);
        expect(component.giveSelection!.pc.inventory![1].name).toBe('Mace');
        expect(spy).toHaveBeenCalledTimes(1); // resuming does not save again
      });

      it('keeps waiting through an unrelated update that arrives before the save', () => {
        const pc = legacyPc();
        component.pc = pc;
        component.openGive(component.items[1]);
        const saved = spy.calls.mostRecent().args[0] as PC;

        component.pc = { ...pc, hp: { cur: 3, max: 10, temp: 0 } }; // a poll: still unfolded
        expect(component.giveSelection).toBeNull();

        component.pc = saved;
        expect(component.giveSelection!.index).toBe(1);
      });

      it('gives up when the save never lands, so the dialog cannot open much later', () => {
        jasmine.clock().install();
        try {
          jasmine.clock().mockDate(new Date(2026, 0, 1));
          component.pc = legacyPc();
          component.openGive(component.items[1]);
          const saved = spy.calls.mostRecent().args[0] as PC;

          jasmine.clock().tick(11_000);
          component.pc = saved;

          expect(component.giveSelection).toBeNull();
        } finally {
          jasmine.clock().uninstall();
        }
      });

      it('opens Give directly for a line that is already in the inventory', () => {
        component.pc = legacyPc();
        component.openGive(component.items[0]); // Potion — a real inventory line
        expect(component.giveSelection!.index).toBe(0);
        expect(spy).not.toHaveBeenCalled();
      });
    });
  });

  describe('slot-based inventory (Darker Dungeons variant)', () => {
    const withStats = (inventory: PcItem[]): PC =>
      ({ ...basePc(inventory), race: 'Human', stats: { STR: 14, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 } } as PC);

    it('totals used slots from stamped bulk × qty, excluding dropped lines', () => {
      component.pc = withStats([
        { name: 'Longsword', category: 'weapon', qty: 2, bulk: 3 },
        { name: 'Anvil', category: 'gear', qty: 1, bulk: 9, status: 'dropped' },
      ]);
      expect(component.usedSlots).toBe(6);
    });

    it('computes capacity from species and STR (Medium 18 + mod)', () => {
      component.pc = withStats([]);
      expect(component.slotCapacity).toBe(20); // STR 14 → +2
    });

    it('flags encumbered only when over capacity', () => {
      component.pc = withStats([{ name: 'Crate', category: 'gear', qty: 1, bulk: 21 }]);
      expect(component.encumbered).toBe(true);

      component.pc = withStats([{ name: 'Crate', category: 'gear', qty: 1, bulk: 20 }]);
      expect(component.encumbered).toBe(false); // at capacity is fine
    });

    it('falls back to weight-band bulk for unstamped lines', () => {
      expect(component.bulkFor({ name: 'Rope', category: 'gear', qty: 1, weight: 5 })).toBe(2);
      expect(component.bulkFor({ name: 'Note', category: 'gear', qty: 1 })).toBe(1);
    });
  });

  it('sums total weight across quantities', () => {
    component.pc = basePc([
      { name: 'Rations', category: 'gear', qty: 3, weight: 2 },
      { name: 'Sword', category: 'weapon', qty: 1, weight: 3 },
    ]);
    expect(component.totalWeight).toBe(9);
  });

  describe('canSell', () => {
    const catalogItem: PcItem = { name: 'Longsword', category: 'weapon', qty: 1, catalogKey: 'longsword' };
    const adHocItem: PcItem = { name: 'Heirloom Ring', category: 'gear', qty: 1, unitCostCp: 500 };
    const priceless: PcItem = { name: 'Note', category: 'gear', qty: 1 };

    it('is false when no shop is open', () => {
      component.shopOpenForMe = false;
      expect(component.canSell(catalogItem)).toBe(false);
    });

    it('is true for a catalog item when the shop is open with no category filter (curated)', () => {
      component.shopOpenForMe = true;
      component.shopCategory = null;
      expect(component.canSell(catalogItem)).toBe(true);
    });

    it('is false when the standard shop category does not match the item', () => {
      component.shopOpenForMe = true;
      component.shopCategory = 'ARMOR';
      expect(component.canSell(catalogItem)).toBe(false);
    });

    it('is true when the standard shop category matches the item', () => {
      component.shopOpenForMe = true;
      component.shopCategory = 'WEAPON';
      expect(component.canSell(catalogItem)).toBe(true);
    });

    it('falls back to unitCostCp for an item with no catalogKey', () => {
      component.shopOpenForMe = true;
      component.shopCategory = null;
      expect(component.canSell(adHocItem)).toBe(true);
    });

    it('is false for an item with no catalogKey and no unitCostCp', () => {
      component.shopOpenForMe = true;
      component.shopCategory = null;
      expect(component.canSell(priceless)).toBe(false);
    });

    it('is false for a dropped item', () => {
      component.shopOpenForMe = true;
      component.shopCategory = null;
      expect(component.canSell({ ...catalogItem, status: 'dropped' })).toBe(false);
    });
  });

  describe('sell', () => {
    const supply: PcItem = { name: 'Rations', category: 'gear', qty: 4, catalogKey: 'rations' };
    const sword: PcItem = { name: 'Longsword', category: 'weapon', qty: 1, catalogKey: 'longsword' };
    const arrows: PcItem = { name: 'Arrows', category: 'weapon', qty: 20, catalogKey: 'arrows' };
    let spy: jasmine.Spy;

    beforeEach(() => {
      component.pc = { ...component.pc, inventory: [supply, sword, arrows], weapons: [], gear: [] };
      component.shopOpenForMe = true;
      component.shopCategory = null;
      spy = spyOn(component.sellRequested, 'emit');
    });

    it('sells a single item straight away, by its position in pc.inventory', () => {
      // The hidden supply line sits first, so the sword is row 0 here but
      // index 1 in pc.inventory — the server needs the latter.
      expect(component.items[0]).toBe(sword);
      component.sell(0);
      expect(spy).toHaveBeenCalledWith({ index: 1, qty: 1 });
      expect(component.sellPrompt).toBeNull();
    });

    it('asks how many before selling from a stack, defaulting to all of it', () => {
      component.sell(1);
      expect(spy).not.toHaveBeenCalled();
      expect(component.sellPrompt).toEqual({ item: arrows, qty: 20 });

      component.setSellQty('5');
      component.confirmSell();
      expect(spy).toHaveBeenCalledWith({ index: 2, qty: 5 });
      expect(component.sellPrompt).toBeNull();
    });

    it('refuses a quantity outside the stack', () => {
      component.sell(1);
      for (const bad of ['0', '21', '2.5', '']) {
        component.setSellQty(bad);
        expect(component.sellQtyValid).withContext(bad).toBeFalse();
        component.confirmSell();
      }
      expect(spy).not.toHaveBeenCalled();
    });

    it('cancel closes the prompt without selling', () => {
      component.sell(1);
      component.cancelSell();
      expect(component.sellPrompt).toBeNull();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does nothing when the shop will not buy the line', () => {
      component.shopOpenForMe = false;
      component.sell(0);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // --- DM grants (the shared composer authors; this panel maps → PcItem) ---

  describe('grant via the shared composer', () => {
    const catalogLongsword: CatalogItem = {
      itemKey: 'longsword', name: 'Longsword', category: 'WEAPON', costCp: 1500,
      weight: 3, bulk: 2, details: { damage: '1d8 slashing', properties: ['versatile (1d10)'] },
    };

    beforeEach(() => {
      component.pc = basePc([]);
      component.grantFormOpen = true;
    });

    it('emits a denormalized catalog PcItem — details flattened, base fields win', () => {
      const emitted: PcItem[] = [];
      component.itemGranted.subscribe(i => emitted.push(i));

      component.onAuthored({ kind: 'catalog', item: catalogLongsword, qty: 2 });

      expect(emitted.length).toBe(1);
      expect(emitted[0]).toEqual({
        catalogKey: 'longsword',
        name: 'Longsword',
        category: 'weapon',
        qty: 2,
        unitCostCp: 1500,
        weight: 3,
        bulk: 2,
        damage: '1d8 slashing',
        properties: ['versatile (1d10)'],
      });
      expect(component.grantFormOpen).toBeFalse(); // form closes after the grant
    });

    it('emits a fully stat’d custom PcItem — value → unitCostCp, weight-band bulk, damage, notes', () => {
      const emitted: PcItem[] = [];
      component.itemGranted.subscribe(i => emitted.push(i));

      component.onAuthored({
        kind: 'custom', name: 'Flametongue', category: 'weapon', qty: 1,
        valueGp: 50, weight: 3, damage: '1d8 slashing + 2d6 fire', notes: 'Ignites.',
      });

      expect(emitted[0]).toEqual({
        name: 'Flametongue', category: 'weapon', qty: 1,
        unitCostCp: 5000, weight: 3, bulk: 2, // 3 lb → the ≤5 lb band, same as a conversion
        damage: '1d8 slashing + 2d6 fire', notes: 'Ignites.',
      });
    });

    it('emits a bare custom PcItem with the unknown-weight bulk default', () => {
      const emitted: PcItem[] = [];
      component.itemGranted.subscribe(i => emitted.push(i));

      component.onAuthored({ kind: 'custom', name: 'Cracked Dragon Fang', category: 'gear', qty: 1 });

      expect(emitted[0]).toEqual({ name: 'Cracked Dragon Fang', category: 'gear', qty: 1, bulk: 1 });
    });

    it('cancel closes the form without emitting', () => {
      const emitted: PcItem[] = [];
      component.itemGranted.subscribe(i => emitted.push(i));

      component.onGrantCancelled();

      expect(component.grantFormOpen).toBeFalse();
      expect(emitted.length).toBe(0);
    });
  });
});
