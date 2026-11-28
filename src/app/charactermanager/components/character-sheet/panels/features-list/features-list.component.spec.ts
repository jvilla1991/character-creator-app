import { FeaturesListComponent } from './features-list.component';
import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { of, Subject } from 'rxjs';
import { DndResourcesService } from '../../../../services/dnd-resources.service';
import { ClassFeatureService } from '../../../../services/class-feature.service';
import { PreferencesService } from '../../../../services/preferences.service';
import { ClassFeatureProgressionEntry } from '../../../../models/class-feature';
import { PC } from '../../../../models/pc';

describe('FeaturesListComponent', () => {
  let component: FeaturesListComponent;
  let dndResources: jasmine.SpyObj<DndResourcesService>;
  let classFeatureService: jasmine.SpyObj<ClassFeatureService>;
  let showLockedFeatures: WritableSignal<boolean>;
  let setShowLockedFeatures: jasmine.Spy;

  /** A slice of the Paladin roadmap: class features plus two Oath of Devotion ones. */
  const PALADIN_ROADMAP: ClassFeatureProgressionEntry[] = [
    { level: 2, name: 'Fighting Style', desc: 'A style.', subclass: false },
    { level: 3, name: 'Sacred Weapon', desc: 'Bless a weapon.', subclass: true },
    { level: 5, name: 'Extra Attack', desc: 'Attack twice.', subclass: false },
    { level: 6, name: 'Aura of Protection', desc: 'Bonus to saves.', subclass: false },
    { level: 7, name: 'Aura of Devotion', desc: 'No charm.', subclass: true },
  ];

  beforeEach(() => {
    dndResources = jasmine.createSpyObj<DndResourcesService>(
      'DndResourcesService', ['getFeatDescription', 'getFeatNames']);
    dndResources.getFeatDescription.and.returnValue('Looked-up feat text.');
    dndResources.getFeatNames.and.returnValue(['Alert', 'Lucky', 'Skilled']);
    classFeatureService = jasmine.createSpyObj<ClassFeatureService>('ClassFeatureService', ['progression']);
    classFeatureService.progression.and.returnValue(of([]));
    showLockedFeatures = signal(true);
    setShowLockedFeatures = jasmine.createSpy('setShowLockedFeatures')
      .and.callFake((show: boolean) => showLockedFeatures.set(show));
    TestBed.configureTestingModule({
      providers: [
        { provide: DndResourcesService, useValue: dndResources },
        { provide: ClassFeatureService, useValue: classFeatureService },
        { provide: PreferencesService, useValue: { showLockedFeatures, setShowLockedFeatures } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new FeaturesListComponent(dndResources));
    component.pc = { id: 1, name: 'X', clazz: 'Fighter', level: 4, playerName: 'P' } as PC;
  });

  /** A level-N Oath of Devotion Paladin with the given saved features, on the Paladin roadmap. */
  function paladin(level: number, features: PC['features'] = []): PC {
    classFeatureService.progression.and.returnValue(of(PALADIN_ROADMAP));
    return { id: 2, name: 'Uther', clazz: 'Paladin', subclass: 'Oath of Devotion', level,
      playerName: 'P', features } as PC;
  }

  // --- Limited-use features: a counter under the feature it belongs to ---

  describe('class resource counters', () => {
    it('puts a counter under the listed feature it belongs to', () => {
      const surge = { name: 'Action Surge', source: 'Fighter 2', desc: 'Act again.' };
      component.pc = { ...component.pc, features: [surge], classResources: { actionSurge: 1 } };

      expect(component.resourceFor(surge)).toEqual(jasmine.objectContaining({ key: 'actionSurge', used: 1, remaining: 0 }));
    });

    it('gives a level 1 feature the list does not carry a row of its own', () => {
      component.pc = { ...component.pc, features: [{ name: 'Action Surge', source: 'Fighter 2', desc: '' }] };

      // Second Wind is a Fighter 1 feature: not on the roadmap, not saved here.
      expect(component.unlistedResources.map(r => r.feature)).toEqual(['Second Wind']);
    });

    it('matches points to the feature that grants them (Sorcery Points under Font of Magic)', () => {
      const font = { name: 'Font of Magic', source: 'Sorcerer 2', desc: 'Points.' };
      component.pc = { id: 3, name: 'Z', clazz: 'Sorcerer', level: 5, playerName: 'P', features: [font] } as PC;

      expect(component.resourceFor(font)?.name).toBe('Sorcery Points');
      expect(component.unlistedResources).toEqual([]);
    });

    it('uses a saved level 1 feature when the character has one', () => {
      const wind = { name: 'Second Wind', source: 'Fighter 1', desc: 'Heal.' };
      component.pc = { ...component.pc, features: [wind] };

      expect(component.resourceFor(wind)?.key).toBe('secondWind');
      expect(component.unlistedResources.map(r => r.key)).toEqual(['actionSurge']);
    });

    it('leaves Death Coil and Soul Fragments to the hero-class panel', () => {
      component.pc = { id: 4, name: 'T', clazz: 'Paladin', subclass: 'Oath of the Ebon Blade', level: 5,
        playerName: 'P', features: [] } as PC;

      expect(component.unlistedResources.map(r => r.key)).toEqual(['channelDivinity']); // no deathCoil here
    });

    it('leaves Arcane Shot to the Arcane Shot panel, and keeps Magical Ammunition as an ordinary counter', () => {
      const shot = { name: 'Arcane Shot', source: 'Fighter 3', desc: 'Shots.' };
      const ammunition = { name: 'Magical Ammunition', source: 'Fighter 7', desc: 'Imbue.' };
      const surge = { name: 'Action Surge', source: 'Fighter 2', desc: 'Act again.' };
      component.pc = {
        ...component.pc, subclass: 'Arcane Archer', level: 7, stats: { STR: 10, DEX: 16, CON: 12, INT: 16, WIS: 10, CHA: 8 },
        features: [surge, shot, ammunition], classResources: { arcaneShot: 1, magicalAmmunition: 1 },
      };

      // The feature row stays, without a counter: the uses are shown once, on the panel.
      expect(component.classFeatures).toContain(shot);
      expect(component.resourcesFor(shot)).toEqual([]);
      expect(component.resourceFor(ammunition)).toEqual(jasmine.objectContaining({ key: 'magicalAmmunition', used: 1, remaining: 0 }));
      expect(component.resourceFor(surge)?.key).toBe('actionSurge');
      expect(component.unlistedResources.map(r => r.key)).toEqual(['secondWind']);

      // Not listed as a feature either (an older character): still no stray Arcane Shot row.
      component.pc = { ...component.pc, features: [surge] };
      expect(component.unlistedResources.map(r => r.key)).toEqual(['secondWind', 'magicalAmmunition']);
    });

    it('shows nothing for a class with no tracked resource', () => {
      component.pc = { id: 5, name: 'W', clazz: 'Wizard', level: 5, playerName: 'P', features: [] } as PC;
      expect(component.unlistedResources).toEqual([]);
    });

    it('puts a feat\'s counters under the feat, both of them when it has two', () => {
      const friend = { name: 'Familiar Friend', source: 'Familiar Trainer · Origin Feat', desc: 'A familiar.' };
      const resistant = { name: 'Spell Resistant', source: 'Feat (Level 4)', desc: '' };
      component.pc = {
        ...component.pc, feat: 'Familiar Friend', features: [friend, resistant],
        classResources: { helpfulFriend: 1, magicResistant: 2 },
      };

      expect(component.resourcesFor(friend).map(r => [r.key, r.used, r.remaining]))
        .toEqual([['findFamiliarFreeCast', 0, 1], ['helpfulFriend', 1, 1]]);
      expect(component.resourcesFor(friend)).toBe(component.resourcesFor(friend));   // stable for the template
      expect(component.resourceFor(friend)?.key).toBe('findFamiliarFreeCast');
      expect(component.resourcesFor(resistant).map(r => [r.key, r.used, r.remaining])).toEqual([['magicResistant', 2, 0]]);
      // The Fighter's own level 1 and 2 features are not saved here: they keep their rows.
      expect(component.unlistedResources.map(r => r.key)).toEqual(['secondWind', 'actionSurge']);
      expect(component.unlistedResources.map(r => component.unlistedSource(r))).toEqual(['Fighter', 'Fighter']);
    });

    it('gives a feat counter a row of its own, marked Feat, when the feat is not in the list', () => {
      component.pc = { ...component.pc, clazz: 'Wizard', feat: 'Portal Jumper', features: [] };

      expect(component.unlistedResources.map(r => [r.feature, r.name, r.max])).toEqual([['Portal Jumper', 'Portal Step', 2]]);
      expect(component.unlistedSource(component.unlistedResources[0])).toBe('Feat');
    });

    it('renders the counters under the feat and saves a use spent on one', () => {
      const fixture = TestBed.createComponent(FeaturesListComponent);
      fixture.componentRef.setInput('pc', {
        id: 9, name: 'Tam', clazz: 'Rogue', level: 5, playerName: 'P', feat: 'Familiar Friend',
        features: [{ name: 'Familiar Friend', source: 'Familiar Trainer · Origin Feat', desc: 'A familiar.' }],
        classResources: { helpfulFriend: 1 },
      } as PC);
      fixture.componentRef.setInput('resourcesEditable', true);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const rows = Array.from(el.querySelectorAll('.feature')) as HTMLElement[];
      expect(rows.length).toBe(1);
      expect(rows[0].querySelector('.feature-name')!.textContent).toContain('Familiar Friend');
      expect(rows[0].querySelectorAll('app-resource-counter').length).toBe(2);
      expect(rows[0].textContent).toContain('Find Familiar (free cast)');
      expect(rows[0].textContent).toContain('Helpful Friend');
      expect(el.querySelector('[data-resource-feature]')).toBeNull();

      const emitted: PC[] = [];
      fixture.componentInstance.pcChange.subscribe(p => emitted.push(p));
      const [cast] = fixture.componentInstance.resourcesFor(fixture.componentInstance.classFeatures[0]);
      fixture.componentInstance.setResourceUsed(cast, 1);
      expect(emitted[0].classResources).toEqual({ findFamiliarFreeCast: 1, helpfulFriend: 1 });
    });

    it('emits the character with the new used amount when the viewer may edit', () => {
      const emitted: PC[] = [];
      component.pcChange.subscribe(p => emitted.push(p));
      component.pc = { ...component.pc, classResources: { secondWind: 1 } };
      const wind = component.unlistedResources.find(r => r.key === 'secondWind')!;

      component.setResourceUsed(wind, 2); // read-only: nothing happens
      expect(emitted).toEqual([]);

      component.resourcesEditable = true;
      component.setResourceUsed(wind, 2);
      expect(emitted.length).toBe(1);
      expect(emitted[0].classResources).toEqual({ secondWind: 2 });
      expect(emitted[0].id).toBe(1);
    });
  });

  // --- Category filtering (the Other Features panel owns 'other' entries) ---

  it('classFeatures keeps untagged and class-tagged entries, dropping other-tagged ones', () => {
    component.pc = {
      ...component.pc,
      features: [
        { name: 'Rage', source: 'Barbarian 1', desc: 'Fury.' },
        { name: 'Darkvision', source: 'Species', desc: 'See in the dark.', category: 'other' },
        { name: 'Second Wind', source: 'Fighter 1', desc: 'Heal.', category: 'class' },
      ],
    };
    expect(component.classFeatures.map(f => f.name)).toEqual(['Rage', 'Second Wind']);
  });

  it('classFeatures is empty for an undefined features list', () => {
    component.pc = { ...component.pc, features: undefined };
    expect(component.classFeatures).toEqual([]);
  });

  it('uses a class feature\'s own description', () => {
    const desc = component.descFor({ name: 'Action Surge', source: 'Fighter 2', desc: 'Extra action.' });
    expect(desc).toBe('Extra action.');
    expect(dndResources.getFeatDescription).not.toHaveBeenCalled();
  });

  it('falls back to the feat lookup for a feat with no description', () => {
    const desc = component.descFor({ name: 'Sentinel', source: 'Feat (Level 4)', desc: '' });
    expect(desc).toBe('Looked-up feat text.');
    expect(dndResources.getFeatDescription).toHaveBeenCalledWith('Sentinel');
  });

  it('returns empty for a non-feat with no description', () => {
    const desc = component.descFor({ name: 'Mystery', source: 'Background', desc: '' });
    expect(desc).toBe('');
    expect(dndResources.getFeatDescription).not.toHaveBeenCalled();
  });

  // --- DM grant form ---

  it('keeps the grant form closed by default and hidden when addAllowed is false', () => {
    expect(component.addAllowed).toBeFalse();
    expect(component.grantFormOpen).toBeFalse();
  });

  it('opens the grant form on request', () => {
    component.addAllowed = true;
    component.openGrantForm();
    expect(component.grantFormOpen).toBeTrue();
  });

  it('blocks submission with a blank name', () => {
    component.addAllowed = true;
    component.openGrantForm();
    const emitted = jasmine.createSpy('emitted');
    component.featureGranted.subscribe(emitted);

    component.nameDraft = '   ';
    component.submitGrant();

    expect(emitted).not.toHaveBeenCalled();
    expect(component.grantFormOpen).toBeTrue(); // form stays open
  });

  it('emits a trimmed payload with the default source and resets the form', () => {
    component.addAllowed = true;
    component.openGrantForm();
    const emitted = jasmine.createSpy('emitted');
    component.featureGranted.subscribe(emitted);

    component.nameDraft = '  Blessing of the Old Gods  ';
    component.descDraft = '  Grants advantage on death saves.  ';
    component.submitGrant();

    expect(emitted).toHaveBeenCalledWith({
      name: 'Blessing of the Old Gods',
      source: 'DM Grant',
      desc: 'Grants advantage on death saves.',
    });
    expect(component.grantFormOpen).toBeFalse();
    expect(component.nameDraft).toBe('');
    expect(component.sourceDraft).toBe('DM Grant');
    expect(component.descDraft).toBe('');
  });

  it('emits a custom source when the DM overrides it', () => {
    component.addAllowed = true;
    component.openGrantForm();
    const emitted = jasmine.createSpy('emitted');
    component.featureGranted.subscribe(emitted);

    component.nameDraft = 'Boon of Vitality';
    component.sourceDraft = '  Divine Boon  ';
    component.submitGrant();

    expect(emitted).toHaveBeenCalledWith({
      name: 'Boon of Vitality',
      source: 'Divine Boon',
      desc: '',
    });
  });

  it('resets the form on cancel without emitting', () => {
    component.addAllowed = true;
    component.openGrantForm();
    const emitted = jasmine.createSpy('emitted');
    component.featureGranted.subscribe(emitted);

    component.nameDraft = 'Half-typed';
    component.cancelGrant();

    expect(emitted).not.toHaveBeenCalled();
    expect(component.grantFormOpen).toBeFalse();
    expect(component.nameDraft).toBe('');
  });

  // --- Feat typeahead ---

  it('shows the full feat list when the name draft is blank', () => {
    component.nameDraft = '';
    expect(component.filteredFeats).toEqual(['Alert', 'Lucky', 'Skilled']);
  });

  it('narrows the feat list case-insensitively', () => {
    component.nameDraft = 'al';
    expect(component.filteredFeats).toEqual(['Alert']);
  });

  it('opens the dropdown on focus and input, closes on blur', () => {
    component.onNameFocus();
    expect(component.featDropdownOpen).toBeTrue();
    component.onNameBlur();
    expect(component.featDropdownOpen).toBeFalse();
    component.onNameInput();
    expect(component.featDropdownOpen).toBeTrue();
  });

  it('selectFeat fills name, source, and description, and closes the dropdown', () => {
    component.featDropdownOpen = true;
    component.selectFeat('Alert');

    expect(component.nameDraft).toBe('Alert');
    expect(component.sourceDraft).toBe('Feat');
    expect(component.descDraft).toBe('Looked-up feat text.');
    expect(component.featDropdownOpen).toBeFalse();
    expect(dndResources.getFeatDescription).toHaveBeenCalledWith('Alert');
  });

  it('submits non-matching typed text as a custom feat, unchanged', () => {
    component.addAllowed = true;
    component.openGrantForm();
    const emitted = jasmine.createSpy('emitted');
    component.featureGranted.subscribe(emitted);

    component.nameDraft = 'Homebrew Boon';
    component.submitGrant();

    expect(emitted).toHaveBeenCalledWith({ name: 'Homebrew Boon', source: 'DM Grant', desc: '' });
  });

  it('Escape closes the dropdown first, then cancels the form on a second Escape', () => {
    component.addAllowed = true;
    component.openGrantForm();
    component.nameDraft = 'Half-typed';
    component.featDropdownOpen = true;

    component.onNameEscape();
    expect(component.featDropdownOpen).toBeFalse();
    expect(component.grantFormOpen).toBeTrue();

    component.onNameEscape();
    expect(component.grantFormOpen).toBeFalse();
    expect(component.nameDraft).toBe('');
  });

  it('reset (via cancel) closes the dropdown too', () => {
    component.addAllowed = true;
    component.openGrantForm();
    component.featDropdownOpen = true;

    component.cancelGrant();

    expect(component.featDropdownOpen).toBeFalse();
  });

  // --- Class feature roadmap: locked features and filled-in gaps ---

  it('asks for the roadmap of the class, subclass and specialization', () => {
    component.pc = { id: 3, name: 'Arthas', clazz: 'Paladin', subclass: 'Oath of the Ebon Blade',
      specialization: 'Frost', level: 2, playerName: 'P' } as PC;
    expect(classFeatureService.progression)
      .toHaveBeenCalledWith('Paladin', 'Oath of the Ebon Blade', 'Frost');
  });

  it('refetches the roadmap only when class, subclass or specialization changes', () => {
    classFeatureService.progression.calls.reset();
    const pc = paladin(3);
    component.pc = pc;
    component.pc = { ...pc, level: 4, name: 'Renamed' }; // an unrelated edit and a level-up
    expect(classFeatureService.progression).toHaveBeenCalledTimes(1);

    component.pc = { ...pc, subclass: 'Oath of Glory' };
    expect(classFeatureService.progression).toHaveBeenCalledTimes(2);
  });

  it('lists roadmap features above the level as locked, in level order', () => {
    component.pc = paladin(5);
    expect(component.lockedFeatures).toEqual([
      { name: 'Aura of Protection', desc: 'Bonus to saves.', level: 6, source: 'Level 6' },
      { name: 'Aura of Devotion', desc: 'No charm.', level: 7, source: 'Oath of Devotion · Level 7' },
    ]);
  });

  it('has no locked features when the roadmap is empty (demo mode, unknown class)', () => {
    expect(component.lockedFeatures).toEqual([]);
  });

  it('moves a feature from locked to unlocked when the character levels up', () => {
    const pc = paladin(5);
    component.pc = pc;
    expect(component.lockedFeatures.map(f => f.name)).toContain('Aura of Protection');

    component.pc = { ...pc, level: 6 };
    expect(component.lockedFeatures.map(f => f.name)).toEqual(['Aura of Devotion']);
    expect(component.classFeatures.map(f => f.name)).toContain('Aura of Protection');
  });

  it('fills in roadmap features at or below the level that are not saved on the character', () => {
    component.pc = paladin(5, [
      { name: 'Lay on Hands', source: 'Paladin 1', desc: 'Heal.' },
      { name: 'Fighting Style', source: 'Paladin 2', desc: 'Saved text.' },
      { name: 'Extra Attack', source: 'Paladin 5', desc: 'Saved text.' },
    ]);
    // Sacred Weapon (the level-3 subclass feature) was never saved: it is filled in after the
    // saved entries, worded the way a level-up would have recorded it.
    expect(component.classFeatures).toEqual([
      { name: 'Lay on Hands', source: 'Paladin 1', desc: 'Heal.' },
      { name: 'Fighting Style', source: 'Paladin 2', desc: 'Saved text.' },
      { name: 'Extra Attack', source: 'Paladin 5', desc: 'Saved text.' },
      { name: 'Sacred Weapon', source: 'Paladin 3', desc: 'Bless a weapon.' },
    ]);
  });

  it('matches saved features to the roadmap by name, ignoring case and spacing', () => {
    component.pc = paladin(3, [
      { name: ' fighting style ', source: 'Paladin 2', desc: '' },
      { name: 'SACRED WEAPON', source: 'DM Grant', desc: '', category: 'other' },
    ]);
    // Both are already on the character (one in the Other Features panel): nothing is filled in.
    expect(component.classFeatures.map(f => f.name)).toEqual([' fighting style ']);
  });

  it('fills in a feature gained twice only as often as it is missing', () => {
    classFeatureService.progression.and.returnValue(of([
      { level: 2, name: 'Expertise', desc: 'Two skills.', subclass: false },
      { level: 9, name: 'Expertise', desc: 'Two more skills.', subclass: false },
    ]));
    component.pc = { id: 4, name: 'Lute', clazz: 'Bard', level: 9, playerName: 'P',
      features: [{ name: 'Expertise', source: 'Bard 2', desc: 'Two skills.' }] } as PC;
    expect(component.classFeatures).toEqual([
      { name: 'Expertise', source: 'Bard 2', desc: 'Two skills.' },
      { name: 'Expertise', source: 'Bard 9', desc: 'Two more skills.' },
    ]);
  });

  it('shows locked features once a slow roadmap request arrives', () => {
    const response = new Subject<ClassFeatureProgressionEntry[]>();
    classFeatureService.progression.and.returnValue(response);
    component.pc = { id: 5, name: 'Slow', clazz: 'Paladin', level: 5, playerName: 'P' } as PC;
    expect(component.lockedFeatures).toEqual([]);

    response.next(PALADIN_ROADMAP);
    expect(component.lockedFeatures.map(f => f.name)).toEqual(['Aura of Protection', 'Aura of Devotion']);
  });

  it('toggleLocked flips the remembered preference', () => {
    expect(component.showLocked()).toBeTrue();
    component.toggleLocked();
    expect(setShowLockedFeatures).toHaveBeenCalledWith(false);
    expect(component.showLocked()).toBeFalse();
    component.toggleLocked();
    expect(setShowLockedFeatures).toHaveBeenCalledWith(true);
  });

  // --- Rendering ---

  describe('rendered', () => {
    function render(pc: PC) {
      const fixture = TestBed.createComponent(FeaturesListComponent);
      fixture.componentRef.setInput('pc', pc);
      fixture.detectChanges();
      return fixture;
    }
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

    it('draws locked features dimmed with a padlock, below the unlocked ones', () => {
      const el: HTMLElement = render(paladin(5, [
        { name: 'Extra Attack', source: 'Paladin 5', desc: 'Attack twice.' },
      ])).nativeElement;

      const rows = Array.from(el.querySelectorAll('.feature'));
      const locked = rows.filter(r => r.classList.contains('locked'));
      expect(locked.length).toBe(2);
      expect(rows.indexOf(locked[0])).toBeGreaterThan(rows.findIndex(r => !r.classList.contains('locked')));
      expect(text(locked[0].querySelector('.feature-name'))).toBe('Locked: Aura of Protection');
      expect(text(locked[1].querySelector('.feature-source'))).toBe('Oath of Devotion · Level 7');
      expect(locked[0].querySelector('svg.lock-mark')).not.toBeNull();
      expect(el.textContent).not.toContain('Yet to unlock');
    });

    it('offers a pressed lock toggle counting the locked features', () => {
      const el: HTMLElement = render(paladin(5)).nativeElement;
      const toggle = el.querySelector<HTMLButtonElement>('.lock-toggle')!;
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      expect(toggle.getAttribute('aria-label')).toBe('Hide locked features');
      expect(text(toggle.querySelector('.lock-count'))).toBe('2');
    });

    it('hides the locked list behind a one-line summary when toggled off', () => {
      const fixture = render(paladin(5));
      const el: HTMLElement = fixture.nativeElement;
      el.querySelector<HTMLButtonElement>('.lock-toggle')!.click();
      fixture.detectChanges();

      expect(el.querySelectorAll('.feature.locked').length).toBe(0);
      expect(text(el.querySelector('.locked-summary'))).toBe('2 more features unlock at higher levels.');
      const toggle = el.querySelector<HTMLButtonElement>('.lock-toggle')!;
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      expect(toggle.getAttribute('aria-label')).toBe('Show locked features');
    });

    it('starts collapsed when the remembered preference is hidden', () => {
      showLockedFeatures.set(false);
      const el: HTMLElement = render(paladin(6)).nativeElement;
      expect(el.querySelectorAll('.feature.locked').length).toBe(0);
      expect(text(el.querySelector('.locked-summary'))).toBe('1 more feature unlocks at a higher level.');
    });

    it('shows no lock toggle when nothing is locked', () => {
      const el: HTMLElement = render(paladin(20)).nativeElement;
      expect(el.querySelector('.lock-toggle')).toBeNull();
      expect(el.querySelector('.locked-summary')).toBeNull();
    });
  });

  // --- World of Warcraft feats (✦) ---

  it('marks a World of Warcraft feat the character took with ✦, and nothing else', () => {
    expect(component.featNoteFor({ name: 'Fingers of Frost', source: 'Feat', desc: '' })).toBe('World of Warcraft feat');
    expect(component.featNoteFor({ name: 'Hot Streak', source: 'feat (level 4)', desc: '' })).toBe('World of Warcraft feat');
    expect(component.featNoteFor({ name: 'War Caster', source: 'Feat', desc: '' })).toBeUndefined();
    expect(component.featNoteFor({ name: 'Clearcasting', source: 'DM Grant', desc: 'x' })).toBeUndefined();
    expect(component.featNote('Clearcasting')).toBe('World of Warcraft feat');
    expect(component.featNote('Alert')).toBeUndefined();

    const fixture = TestBed.createComponent(FeaturesListComponent);
    fixture.componentRef.setInput('pc', {
      id: 3, name: 'Elandra', clazz: 'Wizard', level: 5, playerName: 'Q',
      features: [
        { name: 'Arcane Recovery', source: 'Wizard 1', desc: 'Recover slots.' },
        { name: 'Fingers of Frost', source: 'Feat', desc: '' },
      ],
    } as PC);
    fixture.detectChanges();
    const names = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.feature-name')) as HTMLElement[];
    const marked = names.filter(n => n.querySelector('.wow-mark')).map(n => n.textContent!.replace('✦', '').trim());
    expect(marked).toEqual(['Fingers of Frost']);
    expect(names.find(n => n.querySelector('.wow-mark'))!.querySelector('.wow-mark')!.getAttribute('title'))
      .toBe('World of Warcraft feat');
  });

  // --- Arcana Unleashed feats (✦) ---

  it('marks an Arcana Unleashed feat the same way, wherever the character got it', () => {
    expect(component.featNote('Evocation Adept')).toBe('Arcana Unleashed feat');
    expect(component.featNote('Boon of Magic School Mastery (Illusion)')).toBe('Arcana Unleashed feat');
    expect(component.featNoteFor({ name: 'Familiar Friend', source: 'Familiar Trainer · Origin Feat', desc: 'x' }))
      .toBe('Arcana Unleashed feat');
    expect(component.featNoteFor({ name: 'Arcane Warrior', source: 'Fighting Style (Level 2)', desc: 'x' }))
      .toBe('Arcana Unleashed feat');
    expect(component.featNoteFor({ name: 'Spell Resistant', source: 'Feat (Level 4)', desc: '' }))
      .toBe('Arcana Unleashed feat');
    // A feature that only shares a feat's name is not a feat.
    expect(component.featNoteFor({ name: 'Spell Resistant', source: 'Paladin 6', desc: 'x' })).toBeUndefined();

    const fixture = TestBed.createComponent(FeaturesListComponent);
    fixture.componentRef.setInput('pc', {
      id: 4, name: 'Mirel', clazz: 'Wizard', level: 4, playerName: 'Q', feat: 'Familiar Friend',
      features: [
        { name: 'Familiar Friend', source: 'Familiar Trainer · Origin Feat', desc: 'A familiar.' },
        { name: 'Arcane Recovery', source: 'Wizard 1', desc: 'Recover slots.' },
        { name: 'Evocation Adept', source: 'Feat (Level 4)', desc: '' },
      ],
    } as PC);
    fixture.detectChanges();
    const names = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.feature-name')) as HTMLElement[];
    const marked = names.filter(n => n.querySelector('.wow-mark'));
    expect(marked.map(n => n.textContent!.replace('✦', '').trim())).toEqual(['Familiar Friend', 'Evocation Adept']);
    for (const name of marked) {
      expect(name.querySelector('.wow-mark')!.getAttribute('title')).toBe('Arcana Unleashed feat');
      expect(name.querySelector('.wow-mark')!.getAttribute('aria-label')).toBe('Arcana Unleashed feat');
    }
  });
});
