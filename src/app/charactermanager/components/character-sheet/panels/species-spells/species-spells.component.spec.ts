import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SpeciesSpellsComponent } from './species-spells.component';
import { DndSpell } from '../../../../models/dnd-api.types';
import { PC } from '../../../../models/pc';
import { DndResourcesService } from '../../../../services/dnd-resources.service';

describe('SpeciesSpellsComponent', () => {
  let dndResources: jasmine.SpyObj<DndResourcesService>;

  const spell = (name: string, level: number, source?: 'World of Warcraft'): DndSpell => ({
    name, level, school: 'evocation', classes: [], actionType: 'action', concentration: false, ritual: false,
    range: 'Self', components: ['v'], duration: 'Instantaneous', description: `${name} rules text.`,
    ...(source ? { source } : {}),
  });

  const SPELLS = [
    spell('Mind Sliver', 0), spell('Entropic Embrace', 1, 'World of Warcraft'), spell('Misty Step', 2),
    spell('Arcane Pulse', 0, 'World of Warcraft'),
  ];

  const pc = (overrides: Partial<PC>): PC => ({
    id: 1, name: 'Alleria', clazz: 'Ranger', level: 1, playerName: 'Pat',
    race: 'Elf', speciesSource: 'World of Warcraft', lineage: 'Void Elf', ...overrides,
  });

  beforeEach(() => {
    dndResources = jasmine.createSpyObj<DndResourcesService>('DndResourcesService', ['getSpells']);
    dndResources.getSpells.and.returnValue(of(SPELLS));
    TestBed.configureTestingModule({ providers: [{ provide: DndResourcesService, useValue: dndResources }] });
  });

  function render(character: PC | null) {
    const fixture = TestBed.createComponent(SpeciesSpellsComponent);
    fixture.componentRef.setInput('pc', character);
    fixture.detectChanges();
    return fixture;
  }

  const names = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.hero-spell-name')).map(n => n.textContent!.trim());

  it('renders nothing, and loads no spell data, for a base-game species', () => {
    const el = render(pc({ speciesSource: null, lineage: null })).nativeElement as HTMLElement;
    expect(el.querySelector('.panel')).toBeNull();
    expect(dndResources.getSpells).not.toHaveBeenCalled();
  });

  it('renders nothing for a World of Warcraft species that gives no spells', () => {
    const el = render(pc({ race: 'Orc', lineage: null })).nativeElement as HTMLElement;
    expect(el.querySelector('.panel')).toBeNull();
    expect(render(null).nativeElement.querySelector('.panel')).toBeNull();
  });

  it('shows a level 1 Void Elf its cantrip and what is still to come', () => {
    const el = render(pc({})).nativeElement as HTMLElement;
    expect(el.querySelector('.panel-title')?.textContent).toBe('Void Elf Spells');
    expect(names(el)).toEqual(['Mind Sliver']);
    expect(el.querySelector('.hero-spell-meta')?.textContent).toContain('Cantrip');
    expect(el.querySelector('.species-spells-upcoming')?.textContent)
      .toContain('Entropic Embrace at level 3, Misty Step at level 5');
    expect(el.querySelector('.hero-spells-note')?.textContent).toContain('once per Long Rest');
  });

  it('adds the level 3 spell at level 3, marked as a World of Warcraft spell, and the level 5 spell at 5', () => {
    const three = render(pc({ level: 3 })).nativeElement as HTMLElement;
    expect(names(three)).toEqual(['Mind Sliver', 'Entropic Embrace']);
    const rows = Array.from(three.querySelectorAll('.hero-spell'));
    expect(rows[0].querySelector('.wow-mark')).toBeNull();
    expect(rows[1].querySelector('.wow-mark')).not.toBeNull();
    expect(rows[1].querySelector('.hero-spell-meta')?.textContent).toContain('From level 3');
    expect(rows[1].querySelector('.hero-spell-desc')?.textContent).toContain('Entropic Embrace rules text.');
    expect(three.querySelector('.species-spells-upcoming')?.textContent).toContain('Misty Step at level 5');

    const five = render(pc({ level: 5 })).nativeElement as HTMLElement;
    expect(names(five)).toEqual(['Mind Sliver', 'Entropic Embrace', 'Misty Step']);
    expect(five.querySelector('.species-spells-upcoming')).toBeNull();
  });

  it('shows a Night Elf, who has no cantrip, only what is still to come', () => {
    const el = render(pc({ lineage: 'Night Elf' })).nativeElement as HTMLElement;
    expect(el.querySelector('.panel-title')?.textContent).toBe('Night Elf Spells');
    expect(names(el)).toEqual([]);
    expect(el.querySelector('.species-spells-upcoming')?.textContent)
      .toContain('Longstrider at level 3, Pass without Trace at level 5');
  });

  it('shows an Elf with no lineage recorded nothing at all', () => {
    const el = render(pc({ lineage: null })).nativeElement as HTMLElement;
    expect(el.querySelector('.panel')).toBeNull();
  });

  it('shows a Gnome its two cantrips, with no once-per-rest note', () => {
    const el = render(pc({ race: 'Gnome', lineage: null })).nativeElement as HTMLElement;
    expect(el.querySelector('.panel-title')?.textContent).toBe('Gnome Spells');
    expect(names(el)).toEqual(['Mending', 'Prestidigitation']);
    expect(el.querySelector('.hero-spells-note')?.textContent).not.toContain('once per Long Rest');
    expect(el.querySelector('.species-spells-upcoming')).toBeNull();
  });

  it('shows a Haranir its cantrips, then Entangle and Spike Growth as they are learned', () => {
    const el = render(pc({ race: 'Haranir', lineage: null, level: 3 })).nativeElement as HTMLElement;
    expect(names(el)).toEqual(['Druidcraft', 'Thorn Whip', 'Entangle']);
    expect(el.querySelector('.species-spells-upcoming')?.textContent).toContain('Spike Growth at level 5');
  });

  it('still lists the names when the spell data cannot be loaded', () => {
    dndResources.getSpells.and.returnValue(throwError(() => new Error('offline')));
    const el = render(pc({})).nativeElement as HTMLElement;
    expect(names(el)).toEqual(['Mind Sliver']);
    expect(el.querySelector('.hero-spell-desc')?.textContent).toContain('Loading spell text');
  });
});
