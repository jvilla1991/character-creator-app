import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { PC } from '../../../../models/pc';
import { RenownFaction } from '../../../../models/renown';
import { RenownService } from '../../../../services/renown.service';
import { RenownPanelComponent } from './renown-panel.component';

describe('RenownPanelComponent', () => {
  let fixture: ComponentFixture<RenownPanelComponent>;
  let component: RenownPanelComponent;
  let service: jasmine.SpyObj<RenownService>;
  const pc = (id: number): PC => ({ id, name: 'Aria', campaignId: '7' } as PC);
  const root: RenownFaction = { id: 1, parentId: null, name: 'Silver Covenant', score: 0 };
  const child: RenownFaction = { id: 2, parentId: 1, name: 'Wardens', score: 3 };
  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    service = jasmine.createSpyObj<RenownService>('RenownService', ['list', 'create', 'saveAll']);
    service.list.and.returnValue(of([root, child]));
    await TestBed.configureTestingModule({
      imports: [RenownPanelComponent], providers: [{ provide: RenownService, useValue: service }],
    }).compileComponents();
    fixture = TestBed.createComponent(RenownPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('pc', pc(10));
    fixture.detectChanges();
  });

  it('renders player standings and hierarchy without mutation controls', () => {
    expect(element().textContent).toContain('Silver Covenant');
    expect(element().textContent).toContain('Friendly');
    expect(element().querySelectorAll('[role="meter"]').length).toBe(2);
    expect(element().querySelector('.adjustments')).toBeNull();
    expect(element().textContent).not.toContain('+ Add faction');
    const toggle = element().querySelector<HTMLButtonElement>('.expand')!;
    toggle.click(); fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(element().querySelector('.subfaction')).toBeNull();
    component.name = 'Forbidden'; component.add(); component.adjust(root, 1);
    expect(service.create).not.toHaveBeenCalled();
    expect(component.dirty).toBeFalse();
    expect(element().querySelector('.unsaved-bar')).toBeNull();
  });

  it('does not show a standing blurb under the title', () => {
    expect(element().textContent).not.toContain('standing with the powers of this realm');
  });

  it('draws the milestones as one scale with a segment per standing, sized by its range', () => {
    const segments = Array.from(element().querySelectorAll<HTMLElement>('.scale .segment'));
    expect(segments.length).toBe(8);
    expect(segments.map(segment => segment.style.flexGrow)).toEqual(['36', '15', '7', '5', '7', '15', '25', '11']);
  });

  it('labels the scale with where each standing begins', () => {
    const labels = Array.from(element().querySelectorAll<HTMLElement>('.scale-thresholds span'));
    expect(labels.map(label => label.textContent!.trim())).toEqual(['−25', '−10', '−3', '+3', '+10', '+25', '+50']);
    expect(labels.filter(label => label.classList.contains('neg')).length).toBe(3);
  });

  it('lists every standing best-first with its threshold and note', () => {
    const rows = Array.from(element().querySelectorAll<HTMLTableRowElement>('.standings-table tbody tr'));
    const cells = (row: HTMLTableRowElement) => Array.from(row.cells).map(cell => cell.textContent!.trim());
    expect(rows.map(row => cells(row)[0])).toEqual(
      ['Exalted', 'Revered', 'Honored', 'Friendly', 'Neutral', 'Unfriendly', 'Hostile', 'Hated']);
    expect(rows.map(row => cells(row)[1])).toEqual(['50+', '25+', '10+', '3+', '0', '−3', '−10', '−25']);
    expect(cells(rows[2])[2]).toContain('10% discount');
    expect(rows[0].querySelector('th')!.style.color).toBe('var(--renown-exalted)');
  });

  it('keeps the empty state to a plain line for the DM', () => {
    service.list.and.returnValue(of([]));
    fixture.componentRef.setInput('canManage', true);
    component.load(); fixture.detectChanges();
    expect(element().querySelector('.renown-empty')!.textContent!.trim()).toBe('No factions yet.');
  });

  it('tells a player the DM adds factions when there are none', () => {
    service.list.and.returnValue(of([]));
    component.load(); fixture.detectChanges();
    expect(element().querySelector('.renown-empty')!.textContent!.trim())
      .toBe('No factions yet. Your DM can add factions for this campaign.');
  });

  it('fills a below-Neutral bar from the right', () => {
    component.factions.set([{ ...root, score: -17 }, { ...child, score: 7 }]);
    fixture.detectChanges();
    const [hostile, friendly] = Array.from(element().querySelectorAll<HTMLElement>('.faction-row .fill'));
    expect(hostile.classList).toContain('from-right');
    expect(hostile.style.width).toBe('50%');
    expect(friendly.classList).not.toContain('from-right');
  });

  it('fills a Neutral 0 bar to the centre', () => {
    const fill = element().querySelector<HTMLElement>('.faction-row .fill')!;
    expect(fill.style.width).toBe('50%');
  });

  it('disables only the outward adjustment at each absolute limit', () => {
    fixture.componentRef.setInput('canManage', true);
    const low = { ...root, score: -100 }, high = { ...child, score: 100 };
    component.factions.set([low, high]);
    fixture.detectChanges();
    const buttons = Array.from(element().querySelectorAll<HTMLButtonElement>('.adjustments button'));
    expect(buttons.map(button => button.disabled)).toEqual([true, false, false, true]);
    component.adjust(low, -1);
    component.adjust(high, 1);
    expect(component.dirty).toBeFalse();
  });

  it('keeps +/- clicks local and sends them all in one save', () => {
    fixture.componentRef.setInput('canManage', true); fixture.detectChanges();
    expect(element().querySelector('.unsaved-bar')).toBeNull();
    const plus = element().querySelector<HTMLButtonElement>('[aria-label="Add 1 renown to Wardens"]')!;
    plus.click(); plus.click();
    component.adjust(root, -1);
    fixture.detectChanges();
    expect(service.saveAll).not.toHaveBeenCalled();
    // The unsaved scores show straight away; the saved ones are untouched.
    expect([component.scoreOf(root), component.scoreOf(child)]).toEqual([-1, 5]);
    expect(component.factions().map(row => row.score)).toEqual([0, 3]);
    expect(element().querySelectorAll('.faction-row.unsaved').length).toBe(2);

    service.saveAll.and.returnValue(of([{ ...root, score: -1 }, { ...child, score: 5 }]));
    Array.from(element().querySelectorAll<HTMLButtonElement>('.unsaved-bar button'))
      .find(button => button.textContent!.trim() === 'Save')!.click();
    fixture.detectChanges();
    expect(service.saveAll).toHaveBeenCalledOnceWith(10, '7', jasmine.arrayWithExactContents([
      { factionId: 1, delta: -1 }, { factionId: 2, delta: 2 }]));
    expect(component.factions().map(row => row.score)).toEqual([-1, 5]);
    expect(component.dirty).toBeFalse();
    expect(element().querySelector('.unsaved-bar')).toBeNull();
  });

  it('has nothing to save once a row is stepped back to its saved score', () => {
    fixture.componentRef.setInput('canManage', true); fixture.detectChanges();
    component.adjust(root, 1); component.adjust(root, -1);
    expect(component.dirty).toBeFalse();
    component.save();
    expect(service.saveAll).not.toHaveBeenCalled();
  });

  it('discard throws the unsaved changes away', () => {
    fixture.componentRef.setInput('canManage', true); fixture.detectChanges();
    component.adjust(child, 1);
    component.discard();
    expect(component.scoreOf(child)).toBe(3);
    expect(component.dirty).toBeFalse();
  });

  it('creates a zero-score child under the selected faction and expands its parent', () => {
    fixture.componentRef.setInput('canManage', true); fixture.detectChanges();
    service.create.and.returnValue(of({ ...child, id: 3, name: 'Scouts', score: 0 }));
    component.name = '  Scouts  '; component.parentId = root.id; component.formOpen = true;
    component.collapsed.add(root.id); component.add();
    expect(service.create).toHaveBeenCalledWith(10, '7', 'Scouts', 1);
    expect(component.factions()[2].score).toBe(0);
    expect(component.collapsed.has(1)).toBeFalse();
    expect(component.formOpen).toBeFalse();
  });

  it('keeps the unsaved changes and allows retry when a save fails', () => {
    fixture.componentRef.setInput('canManage', true); fixture.detectChanges();
    service.saveAll.and.returnValue(throwError(() => new Error('offline')));
    component.adjust(root, 1);
    component.save();
    expect(component.factions()[0].score).toBe(0);
    expect(component.scoreOf(root)).toBe(1);
    expect(component.error()).toContain('Could not save');
    expect(component.saving()).toBeFalse();
  });

  it('cancels old reads and writes when a different character is selected', () => {
    const oldRead = new Subject<RenownFaction[]>();
    const oldWrite = new Subject<RenownFaction[]>();
    fixture.componentRef.setInput('canManage', true); fixture.detectChanges();
    service.list.and.returnValue(oldRead); component.load();
    component.adjust(root, 1);
    service.saveAll.and.returnValue(oldWrite); component.save();
    service.list.and.returnValue(of([{ ...root, score: 25 }]));
    fixture.componentRef.setInput('pc', pc(11)); fixture.detectChanges();
    oldRead.next([{ ...root, score: -100 }]); oldWrite.next([{ ...root, score: 1 }]);
    expect(component.factions()[0].score).toBe(25);
    expect(component.dirty).toBeFalse();
    expect(component.saving()).toBeFalse();
    expect(oldRead.observed).toBeFalse(); expect(oldWrite.observed).toBeFalse();
  });

  it('cancels pending requests when the tab is destroyed', () => {
    const pending = new Subject<RenownFaction[]>();
    service.list.and.returnValue(pending); component.load();
    fixture.destroy();
    expect(pending.observed).toBeFalse();
  });
});
