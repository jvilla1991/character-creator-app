import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RecommendedSpellsComponent } from './recommended-spells.component';
import { ClassFeatureProgressionEntry } from '../../../../models/class-feature';
import { DndSpell } from '../../../../models/dnd-api.types';
import { PC } from '../../../../models/pc';
import { ClassFeatureService } from '../../../../services/class-feature.service';
import { DndResourcesService } from '../../../../services/dnd-resources.service';

describe('RecommendedSpellsComponent', () => {
  let dndResources: jasmine.SpyObj<DndResourcesService>;
  let classFeatures: jasmine.SpyObj<ClassFeatureService>;

  const spell = (name: string, level: number, source?: 'World of Warcraft'): DndSpell => ({
    name, level, school: 'abjuration', classes: [], actionType: 'action', concentration: false, ritual: false,
    range: 'Self', components: ['v'], duration: 'Instantaneous', description: `${name} rules text.`,
    ...(source ? { source } : {}),
  });

  const SPELLS = [
    spell('Shield of Faith', 1), spell('Protection from Evil and Good', 1), spell('Aid', 2),
    spell('Wrath', 0, 'World of Warcraft'), spell('Moonfire', 1, 'World of Warcraft'),
  ];

  const DEVOTION: ClassFeatureProgressionEntry[] = [
    { level: 2, name: 'Divine Smite', desc: 'You always have the Divine Smite spell prepared.', subclass: false },
    { level: 3, name: 'Oath of Devotion Spells', subclass: true,
      desc: 'You always have these spells prepared. 3rd — Protection from Evil and Good, Shield of Faith; '
        + '5th — Aid, Zone of Truth; 9th — Beacon of Hope, Dispel Magic.' },
  ];

  const pc = (overrides: Partial<PC>): PC => ({
    id: 1, name: 'Mira', clazz: 'Bard', level: 1, playerName: 'Pat', ...overrides,
  });

  beforeEach(() => {
    dndResources = jasmine.createSpyObj<DndResourcesService>('DndResourcesService', ['getSpells']);
    dndResources.getSpells.and.returnValue(of(SPELLS));
    classFeatures = jasmine.createSpyObj<ClassFeatureService>('ClassFeatureService', ['progression']);
    classFeatures.progression.and.returnValue(of([]));
    TestBed.configureTestingModule({ providers: [
      { provide: DndResourcesService, useValue: dndResources },
      { provide: ClassFeatureService, useValue: classFeatures },
    ] });
  });

  function render(character: PC | null, embedded = false) {
    const fixture = TestBed.createComponent(RecommendedSpellsComponent);
    fixture.componentRef.setInput('pc', character);
    fixture.componentRef.setInput('embedded', embedded);
    // The roadmap arrives through an effect-backed observable: settle it, then render the answer.
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture;
  }

  const texts = (el: HTMLElement, selector: string) =>
    Array.from(el.querySelectorAll(selector)).map(n => n.textContent!.replace(/\s+/g, ' ').trim());

  it('renders nothing, and loads no spell data, for a character that casts no spells', () => {
    for (const character of [pc({ clazz: 'Barbarian' }), pc({ clazz: 'Fighter', subclass: 'Champion', level: 5 }), null]) {
      const el = render(character).nativeElement as HTMLElement;
      expect(el.textContent!.trim()).withContext(character?.clazz ?? 'null').toBe('');
      expect(el.querySelector('.panel')).toBeNull();
    }
    expect(dndResources.getSpells).not.toHaveBeenCalled();
  });

  it("shows a base-game class the Player's Handbook's starting cantrips and level 1 spells", () => {
    const el = render(pc({ clazz: 'Bard' })).nativeElement as HTMLElement;
    expect(el.querySelector('.panel-title')!.textContent).toBe('Recommended Spells');
    expect(texts(el, '.hero-spells-title')).toEqual(['Starting spells']);
    expect(texts(el, '.hero-spells-note'))
      .toEqual(["The Player's Handbook recommends these for a new Bard. They are suggestions only."]);
    expect(texts(el, 'dt')).toEqual(['Cantrips', 'Level 1']);
    expect(texts(el, 'dd')).toEqual([
      'Dancing Lights, Vicious Mockery',
      'Charm Person, Color Spray, Dissonant Whispers, Healing Word',
    ]);
    // No subclass yet, so there is no subclass list to read.
    expect(classFeatures.progression).not.toHaveBeenCalled();
  });

  it('has no cantrip row for a Paladin or Ranger, and calls a Wizard\'s level 1 spells its spellbook', () => {
    const paladin = render(pc({ clazz: 'Paladin' })).nativeElement as HTMLElement;
    expect(texts(paladin, 'dt')).toEqual(['Level 1']);
    expect(texts(paladin, 'dd')).toEqual(['Heroism, Searing Smite']);
    const wizard = render(pc({ clazz: 'Wizard' })).nativeElement as HTMLElement;
    expect(texts(wizard, 'dt')).toEqual(['Cantrips', 'Spellbook']);
  });

  it('marks the recommended spells the character already knows or has prepared', () => {
    const el = render(pc({ clazz: 'Paladin', spells: [
      { lvl: 1, name: 'Heroism', prepared: true } as any,
      { lvl: 1, name: 'searing smite', prepared: false } as any,
    ] })).nativeElement as HTMLElement;
    // The tag sits beside the name with a CSS gap, so the two read as one run of text.
    expect(texts(el, '.suggested-spell.known')).toEqual(['Heroismprepared', 'Searing Smiteknown']);
    expect(texts(el, '.spell-tag')).toEqual(['prepared', 'known']);
  });

  it('shows an Eldritch Knight the picks its subclass teaches at Fighter level 3', () => {
    const el = render(pc({ clazz: 'Fighter', subclass: 'Eldritch Knight', level: 3 })).nativeElement as HTMLElement;
    expect(texts(el, '.hero-spells-title')).toEqual(['Eldritch Knight starting spells']);
    expect(texts(el, '.hero-spells-note')).toEqual([
      "The Player's Handbook recommends these for a new Eldritch Knight, at Fighter level 3. They are suggestions only.",
    ]);
    expect(texts(el, 'dd')).toEqual(['Ray of Frost, Shocking Grasp', 'Burning Hands, Jump, Shield']);
  });

  describe('subclass spells', () => {
    beforeEach(() => classFeatures.progression.and.returnValue(of(DEVOTION)));

    it("lists a base-game subclass's always-prepared spells up to the character's level, and what is still to come", () => {
      const el = render(pc({ clazz: 'Paladin', subclass: 'Oath of Devotion', level: 5 })).nativeElement as HTMLElement;
      expect(classFeatures.progression).toHaveBeenCalledWith('Paladin', 'Oath of Devotion', null);
      expect(texts(el, '.hero-spells-title')).toEqual(['Starting spells', 'Oath of Devotion Spells']);
      expect(texts(el, '.hero-spell-name'))
        .toEqual(['Protection from Evil and Good', 'Shield of Faith', 'Aid', 'Zone of Truth']);
      expect(texts(el, '.hero-spell-meta')[0]).toBe('Paladin 3 · Level 1 abjuration');
      expect(texts(el, '.hero-spell-meta')[2]).toBe('Paladin 5 · Level 2 abjuration');
      expect(texts(el, '.subclass-spells-upcoming')).toEqual(['Still to come: Beacon of Hope, Dispel Magic at level 9.']);
      expect(texts(el, '.hero-spell-desc')[1]).toBe('Shield of Faith rules text.');
    });

    it('shows only what is still to come before the list starts', () => {
      const el = render(pc({ clazz: 'Paladin', subclass: 'Oath of Devotion', level: 2 })).nativeElement as HTMLElement;
      expect(el.querySelector('.hero-spells')).toBeNull();
      expect(texts(el, '.subclass-spells-upcoming')).toEqual([
        'Still to come: Protection from Evil and Good, Shield of Faith at level 3; Aid, Zone of Truth at level 5; '
        + 'Beacon of Hope, Dispel Magic at level 9.',
      ]);
    });

    it('shows no "still to come" line once every row has arrived', () => {
      const el = render(pc({ clazz: 'Paladin', subclass: 'Oath of Devotion', level: 9 })).nativeElement as HTMLElement;
      expect(texts(el, '.hero-spell-name').length).toBe(6);
      expect(el.querySelector('.subclass-spells-upcoming')).toBeNull();
    });

    it('reads the new roadmap when the subclass changes', () => {
      const fixture = render(pc({ clazz: 'Paladin', subclass: 'Oath of Devotion', level: 5 }));
      classFeatures.progression.and.returnValue(of([{ level: 3, name: 'Oath of Glory Spells', subclass: true,
        desc: 'You always have these spells prepared. 3rd — Guiding Bolt, Heroism.' }]));
      fixture.componentRef.setInput('pc', pc({ clazz: 'Paladin', subclass: 'Oath of Glory', level: 5 }));
      fixture.detectChanges();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(classFeatures.progression).toHaveBeenCalledWith('Paladin', 'Oath of Glory', null);
      expect(texts(el, '.hero-spells-title')).toEqual(['Starting spells', 'Oath of Glory Spells']);
      expect(texts(el, '.hero-spell-name')).toEqual(['Guiding Bolt', 'Heroism']);
    });

    it('does not ask again while only the level or the spells change', () => {
      const fixture = render(pc({ clazz: 'Paladin', subclass: 'Oath of Devotion', level: 3 }));
      fixture.componentRef.setInput('pc', pc({ clazz: 'Paladin', subclass: 'Oath of Devotion', level: 5 }));
      fixture.detectChanges();
      fixture.detectChanges();
      expect(classFeatures.progression).toHaveBeenCalledTimes(1);
      expect(texts(fixture.nativeElement, '.hero-spell-name').length).toBe(4);
    });
  });

  describe('World of Warcraft characters (embedded in the hero-class panel)', () => {
    it('draws no frame or title of its own when embedded', () => {
      const el = render(pc({ clazz: 'Paladin', subclass: 'Oath of the Ebon Blade', specialization: 'Frost' }), true)
        .nativeElement as HTMLElement;
      expect(el.querySelector('.panel')).toBeNull();
      expect(el.querySelector('.panel-title')).toBeNull();
      expect(texts(el, '.hero-spells-title')).toEqual(['Starting spells']);
    });

    it("gives a Death Knight the Paladin's handbook picks and leaves its spell table to the hero panel", () => {
      const el = render(pc({ clazz: 'Paladin', subclass: 'Oath of the Ebon Blade', specialization: 'Frost', level: 5 }), true)
        .nativeElement as HTMLElement;
      expect(texts(el, '.hero-spells-note'))
        .toEqual(["The Player's Handbook recommends these for a new Paladin. They are suggestions only."]);
      expect(texts(el, 'dd')).toEqual(['Heroism, Searing Smite']);
      expect(classFeatures.progression).not.toHaveBeenCalled();
    });

    it("gives a specialization the World of Warcraft book's picks, marking World of Warcraft spells", () => {
      const el = render(pc({ clazz: 'Druid', specialization: 'Balance' }), true).nativeElement as HTMLElement;
      expect(texts(el, '.hero-spells-note'))
        .toEqual(['The World of Warcraft book recommends these for a new Balance Druid. They are suggestions only.']);
      expect(texts(el, 'dd')).toEqual([
        'Druidcraft, Starry Wisp, Wrath✦',
        'Cure Wounds, Entangle, Moonfire✦, Thunderwave',
      ]);
    });

    it("adds a base-game subclass's spells for a World of Warcraft class, but not a WoW-only subclass's", () => {
      classFeatures.progression.and.returnValue(of(DEVOTION));
      const devotion = render(pc({ clazz: 'Paladin', subclass: 'Oath of Devotion', specialization: 'Protection', level: 3 }), true)
        .nativeElement as HTMLElement;
      expect(classFeatures.progression).toHaveBeenCalledWith('Paladin', 'Oath of Devotion', 'Protection');
      expect(texts(devotion, '.hero-spells-title')).toEqual(['Starting spells', 'Oath of Devotion Spells']);

      classFeatures.progression.calls.reset();
      const holy = render(pc({ clazz: 'Paladin', subclass: 'Oath of the Holy', specialization: 'Holy', level: 3 }), true)
        .nativeElement as HTMLElement;
      expect(classFeatures.progression).not.toHaveBeenCalled();
      expect(texts(holy, '.hero-spells-title')).toEqual(['Starting spells']);
    });
  });
});
