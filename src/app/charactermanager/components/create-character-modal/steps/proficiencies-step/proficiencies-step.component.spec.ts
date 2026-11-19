import { TestBed } from '@angular/core/testing';
import { ProficienciesStepComponent } from './proficiencies-step.component';

describe('ProficienciesStepComponent — species proficiencies', () => {
  const CLASS_SKILLS = { choose: 2, from: ['Arcana', 'History', 'Insight', 'Stealth'] };

  function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(ProficienciesStepComponent);
    fixture.componentRef.setInput('clazz', 'Wizard');
    fixture.componentRef.setInput('classSkillConfig', CLASS_SKILLS);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return fixture;
  }

  const section = (el: HTMLElement, heading: string) =>
    Array.from(el.querySelectorAll('.prof-section'))
      .find(s => s.querySelector('.eyebrow')?.textContent?.includes(heading)) as HTMLElement | undefined;

  it('shows no species section for a character whose species gives no proficiencies', () => {
    const el = render().nativeElement as HTMLElement;
    expect(section(el, 'Proficiencies')).toBeUndefined();
  });

  it('shows a granted skill as held, and locks its class chip', () => {
    const el = render({
      species: 'Elf', speciesGrantedSkills: ['Stealth'], lockedSkills: ['Stealth'],
    }).nativeElement as HTMLElement;
    const species = section(el, 'Elf Proficiencies')!;
    expect(species.querySelector('span.class-pick.locked')?.textContent).toBe('Stealth');
    const classChip = Array.from(section(el, 'Wizard Skills')!.querySelectorAll('button'))
      .find(b => b.textContent!.trim() === 'Stealth')!;
    expect(classChip.disabled).toBeTrue();
    expect(classChip.classList).toContain('locked');
  });

  it('offers the species skill choice, with a counter, and emits the clicked skill', () => {
    const fixture = render({
      species: 'Elf',
      speciesSkillChoice: { count: 1, from: ['Insight', 'Perception', 'Survival'] },
      speciesSkillPicks: [],
      selectedSkills: ['Insight'],
    });
    const el = fixture.nativeElement as HTMLElement;
    const species = section(el, 'Elf Proficiencies')!;
    expect(species.querySelector('.prof-counter')?.textContent?.trim()).toBe('0/1 chosen');
    const chips = Array.from(species.querySelectorAll('.species-skill-picks button')) as HTMLButtonElement[];
    expect(chips.map(c => c.textContent!.trim())).toEqual(['Insight', 'Perception', 'Survival']);
    // Insight is already a class pick, so it can't be the species pick too.
    expect(chips[0].disabled).toBeTrue();
    expect(chips[1].disabled).toBeFalse();

    const emitted: string[] = [];
    fixture.componentInstance.toggleSpeciesSkill.subscribe(s => emitted.push(s));
    chips[1].click();
    expect(emitted).toEqual(['Perception']);
  });

  it('marks the picked species skill and dims the rest once the pick is made', () => {
    const el = render({
      species: 'Elf',
      speciesSkillChoice: { count: 1, from: ['Insight', 'Perception', 'Survival'] },
      speciesSkillPicks: ['Perception'],
      lockedSkills: ['Perception'],
    }).nativeElement as HTMLElement;
    const species = section(el, 'Elf Proficiencies')!;
    expect(species.querySelector('.prof-counter')?.classList).toContain('complete');
    const chips = Array.from(species.querySelectorAll('.species-skill-picks button')) as HTMLButtonElement[];
    expect(chips[1].classList).toContain('active');
    expect(chips[1].getAttribute('aria-pressed')).toBe('true');
    expect(chips[0].classList).toContain('disabled');
    // Still clickable, so the pick can be undone.
    expect(chips[1].disabled).toBeFalse();
  });

  it('gives a Mechagnome two tool dropdowns that never offer the other one\'s pick', () => {
    const fixture = render({
      species: 'Mechagnome', speciesToolCount: 2,
      speciesToolOptions: ['Lute', 'Dice', 'Smith\'s Tools'], speciesTools: ['Lute', ''],
    });
    const el = fixture.nativeElement as HTMLElement;
    const selects = Array.from(el.querySelectorAll('.species-tool-row select')) as HTMLSelectElement[];
    expect(selects.length).toBe(2);
    const optionsOf = (s: HTMLSelectElement) => Array.from(s.options).map(o => o.textContent!.trim());
    expect(optionsOf(selects[0])).toEqual(['— choose a tool —', 'Lute', 'Dice', 'Smith\'s Tools']);
    expect(optionsOf(selects[1])).toEqual(['— choose a tool —', 'Dice', 'Smith\'s Tools']);
    expect(fixture.componentInstance.toolOptionsFor(1)).not.toContain('Lute');
  });

  describe('languages by allegiance', () => {
    const langSelects = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('select[name^="languageChoice"]')) as HTMLSelectElement[];
    const optionsOf = (s: HTMLSelectElement) => Array.from(s.options).slice(1).map(o => o.textContent!.trim());

    it('shows no allegiance picker and two dropdowns for a base-game species', () => {
      const el = render({ standardLanguages: ['Elvish', 'Giant'] }).nativeElement as HTMLElement;
      expect(el.querySelector('.allegiance-row')).toBeNull();
      expect(langSelects(el).length).toBe(2);
      expect(el.querySelector('.language-hint')).toBeNull();
    });

    it('offers the three allegiances, marks the one in force, and emits a click', () => {
      const fixture = render({
        allegiances: ['Alliance', 'Horde', 'Unaffiliated'], allegiance: 'Horde',
        languageHint: 'You know Orcish, plus two languages of the Horde.',
        standardLanguages: ['Zandali', 'Goblin'],
      });
      const el = fixture.nativeElement as HTMLElement;
      const chips = Array.from(el.querySelectorAll('.allegiance-row button')) as HTMLButtonElement[];
      expect(chips.map(c => c.textContent!.trim())).toEqual(['Alliance', 'Horde', 'Unaffiliated']);
      expect(chips[1].classList).toContain('active');
      expect(chips[1].getAttribute('aria-pressed')).toBe('true');
      expect(el.querySelector('.language-hint')?.textContent).toContain('Orcish');

      const emitted: string[] = [];
      fixture.componentInstance.allegianceChange.subscribe(a => emitted.push(a));
      chips[0].click();
      expect(emitted).toEqual(['Alliance']);
    });

    it('shows a third dropdown for the unaffiliated, and no dropdown offers another one\'s pick', () => {
      const el = render({
        allegiances: ['Alliance', 'Horde', 'Unaffiliated'], allegiance: 'Unaffiliated', languageCount: 3,
        standardLanguages: ['Common', 'Orcish', 'Pandaren', 'Zandali'],
        languageChoice: 'Common', languageChoice2: 'Pandaren', languageChoice3: 'Zandali',
      }).nativeElement as HTMLElement;
      const selects = langSelects(el);
      expect(selects.length).toBe(3);
      expect(optionsOf(selects[0])).toEqual(['Common', 'Orcish']);
      expect(optionsOf(selects[1])).toEqual(['Orcish', 'Pandaren']);
      expect(optionsOf(selects[2])).toEqual(['Orcish', 'Zandali']);
    });

    it('ignores a left-over third pick while only two dropdowns show', () => {
      const fixture = render({
        standardLanguages: ['Elvish', 'Giant', 'Orc'], languageChoice3: 'Orc',
      });
      expect(fixture.componentInstance.firstLanguageOptions).toContain('Orc');
    });
  });

  it('without a lockedSkills list, still locks the background\'s skills on the class chips', () => {
    const el = render({ backgroundSkillProfs: ['Arcana'] }).nativeElement as HTMLElement;
    const arcana = Array.from(section(el, 'Wizard Skills')!.querySelectorAll('button'))
      .find(b => b.textContent!.trim() === 'Arcana')!;
    expect(arcana.disabled).toBeTrue();
  });
});
