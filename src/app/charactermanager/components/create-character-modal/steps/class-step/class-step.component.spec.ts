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
    expect(box.textContent).not.toContain('Suggestions only');
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
    expect(box.textContent).not.toContain('Suggestions only');
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
    expect(box.textContent).not.toContain('Suggestions only');
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

describe('ClassStepComponent — World of Warcraft Warrior (Fighter)', () => {
  const WOW_WARRIOR_KEY = 'Fighter (World of Warcraft)';
  const detail = { hit_die: 10, saving_throws: [{ name: 'STR' }, { name: 'CON' }] } as unknown as DndClass;

  function render(specialization = '') {
    const fixture = TestBed.createComponent(ClassStepComponent);
    const hero = heroClassByKey(WOW_WARRIOR_KEY)!;
    fixture.componentRef.setInput('classOptions', buildClassOptions(['Fighter', 'Rogue']));
    fixture.componentRef.setInput('selectedKey', WOW_WARRIOR_KEY);
    fixture.componentRef.setInput('selectedLabel', 'Warrior (Fighter)');
    fixture.componentRef.setInput('clazz', 'Fighter');
    fixture.componentRef.setInput('classDetail', detail);
    fixture.componentRef.setInput('specialization', specialization);
    fixture.componentRef.setInput('guidance', specialization ? hero.guidance![specialization] : null);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows "Fighter" and a tagged "Warrior (Fighter)" row, with the blurb and subclass note', () => {
    const el = render();
    const heads = Array.from(el.querySelectorAll('.accordion-head')) as HTMLElement[];
    expect(heads[0].textContent!.trim()).toBe('Fighter');
    expect(heads[0].querySelector('.source-tag')).toBeNull();
    const warriorRow = heads.find(h => h.textContent!.includes('Warrior (Fighter)'))!;
    expect(warriorRow).toBeTruthy();
    expect(warriorRow.querySelector('.source-tag')?.textContent).toContain('World of Warcraft');
    expect(warriorRow.classList).toContain('active');
    expect(el.querySelector('.hero-blurb')?.textContent).toContain('arms and armor');
    expect(el.querySelector('.hero-renown')).toBeNull();
    expect(el.textContent).toContain('Chosen as normal at Fighter level 3');
    expect(el.textContent).toContain("Your Warrior's specialization");
    expect(Array.from(el.querySelectorAll('.subclass-card .subclass-name')).map(n => n.textContent!.trim()))
      .toEqual(['Arms', 'Fury', 'Protection']);
    expect(el.querySelector('.spec-guidance')).toBeNull();
  });

  it('shows the Arms box: mastery, level-1 fighting style, Battle Master, maneuvers and feats', () => {
    const box = render('Arms').querySelector('.spec-guidance') as HTMLElement;
    expect(Array.from(box.querySelectorAll('dt')).map(n => n.textContent!.trim())).toEqual([
      'Weapon Mastery', 'Level 1 fighting style', 'Level 3 subclass', 'Maneuvers to consider', 'Feats',
    ]);
    expect(box.textContent).toContain('Recommended for Arms');
    expect(box.textContent).toContain('At least one of Greataxes, Greatswords, Mauls');
    expect(box.textContent).toContain('Great Weapon Fighting');
    expect(box.textContent).toContain('Battle Master');
    expect(box.textContent).toContain('Great Weapon Master');
    expect(box.textContent).not.toContain('Suggestions only');
    expect(box.textContent).not.toContain('Level 2 fighting style');
  });

  it('marks only the World of Warcraft maneuvers with ✦ and explains they are not tracked', () => {
    const box = render('Protection').querySelector('.spec-guidance') as HTMLElement;
    const maneuvers = Array.from(box.querySelectorAll('.maneuver')) as HTMLElement[];
    const marked = maneuvers.filter(m => m.querySelector('.wow-mark')).map(m => m.textContent!.replace('✦', '').trim());
    expect(marked).toEqual(['Battle Shout', 'Demoralizing Shout', 'Warding Maneuver']);
    const plain = maneuvers.filter(m => !m.querySelector('.wow-mark')).map(m => m.textContent!.trim());
    expect(plain).toEqual(['Bait and Switch', 'Goading Attack', 'Maneuvering Attack', 'Parry']);
    expect(box.querySelector('.wow-mark')!.getAttribute('title')).toContain('Battle Master card');
    expect(box.querySelector('.maneuver-footnote')?.textContent).toContain("Maneuvers aren't tracked here");
    expect(box.textContent).toContain('Interception or Protection');
    expect(box.textContent).toContain('At least one of Battleaxes, Longswords, Morningstars');
    expect(box.textContent).toContain('Heavy Armor Master');

    const arms = render('Arms').querySelector('.spec-guidance') as HTMLElement;
    const armsMarked = (Array.from(arms.querySelectorAll('.maneuver')) as HTMLElement[])
      .filter(m => m.querySelector('.wow-mark')).map(m => m.textContent!.replace('✦', '').trim());
    expect(armsMarked).toEqual(['Battle Shout', 'Mortal Strike']);
    expect(arms.textContent).toContain('Trip Attack');
  });

  it('shows the Fury box: Scimitars, Two-Weapon Fighting, Champion, no maneuvers, and the Berserker aside', () => {
    const box = render('Fury').querySelector('.spec-guidance') as HTMLElement;
    expect(box.textContent).toContain('Include Scimitars');
    expect(box.textContent).toContain('Two-Weapon Fighting');
    expect(box.textContent).toContain('Champion');
    expect(box.textContent).toContain('Dual Wielder');
    expect(box.textContent).toContain('Barbarian on the Path of the Berserker');
    expect(box.textContent).not.toContain('Maneuvers to consider');
    expect(box.querySelector('.maneuver-footnote')).toBeNull();
  });

  it('keeps "Level 2 fighting style" for the WoW Paladin', () => {
    const fixture = TestBed.createComponent(ClassStepComponent);
    const hero = heroClassByKey('Paladin (World of Warcraft)')!;
    fixture.componentRef.setInput('classOptions', buildClassOptions(['Paladin']));
    fixture.componentRef.setInput('selectedKey', hero.key);
    fixture.componentRef.setInput('specialization', 'Protection');
    fixture.componentRef.setInput('guidance', hero.guidance!['Protection']);
    fixture.detectChanges();
    const box = (fixture.nativeElement as HTMLElement).querySelector('.spec-guidance')!;
    expect(box.textContent).toContain('Level 2 fighting style');
    expect(box.querySelector('.maneuver')).toBeNull();
  });
});

