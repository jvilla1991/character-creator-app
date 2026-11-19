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
    expect(fixture.nativeElement.querySelector('.breakdown-hint')).toBeNull(); // a player gets no editing words

    open(slots, true);
    const hint: string = fixture.nativeElement.querySelector('.breakdown-hint').textContent;
    expect(hint).toContain('class table');
    expect(hint).not.toContain('armor');
  });

  it('keeps the Armor Class words for Armor Class', () => {
    open(breakdown(), true);
    expect(fixture.nativeElement.querySelector('.breakdown-hint').textContent).toContain('These lines stay when armor changes.');
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
    expect(saved()).toEqual({ lines: [{ value: 1, label: 'Taunka' }], keepUnlabelled: true, removed: [] });
  });

  it('removes a line', () => {
    open(breakdown({ adjustments: [{ value: 1, label: 'Taunka' }], total: 18 }), true);
    component.removeLine(0);
    expect(component.total).toBe(17);
    expect(saved()).toEqual({ lines: [], keepUnlabelled: true, removed: [] });
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
    expect(saved()).toEqual({ lines: [{ value: -2, label: 'Cursed' }], keepUnlabelled: true, removed: [] });
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
    expect(saved()).toEqual({ lines: [], keepUnlabelled: true, removed: ['Dexterity'] });
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
    expect(saved()).toEqual({ lines: [], keepUnlabelled: true, removed: [] });
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
    expect(saved()).toEqual({ lines: [], keepUnlabelled: true, removed: ['Plate', 'Dexterity'] });
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
    expect(saved()).toEqual({ lines: [], keepUnlabelled: true, removed: ['Shield'] });
  });

  // --- the unlabelled rest of an older hand edit ---

  it('keeps an unlabelled amount in the total until the DM deals with it', () => {
    open(breakdown({ unlabelled: 3, total: 20 }), true);
    expect(text('unlabelled')).toBe('Unlabelled +3');
    expect(component.total).toBe(20);

    component.addLine();
    component.drafts[0].label = 'Taunka';
    expect(component.total).toBe(21);
    expect(saved()).toEqual({ lines: [{ value: 1, label: 'Taunka' }], keepUnlabelled: true, removed: [] });
  });

  it('"Label it" turns the unlabelled amount into a line without moving the total', () => {
    open(breakdown({ unlabelled: 3, total: 20 }), true);
    component.labelUnlabelled();
    expect(component.drafts).toEqual([{ value: 3, label: '' }]);
    expect(component.total).toBe(20);
    expect(component.canSave).toBeFalse(); // still needs its label

    component.drafts[0].label = 'Unarmored Defense';
    expect(saved()).toEqual({ lines: [{ value: 3, label: 'Unarmored Defense' }], keepUnlabelled: false, removed: [] });
  });

  it('"Remove it" drops the unlabelled amount from the total', () => {
    open(breakdown({ unlabelled: 3, total: 20 }), true);
    click('Remove it');
    expect(component.total).toBe(17);
    expect(text('total')).toBe('Total 17');
    expect(fixture.nativeElement.querySelector('[data-testid="unlabelled"]')).toBeNull();
    expect(saved()).toEqual({ lines: [], keepUnlabelled: false, removed: [] });
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
});
