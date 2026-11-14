import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReviewStepComponent } from './review-step.component';

type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

const ABILITIES: readonly Ability[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const SCORES: Record<Ability, number> = { STR: 17, DEX: 10, CON: 8, INT: 15, WIS: 9, CHA: 20 };
const EXPECTED_MODS: Record<Ability, string> = {
  STR: '+3', DEX: '+0', CON: '-1', INT: '+2', WIS: '-1', CHA: '+5',
};

describe('ReviewStepComponent', () => {
  let fixture: ComponentFixture<ReviewStepComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewStepComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ReviewStepComponent);
    fixture.componentRef.setInput('abilities', ABILITIES);
    fixture.componentRef.setInput('finalScore', (a: Ability) => SCORES[a]);
    fixture.detectChanges();
  });

  // Regression: the `modifier` pipe only signs a value that is already a
  // modifier. Piping the raw score into it rendered "17 +17" from #228 on.
  it('ability grid shows each score with its modifier, not the score again', () => {
    const cells: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.review-ability'));
    expect(cells.length).toBe(6);

    for (const cell of cells) {
      const a = cell.querySelector('.review-ability-label')!.textContent!.trim() as Ability;
      expect(cell.querySelector('.review-ability-score')!.textContent!.trim())
        .withContext(a).toBe(String(SCORES[a]));
      expect(cell.querySelector('.review-ability-mod')!.textContent!.trim())
        .withContext(a).toBe(EXPECTED_MODS[a]);
    }
  });
});
