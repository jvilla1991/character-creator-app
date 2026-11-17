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
    service = jasmine.createSpyObj<RenownService>('RenownService', ['list', 'create', 'adjust']);
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
    expect(service.adjust).not.toHaveBeenCalled();
  });

  it('does not show a standing blurb under the title', () => {
    expect(element().textContent).not.toContain('standing with the powers of this realm');
  });

  it('draws the milestones as one scale with a segment per standing, sized by its range', () => {
    const segments = Array.from(element().querySelectorAll<HTMLElement>('.scale .segment'));
    expect(segments.length).toBe(8);
    expect(segments.map(segment => segment.style.flexGrow)).toEqual(['76', '15', '7', '5', '7', '15', '25', '51']);
  });

  it('fills a Neutral 0 bar to the centre', () => {
    const fill = element().querySelector<HTMLElement>('.faction-row .fill')!;
    expect(fill.style.width).toBe('50%');
  });

  it('disables only the outward adjustment at each absolute limit', () => {
    fixture.componentRef.setInput('canManage', true);
    component.factions.set([{ ...root, score: -100 }, { ...child, score: 100 }]);
    fixture.detectChanges();
    const buttons = Array.from(element().querySelectorAll<HTMLButtonElement>('.adjustments button'));
    expect(buttons.map(button => button.disabled)).toEqual([true, false, false, true]);
    component.adjust({ ...root, score: -100 }, -1);
    component.adjust({ ...child, score: 100 }, 1);
    expect(service.adjust).not.toHaveBeenCalled();
  });

  it('adjusts the selected subfaction without changing its parent', () => {
    fixture.componentRef.setInput('canManage', true); fixture.detectChanges();
    service.adjust.and.returnValue(of({ ...child, score: 4 }));
    element().querySelector<HTMLButtonElement>('[aria-label="Add 1 renown to Wardens"]')!.click();
    fixture.detectChanges();
    expect(service.adjust).toHaveBeenCalledWith(10, '7', 2, 1);
    expect(component.factions().map(row => row.score)).toEqual([0, 4]);
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

  it('keeps the score and allows retry when an adjustment fails', () => {
    fixture.componentRef.setInput('canManage', true); fixture.detectChanges();
    service.adjust.and.returnValue(throwError(() => new Error('offline')));
    component.adjust(root, 1);
    expect(component.factions()[0].score).toBe(0);
    expect(component.error()).toContain('Could not adjust');
    expect(component.saving()).toBeFalse();
  });

  it('cancels old reads and writes when a different character is selected', () => {
    const oldRead = new Subject<RenownFaction[]>();
    const oldWrite = new Subject<RenownFaction>();
    fixture.componentRef.setInput('canManage', true); fixture.detectChanges();
    service.list.and.returnValue(oldRead); component.load();
    service.adjust.and.returnValue(oldWrite); component.adjust(root, 1);
    service.list.and.returnValue(of([{ ...root, score: 25 }]));
    fixture.componentRef.setInput('pc', pc(11)); fixture.detectChanges();
    oldRead.next([{ ...root, score: -100 }]); oldWrite.next({ ...root, score: 1 });
    expect(component.factions()[0].score).toBe(25);
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
