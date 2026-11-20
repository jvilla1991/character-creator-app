import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { CatalogItem } from '../../models/shop';
import { JsonImportKind } from '../../models/json-import-check';
import { CatalogLookupService } from '../../services/catalog-lookup.service';
import { CHECK_DELAY_MS, JsonImportComponent, JsonImportConfirmed } from './json-import.component';

describe('JsonImportComponent', () => {
  let fixture: ComponentFixture<JsonImportComponent>;
  let component: JsonImportComponent;
  let lookup: { all: jasmine.Spy<() => Observable<CatalogItem[]>> };
  let confirmed: JsonImportConfirmed[];

  const item = (itemKey: string, name: string, category: string, costCp: number): CatalogItem =>
    ({ itemKey, name, category, costCp, bulk: 1, details: {} });
  const CATALOG = [item('longsword', 'Longsword', 'WEAPON', 1500), item('rations', 'Rations', 'GEAR', 50)];

  const GOOD = JSON.stringify({ items: [{ key: 'longsword' }, { name: 'Ruby', qty: 2 }] });
  const TYPO = JSON.stringify({ items: [{ key: 'longsord' }] });

  function create(kind: JsonImportKind, catalog: Observable<CatalogItem[]> = of(CATALOG)): void {
    lookup.all.and.returnValue(catalog);
    fixture = TestBed.createComponent(JsonImportComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('kind', kind);
    confirmed = [];
    component.confirmed.subscribe(c => confirmed.push(c));
    fixture.detectChanges();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const button = (label: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find(b => (b.textContent ?? '').trim().startsWith(label)) as HTMLButtonElement | undefined;
  const paste = (value: string) => {
    component.onPaste();
    component.onInput(value);
    fixture.detectChanges();
  };

  beforeEach(() => {
    lookup = { all: jasmine.createSpy('all') };
    TestBed.configureTestingModule({
      imports: [JsonImportComponent],
      providers: [{ provide: CatalogLookupService, useValue: lookup }],
    });
  });

  it('starts with the format hint and a confirm button that is off', () => {
    create('grant');
    expect(component.check().state).toBe('empty');
    expect(text()).toContain('Each item is written out');
    expect(button('Import')?.disabled).toBeTrue();
  });

  it('checks a paste at once, with no waiting', () => {
    create('grant');
    paste(GOOD);
    expect(component.checking()).toBeFalse();
    expect(component.check().ok).toBeTrue();
    expect(text()).toContain('Ready — 2 items checked.');
    expect(text()).toContain('Longsword');
    expect(button('Import')?.disabled).toBeFalse();
  });

  it('checks typed edits once the typing pauses', fakeAsync(() => {
    create('grant');
    component.onInput('{ "items": [ { "key": "longsword" }');
    fixture.detectChanges();
    expect(component.checking()).toBeTrue();
    expect(text()).toContain('Checking…');
    expect(button('Import')?.disabled).toBeTrue();

    // Another keystroke inside the pause restarts the wait.
    tick(CHECK_DELAY_MS - 50);
    component.onInput(GOOD);
    tick(CHECK_DELAY_MS - 50);
    expect(component.checking()).toBeTrue();

    tick(50);
    fixture.detectChanges();
    expect(component.checking()).toBeFalse();
    expect(component.check().ok).toBeTrue();
  }));

  it('clears the verdict at once when the box is emptied', () => {
    create('grant');
    paste(GOOD);
    component.onInput('');
    fixture.detectChanges();
    expect(component.check().state).toBe('empty');
    expect(component.checking()).toBeFalse();
  });

  it('lists the lines that need fixing first and keeps the confirm button off', () => {
    create('grant');
    paste(JSON.stringify({ items: [{ key: 'longsword' }, { key: 'vorpal-blade' }, { name: 'Rope', quantity: 2 }] }));
    expect(text()).toContain('2 of 3 lines need fixing.');
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.ji-line'));
    expect(rows.map(r => r.classList.contains('bad'))).toEqual([true, true, false]);
    expect(rows[0].textContent).toContain('Unknown catalog key.');
    expect(rows[1].textContent).toContain('use "qty"');
    expect(button('Import')?.disabled).toBeTrue();
  });

  it('fixes a wrong key from its suggestion and re-checks', () => {
    create('grant');
    paste(TYPO);
    expect(component.check().ok).toBeFalse();
    button('Use "longsword"')?.click();
    fixture.detectChanges();
    expect(JSON.parse(component.draft())).toEqual({ items: [{ key: 'longsword' }] });
    expect(component.check().ok).toBeTrue();
    expect(text()).toContain('Ready — 1 item checked.');
  });

  it('emits the normalized payload and the catalog on confirm', () => {
    create('grant');
    paste(GOOD);
    button('Import')?.click();
    expect(confirmed.length).toBe(1);
    expect(confirmed[0].loot?.items.map(i => i.key ?? i.name)).toEqual(['longsword', 'Ruby']);
    expect(confirmed[0].shop).toBeNull();
    expect(confirmed[0].catalog.get('longsword')?.name).toBe('Longsword');
  });

  it('a confirm inside the typing pause still runs a fresh check first', fakeAsync(() => {
    create('grant');
    component.onInput(TYPO);
    component.confirm();
    expect(confirmed.length).toBe(0);
    expect(component.check().ok).toBeFalse();

    component.onInput(GOOD);
    component.confirm();
    expect(confirmed.length).toBe(1);
    tick(CHECK_DELAY_MS);
  }));

  it('does not confirm while the host is saving', () => {
    create('grant');
    paste(GOOD);
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    component.confirm();
    expect(confirmed.length).toBe(0);
    expect(button('Import')?.disabled).toBeTrue();
  });

  it('emits a shop payload for a shop', () => {
    create('shop');
    paste(JSON.stringify({ name: 'Smithy', items: [{ key: 'longsword', priceGp: 12 }] }));
    expect(text()).toContain('Smithy');
    button('Import')?.click();
    expect(confirmed[0].shop).toEqual({ name: 'Smithy', settlement: null, items: [{ key: 'longsword', priceGp: 12 }] });
    expect(confirmed[0].loot).toBeNull();
  });

  it('shows the host error until the text changes', () => {
    create('loot');
    paste(GOOD);
    button('Import')?.click();
    fixture.componentRef.setInput('serverError', 'Unknown catalog keys: longsword');
    fixture.detectChanges();
    expect(text()).toContain('Unknown catalog keys: longsword');

    paste(GOOD + ' ');
    expect(text()).not.toContain('Unknown catalog keys: longsword');
  });

  it('uses the given confirm label and offers Cancel only when asked', () => {
    create('grant');
    fixture.componentRef.setInput('confirmLabel', 'Add items');
    fixture.detectChanges();
    expect(button('Add items')).toBeDefined();
    expect(button('Cancel')).toBeUndefined();

    let cancelled = 0;
    component.cancelled.subscribe(() => cancelled++);
    fixture.componentRef.setInput('cancellable', true);
    fixture.detectChanges();
    button('Cancel')?.click();
    expect(cancelled).toBe(1);
  });

  // ── The catalog ───────────────────────────────────────────────────────────

  it('holds the check until the catalog has loaded, then runs it', () => {
    const loading = new Subject<CatalogItem[]>();
    create('grant', loading);
    paste(GOOD);
    expect(component.checking()).toBeTrue();
    expect(text()).toContain('Checking…');
    // The instructions do not depend on the catalog, so they never wait for it.
    expect(button('Copy AI instructions')?.disabled).toBeFalse();

    loading.next(CATALOG);
    loading.complete();
    fixture.detectChanges();
    expect(component.checking()).toBeFalse();
    expect(component.check().ok).toBeTrue();
  });

  it('says so when the catalog fails, checks without it, and can retry', () => {
    create('loot', throwError(() => new Error('network down')));
    expect(text()).toContain('Could not load the item catalog');
    paste(GOOD);
    // A loot key is left for the server; the paste is still usable.
    expect(component.check().ok).toBeTrue();
    expect(component.check().lines[0].unverified).toBeTrue();

    lookup.all.and.returnValue(of(CATALOG));
    button('Try again')?.click();
    fixture.detectChanges();
    expect(component.catalogState()).toBe('ready');
    expect(component.check().lines[0].unverified).toBeFalse();
    expect(text()).not.toContain('Could not load the item catalog');
  });

  // ── Copy AI instructions ──────────────────────────────────────────────────

  describe('Copy AI instructions', () => {
    let written: string[];

    beforeEach(() => {
      written = [];
      spyOnProperty(navigator, 'clipboard', 'get').and.returnValue(
        { writeText: (value: string) => { written.push(value); return Promise.resolve(); } } as Clipboard);
    });

    it('copies the instructions for this box and flashes Copied', fakeAsync(() => {
      create('shop');
      button('Copy AI instructions')?.click();
      fixture.detectChanges();
      expect(written.length).toBe(1);
      expect(written[0]).toContain('You are formatting a shop');
      expect(written[0]).toContain('"priceGp" — required');
      expect(text()).toContain('Copied ✓');

      tick(1500);
      fixture.detectChanges();
      expect(text()).toContain('Copy AI instructions');
    }));

    it('copies the loot and grant instructions for their boxes', () => {
      create('loot');
      component.copyBrief();
      expect(written[0]).toContain('You are formatting a loot list');
      expect(written[0]).toContain('"coinGp"');

      fixture.componentRef.setInput('kind', 'grant');
      component.copyBrief();
      expect(written[1]).toContain('handed to a character');
      expect(written[1]).not.toContain('coinGp');
    });

    it('never offers the AI a catalog to choose from, whatever the catalog holds', () => {
      create('grant');
      component.copyBrief();
      expect(written[0]).toContain('Write out EVERY item I give you');
      expect(written[0]).not.toContain('longsword —');
      expect(written[0]).not.toContain('CATALOG');
    });

    it('works while the catalog is missing — the instructions do not need it', () => {
      create('shop', throwError(() => new Error('network down')));
      expect(button('Copy AI instructions')?.disabled).toBeFalse();
      component.copyBrief();
      expect(written.length).toBe(1);
    });
  });
});
