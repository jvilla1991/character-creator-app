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

describe('ClassStepComponent — World of Warcraft Rogue', () => {
  const WOW_ROGUE_KEY = 'Rogue (World of Warcraft)';
  const detail = { hit_die: 8, saving_throws: [{ name: 'DEX' }, { name: 'INT' }] } as unknown as DndClass;

  function render(specialization = '') {
    const fixture = TestBed.createComponent(ClassStepComponent);
    const hero = heroClassByKey(WOW_ROGUE_KEY)!;
    fixture.componentRef.setInput('classOptions', buildClassOptions(['Rogue']));
    fixture.componentRef.setInput('selectedKey', WOW_ROGUE_KEY);
    fixture.componentRef.setInput('clazz', 'Rogue');
    fixture.componentRef.setInput('classDetail', detail);
    fixture.componentRef.setInput('specialization', specialization);
    fixture.componentRef.setInput('guidance', specialization ? hero.guidance![specialization] : null);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows two "Rogue" rows, the WoW one tagged, with the SI:7 blurb and the subclass note', () => {
    const el = render();
    const rows = (Array.from(el.querySelectorAll('.accordion-head')) as HTMLElement[])
      .filter(h => h.textContent!.trim().startsWith('Rogue'));
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.source-tag')).toBeNull();
    expect(rows[1].querySelector('.source-tag')?.textContent).toContain('World of Warcraft');
    expect(el.querySelector('.hero-blurb')?.textContent).toContain('SI:7');
    expect(el.textContent).toContain('Chosen as normal at Rogue level 3');
    expect(Array.from(el.querySelectorAll('.subclass-card .subclass-name')).map(n => n.textContent!.trim()))
      .toEqual(['Assassination', 'Outlaw', 'Subtlety']);
    expect(el.querySelector('.spec-guidance')).toBeNull();
  });

  it('shows the Assassination box with mastery, subclass, the level-5 tip and feats — no spell or style rows', () => {
    const box = render('Assassination').querySelector('.spec-guidance') as HTMLElement;
    const terms = Array.from(box.querySelectorAll('dt')).map(n => n.textContent!.trim());
    expect(terms).toEqual(['Weapon Mastery', 'Level 3 subclass', 'Level 5', 'Feats']);
    expect(box.textContent).toContain('Recommended for Assassination');
    expect(box.textContent).toContain('At least one of Daggers, Shortbows');
    expect(box.textContent).toContain('Assassin');
    expect(box.textContent).toContain('Poison');
    expect(box.textContent).toContain('Poisoner');
    expect(box.textContent).toContain('Suggestions only — nothing is picked for you.');
  });

  it('shows Swashbuckler for Outlaw and Soulknife for Subtlety, with no level tip', () => {
    const outlaw = render('Outlaw').querySelector('.spec-guidance') as HTMLElement;
    expect(outlaw.textContent).toContain('Daggers, Rapiers');
    expect(outlaw.textContent).toContain('Swashbuckler');
    expect(outlaw.textContent).toContain('Martial Weapon Training');
    expect(Array.from(outlaw.querySelectorAll('dt')).map(n => n.textContent!.trim()))
      .toEqual(['Weapon Mastery', 'Level 3 subclass', 'Feats']);
    const sub = render('Subtlety').querySelector('.spec-guidance') as HTMLElement;
    expect(sub.textContent).toContain('Daggers, Maces');
    expect(sub.textContent).toContain('Soulknife');
    expect(sub.textContent).toContain('Shadow Touched');
  });
});

