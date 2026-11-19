import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ResourceCounterComponent } from './resource-counter.component';
import { ClassResourceState } from '../../../utils/class-resources';

describe('ResourceCounterComponent', () => {
  let fixture: ComponentFixture<ResourceCounterComponent>;
  let component: ResourceCounterComponent;
  let emitted: number[];

  const uses = (used: number, max = 3): ClassResourceState => ({
    key: 'secondWind', name: 'Second Wind', feature: 'Second Wind', max, shortRest: 'ONE', pool: false,
    unit: 'uses', used, remaining: max - used,
  });

  const pool = (used: number, max = 25): ClassResourceState => ({
    key: 'layOnHands', name: 'Lay On Hands', feature: 'Lay On Hands', max, shortRest: 'NONE', pool: true,
    unit: 'points', used, remaining: max - used,
  });

  function render(resource: ClassResourceState, editable = true, hideName = false): void {
    fixture.componentRef.setInput('resource', resource);
    fixture.componentRef.setInput('editable', editable);
    fixture.componentRef.setInput('hideName', hideName);
    fixture.detectChanges();
  }

  const q = (css: string) => fixture.debugElement.query(By.css(css));
  const text = (css: string): string => q(css)?.nativeElement.textContent.replace(/\s+/g, ' ').trim() ?? '';
  const button = (attr: 'data-spend' | 'data-regain'): HTMLButtonElement => q(`[${attr}]`).nativeElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ResourceCounterComponent] }).compileComponents();
    fixture = TestBed.createComponent(ResourceCounterComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.usedChange.subscribe(v => emitted.push(v));
  });

  describe('a handful of uses', () => {
    it('shows what is left of the maximum, a pip per use, and when it comes back', () => {
      render(uses(1));

      expect(text('.rc-name')).toBe('Second Wind');
      expect(text('.rc-count')).toBe('2 / 3 left');
      const pips = fixture.debugElement.queryAll(By.css('.rc-pip'));
      expect(pips.length).toBe(3);
      expect(pips.filter(p => p.nativeElement.classList.contains('filled')).length).toBe(2);
      expect(q('.rc-pips').attributes['aria-hidden']).toBe('true'); // the count is what is read out
      expect(text('.rc-recovery')).toBe('Short Rest: 1 back. Long Rest: all back.');
      expect(q('.rc-amount')).toBeNull(); // no amount field for single uses
    });

    it('Use spends one and Regain gives one back', () => {
      render(uses(1));

      button('data-spend').click();
      button('data-regain').click();

      expect(emitted).toEqual([2, 0]);
      expect(button('data-spend').textContent).toContain('Use');
      expect(button('data-spend').getAttribute('aria-label')).toBe('Use one Second Wind');
    });

    it('disables Use at none left and Regain at none spent', () => {
      render(uses(3));
      expect(button('data-spend').disabled).toBeTrue();
      expect(button('data-regain').disabled).toBeFalse();
      expect(q('.rc').nativeElement.classList).toContain('spent');
      button('data-spend').click();
      expect(emitted).toEqual([]);

      render(uses(0));
      expect(button('data-spend').disabled).toBeFalse();
      expect(button('data-regain').disabled).toBeTrue();
    });

    it('leaves the name out under a feature of the same name', () => {
      render(uses(0), true, true);
      expect(q('.rc-name')).toBeNull();
      expect(text('.rc-count')).toBe('3 / 3 left');
    });
  });

  describe('a pool', () => {
    const setAmount = (value: string): void => {
      const input: HTMLInputElement = q('.rc-amount').nativeElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    it('shows the count with its unit and no pips', () => {
      render(pool(10));

      expect(text('.rc-count')).toBe('15 / 25 points left');
      expect(fixture.debugElement.queryAll(By.css('.rc-pip')).length).toBe(0);
      expect(text('.rc-recovery')).toBe('All back on a Long Rest.');
    });

    it('spends and regains several at once through the amount field', () => {
      render(pool(10));

      setAmount('12');
      button('data-spend').click();
      button('data-regain').click();

      expect(emitted).toEqual([22, 0]); // 10 + 12 spent; 10 - 12 floors at nothing spent
      expect(button('data-spend').getAttribute('aria-label')).toBe('Spend 12 Lay On Hands');
    });

    it('never spends past the pool, and treats a bad amount as one', () => {
      render(pool(20));

      setAmount('500');
      button('data-spend').click();
      expect(emitted).toEqual([25]);

      setAmount('abc');
      button('data-spend').click();
      setAmount('0');
      button('data-spend').click();
      expect(emitted).toEqual([25, 21, 21]);
    });

    it('labels the amount field for assistive tech', () => {
      render(pool(0));
      const input: HTMLInputElement = q('.rc-amount').nativeElement;
      expect(q(`label[for="${input.id}"]`).nativeElement.textContent).toContain('Amount of Lay On Hands');
    });
  });

  it('is read-only for a viewer who cannot edit', () => {
    render(uses(1), false);

    expect(q('.rc-actions')).toBeNull();
    expect(text('.rc-count')).toBe('2 / 3 left');
    component.spend();
    component.regain();
    expect(emitted).toEqual([]);
  });

  it('gives its buttons finger-sized targets', () => {
    render(uses(1));
    expect(parseFloat(getComputedStyle(button('data-spend')).minHeight)).toBeGreaterThanOrEqual(44);
    expect(parseFloat(getComputedStyle(button('data-regain')).minHeight)).toBeGreaterThanOrEqual(44);
  });
});