describe('ClassStepComponent — World of Warcraft Priest (Cleric)', () => {
  const WOW_PRIEST_KEY = 'Cleric (World of Warcraft)';
  const detail = { hit_die: 8, saving_throws: [{ name: 'WIS' }, { name: 'CHA' }] } as unknown as DndClass;

  function render(specialization = '') {
    const fixture = TestBed.createComponent(ClassStepComponent);
    const hero = heroClassByKey(WOW_PRIEST_KEY)!;
    fixture.componentRef.setInput('classOptions', buildClassOptions(['Cleric', 'Wizard']));
    fixture.componentRef.setInput('selectedKey', WOW_PRIEST_KEY);
    fixture.componentRef.setInput('selectedLabel', 'Priest (Cleric)');
    fixture.componentRef.setInput('clazz', 'Cleric');
    fixture.componentRef.setInput('classDetail', detail);
    fixture.componentRef.setInput('specialization', specialization);
    fixture.componentRef.setInput('guidance', specialization ? hero.guidance![specialization] : null);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows "Cleric" and a tagged "Priest (Cleric)" row, with the blurb and domain note', () => {
    const el = render();
    const heads = Array.from(el.querySelectorAll('.accordion-head')) as HTMLElement[];
    expect(heads[0].textContent!.trim()).toBe('Cleric');
    expect(heads[0].querySelector('.source-tag')).toBeNull();
    const priestRow = heads.find(h => h.textContent!.includes('Priest (Cleric)'))!;
    expect(priestRow.querySelector('.source-tag')?.textContent).toContain('World of Warcraft');
    expect(priestRow.classList).toContain('active');
    expect(el.querySelector('.hero-blurb')?.textContent).toContain('two opposing forces');
    expect(el.textContent).toContain('Chosen as normal at Cleric level 3');
    expect(el.textContent).toContain("Your Priest's specialization");
    expect(Array.from(el.querySelectorAll('.subclass-card .subclass-name')).map(n => n.textContent!.trim()))
      .toEqual(['Discipline', 'Holy', 'Shadow']);
    expect(el.querySelector('.spec-guidance')).toBeNull();
  });

  it('shows the Shadow box: Divine Order, cantrips, level-1 spells, Shadow Domain and feats', () => {
    const box = render('Shadow').querySelector('.spec-guidance') as HTMLElement;
    expect(Array.from(box.querySelectorAll('dt')).map(n => n.textContent!.trim())).toEqual([
      'Divine Order', 'Cantrips', 'Level 1 spells', 'Level 3 subclass', 'Feats',
    ]);
    expect(box.textContent).toContain('Recommended for Shadow');
    expect(box.textContent).toContain('Thaumaturge');
    expect(box.textContent).toContain('Mending, Resistance, Thaumaturgy, Toll the Dead');
    expect(box.textContent).toContain('Bane, Command, Healing Word, Shadow Word: Pain');
    expect(box.textContent).toContain('Shadow Domain');
    expect(box.textContent).toContain('Actor, Mage Slayer, Shadow Touched, Skulker, Telepathic');
    expect(box.textContent).not.toContain('Suggestions only');
  });

  it('recommends the Life Domain for Holy and the Discipline Domain for Discipline', () => {
    expect(render('Holy').querySelector('.spec-guidance')!.textContent).toContain('Life Domain');
    expect(render('Discipline').querySelector('.spec-guidance')!.textContent).toContain('Discipline Domain');
  });
});