describe('ClassStepComponent — World of Warcraft Shaman (Barbarian)', () => {
  const SHAMAN_KEY = 'Barbarian (World of Warcraft)';
  const detail = { hit_die: 12, saving_throws: [{ name: 'STR' }, { name: 'CON' }] } as unknown as DndClass;

  function render(specialization = '') {
    const fixture = TestBed.createComponent(ClassStepComponent);
    const hero = heroClassByKey(SHAMAN_KEY)!;
    fixture.componentRef.setInput('classOptions', buildClassOptions(['Barbarian']));
    fixture.componentRef.setInput('selectedKey', SHAMAN_KEY);
    fixture.componentRef.setInput('clazz', 'Barbarian');
    fixture.componentRef.setInput('classDetail', detail);
    fixture.componentRef.setInput('specialization', specialization);
    fixture.componentRef.setInput('guidance', specialization ? hero.guidance![specialization] : null);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows "Barbarian" and a tagged "Shaman (Barbarian)" row, with the blurb, Earthen Ring note and subclass note', () => {
    const el = render();
    const heads = Array.from(el.querySelectorAll('.accordion-head')) as HTMLElement[];
    expect(heads[0].textContent!.trim()).toBe('Barbarian');
    const shamanRow = heads.find(h => h.textContent!.includes('Shaman (Barbarian)'))!;
    expect(shamanRow).toBeTruthy();
    expect(shamanRow.querySelector('.source-tag')?.textContent).toContain('World of Warcraft');
    expect(el.querySelector('.hero-blurb')?.textContent).toContain('totems');
    expect(el.querySelector('.hero-renown')?.textContent).toContain('Earthen Ring by 3');
    expect(el.textContent).toContain('Chosen as normal at Barbarian level 3');
    expect(el.textContent).toContain("Your Shaman's specialization");
    expect(Array.from(el.querySelectorAll('.subclass-card .subclass-name')).map(n => n.textContent!.trim()))
      .toEqual(['Elemental', 'Enhancement', 'Restoration']);
    expect(el.querySelector('.spec-guidance')).toBeNull();
  });

  it('shows the Elemental box: two masteries, the path plus Totems, and feats — no spell or style rows', () => {
    const box = render('Elemental').querySelector('.spec-guidance') as HTMLElement;
    expect(Array.from(box.querySelectorAll('dt')).map(n => n.textContent!.trim()))
      .toEqual(['Weapon Mastery', 'Level 3 subclass', 'Feats']);
    expect(box.textContent).toContain('Recommended for Elemental');
    expect(box.textContent).toContain('Any two of Battleaxes, Longswords, Maces');
    expect(box.textContent).toContain('Path of the Elements — plus Totems instead of Primal Knowledge.');
    expect(box.textContent).toContain('Ritual Caster');
    expect(box.textContent).toContain('Suggestions only — nothing is picked for you.');
  });

  it('shows the Enhancement and Restoration picks', () => {
    const enh = render('Enhancement').querySelector('.spec-guidance') as HTMLElement;
    expect(enh.textContent).toContain('Any two of Handaxes, Light Hammers, Scimitars, Shortswords');
    expect(enh.textContent).toContain('Path of the Spiritual Guardian — plus Totems');
    expect(enh.textContent).toContain('Dual Wielder');
    const resto = render('Restoration').querySelector('.spec-guidance') as HTMLElement;
    expect(resto.textContent).toContain('Any two of Flails, Maces, Warhammers');
    expect(resto.textContent).toContain('Path of the World Tree — plus Totems');
    expect(resto.textContent).toContain('Inspiring Leader');
  });

  it('keeps "At least one of" for the WoW Rogue', () => {
    const fixture = TestBed.createComponent(ClassStepComponent);
    const hero = heroClassByKey('Rogue (World of Warcraft)')!;
    fixture.componentRef.setInput('classOptions', buildClassOptions(['Rogue']));
    fixture.componentRef.setInput('selectedKey', hero.key);
    fixture.componentRef.setInput('specialization', 'Outlaw');
    fixture.componentRef.setInput('guidance', hero.guidance!['Outlaw']);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.spec-guidance')?.textContent)
      .toContain('At least one of Daggers, Rapiers');
  });
});

