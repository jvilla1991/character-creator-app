import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LongRestChoicesComponent } from './long-rest-choices.component';
import { PC, PcSpell } from '../../../models/pc';
import { LongRestDraft, startLongRestDraft } from '../../../utils/long-rest-choices';

describe('LongRestChoicesComponent', () => {
  let fixture: ComponentFixture<LongRestChoicesComponent>;
  let component: LongRestChoicesComponent;
  let emitted: LongRestDraft[];

  const spell = (name: string, lvl: number, prepared: boolean): PcSpell =>
    ({ name, lvl, prepared, school: 'Evocation', time: '1 action' } as PcSpell);

  // Level 1 cleric: cap 4. Three prepared, two not.
  const cleric = (over: Partial<PC> = {}): PC => ({
    id: 7, name: 'Mira', clazz: 'Cleric', level: 1, playerName: 'Sam',
    spells: [
      spell('Guidance', 0, true),
      spell('Bless', 1, true), spell('Cure Wounds', 1, true), spell('Shield of Faith', 1, true),
      spell('Command', 1, false), spell('Sanctuary', 1, false),
    ],
    ...over,
  } as PC);

  // Level 5 paladin: cap 6. Two prepared, two not.
  const paladin = (over: Partial<PC> = {}): PC => ({
    id: 8, name: 'Aelira', clazz: 'Paladin', level: 5, playerName: 'Sam',
    spells: [
      spell('Bless', 1, true), spell('Heroism', 1, true),
      spell('Command', 1, false), spell('Aid', 2, false),
    ],
    ...over,
  } as PC);

  const knight = (over: Partial<PC> = {}): PC => ({
    id: 9, name: 'Thorne', clazz: 'Paladin', subclass: 'Oath of the Ebon Blade', specialization: 'Blood',
    level: 5, playerName: 'Sam',
    stats: { STR: 16, DEX: 10, CON: 14, INT: 8, WIS: 10, CHA: 16 },
    spells: [],
    inventory: [
      { name: 'Greatsword', category: 'weapon', qty: 1, damage: '2d6' },
      { name: 'Maul', category: 'weapon', qty: 1, damage: '2d6' },
      { name: 'Longbow', category: 'weapon', qty: 1, properties: ['ammunition (150/600)'] },
    ],
    ...over,
  } as PC);

  /** Render, and feed every emitted draft straight back in — as the session screen does. */
  function render(pc: PC, draft: LongRestDraft = startLongRestDraft(pc), locked = false): void {
    fixture.componentRef.setInput('pc', pc);
    fixture.componentRef.setInput('draft', draft);
    fixture.componentRef.setInput('locked', locked);
    fixture.detectChanges();
  }

  const q = (css: string) => fixture.debugElement.query(By.css(css));
  const text = (css: string): string => q(css)?.nativeElement.textContent.replace(/\s+/g, ' ').trim() ?? '';
  const box = (name: string): HTMLInputElement =>
    fixture.debugElement.queryAll(By.css('.lc-spell'))
      .find(row => row.nativeElement.textContent.includes(name))!
      .query(By.css('input')).nativeElement;
  const tick = (name: string): void => {
    box(name).click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LongRestChoicesComponent] }).compileComponents();
    fixture = TestBed.createComponent(LongRestChoicesComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.draftChange.subscribe(d => {
      emitted.push(d);
      fixture.componentRef.setInput('draft', d);
    });
  });

  describe('prepared spells: any number (Cleric)', () => {
    it('lists the leveled spells with the current list ticked and an "x of cap" count', () => {
      render(cleric());

      expect(text('.lc-count')).toBe('3 of 4');
      expect(fixture.debugElement.queryAll(By.css('.lc-spell')).length).toBe(5); // no cantrip
      expect(box('Bless').checked).toBeTrue();
      expect(box('Command').checked).toBeFalse();
      expect(text('.lc-hint')).toContain('Change as many as you like');
      expect(text('.lc-status')).toBe('You can prepare 1 more.');
    });

    it('stops at the cap: at the limit, unticked spells are disabled until one is unticked', () => {
      render(cleric());

      tick('Command');
      expect(text('.lc-count')).toBe('4 of 4');
      expect(box('Sanctuary').disabled).toBeTrue();
      expect(text('.lc-status')).toBe('Your list is full. Untick a spell to make room for another.');

      tick('Sanctuary'); // disabled — nothing happens
      expect(emitted.length).toBe(1);

      tick('Bless');
      expect(box('Sanctuary').disabled).toBeFalse();
      tick('Sanctuary');
      expect(emitted[emitted.length - 1].spells).toEqual(['Cure Wounds', 'Shield of Faith', 'Command', 'Sanctuary']);
    });

    it('Same as Before puts the original list back, and is disabled while nothing changed', () => {
      render(cleric());
      const reset: HTMLButtonElement = q('[data-reset-spells]').nativeElement;
      expect(reset.disabled).toBeTrue();

      tick('Bless');
      expect(reset.disabled).toBeFalse();
      reset.click();
      fixture.detectChanges();

      expect(emitted[emitted.length - 1].spells).toEqual(['Bless', 'Cure Wounds', 'Shield of Faith']);
      expect(box('Bless').checked).toBeTrue();
      expect(reset.disabled).toBeTrue();
    });

    it('the list is a scroll region of its own', () => {
      render(cleric());
      const list: HTMLElement = q('.lc-list').nativeElement;
      expect(getComputedStyle(list).overflowY).toBe('auto');
      expect(getComputedStyle(list).maxHeight).not.toBe('none');
    });
  });

  describe('prepared spells: replace one (Paladin)', () => {
    it('starts folded behind Change a Spell, and says only one may be replaced', () => {
      render(paladin());

      expect(q('.lc-list')).toBeNull();
      expect(text('.lc-hint')).toBe('You can replace one prepared spell.');
      expect(text('.lc-count')).toBe('2 of 6');

      q('[data-open-spells]').nativeElement.click();
      fixture.detectChanges();
      expect(q('.lc-list')).not.toBeNull();
    });

    it('after one spell is swapped out and one in, every other change is blocked until reset', () => {
      render(paladin());
      q('[data-open-spells]').nativeElement.click();
      fixture.detectChanges();

      tick('Bless'); // out
      expect(text('.lc-status')).toBe('Now tick the spell that takes its place.');
      expect(box('Heroism').disabled).toBeTrue(); // a second removal is not allowed

      tick('Command'); // in
      expect(text('.lc-status')).toBe('One spell replaced. Use Same as Before to pick again.');
      expect(box('Aid').disabled).toBeTrue();      // a second addition
      expect(box('Heroism').disabled).toBeTrue();  // a second removal
      expect(box('Bless').disabled).toBeFalse();   // undoing the removal is fine
      expect(box('Command').disabled).toBeFalse(); // undoing the addition is fine
      expect(emitted[emitted.length - 1].spells).toEqual(['Heroism', 'Command']);

      q('[data-reset-spells]').nativeElement.click();
      fixture.detectChanges();
      expect(box('Aid').disabled).toBeFalse();
    });

    it('may simply add one spell when under the cap', () => {
      render(paladin());
      q('[data-open-spells]').nativeElement.click();
      fixture.detectChanges();

      tick('Aid');
      expect(text('.lc-status')).toBe('One spell added. Use Same as Before to pick again.');
      expect(box('Command').disabled).toBeTrue();
      expect(box('Bless').disabled).toBeFalse(); // may still turn the add into a swap
    });
  });

  it('shows no spell section for a class that does not change spells at a long rest', () => {
    render(cleric({ clazz: 'Bard' }));
    expect(q('[data-section="spells"]')).toBeNull();
  });

  it('shows always-prepared hero spells as read-only chips', () => {
    // A Death Knight of level 5 always has Rune Strike, Death Grip, Vampiric Blood, …
    render(knight({ spells: [spell('Bless', 1, true), spell('Command', 1, false)] }));

    const chips = fixture.debugElement.queryAll(By.css('.lc-chip')).map(c => c.nativeElement.textContent.trim());
    expect(chips).toContain('Rune Strike');
    expect(chips).toContain('Death Grip');
    expect(chips).toContain('Vampiric Blood'); // the Blood column
    expect(fixture.debugElement.queryAll(By.css('.lc-always input')).length).toBe(0);
  });

  it('locks every control once the hero is Ready', () => {
    const pc = cleric();
    render(pc, startLongRestDraft(pc), true);

    expect(box('Bless').disabled).toBeTrue();
    expect(box('Command').disabled).toBeTrue();
    expect((q('[data-reset-spells]').nativeElement as HTMLButtonElement).disabled).toBeTrue();
    expect(text('.lc-status')).toBe('Take back Ready to change your spells.');
  });

  describe('Death Knight rune weapon', () => {
    const radios = (): HTMLInputElement[] =>
      fixture.debugElement.queryAll(By.css('.lc-weapon input')).map(r => r.nativeElement);

    it('lists the melee weapons as radios, with the current rune weapon selected', () => {
      const pc = knight({ runeWeapon: 'Greatsword' });
      render(pc);

      expect(text('#lc-rune-question')).toBe('Which melee weapon carries your Blood Rune?');
      const rows = fixture.debugElement.queryAll(By.css('.lc-weapon'))
        .map(r => r.nativeElement.textContent.replace(/\s+/g, ' ').trim());
      expect(rows.length).toBe(2); // the Longbow is not a melee weapon
      expect(rows[0]).toContain('Greatsword');
      expect(rows[0]).toContain('The rune is here now');
      expect(rows[0]).toContain('2d6');
      expect(rows[1]).toContain('Move the rune to this weapon');
      expect(radios().map(r => r.checked)).toEqual([true, false]);
      expect(q('.lc-required')).toBeNull();
    });

    it('choosing another weapon emits it', () => {
      render(knight({ runeWeapon: 'Greatsword' }));

      radios()[1].click();
      fixture.detectChanges();

      expect(emitted[emitted.length - 1].rune).toBe('Maul');
      expect(radios().map(r => r.checked)).toEqual([false, true]);
    });

    it('a knight who has never inscribed a weapon is asked to choose one', () => {
      render(knight());

      expect(text('.lc-required')).toBe('Choose one');
      expect(radios().every(r => !r.checked)).toBeTrue();
      expect(text('.lc-weapon-note')).toBe('Inscribe the rune on this weapon');
      expect(q('[data-blood-bonus]').nativeElement.classList).toContain('pending');
    });

    it('says the rune type changes only on level-up, and offers no rune type picker', () => {
      render(knight());
      expect(text('.lc-note')).toBe('The rune itself (Blood, Frost or Unholy) changes only when you gain a level.');
      expect(fixture.debugElement.queryAll(By.css('select')).length).toBe(0);
    });

    it('shows the Blood Rune temporary Hit Points and how they are worked out', () => {
      render(knight({ runeWeapon: 'Greatsword' }));

      expect(text('[data-blood-bonus]')).toContain('Charisma +3, plus Paladin level 5');
      expect(text('[data-blood-bonus]')).toContain('+8 temp HP');
      expect(q('[data-blood-bonus]').nativeElement.classList).not.toContain('pending');
    });

    it('shows no temporary Hit Points line for a Frost rune', () => {
      render(knight({ specialization: 'Frost', runeWeapon: 'Greatsword' }));
      expect(q('[data-blood-bonus]')).toBeNull();
      expect(text('#lc-rune-question')).toContain('Frost Rune');
    });

    it('explains when there is no melee weapon to carry the rune', () => {
      render(knight({ inventory: [] }));

      expect(radios().length).toBe(0);
      expect(text('[data-no-weapon]')).toContain('Thorne has no melee weapon for the rune');
      expect(q('.lc-required')).toBeNull();
    });

    it('is not shown before Paladin level 3', () => {
      render(knight({ level: 2 }));
      expect(q('[data-section="rune"]')).toBeNull();
    });

    it('locks the radios once the hero is Ready', () => {
      const pc = knight({ runeWeapon: 'Greatsword' });
      render(pc, startLongRestDraft(pc), true);
      expect(radios().every(r => r.disabled)).toBeTrue();
    });
  });
});
