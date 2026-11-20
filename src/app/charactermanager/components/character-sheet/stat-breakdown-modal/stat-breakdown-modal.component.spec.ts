import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatBreakdownModalComponent, StatBreakdownSave } from './stat-breakdown-modal.component';
import { StatBreakdown } from '../../../utils/stat-breakdown';

/** Chain Shirt 13 + Dex 2 + Shield 2 = 17, plus whatever the test adds. */
const breakdown = (overrides: Partial<StatBreakdown> = {}): StatBreakdown => ({
  stat: 'ac',
  auto: [
    { label: 'Chain Shirt', value: 13 },
    { label: 'Dexterity', value: 2 },
    { label: 'Shield', value: 2 },
  ],
  adjustments: [],
  removed: [],
  unlabelled: 0,
  total: 17,
  ...overrides,
});

/** The same armour with the Dexterity line taken out: 13 + 2 = 15. */
const withoutDex = (): StatBreakdown => breakdown({
  auto: [
    { label: 'Chain Shirt', value: 13 },
    { label: 'Dexterity', value: 2, removed: true },
    { label: 'Shield', value: 2 },
  ],
  removed: ['Dexterity'],
  total: 15,
});

describe('StatBreakdownModalComponent', () => {
  let fixture: ComponentFixture<StatBreakdownModalComponent>;
  let component: StatBreakdownModalComponent;

  const open = (b: StatBreakdown, editable: boolean): void => {
    fixture = TestBed.createComponent(StatBreakdownModalComponent);
    component = fixture.componentInstance;
    component.breakdown = b;
    component.editable = editable;
    fixture.detectChanges();
  };

  /** The rows inside a block, each as "label value" (a row's small-print note left out). */
  const text = (testId: string): string => {
    const block: HTMLElement | null = fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
    if (!block) return '';
    const rows = block.matches('.breakdown-line') ? [block] : Array.from(block.querySelectorAll('.breakdown-line'));
    return rows.map(row => {
      const label = (row.querySelector('.line-label')?.firstChild?.textContent ?? '').trim();
      const value = (row.querySelector('.line-value')?.textContent ?? '').trim();
      return `${label} ${value}`;
    }).join(' ');
  };

  const click = (label: string): void => {
    const button = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === label);
    button!.click();
    fixture.detectChanges();
  };

  const saved = (): StatBreakdownSave | undefined => {
    let result: StatBreakdownSave | undefined;
    component.save.subscribe(r => (result = r));
    component.submit();
    return result;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [StatBreakdownModalComponent] });
  });

  // --- what everyone sees ---

  it('lists the automatic lines: the first as a starting value, the rest signed', () => {
    open(breakdown(), false);
    expect(text('auto-lines')).toBe('Chain Shirt 13 Dexterity +2 Shield +2');
    expect(text('total')).toBe('Total 17');
  });

  it('shows a player the DM lines, read-only, with no way to change them', () => {
    open(breakdown({ adjustments: [{ value: 1, label: 'Taunka' }], total: 18 }), false);
    expect(text('adjust-lines')).toBe('Taunka +1');
    expect(text('total')).toBe('Total 18');
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    expect(fixture.nativeElement.querySelector('.btn.primary')).toBeNull();
  });

  it('shows a player an unlabelled amount as part of the total', () => {
    open(breakdown({ unlabelled: 3, total: 20 }), false);
    expect(text('unlabelled')).toBe('Unlabelled +3');
    expect(text('total')).toBe('Total 20');
  });

  it('leaves the adjustments section out for a player when there is nothing in it', () => {
    open(breakdown(), false);
    expect(fixture.nativeElement.querySelector('[data-testid="adjust-lines"]')).toBeNull();
  });

  it('a player cannot save, even by calling submit', () => {
    open(breakdown({ adjustments: [{ value: 1, label: 'Taunka' }], total: 18 }), false);
    component.drafts = [];
    expect(saved()).toBeUndefined();
  });

  // --- one dialog for every number ---

  it('opens a spell level\'s slot maximum with its own title, lines and words', () => {
    const slots: StatBreakdown = {
      stat: 'slot3', auto: [{ label: 'Class table', value: 2 }],
      adjustments: [{ value: 1, label: 'Pearl of Power' }], removed: [], unlabelled: 0, total: 3,
    };

    open(slots, false);
    expect(fixture.nativeElement.querySelector('h2').textContent).toContain('3rd-level spell slots');
    expect(text('auto-lines')).toBe('Class table 2');
    expect(text('adjust-lines')).toBe('Pearl of Power +1');
    expect(text('total')).toBe('Total 3');
  });

  it('shows no explaining sentence, column heads or Calculated heading, for the DM or anyone', () => {
    for (const editable of [false, true]) {
      open(breakdown({ adjustments: [{ value: 1, label: 'Taunka' }], total: 18 }), editable);
      const words: string = fixture.nativeElement.textContent;
      expect(words).not.toContain('Calculated');
      expect(words).not.toContain('Add what the sheet does not work out');
      expect(words).not.toContain('These lines stay');
      expect(words).not.toContain('Amount');
      expect(fixture.nativeElement.querySelector('.field-hint')).toBeNull();
      const headings = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('h3')).map(h => h.textContent?.trim());
      expect(headings).toEqual(['Adjustments']);
    }
  });

  it('still names each typed line\'s fields for a screen reader', () => {
    open(breakdown({ adjustments: [{ value: 1, label: 'Taunka' }], total: 18 }), true);
    expect(fixture.nativeElement.querySelector('.adjust-amount').getAttribute('aria-label')).toBe('Amount for line 1');
    expect(fixture.nativeElement.querySelector('.adjust-label').getAttribute('aria-label')).toBe('Label for line 1');
  });

  // --- what the DM can do ---

  it('starts the DM on the saved lines, with nothing to save yet', () => {
    open(breakdown({ adjustments: [{ value: 1, label: 'Taunka' }], total: 18 }), true);
    expect(component.drafts).toEqual([{ value: 1, label: 'Taunka' }]);
    expect(component.canSave).toBeFalse();
    expect(fixture.nativeElement.querySelectorAll('.adjust-row input').length).toBe(2);
  });

  it('adds a line, counts it in the live total and saves it trimmed', () => {
    open(breakdown(), true);
    component.addLine();
    expect(component.canSave).toBeFalse(); // no label yet
    expect(component.lineProblem).toContain('label');

    component.drafts[0].label = '  Taunka ';
    expect(component.total).toBe(18);
    expect(component.lineProblem).toBeNull();
    expect(saved()).toEqual({ lines: [{ value: 1, label: 'Taunka' }], keepUnlabelled: true, removed: [], fromBase: 0 });
  });

  it('removes a line', () => {
    open(breakdown({ adjustments: [{ value: 1, label: 'Taunka' }], total: 18 }), true);
    component.removeLine(0);
    expect(component.total).toBe(17);
    expect(saved()).toEqual({ lines: [], keepUnlabelled: true, removed: [], fromBase: 0 });
  });

  it('refuses a line with a zero, missing or fractional amount', () => {
    open(breakdown(), true);
    component.addLine();
    component.drafts[0].label = 'Taunka';

    for (const value of [0, null, 1.5]) {
      component.drafts[0].value = value;
      expect(component.canSave).withContext(String(value)).toBeFalse();
      expect(component.lineProblem).withContext(String(value)).toContain('whole number');
    }
    expect(component.total).toBe(17); // an unfinished line counts as nothing
  });

  it('refuses an amount beyond the limit', () => {
    open(breakdown(), true);
    component.addLine(100);
    component.drafts[0].label = 'Too much';
    expect(component.canSave).toBeFalse();
    expect(component.lineProblem).toContain('99');
  });

  it('accepts a negative line', () => {
    open(breakdown(), true);
    component.addLine(-2);
    component.drafts[0].label = 'Cursed';
    expect(component.total).toBe(15);
    expect(saved()).toEqual({ lines: [{ value: -2, label: 'Cursed' }], keepUnlabelled: true, removed: [], fromBase: 0 });
  });

  it('stops offering more lines at the limit', () => {
    open(breakdown({ adjustments: Array.from({ length: 12 }, (_, i) => ({ value: 1, label: `L${i}` })), total: 29 }), true);
    expect(component.canAddLine).toBeFalse();
    component.addLine();
    expect(component.drafts.length).toBe(12);
  });

  // --- taking a calculated line out of the total ---

  /** The Remove / Restore buttons on the calculated lines, by their visible word. */
  const lineActions = (): string[] =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('[data-testid="auto-lines"] button'))
      .map(b => b.textContent!.trim());
  const notCounted = (): string[] =>
    Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('[data-testid="not-counted"]'))
      .map(el => el.textContent!.trim());
  /** Press the Remove / Restore button on the calculated line at `index`. */
  const pressLineAction = (index: number): void => {
    const row: HTMLElement = fixture.nativeElement.querySelectorAll('[data-testid="auto-lines"] li')[index];
    row.querySelector('button')!.click();
    fixture.detectChanges();
  };

  it('offers the DM a Remove control on every calculated line', () => {
    open(breakdown(), true);
    expect(lineActions()).toEqual(['Remove', 'Remove', 'Remove']);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="auto-lines"] button');
    expect(button.getAttribute('aria-label')).toBe('Remove the Chain Shirt line from the total');
    expect(button.type).toBe('button');
  });

  it('gives a player no way to take a calculated line out', () => {
    open(breakdown(), false);
    expect(lineActions()).toEqual([]);
    component.removeAutoLine(1);
    expect(component.removed).toEqual([]);
  });

  it('offers no Remove control on a number whose lines cannot be taken out (a spell level)', () => {
    open({
      stat: 'slot3', auto: [{ label: 'Class table', value: 2 }],
      adjustments: [], removed: [], unlabelled: 0, total: 2,
    }, true);
    expect(lineActions()).toEqual([]);
    component.removeAutoLine(0);
    expect(component.removed).toEqual([]);
    expect(component.total).toBe(2);
  });

  it('removing a line keeps it listed as not counted, drops it from the total and offers Restore', () => {
    open(breakdown(), true);
    pressLineAction(1);

    expect(text('auto-lines')).toBe('Chain Shirt 13 Dexterity +2 Shield +2'); // still listed
    const row: HTMLElement = fixture.nativeElement.querySelectorAll('[data-testid="auto-lines"] li')[1];
    expect(row.classList).toContain('not-counted');
    expect(notCounted()).toEqual(['Not counted.']);                              // said in words, not only by looks
    expect(lineActions()).toEqual(['Remove', 'Restore', 'Remove']);
    expect(text('total')).toBe('Total 15');
    expect(fixture.nativeElement.querySelector('[data-testid="unlabelled"]')).toBeNull();
    expect(saved()).toEqual({ lines: [], keepUnlabelled: true, removed: ['Dexterity'], fromBase: 0 });
  });

  it('restoring a line counts it again', () => {
    open(withoutDex(), true);
    expect(text('total')).toBe('Total 15');
    expect(component.canSave).toBeFalse(); // opened as saved

    const restore = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === 'Restore')!;
    expect(restore.getAttribute('aria-label')).toBe('Count the Dexterity line again');
    pressLineAction(1);

    expect(notCounted()).toEqual([]);
    expect(text('total')).toBe('Total 17');
    expect(saved()).toEqual({ lines: [], keepUnlabelled: true, removed: [], fromBase: 0 });
  });

  it('has nothing to save once a removal is undone again', () => {
    open(breakdown(), true);
    component.removeAutoLine(2);
    expect(component.canSave).toBeTrue();
    component.restoreAutoLine(2);
    expect(component.canSave).toBeFalse();
    expect(component.total).toBe(17);
  });

  it('carries a removal whose line is not there right now through a save', () => {
    open(breakdown({ removed: ['Plate'] }), true);
    expect(notCounted()).toEqual([]);
    component.removeAutoLine(1);
    expect(saved()).toEqual({ lines: [], keepUnlabelled: true, removed: ['Plate', 'Dexterity'], fromBase: 0 });
  });

  it('removes one of two lines with the same name at a time', () => {
    open(breakdown({
      auto: [{ label: 'Unarmored', value: 10 }, { label: 'Shield', value: 2 }, { label: 'Shield', value: 2 }],
      total: 14,
    }), true);
    component.removeAutoLine(2);
    expect(component.total).toBe(12);
    expect(component.autoLines.filter(line => line.removed).length).toBe(1);
    component.removeAutoLine(2);
    expect(component.total).toBe(10);
  });

  it('shows a player a removed line as not counted, with who removed it and no controls', () => {
    open(withoutDex(), false);
    expect(text('auto-lines')).toBe('Chain Shirt 13 Dexterity +2 Shield +2');
    expect(notCounted()).toEqual(['Not counted. Your DM removed this line.']);
    expect(lineActions()).toEqual([]);
    expect(text('total')).toBe('Total 15');
  });

  it('a removal does not disturb an unlabelled amount', () => {
    open(breakdown({ unlabelled: 3, total: 20 }), true);
    pressLineAction(2);
    expect(text('unlabelled')).toBe('Unlabelled +3');
    expect(text('total')).toBe('Total 18');
    expect(saved()).toEqual({ lines: [], keepUnlabelled: true, removed: ['Shield'], fromBase: 0 });
  });

  // --- the unlabelled rest of an older hand edit ---

  it('keeps an unlabelled amount in the total until the DM deals with it', () => {
    open(breakdown({ unlabelled: 3, total: 20 }), true);
    expect(text('unlabelled')).toBe('Unlabelled +3');
    expect(component.total).toBe(20);

    component.addLine();
    component.drafts[0].label = 'Taunka';
    expect(component.total).toBe(21);
    expect(saved()).toEqual({ lines: [{ value: 1, label: 'Taunka' }], keepUnlabelled: true, removed: [], fromBase: 0 });
  });

  it('"Label it" turns the unlabelled amount into a line without moving the total', () => {
    open(breakdown({ unlabelled: 3, total: 20 }), true);
    component.labelUnlabelled();
    expect(component.drafts).toEqual([{ value: 3, label: '' }]);
    expect(component.total).toBe(20);
    expect(component.canSave).toBeFalse(); // still needs its label

    component.drafts[0].label = 'Unarmored Defense';
    expect(saved()).toEqual({ lines: [{ value: 3, label: 'Unarmored Defense' }], keepUnlabelled: false, removed: [], fromBase: 0 });
  });

  it('"Remove it" drops the unlabelled amount from the total', () => {
    open(breakdown({ unlabelled: 3, total: 20 }), true);
    click('Remove it');
    expect(component.total).toBe(17);
    expect(text('total')).toBe('Total 17');
    expect(fixture.nativeElement.querySelector('[data-testid="unlabelled"]')).toBeNull();
    expect(saved()).toEqual({ lines: [], keepUnlabelled: false, removed: [], fromBase: 0 });
  });

  // --- lifetime ---

  it('reads the breakdown once: a later refresh does not throw away what the DM typed', () => {
    open(breakdown(), true);
    component.addLine();
    component.drafts[0].label = 'Taunka';

    component.breakdown = { ...component.breakdown };
    fixture.detectChanges();

    expect(component.drafts).toEqual([{ value: 1, label: 'Taunka' }]);
  });

  it('cancel closes without saving', () => {
    open(breakdown(), true);
    let closed = false;
    let savedAnything = false;
    component.close.subscribe(() => (closed = true));
    component.save.subscribe(() => (savedAnything = true));
    component.cancel();
    expect(closed).toBeTrue();
    expect(savedAnything).toBeFalse();
  });

  // --- a number with a base line (an ability score) ---

  describe('ability score', () => {
    /** Strength 17: a base of 14, the Soldier background's +2 and a level increase. */
    const strength = (overrides: Partial<StatBreakdown> = {}): StatBreakdown => ({
      stat: 'STR',
      auto: [{ label: 'Base score', value: 14 }],
      adjustments: [{ value: 2, label: 'Soldier' }, { value: 1, label: 'Level 4 Increase' }],
      removed: [],
      unlabelled: 0,
      total: 17,
      ...overrides,
    });
    /** Strength 17 with nothing recorded yet: the whole score is the base. */
    const unexplained = (): StatBreakdown => strength({ auto: [{ label: 'Base score', value: 17 }], adjustments: [] });

    const problem = (): string =>
      (fixture.nativeElement.querySelector('[data-testid="problem"]')?.textContent ?? '').trim();
    const buttonNamed = (label: string): HTMLButtonElement | undefined =>
      Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
        .find(b => b.textContent?.trim() === label);

    it('shows a player the base score, the lines and the total, read-only', () => {
      open(strength(), false);
      expect(fixture.nativeElement.querySelector('.modal-title, h2')?.textContent ?? fixture.nativeElement.textContent)
        .toContain('Strength');
      expect(text('auto-lines')).toBe('Base score 14');
      expect(text('adjust-lines')).toBe('Soldier +2 Level 4 Increase +1');
      expect(text('total')).toBe('Total 17');
      expect(fixture.nativeElement.querySelector('input')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="unlabelled"]')).toBeNull();
    });

    it('never offers to remove the base score', () => {
      open(strength(), true);
      expect(fixture.nativeElement.querySelectorAll('[data-testid="auto-lines"] button').length).toBe(0);
      component.removeAutoLine(0);
      expect(component.removed).toEqual([]);
    });

    it('a new line raises the score', () => {
      open(strength(), true);
      component.addLine(2);
      component.drafts[2].label = 'Belt of Strength';
      expect(component.total).toBe(19);
      expect(saved()).toEqual({
        lines: [{ value: 2, label: 'Soldier' }, { value: 1, label: 'Level 4 Increase' }, { value: 2, label: 'Belt of Strength' }],
        keepUnlabelled: true, removed: [], fromBase: 0,
      });
    });

    it('"Label part of the base score" takes the amount out of the base, so the total stays', () => {
      open(unexplained(), true);
      click('Label part of the base score');

      expect(component.drafts).toEqual([{ value: 1, label: '', fromBase: true }]);
      expect(text('auto-lines')).toBe('Base score 16');
      expect(text('total')).toBe('Total 17');
      expect(fixture.nativeElement.querySelector('[data-testid="from-base"]').textContent.trim())
        .toBe('Line 1 comes out of the base score. The total stays the same.');
      expect(component.canSave).toBeFalse(); // still needs its label

      component.drafts[0].label = 'Level 4 Increase';
      component.drafts[0].value = 2;
      expect(component.autoLines[0].value).toBe(15);
      expect(component.total).toBe(17);
      expect(saved()).toEqual({
        lines: [{ value: 2, label: 'Level 4 Increase' }], keepUnlabelled: true, removed: [], fromBase: 2,
      });
    });

    it('can label part of the base and add something new in one go', () => {
      open(unexplained(), true);
      component.labelPartOfBase();
      component.drafts[0].label = 'Soldier';
      component.addLine(2);
      component.drafts[1].label = 'Belt of Strength';
      expect(component.autoLines[0].value).toBe(16);
      expect(component.total).toBe(19);
      expect(saved()?.fromBase).toBe(1);
    });

    it('gives the amount back to the base when the line is removed again before saving', () => {
      open(unexplained(), true);
      component.labelPartOfBase();
      component.removeLine(0);
      expect(component.autoLines[0].value).toBe(17);
      expect(component.total).toBe(17);
      expect(component.canSave).toBeFalse();
    });

    it('does not offer to label part of a base where there is none (Armor Class)', () => {
      open(breakdown(), true);
      expect(buttonNamed('Label part of the base score')).toBeUndefined();
      component.labelPartOfBase();
      expect(component.drafts).toEqual([]);
    });

    it('treats a spell level as neither: the class table is no base to label and has no range', () => {
      open({
        stat: 'slot3', auto: [{ label: 'Class table', value: 2 }],
        adjustments: [], removed: [], unlabelled: 0, total: 2,
      }, true);
      expect(component.hasBase).toBeFalse();
      expect(buttonNamed('Label part of the base score')).toBeUndefined();
      expect(buttonNamed('Add a line')).toBeDefined();
      component.labelPartOfBase();
      expect(component.drafts).toEqual([]);

      component.addLine(40);
      component.drafts[0].label = 'Boon';
      expect(component.rangeProblem).toBeNull();
      expect(text('auto-lines')).toBe('Class table 2'); // nothing comes out of the class table
      expect(saved()).toEqual({ lines: [{ value: 40, label: 'Boon' }], keepUnlabelled: true, removed: [], fromBase: 0 });
    });

    it('blocks Save, with a plain reason, when the score would leave 1 to 30', () => {
      open(strength(), true);
      component.addLine(14);
      component.drafts[2].label = 'Wish';
      fixture.detectChanges();
      expect(component.total).toBe(31);
      expect(component.canSave).toBeFalse();
      expect(component.rangeProblem).toBe('Strength has to stay between 1 and 30.');

      component.drafts[2].value = -17;
      expect(component.total).toBe(0);
      expect(component.canSave).toBeFalse();
      expect(saved()).toBeUndefined();

      component.drafts[2].value = 13;
      expect(component.rangeProblem).toBeNull();
      expect(component.canSave).toBeTrue();
    });

    it('shows that reason under the lines', () => {
      open(strength(), true);
      click('Add a line');
      const amount: HTMLInputElement = fixture.nativeElement.querySelectorAll('.adjust-amount')[2];
      const label: HTMLInputElement = fixture.nativeElement.querySelectorAll('.adjust-label')[2];
      amount.value = '20'; amount.dispatchEvent(new Event('input'));
      label.value = 'Wish'; label.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(problem()).toBe('Strength has to stay between 1 and 30.');
      expect(buttonNamed('Save')!.disabled).toBeTrue();
    });

    it('blocks Save when more is labelled out of the base than it holds', () => {
      open(unexplained(), true);
      component.labelPartOfBase();
      component.drafts[0].label = 'Typo';
      component.drafts[0].value = 51;
      expect(component.rangeProblem).toBe('These lines take more out of the base score than it holds.');
      expect(component.canSave).toBeFalse();
    });

    it('puts no range on Armor Class', () => {
      open(breakdown(), true);
      component.addLine(60);
      component.drafts[0].label = 'Divine Shield';
      expect(component.rangeProblem).toBeNull();
      expect(component.canSave).toBeTrue();
    });
  });

  describe('skill modifier', () => {
    /** Perception +5: Wisdom +2, Proficiency +2, and the DM's Observant +1. */
    const perception = (overrides: Partial<StatBreakdown> = {}): StatBreakdown => ({
      stat: 'skillPerception',
      auto: [{ label: 'Wisdom', value: 2, note: 'score 14' }, { label: 'Proficiency', value: 2 }],
      adjustments: [{ value: 1, label: 'Observant' }],
      removed: [],
      unlabelled: 0,
      total: 5,
      ...overrides,
    });

    it('shows every line and the total with a sign, the first line included', () => {
      open(perception({ auto: [{ label: 'Wisdom', value: -1 }, { label: 'Proficiency', value: 0 }],
                        adjustments: [], total: -1 }), false);
      expect(text('auto-lines')).toBe('Wisdom -1 Proficiency +0');
      expect(text('total')).toBe('Total -1');
    });

    it('shows a player the lines and the DM lines, read-only, under the skill name', () => {
      open(perception(), false);
      expect(fixture.nativeElement.textContent).toContain('Perception');
      expect(text('auto-lines')).toBe('Wisdom +2 Proficiency +2');
      expect(text('adjust-lines')).toBe('Observant +1');
      expect(text('total')).toBe('Total +5');
      expect(fixture.nativeElement.querySelector('input')).toBeNull();
    });

    it('lets the DM add a line, with no Remove on the calculated lines', () => {
      open(perception({ adjustments: [], total: 4 }), true);
      expect(Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('[data-testid="auto-lines"] button')))
        .toEqual([]);
      const saved: StatBreakdownSave[] = [];
      component.save.subscribe(s => saved.push(s));
      click('Add a line');
      const label: HTMLInputElement = fixture.nativeElement.querySelector('.adjust-label');
      label.value = 'Observant'; label.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(text('total')).toBe('Total +5');
      click('Save');
      expect(saved).toEqual([{ lines: [{ value: 1, label: 'Observant' }], keepUnlabelled: true, removed: [], fromBase: 0 }]);
    });
  });

  describe('initiative, speed, proficiency and slot capacity', () => {
    it('shows initiative signed: Dexterity, the DM lines and the total', () => {
      open({ stat: 'init', auto: [{ label: 'Dexterity', value: 2 }],
             adjustments: [{ value: 2, label: 'Alert' }], removed: [], unlabelled: 0, total: 4 }, false);
      expect(fixture.nativeElement.querySelector('h2').textContent).toContain('Initiative');
      expect(text('auto-lines')).toBe('Dexterity +2');
      expect(text('adjust-lines')).toBe('Alert +2');
      expect(text('total')).toBe('Total +4');
    });

    it('shows proficiency signed, starting from the level', () => {
      open({ stat: 'prof', auto: [{ label: 'Level 5', value: 3 }],
             adjustments: [], removed: [], unlabelled: 0, total: 3 }, false);
      expect(fixture.nativeElement.querySelector('h2').textContent).toContain('Proficiency Bonus');
      expect(text('auto-lines')).toBe('Level 5 +3');
      expect(text('total')).toBe('Total +3');
    });

    it('lets the DM label part of the base speed', () => {
      open({ stat: 'speed', auto: [{ label: 'Base speed', value: 35 }],
             adjustments: [], removed: [], unlabelled: 0, total: 35 }, true);
      expect(text('auto-lines')).toBe('Base speed 35');
      expect(Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
        .some(b => b.textContent?.trim() === 'Label part of the base speed')).toBeTrue();
    });

    it('shows slot capacity as a plain count', () => {
      open({ stat: 'capacity', auto: [{ label: 'Medium size', value: 18 }, { label: 'Strength', value: 2 }],
             adjustments: [{ value: 3, label: 'Bag of Holding' }], removed: [], unlabelled: 0, total: 23 }, false);
      expect(fixture.nativeElement.querySelector('h2').textContent).toContain('Slot Capacity');
      expect(text('auto-lines')).toBe('Medium size 18 Strength +2');
      expect(text('adjust-lines')).toBe('Bag of Holding +3');
      expect(text('total')).toBe('Total 23');
    });
  });
});
