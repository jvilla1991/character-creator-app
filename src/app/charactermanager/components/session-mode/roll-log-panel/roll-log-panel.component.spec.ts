import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RollLogPanelComponent } from './roll-log-panel.component';
import { SessionRollView } from '../../../models/session';

describe('RollLogPanelComponent', () => {
  let component: RollLogPanelComponent;
  let fixture: ComponentFixture<RollLogPanelComponent>;

  const roll = (overrides: Partial<SessionRollView> = {}): SessionRollView => ({
    rollId: 1,
    participantId: 5,
    rollerName: 'Gorath',
    mine: false,
    groups: [{ sides: 6, rolls: [4, 2], subtotal: 6 }],
    grandTotal: 6,
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RollLogPanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RollLogPanelComponent);
    component = fixture.componentInstance;
  });

  it('renders one row per roll', () => {
    component.rolls = [roll({ rollId: 1 }), roll({ rollId: 2, rollerName: 'Pip' })];
    fixture.detectChanges();

    const rows = fixture.debugElement.queryAll(By.css('.roll-row'));
    expect(rows.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Gorath');
    expect(fixture.nativeElement.textContent).toContain('Pip');
  });

  it('shows the empty state with no rolls', () => {
    component.rolls = [];
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.roll-log-empty'))).toBeTruthy();
    expect(fixture.debugElement.queryAll(By.css('.roll-row')).length).toBe(0);
  });

  it('toggle() hides and shows the body', () => {
    component.rolls = [roll()];
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.roll-log-body'))).toBeTruthy();

    component.toggle();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.roll-log-body'))).toBeFalsy();

    component.toggle();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.roll-log-body'))).toBeTruthy();
  });

  it('renders the die breakdown and grand total', () => {
    component.rolls = [roll({ groups: [{ sides: 20, rolls: [15], subtotal: 15 }], grandTotal: 15 })];
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('1d20');
    expect(text).toContain('15');
  });
});
