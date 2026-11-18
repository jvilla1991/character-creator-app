import { TestBed } from '@angular/core/testing';
import { ClassStepComponent } from './class-step.component';
import { buildClassOptions, heroClassByKey } from '../../../../models/hero-class';
import { DndClass } from '../../../../models/dnd-api.types';

describe('ClassStepComponent — World of Warcraft Druid', () => {
  const WOW_DRUID_KEY = 'Druid (World of Warcraft)';
  const detail = { hit_die: 8, saving_throws: [{ name: 'INT' }, { name: 'WIS' }] } as unknown as DndClass;

  function render(specialization = '') {
    const fixture = TestBed.createComponent(ClassStepComponent);
    const hero = heroClassByKey(WOW_DRUID_KEY)!;
    fixture.componentRef.setInput('classOptions', buildClassOptions(['Druid']));
    fixture.componentRef.setInput('selectedKey', WOW_DRUID_KEY);
    fixture.componentRef.setInput('selectedLabel', 'Druid');
    fixture.componentRef.setInput('clazz', 'Druid');
    fixture.componentRef.setInput('classDetail', detail);
    fixture.componentRef.setInput('specialization', specialization);
    fixture.componentRef.setInput('guidance', specialization ? hero.guidance![specialization] : null);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows two "Druid" rows, the WoW one tagged with its source, and expands only the chosen one', () => {
    const el = render();
    const heads = Array.from(el.querySelectorAll('.accordion-head')) as HTMLElement[];
    const druidRows = heads.filter(h => h.textContent!.trim().startsWith('Druid'));
    expect(druidRows.length).toBe(2);
    expect(druidRows[0].querySelector('.source-tag')).toBeNull();
    expect(druidRows[1].querySelector('.source-tag')?.textContent).toContain('World of Warcraft');
    expect(druidRows[1].classList).toContain('active');
    expect(druidRows[0].classList).not.toContain('active');
    expect(el.querySelectorAll('.accordion-body').length).toBe(1);
  });

  it('notes the subclass is chosen normally and reminds about Cenarion Circle renown', () => {
    const el = render();
    expect(el.textContent).toContain('Chosen as normal at Druid level 3');
    expect(el.textContent).not.toContain('(fixed)');
    expect(el.querySelector('.hero-renown')?.textContent).toContain('Cenarion Circle by 3');
  });

  it('shows the specialization picker and no guidance box until a spec is chosen', () => {
    const el = render();
    expect(Array.from(el.querySelectorAll('.subclass-card .subclass-name')).map(n => n.textContent!.trim()))
      .toEqual(['Balance', 'Feral', 'Guardian', 'Restoration']);
    expect(el.querySelector('.spec-guidance')).toBeNull();
  });

  it('shows the "Recommended for <spec>" box once a spec is chosen', () => {
    const box = render('Guardian').querySelector('.spec-guidance') as HTMLElement;
    expect(box.textContent).toContain('Recommended for Guardian');
    expect(box.textContent).toContain('Primal Order');
    expect(box.textContent).toContain('Warden');
    expect(box.textContent).toContain('Thorn Whip');
    expect(box.textContent).toContain('Circle of the Moon');
    expect(box.textContent).toContain('Bear Form');
    expect(box.textContent).toContain('Sentinel');
  });

  it('emits the row key when a row is clicked', () => {
    const fixture = TestBed.createComponent(ClassStepComponent);
    fixture.componentRef.setInput('classOptions', buildClassOptions(['Druid']));
    fixture.detectChanges();
    const emitted: string[] = [];
    fixture.componentInstance.toggle.subscribe(k => emitted.push(k));
    const heads = Array.from(fixture.nativeElement.querySelectorAll('.accordion-head') as NodeListOf<HTMLButtonElement>)
      .filter(h => h.textContent!.trim().startsWith('Druid'));
    heads[0].click();
    heads[1].click();
    expect(emitted).toEqual(['Druid', WOW_DRUID_KEY]);
  });
});

describe('ClassStepComponent — World of Warcraft Paladin', () => {
  const WOW_PALADIN_KEY = 'Paladin (World of Warcraft)';
  const detail = { hit_die: 10, saving_throws: [{ name: 'WIS' }, { name: 'CHA' }] } as unknown as DndClass;

  function render(specialization: string) {
    const fixture = TestBed.createComponent(ClassStepComponent);
    const hero = heroClassByKey(WOW_PALADIN_KEY)!;
    fixture.componentRef.setInput('classOptions', buildClassOptions(['Paladin']));
    fixture.componentRef.setInput('selectedKey', WOW_PALADIN_KEY);
    fixture.componentRef.setInput('clazz', 'Paladin');
    fixture.componentRef.setInput('classDetail', detail);
    fixture.componentRef.setInput('specialization', specialization);
    fixture.componentRef.setInput('guidance', hero.guidance![specialization]);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the Holy box: spells as text, mastery, Blessed Warrior cantrips, oath, feats and the cleric aside', () => {
    const el = render('Holy');
    const box = el.querySelector('.spec-guidance') as HTMLElement;
    expect(box.textContent).toContain('Recommended for Holy');
    expect(box.textContent).not.toContain('Cantrips');
    expect(box.textContent).toContain('Cure Wounds, Shield of Faith');
    expect(box.textContent).toContain('At least one of Flails, Longswords, Morningstars, Warhammers');
    expect(box.textContent).toContain('Blessed Warrior');
    expect(box.textContent).toContain('Sacred Flame, Spare the Dying');
    expect(box.textContent).toContain('Oath of the Holy');
    expect(box.textContent).toContain('Inspiring Leader');
    expect(box.textContent).toContain('War Domain');
    expect(box.textContent).not.toContain('Spells step');
    expect(el.textContent).toContain('Chosen as normal at Paladin level 3');
  });

  it('shows "or" between Protection\'s fighting styles and the Retribution picks', () => {
    expect(render('Protection').querySelector('.spec-guidance')!.textContent).toContain('Interception or Protection');
    const ret = render('Retribution').querySelector('.spec-guidance')!.textContent!;
    expect(ret).toContain('Great Weapon Fighting');
    expect(ret).toContain('Greataxes, Greatswords, Mauls');
    expect(ret).toContain('Oath of Vengeance');
    expect(ret).toContain('Great Weapon Master');
  });
});