describe('ClassStepComponent — World of Warcraft Evoker (Sorcerer)', () => {
  const EVOKER_KEY = 'Sorcerer (World of Warcraft)';
  const detail = { hit_die: 6, saving_throws: [{ name: 'CON' }, { name: 'CHA' }] } as unknown as DndClass;

  /** The parent passes requiresLevel1Subclass false for the Evoker (its subclass is locked). */
  function render(specialization = '') {
    const fixture = TestBed.createComponent(ClassStepComponent);
    const hero = heroClassByKey(EVOKER_KEY)!;
    fixture.componentRef.setInput('classOptions', buildClassOptions(['Sorcerer']));
    fixture.componentRef.setInput('selectedKey', EVOKER_KEY);
    fixture.componentRef.setInput('selectedLabel', 'Evoker (Sorcerer)');
    fixture.componentRef.setInput('clazz', 'Sorcerer');
    fixture.componentRef.setInput('classDetail', detail);
    fixture.componentRef.setInput('specialization', specialization);
    fixture.componentRef.setInput('guidance', specialization ? hero.guidance![specialization] : null);
    fixture.componentRef.setInput('requiresLevel1Subclass', false);
    fixture.componentRef.setInput('selectedSubclass', 'Draconic Sorcery');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows "Sorcerer" and a tagged "Evoker (Sorcerer)" row with the dragonflight blurb and the hero-class note', () => {
    const el = render();
    const heads = Array.from(el.querySelectorAll('.accordion-head')) as HTMLElement[];
    expect(heads[0].textContent!.trim()).toBe('Sorcerer');
    const evokerRow = heads.find(h => h.textContent!.includes('Evoker (Sorcerer)'))!;
    expect(evokerRow.querySelector('.source-tag')?.textContent).toContain('World of Warcraft');
    expect(evokerRow.classList).toContain('active');
    expect(el.querySelector('.hero-blurb')?.textContent).toContain('five dragonflights');
    const note = el.querySelector('.hero-note')?.textContent ?? '';
    expect(note).toContain('level 3');
    expect(note).toContain('dracthyr');
  });

  it('shows Draconic Sorcery as the fixed subclass with no subclass picker', () => {
    const el = render();
    expect(el.textContent).toContain('Draconic Sorcery');
    expect(el.textContent).toContain('(fixed)');
    expect(el.textContent).not.toContain('Choose a Subclass');
    expect(Array.from(el.querySelectorAll('.subclass-card .subclass-name')).map(n => n.textContent!.trim()))
      .toEqual(['Augmentation', 'Devastation', 'Preservation']);
  });

  it('shows the Devastation box: cantrips, spells to prepare, Metamagic, Elemental Affinity and feats — no subclass row', () => {
    const box = render('Devastation').querySelector('.spec-guidance') as HTMLElement;
    const terms = Array.from(box.querySelectorAll('dt')).map(d => d.textContent!.trim());
    expect(terms).toEqual(['Cantrips', 'Spells to prepare', 'Metamagic', 'Level 6 Elemental Affinity', 'Feats']);
    expect(box.textContent).toContain('Ray of Frost');
    expect(box.textContent).toContain('Living Flame');
    expect(box.textContent).toContain('Empowered Spell, Transmuted Spell');
    expect(box.textContent).toContain('Sorcerer level 2');
    expect(box.textContent).toContain('Cold or Fire');
    expect(box.textContent).toContain('Elemental Adept (Cold and Fire)');
    expect(box.textContent).not.toContain('Level 3');
    expect(box.textContent).not.toContain('marked “Recommended” in the picker');
  });

  it('shows the Augmentation and Preservation picks', () => {
    const aug = render('Augmentation').querySelector('.spec-guidance')!.textContent!;
    expect(aug).toContain('Thunderclap');
    expect(aug).toContain('Extended Spell');
    expect(aug).toContain('Speedy');
    const pres = render('Preservation').querySelector('.spec-guidance')!.textContent!;
    expect(pres).toContain('Blade Ward');
    expect(pres).toContain('Ray of Sickness');
    expect(pres).toContain('Heightened Spell, Twinned Spell');
    expect(pres).toContain('Lightning or Poison');
  });
});

