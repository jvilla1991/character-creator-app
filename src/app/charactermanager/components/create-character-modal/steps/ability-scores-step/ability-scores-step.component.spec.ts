import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AbilityScoresStepComponent } from './ability-scores-step.component';

type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

const ABILITIES: readonly Ability[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

/** Final scores chosen to cover positive, zero, negative and odd-score rounding. */
const SCORES: Record<Ability, number> = { STR: 17, DEX: 10, CON: 8, INT: 15, WIS: 9, CHA: 20 };

/** What each row must show: the D&D modifier, never the score itself. */
const EXPECTED_MODS: Record<Ability, string> = {
  STR: '+3', DEX: '+0', CON: '-1', INT: '+2', WIS: '-1', CHA: '+5',
};

describe('AbilityScoresStepComponent', () => {
  let fixture: ComponentFixture<AbilityScoresStepComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AbilityScoresStepComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AbilityScoresStepComponent);
    fixture.componentRef.setInput('abilities', ABILITIES);
    fixture.componentRef.setInput('finalScore', (a: Ability) => SCORES[a]);
  });

  /** Reads each row's "= <score> <modifier>" cell, keyed by its ability label. */
  function finals(): Record<string, { score: string; mod: string }> {
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.ability-row'));
    const out: Record<string, { score: string; mod: string }> = {};
    for (const row of rows) {
      const label = row.querySelector('.ability-label')!.textContent!.replace('*', '').trim();
      const cell = row.querySelector('.ability-final');
      if (!cell) continue;
      const mod = cell.querySelector('em')!.textContent!.trim();
      const score = cell.textContent!.replace('=', '').replace(mod, '').trim();
      out[label] = { score, mod };
    }
    return out;
  }

  // Regression: the `modifier` pipe only signs a value that is already a
  // modifier. Piping the raw score into it rendered "17 +17" from #228 on.
  it('point buy shows each final score with its modifier, not the score again', () => {
    fixture.componentRef.setInput('abilityMethod', 'point-buy');
    fixture.detectChanges();

    const shown = finals();
    for (const a of ABILITIES) {
      expect(shown[a]).withContext(a).toEqual({ score: String(SCORES[a]), mod: EXPECTED_MODS[a] });
    }
  });

  it('standard array shows the modifier for every assigned ability', () => {
    fixture.componentRef.setInput('abilityMethod', 'standard');
    fixture.componentRef.setInput('assignments',
      { STR: 15, DEX: 10, CON: 8, INT: 14, WIS: 9, CHA: 13 });
    fixture.detectChanges();

    const shown = finals();
    for (const a of ABILITIES) {
      expect(shown[a]).withContext(a).toEqual({ score: String(SCORES[a]), mod: EXPECTED_MODS[a] });
    }
  });

  it('standard array hides the result for an ability not yet assigned', () => {
    fixture.componentRef.setInput('abilityMethod', 'standard');
    fixture.componentRef.setInput('assignments',
      { STR: 15, DEX: null, CON: null, INT: null, WIS: null, CHA: null });
    fixture.detectChanges();

    expect(Object.keys(finals())).toEqual(['STR']);
  });
});
