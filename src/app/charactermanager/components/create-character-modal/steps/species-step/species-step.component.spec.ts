import { TestBed } from '@angular/core/testing';
import { SpeciesStepComponent } from './species-step.component';
import { buildSpeciesOptions, catalogSpeciesByKey, emptySpeciesSelections } from '../../../../models/species';
import { DndSpecies } from '../../../../models/dnd-api.types';
import { DndResourcesService } from '../../../../services/dnd-resources.service';

describe('SpeciesStepComponent', () => {
  const WOW_ELF = 'Elf (World of Warcraft)';
  const BASE_ELF_DETAIL: DndSpecies = {
    index: 'elf', name: 'Elf', size: 'Medium', speed: 30,
    traits: [{ index: 'trance', name: 'Trance', url: '' }],
    subspecies: [{ index: 'wood-elf', name: 'Wood Elf', url: '' }],
  };

  beforeEach(() => {
    const dndResources = jasmine.createSpyObj<DndResourcesService>('DndResourcesService', ['getTraitDescription']);
    dndResources.getTraitDescription.and.returnValue('Base-game trait text.');
    TestBed.configureTestingModule({ providers: [{ provide: DndResourcesService, useValue: dndResources }] });
  });

  function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(SpeciesStepComponent);
    fixture.componentRef.setInput('options', buildSpeciesOptions(['Elf', 'Halfling']));
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return fixture;
  }

  const heads = (el: HTMLElement) => Array.from(el.querySelectorAll('.accordion-head')) as HTMLElement[];

  it('shows two "Elf" rows and tags only the World of Warcraft one', () => {
    const el = render().nativeElement as HTMLElement;
    const elfRows = heads(el).filter(h => h.textContent!.trim().startsWith('Elf'));
    expect(elfRows.length).toBe(2);
    expect(elfRows[0].querySelector('.source-tag')).toBeNull();
    expect(elfRows[1].querySelector('.source-tag')?.textContent).toContain('World of Warcraft');
  });

  it('lists the base-game rows first, then the seventeen catalog species', () => {
    const el = render().nativeElement as HTMLElement;
    expect(heads(el).length).toBe(2 + 17);
    expect(heads(el)[1].textContent!.trim()).toBe('Halfling');
    expect(heads(el)[2].textContent).toContain('Dracthyr');
  });

  it('emits the row key, not the name, when a row is clicked', () => {
    const fixture = render();
    const emitted: string[] = [];
    fixture.componentInstance.toggle.subscribe(key => emitted.push(key));
    const elfRows = heads(fixture.nativeElement).filter(h => h.textContent!.trim().startsWith('Elf'));
    elfRows[1].click();
    elfRows[0].click();
    expect(emitted).toEqual([WOW_ELF, 'Elf']);
  });

  it('expands only the chosen World of Warcraft row and renders it from the catalog', () => {
    const el = render({ selectedKey: WOW_ELF }).nativeElement as HTMLElement;
    const elfRows = heads(el).filter(h => h.textContent!.trim().startsWith('Elf'));
    expect(elfRows[1].classList).toContain('active');
    expect(elfRows[0].classList).not.toContain('active');
    expect(el.querySelectorAll('.accordion-body').length).toBe(1);

    const body = el.querySelector('.accordion-body')!.textContent!;
    expect(body).toContain('Medium (about 6 to 8 feet tall)');
    expect(body).toContain('30 ft.');
    expect(body).toContain('Keen Senses');
    expect(body).toContain('Insight, Perception or Survival');
    expect(body).toContain('Azeroth Elven Lineage options');
    expect(body).toContain('Nightborne');
    expect(body).toContain('Arcane Pulse');
    // Never the base-game lookup text for a catalog species.
    expect(body).not.toContain('Base-game trait text.');
    expect(body).not.toContain('Loading traits');
  });

  it('shows the creature type only when it is not Humanoid', () => {
    const elf = render({ selectedKey: WOW_ELF }).nativeElement as HTMLElement;
    expect(elf.querySelector('.accordion-body')!.textContent).not.toContain('Creature Type');
    const forsaken = render({ selectedKey: 'Forsaken (World of Warcraft)' }).nativeElement as HTMLElement;
    const body = forsaken.querySelector('.accordion-body')!.textContent!;
    expect(body).toContain('Creature Type');
    expect(body).toContain('Undead');
    expect(body).toContain('Small or Medium');
  });

  it('renders no lineage block for a species without lineages', () => {
    const el = render({ selectedKey: 'Orc (World of Warcraft)' }).nativeElement as HTMLElement;
    expect(el.querySelector('.accordion-body')!.textContent).not.toContain('options');
  });

  it('still renders a base-game row from the rules API detail', () => {
    const el = render({
      selectedKey: 'Elf', speciesDetail: BASE_ELF_DETAIL, speciesSubspeciesNames: 'Wood Elf',
    }).nativeElement as HTMLElement;
    const body = el.querySelector('.accordion-body')!.textContent!;
    expect(body).toContain('Trance');
    expect(body).toContain('Base-game trait text.');
    expect(body).toContain('Wood Elf');
    expect(body).not.toContain('Azeroth Elven Lineage');
  });

  it('says so when the chosen species is hidden by the content-source filter', () => {
    const el = render({
      options: buildSpeciesOptions(['Elf']).filter(o => o.source === 'Base Game'),
      selectedKey: WOW_ELF, selectedHidden: true,
    }).nativeElement as HTMLElement;
    expect(el.querySelector('.filter-note')?.textContent).toContain('Elf (World of Warcraft)');
    expect(el.querySelectorAll('.accordion-body').length).toBe(0);
  });

  describe('choices', () => {
    const chips = (el: HTMLElement, label: string) => {
      const row = Array.from(el.querySelectorAll('.species-choice'))
        .find(r => r.querySelector('.choice-label')?.textContent?.includes(label));
      return Array.from(row?.querySelectorAll('button.class-pick') ?? []) as HTMLButtonElement[];
    };
    const emptyFor = (key: string) => emptySpeciesSelections(catalogSpeciesByKey(key));

    it('offers an Elf its five lineages and three spellcasting abilities, and emits each pick as a patch', () => {
      const fixture = render({ selectedKey: WOW_ELF, selections: emptyFor(WOW_ELF) });
      const el = fixture.nativeElement as HTMLElement;
      const patches: unknown[] = [];
      fixture.componentInstance.selectionsChange.subscribe(p => patches.push(p));

      const lineages = chips(el, 'Lineage');
      expect(lineages.map(b => b.textContent!.trim()))
        .toEqual(['Blood Elf', 'Night Elf', 'Nightborne', 'Void Elf', 'High Elf']);
      const abilities = chips(el, 'Spellcasting ability');
      expect(abilities.map(b => b.textContent!.trim())).toEqual(['Intelligence', 'Wisdom', 'Charisma']);
      expect(chips(el, 'Size').length).toBe(0); // one size — nothing to choose

      lineages[1].click();
      abilities[2].click();
      expect(patches).toEqual([{ lineage: 'Night Elf' }, { ability: 'CHA' }]);
    });

    it('marks the chosen lineage on its chip and in the list that describes it', () => {
      const el = render({
        selectedKey: WOW_ELF, selections: { ...emptyFor(WOW_ELF), lineage: 'Void Elf', ability: 'INT' },
      }).nativeElement as HTMLElement;
      const active = chips(el, 'Lineage').filter(b => b.classList.contains('active'));
      expect(active.map(b => b.textContent!.trim())).toEqual(['Void Elf']);
      expect(active[0].getAttribute('aria-pressed')).toBe('true');
      expect(el.querySelector('.trait-item.chosen .trait-name')?.textContent).toBe('Void Elf');
      expect(chips(el, 'Spellcasting ability').find(b => b.classList.contains('active'))?.textContent!.trim())
        .toBe('Intelligence');
    });

    it('asks a Tauren for a saving throw ability, but not once the Taunka lineage is chosen', () => {
      const key = 'Tauren (World of Warcraft)';
      const before = render({ selectedKey: key, selections: emptyFor(key) }).nativeElement as HTMLElement;
      expect(chips(before, 'Saving throw ability').map(b => b.textContent!.trim()))
        .toEqual(['Strength', 'Constitution', 'Wisdom']);
      const taunka = render({
        selectedKey: key, selections: { ...emptyFor(key), lineage: 'Taunka' },
      }).nativeElement as HTMLElement;
      expect(chips(taunka, 'Saving throw ability').length).toBe(0);
    });

    it('offers a Forsaken the two sizes', () => {
      const key = 'Forsaken (World of Warcraft)';
      const fixture = render({ selectedKey: key, selections: emptyFor(key) });
      const patches: unknown[] = [];
      fixture.componentInstance.selectionsChange.subscribe(p => patches.push(p));
      const sizes = chips(fixture.nativeElement, 'Size');
      expect(sizes.map(b => b.textContent!.trim())).toEqual(['Small', 'Medium']);
      sizes[0].click();
      expect(patches).toEqual([{ size: 'Small' }]);
    });

    it('offers a Human an Origin feat with its description, and warns about a repeat', () => {
      const key = 'Human (World of Warcraft)';
      const el = render({
        selectedKey: key,
        selections: { ...emptyFor(key), originFeat: 'Alert' },
        originFeats: [{ name: 'Alert' }, { name: 'Child of the Sea' }],
        featDescription: 'Add your Proficiency Bonus to Initiative.',
        blockedFeat: 'Alert',
      }).nativeElement as HTMLElement;
      const options = Array.from(el.querySelectorAll('#species-origin-feat option')).map(o => o.textContent!.trim());
      expect(options).toEqual(['— choose a feat —', 'Alert', 'Child of the Sea']);
      expect(el.querySelector('.choice-note')?.textContent).toContain('Add your Proficiency Bonus');
      expect(el.querySelector('.choice-note--warn')?.textContent).toContain('already gives you Alert');
    });

    it('shows no choices block for a species with nothing to choose', () => {
      const key = 'Orc (World of Warcraft)';
      const el = render({ selectedKey: key, selections: emptyFor(key) }).nativeElement as HTMLElement;
      expect(el.querySelector('.species-choices')).toBeNull();
    });
  });

  it('asks for a content source when the filter leaves no rows', () => {
    const el = render({ options: [] }).nativeElement as HTMLElement;
    expect(el.textContent).toContain('No species to show');
  });
});