describe('ClassStepComponent — World of Warcraft Hunter (Ranger)', () => {
  const HUNTER_KEY = 'Ranger (World of Warcraft)';
  const detail = { hit_die: 10, saving_throws: [{ name: 'STR' }, { name: 'DEX' }] } as unknown as DndClass;

  function render(specialization = '') {
    const fixture = TestBed.createComponent(ClassStepComponent);
    const hero = heroClassByKey(HUNTER_KEY)!;
    fixture.componentRef.setInput('classOptions', buildClassOptions(['Ranger']));
    fixture.componentRef.setInput('selectedKey', HUNTER_KEY);
    fixture.componentRef.setInput('selectedLabel', 'Hunter (Ranger)');
    fixture.componentRef.setInput('clazz', 'Ranger');
    fixture.componentRef.setInput('classDetail', detail);
    fixture.componentRef.setInput('specialization', specialization);
    fixture.componentRef.setInput('guidance', specialization ? hero.guidance![specialization] : null);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows "Ranger", "Demon Hunter (Ranger)" and a tagged "Hunter (Ranger)" row', () => {
    const el = render();
    const heads = (Array.from(el.querySelectorAll('.accordion-head')) as HTMLElement[]).map(h => h.textContent!.trim());
    expect(heads[0]).toBe('Ranger');
    expect(heads.filter(h => h.includes('Hunter (Ranger)')).length).toBe(2);   // Demon Hunter + Hunter
    const active = el.querySelector('.accordion-head.active') as HTMLElement;
    expect(active.textContent).toContain('Hunter (Ranger)');
    expect(active.textContent).not.toContain('Demon');
    expect(el.querySelector('.hero-blurb')?.textContent).toContain('call of the wild');
    expect(el.textContent).toContain('Chosen as normal at Ranger level 3');
  });

  it('shows the Beast Mastery box: spells, two masteries, Archery, Beast Master, the level-6 tip and feats', () => {
    const box = render('Beast Mastery').querySelector('.spec-guidance') as HTMLElement;
    const terms = Array.from(box.querySelectorAll('dt')).map(d => d.textContent!.trim());
    expect(terms).toEqual(['Level 1 spells', 'Weapon Mastery', 'Level 2 fighting style', 'Level 3 subclass', 'Level 6', 'Feats']);
    expect(box.textContent).toContain('Ensnaring Strike, Speak with Animals');
    expect(box.textContent).toContain('Any two of Heavy Crossbows, Longbows, Muskets');
    expect(box.textContent).toContain('Archery');
    expect(box.textContent).toContain('Beast Master');
    expect(box.textContent).toContain('Pet Specialization instead of Roving');
    expect(box.textContent).toContain('Weapon Master');
  });

  it('shows the Marksmanship and Survival picks', () => {
    const mm = render('Marksmanship').querySelector('.spec-guidance')!.textContent!;
    expect(mm).toContain('Cure Wounds');
    expect(mm).toContain('Hunter');
    expect(mm).toContain('Sharpshooter');
    const sv = render('Survival').querySelector('.spec-guidance')!.textContent!;
    expect(sv).toContain('Any two of Glaives, Halberds, Pikes');
    expect(sv).toContain('Great Weapon Fighting');
    expect(sv).toContain('Polearm Master');
  });
});