describe('ClassStepComponent — World of Warcraft Warlock', () => {
  const WOW_WARLOCK_KEY = 'Warlock (World of Warcraft)';
  const detail = { hit_die: 8, saving_throws: [{ name: 'WIS' }, { name: 'CHA' }] } as unknown as DndClass;
  const patrons = [
    { name: 'Fiend Patron', desc: 'Fiend.' },
    { name: 'Great Old One Patron', desc: 'Old One.' },
    { name: 'Archfey Patron', desc: 'Fey.' },
    { name: 'Celestial Patron', desc: 'Celestial.' },
  ];

  function render(specialization = '', recommendedSubclass = '', selectedSubclass = '') {
    const fixture = TestBed.createComponent(ClassStepComponent);
    const hero = heroClassByKey(WOW_WARLOCK_KEY)!;
    fixture.componentRef.setInput('classOptions', buildClassOptions(['Sorcerer', 'Warlock']));
    fixture.componentRef.setInput('selectedKey', WOW_WARLOCK_KEY);
    fixture.componentRef.setInput('selectedLabel', 'Warlock');
    fixture.componentRef.setInput('clazz', 'Warlock');
    fixture.componentRef.setInput('classDetail', detail);
    fixture.componentRef.setInput('spellsStep', true);
    fixture.componentRef.setInput('specialization', specialization);
    fixture.componentRef.setInput('guidance', specialization ? hero.guidance![specialization] : null);
    fixture.componentRef.setInput('requiresLevel1Subclass', true);
    fixture.componentRef.setInput('availableSubclasses', patrons);
    fixture.componentRef.setInput('recommendedSubclass', recommendedSubclass);
    fixture.componentRef.setInput('selectedSubclass', selectedSubclass);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /** The level-1 patron cards (the picker after the specialization cards). */
  function patronCards(el: HTMLElement): HTMLElement[] {
    return (Array.from(el.querySelectorAll('.subclass-card')) as HTMLElement[])
      .filter(c => c.textContent!.includes('Patron'));
  }

  it('shows a "Warlock" row tagged World of Warcraft beside the base Warlock', () => {
    const el = render();
    const rows = (Array.from(el.querySelectorAll('.accordion-head')) as HTMLElement[])
      .filter(h => h.textContent!.trim().startsWith('Warlock'));
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.source-tag')).toBeNull();
    expect(rows[1].querySelector('.source-tag')?.textContent).toContain('World of Warcraft');
    expect(rows[1].classList).toContain('active');
    expect(el.querySelector('.hero-blurb')?.textContent).toContain('Burning Legion');
    expect(el.textContent).toContain('Chosen as normal at Warlock level 1');
  });

  it('shows the specialization picker and the patron picker with no badge before a spec is chosen', () => {
    const el = render();
    const specs = (Array.from(el.querySelectorAll('.subclass-card .subclass-name')) as HTMLElement[])
      .map(n => n.textContent!.trim()).slice(0, 3);
    expect(specs).toEqual(['Affliction', 'Demonology', 'Destruction']);
    expect(patronCards(el).length).toBe(4);
    expect(el.querySelector('.subclass-recommended-badge')).toBeNull();
    expect(el.querySelector('.spec-guidance')).toBeNull();
  });

  it('labels the patron recommendation "Patron" (no level) and drops the empty Feats row', () => {
    const box = render('Demonology', 'Fiend Patron').querySelector('.spec-guidance') as HTMLElement;
    const terms = Array.from(box.querySelectorAll('dt')).map(t => t.textContent!.trim());
    expect(terms).toEqual([
      'Cantrips', 'Level 1 spells', 'Patron', 'Level 1 invocation', 'Level 2 invocations', 'From level 5, consider',
    ]);
    expect(box.textContent).not.toContain('Level 3');
    expect(box.textContent).toContain('Recommended for Demonology');
    expect(box.textContent).toContain('Eldritch Blast, Toll the Dead');
    expect(box.textContent).toContain('Arms of Hadar, Hex');
    expect(box.textContent).toContain('Fiend Patron');
    expect(box.textContent).toContain('marked “Recommended” on the Spells step');
    expect(box.textContent).toContain('The patron is marked “Recommended” in the picker below.');
  });

  it('lists the invocations per spec and marks only the World of Warcraft ones with ✦ and a TBD title', () => {
    const box = render('Demonology', 'Fiend Patron').querySelector('.spec-guidance') as HTMLElement;
    const invocations = Array.from(box.querySelectorAll('.invocation')) as HTMLElement[];
    const marked = invocations.filter(i => i.querySelector('.wow-mark')).map(i => i.textContent!.replace('✦', '').trim());
    expect(marked).toEqual(['Pact of the Legion', 'Health Funnel', 'Call of the Void', 'Expendable Minions',
      'Legion Summoning', 'Master Demonologist']);
    const plain = invocations.filter(i => !i.querySelector('.wow-mark')).map(i => i.textContent!.trim());
    expect(plain).toEqual(['Repelling Blast', 'Gift of the Depths', 'Visions of Distant Realms']);
    expect(box.querySelector('.wow-mark')!.getAttribute('title'))
      .toBe('Full text TBD — World of Warcraft invocations update.');
    expect(box.querySelector('.invocation-footnote')?.textContent)
      .toContain('Full text TBD — World of Warcraft invocations update.');

    const aff = render('Affliction', 'Great Old One Patron').querySelector('.spec-guidance') as HTMLElement;
    expect(aff.textContent).toContain('Agonizing Blast');
    expect(aff.textContent).toContain('Curse of Corruption');
    expect(aff.textContent).toContain('Eldritch Mind');
    expect(aff.textContent).not.toContain('Master Demonologist');
    const dest = render('Destruction', 'Fiend Patron').querySelector('.spec-guidance') as HTMLElement;
    expect(dest.textContent).toContain('Eldritch Blast, Thunderclap');
    expect(dest.textContent).toContain('Hellish Rebuke, Hex');
    expect(dest.textContent).not.toContain('Health Funnel');
  });

  it('badges the recommended patron for the spec without selecting it', () => {
    const el = render('Affliction', 'Great Old One Patron');
    const cards = patronCards(el);
    const recommended = cards.filter(c => c.classList.contains('recommended'));
    expect(recommended.length).toBe(1);
    expect(recommended[0].querySelector('.subclass-name')!.textContent).toContain('Great Old One Patron');
    expect(recommended[0].querySelector('.subclass-recommended-badge')!.textContent!.trim())
      .toBe('Recommended for Affliction');
    expect(cards.some(c => c.classList.contains('active'))).toBeFalse();
    expect(el.querySelectorAll('.subclass-recommended-badge').length).toBe(1);

    const demo = patronCards(render('Demonology', 'Fiend Patron', 'Archfey Patron'));
    expect(demo.find(c => c.classList.contains('recommended'))!.textContent).toContain('Fiend Patron');
    expect(demo.find(c => c.classList.contains('active'))!.textContent).toContain('Archfey Patron');
  });

  it('emits the patron only when the player clicks one', () => {
    const fixture = TestBed.createComponent(ClassStepComponent);
    fixture.componentRef.setInput('classOptions', buildClassOptions(['Warlock']));
    fixture.componentRef.setInput('selectedKey', WOW_WARLOCK_KEY);
    fixture.componentRef.setInput('clazz', 'Warlock');
    fixture.componentRef.setInput('classDetail', detail);
    fixture.componentRef.setInput('requiresLevel1Subclass', true);
    fixture.componentRef.setInput('availableSubclasses', patrons);
    fixture.componentRef.setInput('specialization', 'Destruction');
    fixture.componentRef.setInput('recommendedSubclass', 'Fiend Patron');
    const emitted: string[] = [];
    fixture.componentInstance.selectedSubclassChange.subscribe(s => emitted.push(s));
    fixture.detectChanges();
    expect(emitted).toEqual([]);
    patronCards(fixture.nativeElement)[1].click();
    expect(emitted).toEqual(['Great Old One Patron']);
  });

  it('shows no patron badge for a base Warlock', () => {
    const fixture = TestBed.createComponent(ClassStepComponent);
    fixture.componentRef.setInput('classOptions', buildClassOptions(['Warlock']));
    fixture.componentRef.setInput('selectedKey', 'Warlock');
    fixture.componentRef.setInput('clazz', 'Warlock');
    fixture.componentRef.setInput('classDetail', detail);
    fixture.componentRef.setInput('requiresLevel1Subclass', true);
    fixture.componentRef.setInput('availableSubclasses', patrons);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(patronCards(el).length).toBe(4);
    expect(el.querySelector('.subclass-recommended-badge')).toBeNull();
    expect(el.querySelector('.recommended')).toBeNull();
  });
});
