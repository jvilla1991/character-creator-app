import { Subject, of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';

import { ItemComposerComponent } from './item-composer.component';
import { AuthoredItem, pcItemFromAuthored } from './authored-item';
import { CatalogItem } from '../../models/shop';
import { ShopService } from '../../services/shop.service';
import { environment } from '../../../../environments/environment';

/** Tests the component class directly (no TestBed/DOM), per the app convention. */
describe('ItemComposerComponent', () => {
  let component: ItemComposerComponent;
  let shopService: jasmine.SpyObj<ShopService>;

  const catalogLongsword: CatalogItem = {
    itemKey: 'longsword', name: 'Longsword', category: 'WEAPON', costCp: 1500,
    weight: 3, bulk: 2, details: { damage: '1d8 slashing', properties: ['versatile (1d10)'] },
  };

  beforeEach(() => {
    shopService = jasmine.createSpyObj<ShopService>('ShopService', ['getCatalog']);
    shopService.getCatalog.and.returnValue(of([]));
    component = TestBed.runInInjectionContext(() => new ItemComposerComponent(shopService));
  });

  it('loads the catalog for the default category on init', () => {
    shopService.getCatalog.and.returnValue(of([catalogLongsword]));
    component.ngOnInit();
    expect(shopService.getCatalog).toHaveBeenCalledWith('WEAPON');
    expect(component.tab).toBe('catalog');
    expect(component.catalogItems()).toEqual([catalogLongsword]);
  });

  it('emits the full catalog item and qty on a catalog confirm', () => {
    shopService.getCatalog.and.returnValue(of([catalogLongsword]));
    component.ngOnInit();
    component.catalogSelectedKey = 'longsword';
    component.catalogQty = 2;
    const emitted: AuthoredItem[] = [];
    component.itemAuthored.subscribe(i => emitted.push(i));

    component.confirmCatalog();

    expect(emitted).toEqual([{ kind: 'catalog', item: catalogLongsword, qty: 2 }]);
    expect(component.catalogSelectedKey).toBeNull(); // form reset
  });

  it('filters the catalog by the search box', () => {
    component.catalogItems.set([catalogLongsword,
      { ...catalogLongsword, itemKey: 'dagger', name: 'Dagger' }]);
    component.catalogSearch = 'dag';
    expect(component.filteredCatalog.map(i => i.itemKey)).toEqual(['dagger']);
  });

  it('emits a minimal custom item (no attributes typed)', () => {
    const emitted: AuthoredItem[] = [];
    component.itemAuthored.subscribe(i => emitted.push(i));
    component.tab = 'custom';
    component.customName = '  Cracked Dragon Fang  ';
    component.customCategory = 'gear';
    component.customQty = 1;

    component.confirmCustom();

    expect(emitted).toEqual([{ kind: 'custom', name: 'Cracked Dragon Fang', category: 'gear', qty: 1 }]);
  });

  it('carries value/weight/notes and the weapon stat on a custom weapon', () => {
    const emitted: AuthoredItem[] = [];
    component.itemAuthored.subscribe(i => emitted.push(i));
    component.customName = 'Flametongue';
    component.customCategory = 'weapon';
    component.customQty = 1;
    component.customValueGp = 50;
    component.customWeight = 3;
    component.customDamage = '1d8 slashing + 2d6 fire';
    component.customArmorClass = 'ignored for a weapon';
    component.customNotes = ' Ignites on command. ';

    component.confirmCustom();

    expect(emitted).toEqual([{
      kind: 'custom', name: 'Flametongue', category: 'weapon', qty: 1,
      valueGp: 50, weight: 3, damage: '1d8 slashing + 2d6 fire', notes: 'Ignites on command.',
    }]);
  });

  it('carries armor class on a custom armor item', () => {
    const emitted: AuthoredItem[] = [];
    component.itemAuthored.subscribe(i => emitted.push(i));
    component.customName = 'Mithral Plate';
    component.customCategory = 'armor';
    component.customArmorClass = '18';

    component.confirmCustom();

    expect(emitted).toEqual([{
      kind: 'custom', name: 'Mithral Plate', category: 'armor', qty: 1, armorClass: '18',
    }]);
  });

  it('blocks a custom confirm with a blank name', () => {
    const emitted: AuthoredItem[] = [];
    component.itemAuthored.subscribe(i => emitted.push(i));
    component.customName = '   ';
    component.confirmCustom();
    expect(emitted.length).toBe(0);
  });

  it('cancel resets the form and emits cancelled', () => {
    let cancelled = 0;
    component.cancelled.subscribe(() => cancelled++);
    component.customName = 'Half-typed';
    component.cancel();
    expect(cancelled).toBe(1);
    expect(component.customName).toBe('');
  });

  // --- JSON tab ---

  describe('JSON tab', () => {
    const catalogRations: CatalogItem = {
      itemKey: 'rations', name: 'Rations', category: 'GEAR', costCp: 50, weight: 2, bulk: 1,
      details: {},
    };
    let batches: AuthoredItem[][];

    beforeEach(() => {
      batches = [];
      component.itemsAuthored.subscribe(b => batches.push(b));
      component.tab = 'json';
    });

    it('rejects malformed JSON and keeps the draft', () => {
      component.jsonDraft = '{oops';
      component.confirmJson();
      expect(component.jsonError()).toContain('Not valid JSON');
      expect(component.jsonDraft).toBe('{oops');
      expect(batches.length).toBe(0);
    });

    it('rejects an empty items array', () => {
      component.jsonDraft = '{"items": []}';
      component.confirmJson();
      expect(component.jsonError()).toContain('empty');
      expect(batches.length).toBe(0);
    });

    it('rejects coins — the grant is items only', () => {
      component.jsonDraft = '{"coinGp": 10, "items": [{"name": "Rope"}]}';
      component.confirmJson();
      expect(component.jsonError()).toContain('coinGp');
      expect(batches.length).toBe(0);
    });

    it('emits custom lines as one batch without touching the catalog', () => {
      component.jsonDraft = JSON.stringify({ items: [
        { name: ' Cracked Fang ' },
        { name: 'Flametongue', category: 'weapon', qty: 2, valueGp: 5000, weight: 3,
          damage: '1d8 slashing + 2d6 fire', notes: 'Ignites on command.' },
        { name: 'Mithral Plate', category: 'armor', armorClass: '18' },
      ] });

      component.confirmJson();

      expect(shopService.getCatalog).not.toHaveBeenCalled();
      expect(batches).toEqual([[
        { kind: 'custom', name: 'Cracked Fang', category: 'gear', qty: 1 },
        { kind: 'custom', name: 'Flametongue', category: 'weapon', qty: 2, valueGp: 5000, weight: 3,
          damage: '1d8 slashing + 2d6 fire', notes: 'Ignites on command.' },
        { kind: 'custom', name: 'Mithral Plate', category: 'armor', qty: 1, armorClass: '18' },
      ]]);
      // Form reset after a successful paste.
      expect(component.jsonDraft).toBe('');
      expect(component.jsonError()).toBeNull();
    });

    it('looks catalog keys up across every category and keeps the written order', () => {
      shopService.getCatalog.and.callFake((category: string) =>
        of(category === 'WEAPON' ? [catalogLongsword] : category === 'GEAR' ? [catalogRations] : []));
      component.jsonDraft = JSON.stringify({ items: [
        { key: 'rations', qty: 10 }, { name: 'Odd Coin' }, { key: 'longsword' },
      ] });

      component.confirmJson();

      expect(shopService.getCatalog.calls.allArgs().map(a => a[0]))
        .toEqual(['WEAPON', 'ARMOR', 'MATERIAL_COMPONENT', 'GEAR', 'TRANSPORT']);
      expect(batches).toEqual([[
        { kind: 'catalog', item: catalogRations, qty: 10 },
        { kind: 'custom', name: 'Odd Coin', category: 'gear', qty: 1 },
        { kind: 'catalog', item: catalogLongsword, qty: 1 },
      ]]);
      expect(component.jsonBusy()).toBeFalse();
    });

    it('names every unknown catalog key once and emits nothing', () => {
      shopService.getCatalog.and.callFake((category: string) =>
        of(category === 'WEAPON' ? [catalogLongsword] : []));
      component.jsonDraft = JSON.stringify({ items: [
        { key: 'longsword' }, { key: 'vorpal-blade' }, { key: 'vorpal-blade', qty: 2 }, { key: 'bag-of-holding' },
      ] });

      component.confirmJson();

      expect(component.jsonError()).toBe('Unknown catalog keys: vorpal-blade, bag-of-holding');
      expect(batches.length).toBe(0);
      expect(component.jsonDraft).not.toBe(''); // kept so it can be fixed
    });

    it('reports a catalog lookup failure and can be retried', () => {
      shopService.getCatalog.and.returnValue(throwError(() => new Error('network down')));
      component.jsonDraft = '{"items": [{"key": "longsword"}]}';

      component.confirmJson();

      expect(component.jsonError()).toContain('Could not load the catalog');
      expect(component.jsonBusy()).toBeFalse();
      expect(batches.length).toBe(0);
    });

    it('a cancel while the catalog is loading emits nothing when it arrives', () => {
      const pending = new Subject<CatalogItem[]>();
      shopService.getCatalog.and.returnValue(pending);
      component.jsonDraft = '{"items": [{"key": "longsword"}]}';
      component.confirmJson();
      expect(component.jsonBusy()).toBeTrue();

      component.cancel();
      pending.next([catalogLongsword]);
      pending.complete();

      expect(batches.length).toBe(0);
      expect(component.jsonBusy()).toBeFalse();
    });

    it('floors a fractional quantity', () => {
      component.jsonDraft = '{"items": [{"name": "Arrows", "qty": 2.9}]}';
      component.confirmJson();
      expect(batches[0][0].qty).toBe(2);
    });

    it('in demo mode accepts custom lines but refuses catalog keys', () => {
      spyOnProperty(environment, 'demoMode', 'get').and.returnValue(true);
      const demoComponent = TestBed.runInInjectionContext(() => new ItemComposerComponent(shopService));
      const demoBatches: AuthoredItem[][] = [];
      demoComponent.itemsAuthored.subscribe(b => demoBatches.push(b));

      demoComponent.jsonDraft = '{"items": [{"key": "longsword"}]}';
      demoComponent.confirmJson();
      expect(demoComponent.jsonError()).toContain('demo has no catalog');
      expect(shopService.getCatalog).not.toHaveBeenCalled();

      demoComponent.jsonDraft = '{"items": [{"name": "Rope"}]}';
      demoComponent.confirmJson();
      expect(demoBatches).toEqual([[{ kind: 'custom', name: 'Rope', category: 'gear', qty: 1 }]]);
    });
  });

  it('starts on the custom tab in demo mode (no catalog)', () => {
    // demoMode is captured at construction; build a component that reads it as true.
    spyOnProperty(environment, 'demoMode', 'get').and.returnValue(true);
    const demoComponent = TestBed.runInInjectionContext(() => new ItemComposerComponent(shopService));

    demoComponent.ngOnInit();

    expect(demoComponent.tab).toBe('custom');
    expect(shopService.getCatalog).not.toHaveBeenCalled();
  });
});

describe('pcItemFromAuthored', () => {
  const catalogLongsword: CatalogItem = {
    itemKey: 'longsword', name: 'Longsword', category: 'WEAPON', costCp: 1500,
    weight: 3, bulk: 2, details: { damage: '1d8 slashing', properties: ['versatile (1d10)'] },
  };

  it('denormalizes a catalog pick like the backend (flatten details, base fields win)', () => {
    expect(pcItemFromAuthored({ kind: 'catalog', item: catalogLongsword, qty: 2 })).toEqual({
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
  });

  it('maps a bare custom item — bulk stamped at the unknown-weight default', () => {
    expect(pcItemFromAuthored({ kind: 'custom', name: 'Cracked Dragon Fang', category: 'gear', qty: 1 }))
      .toEqual({ name: 'Cracked Dragon Fang', category: 'gear', qty: 1, bulk: 1 });
  });

  it('maps a full custom weapon — value → unitCostCp, weight-band bulk, damage, notes', () => {
    expect(pcItemFromAuthored({
      kind: 'custom', name: 'Flametongue', category: 'weapon', qty: 1,
      valueGp: 50, weight: 3, damage: '1d8 slashing + 2d6 fire', notes: 'Ignites.',
    })).toEqual({
      name: 'Flametongue', category: 'weapon', qty: 1,
      unitCostCp: 5000, weight: 3, bulk: 2, // 3 lb → the ≤5 lb band
      damage: '1d8 slashing + 2d6 fire', notes: 'Ignites.',
    });
  });

  it('maps custom armor with its armor class', () => {
    expect(pcItemFromAuthored({
      kind: 'custom', name: 'Mithral Plate', category: 'armor', qty: 1, armorClass: '18',
    })).toEqual({ name: 'Mithral Plate', category: 'armor', qty: 1, bulk: 1, armorClass: '18' });
  });

  it('denormalizes a TRANSPORT catalog pick — fractional-safe bulk and ride notes intact', () => {
    const pony: CatalogItem = {
      itemKey: 'pony', name: 'Pony', category: 'TRANSPORT', costCp: 3000,
      bulk: 20, details: { notes: 'Mount — Medium, speed 40 ft, carries 20 slots' },
    };
    expect(pcItemFromAuthored({ kind: 'catalog', item: pony, qty: 1 })).toEqual({
      catalogKey: 'pony',
      name: 'Pony',
      category: 'transport',
      qty: 1,
      unitCostCp: 3000,
      bulk: 20,
      notes: 'Mount — Medium, speed 40 ft, carries 20 slots',
    });
  });
});