describe('ClassStepComponent — World of Warcraft Mage (Wizard)', () => {
  const MAGE_KEY = 'Wizard (World of Warcraft)';
  const detail = { hit_die: 6, saving_throws: [{ name: 'INT' }, { name: 'WIS' }] } as unknown as DndClass;

  function render(specialization = '') {
    const fixture = TestBed.createComponent(ClassStepComponent);
    const hero = heroClassByKey(MAGE_KEY)!;
    fixture.componentRef.setInput('classOptions', buildClassOptions(['Wizard']));
    fixture.componentRef.setInput('selectedKey', MAGE_KEY);
    fixture.componentRef.setInput('selectedLabel', 'Mage (Wizard)');
    fixture.componentRef.setInput('clazz', 'Wizard');
    fixture.componentRef.setInput('classDetail', detail);
    fixture.componentRef.setInput('specialization', specialization);
    fixture.componentRef.setInput('guidance', specialization ? hero.guidance![specialization] : null);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows "Wizard" and a tagged "Mage (Wizard)" row with the blurb and the Kirin Tor renown note', () => {
    const el = render();
    const heads = (Array.from(el.querySelectorAll('.accordion-head')) as HTMLElement[]).map(h => h.textContent!.trim());
    expect(heads[0]).toBe('Wizard');
    const active = el.querySelector('.accordion-head.active') as HTMLElement;
    expect(active.textContent).toContain('Mage (Wizard)');
    expect(active.querySelector('.source-tag')?.textContent).toContain('World of Warcraft');
    expect(el.querySelector('.hero-blurb')?.textContent).toContain('Kirin Tor of Dalaran');
    expect(el.querySelector('.hero-renown')?.textContent).toContain('Kirin Tor by 3');
    expect(el.textContent).toContain('Chosen as normal at Wizard level 3');
    expect(Array.from(el.querySelectorAll('.subclass-card .subclass-name')).map(n => n.textContent!.trim()))
      .toEqual(['Arcane', 'Fire', 'Frost']);
  });

  it('shows the Frost box: cantrips, a spellbook, the Evoker school (not the Evoker class) and feats with ✦', () => {
    const box = render('Frost').querySelector('.spec-guidance') as HTMLElement;
    const terms = Array.from(box.querySelectorAll('dt')).map(d => d.textContent!.trim());
    expect(terms).toEqual(['Cantrips', 'Spellbook', 'Level 3 subclass', 'Feats']);
    expect(box.textContent).toContain('Light, Mage Hand, Ray of Frost');
    expect(box.textContent).toContain('Detect Magic, Feather Fall, Frost Nova, Ice Knife, Mage Armor, Shield');
    expect(box.textContent).toContain('Evoker (school of evocation)');
    const feats = Array.from(box.querySelectorAll('.feat-list .feat')) as HTMLElement[];
    expect(feats.map(f => f.textContent!.replace('✦', '').trim())).toEqual(['Fingers of Frost', 'Spell Sniper', 'War Caster']);
    expect(feats.map(f => !!f.querySelector('.wow-mark'))).toEqual([true, false, false]);
    expect(feats[0].querySelector('.wow-mark')?.getAttribute('title')).toBe('World of Warcraft feat');
    expect(box.querySelector('.feat-footnote')?.textContent).toContain('World of Warcraft feat');
  });

  it('marks Clearcasting for Arcane and Hot Streak for Fire, and no PHB feat', () => {
    const marked = (spec: string) => Array.from(render(spec).querySelectorAll('.feat-list .feat'))
      .filter(f => f.querySelector('.wow-mark')).map(f => f.textContent!.replace('✦', '').trim());
    expect(marked('Arcane')).toEqual(['Clearcasting']);
    expect(marked('Fire')).toEqual(['Hot Streak']);
    const fire = render('Fire').querySelector('.spec-guidance')!.textContent!;
    expect(fire).toContain('Fire Bolt');
    expect(fire).toContain('Burning Hands');
    expect(fire).toContain('Elemental Adept');
  });

  it('keeps "Level 1 spells", the bare subclass name and no feat footnote for other variants', () => {
    const fixture = TestBed.createComponent(ClassStepComponent);
    const hunter = heroClassByKey('Ranger (World of Warcraft)')!;
    fixture.componentRef.setInput('classOptions', buildClassOptions(['Ranger']));
    fixture.componentRef.setInput('selectedKey', hunter.key);
    fixture.componentRef.setInput('clazz', 'Ranger');
    fixture.componentRef.setInput('classDetail', detail);
    fixture.componentRef.setInput('specialization', 'Marksmanship');
    fixture.componentRef.setInput('guidance', hunter.guidance!['Marksmanship']);
    fixture.detectChanges();
    const box = (fixture.nativeElement as HTMLElement).querySelector('.spec-guidance') as HTMLElement;
    expect(Array.from(box.querySelectorAll('dt')).map(d => d.textContent!.trim())).toContain('Level 1 spells');
    expect(box.querySelectorAll('.feat-list .wow-mark').length).toBe(0);
    expect(box.querySelector('.feat-footnote')).toBeNull();
  });
});

