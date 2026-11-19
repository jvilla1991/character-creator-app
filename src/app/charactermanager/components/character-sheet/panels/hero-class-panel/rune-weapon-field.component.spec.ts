import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RuneWeaponFieldComponent } from './rune-weapon-field.component';
import { PC } from '../../../../models/pc';

describe('RuneWeaponFieldComponent', () => {
  let fixture: ComponentFixture<RuneWeaponFieldComponent>;
  let component: RuneWeaponFieldComponent;

  const knight = (over: Partial<PC> = {}): PC => ({
    id: 9, name: 'Thorne', clazz: 'Paladin', subclass: 'Oath of the Ebon Blade', specialization: 'Frost',
    level: 5, playerName: 'Sam',
    inventory: [
      { name: 'Greatsword', category: 'weapon', qty: 1 },
      { name: 'Maul', category: 'weapon', qty: 1 },
      { name: 'Longbow', category: 'weapon', qty: 1, properties: ['ammunition (150/600)'] },
    ],
    ...over,
  } as PC);

  function render(pc: PC, editable = false): void {
    fixture.componentRef.setInput('pc', pc);
    fixture.componentRef.setInput('editable', editable);
    fixture.detectChanges();
  }

  const q = (css: string) => fixture.debugElement.query(By.css(css));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RuneWeaponFieldComponent] }).compileComponents();
    fixture = TestBed.createComponent(RuneWeaponFieldComponent);
    component = fixture.componentInstance;
  });

  it('renders nothing for a character without Runeforging', () => {
    render(knight({ level: 2 }));
    expect(q('.feature')).toBeNull();

    render(knight({ subclass: 'Oath of Devotion' }));
    expect(q('.feature')).toBeNull();
  });

  it('shows the weapon that carries the rune, named after the rune type', () => {
    render(knight({ runeWeapon: 'Greatsword' }));

    expect(q('.feature-name').nativeElement.textContent).toContain('Frost Rune Weapon');
    expect(q('.feature-desc').nativeElement.textContent).toContain('Greatsword');
    expect(q('select')).toBeNull(); // read-only for a viewer who cannot edit
  });

  it('says so when no weapon is inscribed, or there is none to inscribe', () => {
    render(knight());
    expect(q('.feature-desc').nativeElement.textContent).toContain('Not inscribed on a weapon yet.');

    render(knight({ inventory: [] }), true);
    expect(q('select')).toBeNull();
    expect(q('.feature-desc').nativeElement.textContent).toContain('No melee weapon to inscribe.');
  });

  it('an editor picks from the melee weapons, and the pick is emitted', () => {
    const picked: string[] = [];
    component.runeWeaponChange.subscribe(w => picked.push(w));
    render(knight(), true);

    const select: HTMLSelectElement = q('select').nativeElement;
    const options = [...select.options].map(o => o.textContent!.trim());
    expect(options).toEqual(['Choose a melee weapon', 'Greatsword', 'Maul']); // no Longbow

    select.value = 'Maul';
    select.dispatchEvent(new Event('change'));
    expect(picked).toEqual(['Maul']);
  });

  it('re-picking the current weapon emits nothing', () => {
    const picked: string[] = [];
    component.runeWeaponChange.subscribe(w => picked.push(w));
    render(knight({ runeWeapon: 'Maul' }), true);

    const select: HTMLSelectElement = q('select').nativeElement;
    expect([...select.options].map(o => o.textContent!.trim())).toEqual(['Greatsword', 'Maul']);
    select.value = 'Maul';
    select.dispatchEvent(new Event('change'));
    expect(picked).toEqual([]);
  });
});
