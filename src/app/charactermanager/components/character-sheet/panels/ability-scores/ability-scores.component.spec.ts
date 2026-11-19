import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AbilityScoresComponent } from './ability-scores.component';
import { PC } from '../../../../models/pc';

describe('AbilityScoresComponent', () => {
  let fixture: ComponentFixture<AbilityScoresComponent>;
  let component: AbilityScoresComponent;

  const basePc = (): PC =>
    ({ id: 1, name: 'X', clazz: 'Fighter', level: 4, playerName: 'P', stats: { STR: 16, DEX: 12, CON: 14, INT: 8, WIS: 10, CHA: 13 } } as PC);

  beforeEach(() => {
    fixture = TestBed.createComponent(AbilityScoresComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('pc', basePc());
  });

  describe('requestScore', () => {
    it('label is the ability key itself (matches the backend diff vocabulary), min 1 max 30', () => {
      const emitted = jasmine.createSpy('emitted');
      component.editRequested.subscribe(emitted);

      component.requestScore('STR', 16);

      expect(emitted).toHaveBeenCalledWith(jasmine.objectContaining({ label: 'STR', value: 16, min: 1, max: 30 }));
    });

    it('apply is a pure builder for that ability', () => {
      let captured: any;
      component.editRequested.subscribe(r => (captured = r));

      component.requestScore('STR', 16);
      const result = captured.apply(18);

      expect(result.stats.STR).toBe(18);
      expect(component.pc().stats?.STR).toBe(16); // original untouched
      // Other abilities preserved.
      expect(result.stats.DEX).toBe(12);
    });
  });

  // --- score breakdown button ---

  describe('score breakdown', () => {
    const buttons = (): HTMLButtonElement[] =>
      Array.from(fixture.nativeElement.querySelectorAll('.ability-score .breakdown-btn'));

    it('makes each score a real button that asks the parent for that ability breakdown', () => {
      fixture.componentRef.setInput('breakdownEnabled', true);
      fixture.detectChanges();
      const requested: string[] = [];
      component.breakdownRequested.subscribe(stat => requested.push(stat));

      expect(buttons().map(b => b.textContent!.trim())).toEqual(['16', '12', '14', '8', '10', '13']);
      expect(buttons().every(b => b.tagName === 'BUTTON' && b.type === 'button')).toBeTrue();
      expect(fixture.nativeElement.querySelector('app-editable-number')).toBeNull();

      buttons()[0].click();
      buttons()[5].click();
      expect(requested).toEqual(['STR', 'CHA']);
    });

    it('says what the button does, and that it can be adjusted when it can', () => {
      fixture.componentRef.setInput('breakdownEnabled', true);
      fixture.detectChanges();
      expect(buttons()[0].getAttribute('aria-label')).toBe('Strength score 16. Show how it is worked out');
      expect(buttons()[0].classList).not.toContain('adjustable');

      fixture.componentRef.setInput('canAdjust', true);
      fixture.detectChanges();
      expect(buttons()[1].getAttribute('aria-label'))
        .toBe('Dexterity score 12. Show how it is worked out and adjust it');
      expect(buttons()[1].classList).toContain('adjustable');
    });

    it('a DM clicking a score opens the breakdown, not the type-a-score editor', () => {
      fixture.componentRef.setInput('breakdownEnabled', true);
      fixture.componentRef.setInput('canAdjust', true);
      fixture.componentRef.setInput('editable', true);
      fixture.detectChanges();
      let edits = 0;
      component.editRequested.subscribe(() => edits++);
      let requested: string | undefined;
      component.breakdownRequested.subscribe(stat => (requested = stat));

      buttons()[2].click();

      expect(requested).toBe('CON');
      expect(edits).toBe(0);
    });

    it('keeps the plain editable number where there is no breakdown (a follower)', () => {
      fixture.componentRef.setInput('editable', true);
      fixture.detectChanges();
      expect(buttons().length).toBe(0);
      expect(fixture.nativeElement.querySelectorAll('app-editable-number').length).toBe(6);
    });
  });
});