describe('ClassStepComponent — World of Warcraft Monk', () => {
  const MONK_KEY = 'Monk (World of Warcraft)';
  const detail = { hit_die: 8, saving_throws: [{ name: 'STR' }, { name: 'DEX' }] } as unknown as DndClass;

  function render(specialization = '') {
    const fixture = TestBed.createComponent(ClassStepComponent);
    const hero = heroClassByKey(MONK_KEY)!;
    fixture.componentRef.setInput('classOptions', buildClassOptions(['Monk']));
    fixture.componentRef.setInput('selectedKey', MONK_KEY);
    fixture.componentRef.setInput('selectedLabel', 'Monk');
    fixture.componentRef.setInput('clazz', 'Monk');
    fixture.componentRef.setInput('classDetail', detail);
    fixture.componentRef.setInput('specialization', specialization);
    fixture.componentRef.setInput('guidance', specialization ? hero.guidance![specialization] : null);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows two "Monk" rows, the WoW one tagged, with the pandaren blurb', () => {
    const el = render();
    const heads = (Array.from(el.querySelectorAll('.accordion-head')) as HTMLElement[])
      .filter(h => h.textContent!.trim().startsWith('Monk'));
    expect(heads.length).toBe(2);
    expect(heads[0].querySelector('.source-tag')).toBeNull();
    expect(heads[1].querySelector('.source-tag')?.textContent).toContain('World of Warcraft');
    expect(el.querySelector('.hero-blurb')?.textContent).toContain('mogu');
    expect(el.querySelector('.hero-renown')).toBeNull();
    expect(el.textContent).toContain('Chosen as normal at Monk level 3');
    expect(Array.from(el.querySelectorAll('.subclass-card .subclass-name')).map(n => n.textContent!.trim()))
      .toEqual(['Brewmaster', 'Mistweaver', 'Windwalker']);
  });

  it('shows the Brewmaster box: the Mystic Brews subclass and feats, ✦ on the monk feats, no spell rows', () => {
    const box = render('Brewmaster').querySelector('.spec-guidance') as HTMLElement;
    expect(Array.from(box.querySelectorAll('dt')).map(d => d.textContent!.trim())).toEqual(['Level 3 subclass', 'Feats']);
    expect(box.textContent).toContain('Warrior of Mystic Brews');
    const marked = Array.from(box.querySelectorAll('.feat-list .feat'))
      .filter(f => f.querySelector('.wow-mark')).map(f => f.textContent!.replace('✦', '').trim());
    expect(marked).toEqual(['Elusive Brawler', 'Stagger and Sway']);
    expect(box.querySelector('.feat-footnote')).not.toBeNull();
  });

  it('shows Warrior of Mercy with Enveloping Mist ✦, and the Open Hand with Fists of Fury ✦', () => {
    const mist = render('Mistweaver').querySelector('.spec-guidance') as HTMLElement;
    expect(mist.textContent).toContain('Warrior of Mercy');
    expect(Array.from(mist.querySelectorAll('.feat-list .feat')).filter(f => f.querySelector('.wow-mark'))
      .map(f => f.textContent!.replace('✦', '').trim())).toEqual(['Enveloping Mist']);
    const wind = render('Windwalker').querySelector('.spec-guidance') as HTMLElement;
    expect(wind.textContent).toContain('Warrior of the Open Hand');
    expect(wind.textContent).toContain('Speedy');
    expect(Array.from(wind.querySelectorAll('.feat-list .feat')).filter(f => f.querySelector('.wow-mark'))
      .map(f => f.textContent!.replace('✦', '').trim())).toEqual(['Fists of Fury']);
  });
});

describe('ClassStepComponent — level-1 subclass from another book', () => {
  const detail = { hit_die: 8, saving_throws: [{ name: 'WIS' }, { name: 'CHA' }] } as unknown as DndClass;

  function render(subclasses: { name: string; desc: string; source?: 'Arcana Unleashed' }[], selectedSubclass = ''): HTMLElement {
    const fixture = TestBed.createComponent(ClassStepComponent);
    fixture.componentRef.setInput('classOptions', buildClassOptions(['Warlock']));
    fixture.componentRef.setInput('selectedKey', 'Warlock');
    fixture.componentRef.setInput('selectedLabel', 'Warlock');
    fixture.componentRef.setInput('clazz', 'Warlock');
    fixture.componentRef.setInput('classDetail', detail);
    fixture.componentRef.setInput('requiresLevel1Subclass', true);
    fixture.componentRef.setInput('availableSubclasses', subclasses);
    fixture.componentRef.setInput('selectedSubclass', selectedSubclass);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const cards = (el: HTMLElement) => Array.from(el.querySelectorAll('.subclass-list .subclass-card')) as HTMLElement[];

  it('tags the Vestige Patron card Arcana Unleashed and leaves the handbook patrons untagged', () => {
    const el = render([
      { name: 'Fiend Patron', desc: 'Fiend.' },
      { name: 'Vestige Patron', desc: 'A dying god.', source: 'Arcana Unleashed' },
    ], 'Vestige Patron');
    const [fiend, vestige] = cards(el);
    expect(fiend.querySelector('.source-tag')).toBeNull();
    expect(vestige.querySelector('.subclass-name .source-tag')!.textContent!.trim()).toBe('Arcana Unleashed');
    expect(vestige.querySelector('.subclass-desc')!.textContent).toContain('A dying god.');
    expect(vestige.classList).toContain('active');
    expect(el.querySelector('.subclass-list + .loading')).toBeNull();
  });

  it('says so when the content-source filter leaves no subclass to show', () => {
    const el = render([]);
    expect(cards(el).length).toBe(0);
    expect(el.querySelector('.subclass-list + .loading')!.textContent).toContain('No subclasses to show. Turn on a content source above.');
  });
});
