import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { PC } from '../../../models/pc';
import { Follower } from '../../../models/follower';
import { buildSpellFollower } from '../../../models/spell-followers';
import { FollowerService } from '../../../services/follower.service';
import { NotificationService } from '../../../services/notification.service';
import { SpellFollowerDialogComponent } from './spell-follower-dialog.component';

describe('SpellFollowerDialogComponent', () => {
  let fixture: ComponentFixture<SpellFollowerDialogComponent>;
  let component: SpellFollowerDialogComponent;
  let followers: jasmine.SpyObj<FollowerService>;
  let notifications: jasmine.SpyObj<NotificationService>;
  let closed: number;

  /** A level 9 Druid with Wisdom 18: spell attack +8, save DC 16. */
  const druid = (over: Partial<PC> = {}): PC => ({
    id: 7, name: 'Wren', clazz: 'Druid', level: 9, playerName: 'Sam', prof: 4,
    stats: { STR: 10, DEX: 14, CON: 14, INT: 12, WIS: 18, CHA: 8 },
    ...over,
  });

  const pip = (hp = 1): Follower => ({
    id: 3, pcId: 7, name: 'Pip', kind: 'FAMILIAR',
    statBlock: { ...buildSpellFollower('Find Familiar', druid(), { form: 'Owl', creatureType: 'Fey' })!.statBlock,
      hp: { max: 1, cur: hp, temp: 0 } },
  });

  const el = (): HTMLElement => fixture.nativeElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  const labels = () => Array.from(el().querySelectorAll('.field label')).map(l => l.textContent!.trim());
  const field = <T extends HTMLElement>(label: string): T => {
    const found = Array.from(el().querySelectorAll('.field')).find(f => f.querySelector('label')!.textContent!.trim() === label);
    return found!.querySelector<T>('input, select')!;
  };
  const options = (label: string) =>
    Array.from(field<HTMLSelectElement>(label).options).map(o => o.textContent!.trim());
  const button = (label: string) =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent!.trim() === label)!;

  function choose(label: string, option: string): void {
    const select = field<HTMLSelectElement>(label);
    select.value = Array.from(select.options).find(o => o.textContent!.trim() === option)!.value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function type(value: string): void {
    const input = field<HTMLInputElement>('Name');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function open(spellName: string, pc: PC = druid(), current: Follower[] = []): void {
    fixture?.destroy(); // a test may open more than one in turn
    followers.list.and.returnValue(of(current));
    fixture = TestBed.createComponent(SpellFollowerDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('pc', pc);
    fixture.componentRef.setInput('spellName', spellName);
    closed = 0;
    component.closed.subscribe(() => closed++);
    fixture.detectChanges();
  }

  beforeEach(() => {
    followers = jasmine.createSpyObj<FollowerService>('FollowerService', ['list', 'summon']);
    followers.summon.and.callFake((pcId, name, statBlock, kind) => of({ id: 9, pcId, name, statBlock, kind }));
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['notify', 'error']);
    TestBed.configureTestingModule({
      imports: [SpellFollowerDialogComponent],
      providers: [
        { provide: FollowerService, useValue: followers },
        { provide: NotificationService, useValue: notifications },
      ],
    });
  });

  afterEach(() => fixture?.destroy());

  describe('a summon', () => {
    it('is a dialog named after the spell, asking only for a name, the slot level and the form', () => {
      open('Summon Dinosaur');

      expect(el().querySelector('.modal .modal-title')!.textContent).toContain('Summon Dinosaur');
      expect(el().querySelector('.modal')!.getAttribute('role')).toBe('dialog');
      expect(labels()).toEqual(['Name', 'Slot level', 'Form']);
      expect(options('Slot level')).toEqual(['6th level', '7th level', '8th level', '9th level']);
      expect(options('Form')).toEqual(['Ankylosaur', 'Triceratops', 'Tyrannosaur']);
      expect(field<HTMLInputElement>('Name').value).toBe('Ankylosaur Spirit');
      expect(el().querySelector('.follower-dialog-summary')!.textContent!.trim()).toBe('AC 19 · HP 60');
      // A summon touches no familiar, so it never asks for the list.
      expect(followers.list).not.toHaveBeenCalled();
      expect(el().querySelector('em, i')).toBeNull();
    });

    it('the name follows the form until the player types one', () => {
      open('Summon Plant');
      expect(field<HTMLInputElement>('Name').value).toBe('Fungus Spirit');

      choose('Form', 'Vine');
      expect(field<HTMLInputElement>('Name').value).toBe('Vine Spirit');

      type('Creeper');
      choose('Form', 'Tree');
      expect(field<HTMLInputElement>('Name').value).toBe('Creeper');
    });

    it('a higher slot shows what it is worth, and the follower is built with it', () => {
      open('Summon Dinosaur');
      choose('Form', 'Tyrannosaur');
      choose('Slot level', '8th level');
      expect(el().querySelector('.follower-dialog-summary')!.textContent!.trim()).toBe('AC 19 · HP 80');

      button('Add follower').click();
      fixture.detectChanges();

      const expected = buildSpellFollower('Summon Dinosaur', druid(), { form: 'Tyrannosaur', slotLevel: 8 })!;
      expect(followers.summon).toHaveBeenCalledOnceWith(7, 'Tyrannosaur Spirit', expected.statBlock, 'SUMMON');
      expect(notifications.notify).toHaveBeenCalledOnceWith('Tyrannosaur Spirit joined your followers.');
      expect(closed).toBe(1);
    });

    it('Enter in the name adds it, under the typed name', () => {
      open('Summon Plant');
      type('  Old Mossback ');

      field<HTMLInputElement>('Name').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(followers.summon.calls.mostRecent().args[1]).toBe('Old Mossback');
      expect(followers.summon.calls.mostRecent().args[3]).toBe('SUMMON');
    });

    it('needs a name', () => {
      open('Summon Plant');
      type('   ');

      expect(button('Add follower').disabled).toBeTrue();
      component.add();
      expect(followers.summon).not.toHaveBeenCalled();
    });

    it('a refusal keeps the dialog open and says why in the server\'s words', () => {
      open('Summon Plant');
      followers.summon.and.returnValue(throwError(() =>
        ({ status: 409, error: { message: 'A character can have at most 20 followers' } })));

      button('Add follower').click();
      fixture.detectChanges();

      expect(el().querySelector('[role="alert"]')!.textContent!.trim()).toBe('A character can have at most 20 followers');
      expect(closed).toBe(0);
      expect(notifications.notify).not.toHaveBeenCalled();
      expect(button('Add follower').disabled).toBeFalse();
    });

    it('a failure the server did not explain gets a plain message', () => {
      open('Summon Plant');
      followers.summon.and.returnValue(throwError(() => ({ status: 500, error: { message: 'NullPointerException' } })));

      button('Add follower').click();
      fixture.detectChanges();

      expect(el().querySelector('[role="alert"]')!.textContent!.trim()).toBe('Could not add the follower. Try again.');
    });

    it('Cancel and the backdrop close it; neither does while the save is on its way', () => {
      open('Summon Plant');
      const pending = new Subject<Follower>();
      followers.summon.and.returnValue(pending);
      button('Add follower').click();
      fixture.detectChanges();

      expect(button('Add follower').disabled).toBeTrue(); // no double add
      button('Cancel').click();
      el().querySelector<HTMLElement>('.modal-backdrop')!.click();
      expect(closed).toBe(0);

      pending.next({ id: 9, pcId: 7, name: 'Fungus Spirit', statBlock: {} });
      pending.complete();
      expect(closed).toBe(1);

      open('Summon Plant');
      button('Cancel').click();
      expect(closed).toBe(1);
      expect(followers.summon).toHaveBeenCalledTimes(1);
    });
  });

  describe('Find Familiar', () => {
    it('asks for the form and the creature type, and no slot level', () => {
      open('Find Familiar');

      expect(labels()).toEqual(['Name', 'Form', 'Creature type']);
      expect(options('Form')).toEqual(
        ['Bat', 'Cat', 'Frog', 'Hawk', 'Lizard', 'Octopus', 'Owl', 'Rat', 'Raven', 'Spider', 'Weasel']);
      expect(options('Creature type')).toEqual(['Celestial', 'Fey', 'Fiend']);
      expect(field<HTMLInputElement>('Name').value).toBe('Bat');
      expect(text()).not.toContain('Replaces');
    });

    it('adds a FAMILIAR built from the choices', () => {
      open('Find Familiar');
      choose('Form', 'Owl');
      choose('Creature type', 'Fiend');
      type('Soot');

      button('Add follower').click();

      const expected = buildSpellFollower('Find Familiar', druid(), { form: 'Owl', creatureType: 'Fiend' })!;
      expect(followers.summon).toHaveBeenCalledOnceWith(7, 'Soot', expected.statBlock, 'FAMILIAR');
      expect(notifications.notify).toHaveBeenCalledOnceWith('Soot joined your followers.');
    });

    it('says a current familiar will be replaced', () => {
      open('Find Familiar', druid(), [
        { id: 1, pcId: 7, name: 'Brannoc', statBlock: {} },
        pip(),
      ]);

      expect(followers.list).toHaveBeenCalledOnceWith(7);
      expect(el().querySelector('.follower-dialog-note')!.textContent!.trim())
        .toBe('Replaces your current familiar, Pip.');
    });

    it('still opens when the followers cannot be listed', () => {
      followers.list.and.returnValue(throwError(() => new Error('offline')));
      fixture = TestBed.createComponent(SpellFollowerDialogComponent);
      fixture.componentRef.setInput('pc', druid());
      fixture.componentRef.setInput('spellName', 'Find Familiar');
      fixture.detectChanges();

      expect(labels()).toEqual(['Name', 'Form', 'Creature type']);
    });

    it('asks for a damage type only for the feats that need one', () => {
      const feats = (...names: string[]) =>
        druid({ features: names.map(name => ({ name, source: 'Feat (Level 4)', desc: '' })) });

      open('Find Familiar', feats('Soothing Familiar', 'Warlike Familiar'));
      expect(labels()).toEqual(['Name', 'Form', 'Creature type']);

      open('Find Familiar', feats('Elemental Familiar'));
      expect(labels()).toEqual(['Name', 'Form', 'Creature type', 'Elemental Familiar damage']);
      expect(options('Elemental Familiar damage')).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']);

      open('Find Familiar', feats('Elemental Familiar', 'Otherworldly Familiar'));
      expect(labels()).toEqual(['Name', 'Form', 'Creature type', 'Elemental Familiar damage',
        'Otherworldly Familiar resistance']);
      expect(options('Otherworldly Familiar resistance')).toEqual(['Necrotic', 'Poison', 'Psychic', 'Radiant', 'Thunder']);
    });

    it('builds the familiar with the feats\' Hit Points and the chosen damage types', () => {
      const pc = druid({
        feat: 'Familiar Friend',
        features: ['Elemental Familiar', 'Otherworldly Familiar'].map(name => ({ name, source: 'Feat', desc: '' })),
      });
      open('Find Familiar', pc);
      choose('Form', 'Cat');
      choose('Elemental Familiar damage', 'Fire');
      choose('Otherworldly Familiar resistance', 'Radiant');
      expect(el().querySelector('.follower-dialog-summary')!.textContent!.trim()).toBe('AC 12 · HP 20'); // 2 + 2 x 9

      button('Add follower').click();

      const block = followers.summon.calls.mostRecent().args[2];
      expect(block.hp).toEqual({ max: 20, cur: 20, temp: 0 });
      expect(block.features!.find(f => f.name === 'Elemental Resistance')!.desc).toBe('Resistance to Fire damage.');
      expect(block.features!.find(f => f.name === 'Energy Resistance')!.desc).toBe('Resistance to Radiant damage.');
    });
  });

  describe('Battle Familiar', () => {
    it('with no familiar: slot level, form and creature type, added as a SUMMON', () => {
      open('Battle Familiar');

      expect(labels()).toEqual(['Name', 'Slot level', 'Form', 'Creature type']);
      expect(options('Slot level')[0]).toBe('2nd level');
      expect(options('Form')).toEqual(['Brute', 'Flyer', 'Stalker']);
      expect(el().querySelector('.follower-dialog-check')).toBeNull();
      expect(el().querySelector('.follower-dialog-summary')!.textContent!.trim()).toBe('AC 15 · HP 30');

      button('Add follower').click();
      expect(followers.summon.calls.mostRecent().args[3]).toBe('SUMMON');
      expect(followers.summon.calls.mostRecent().args[1]).toBe('Battle Familiar');
    });

    it('with a familiar: empowers it by default, keeping its Hit Points and type', () => {
      const familiar = pip();
      open('Battle Familiar', druid(), [familiar]);

      const check = el().querySelector<HTMLInputElement>('.follower-dialog-check input')!;
      expect(el().querySelector('.follower-dialog-check')!.textContent!.trim()).toBe('Empower Pip');
      expect(check.checked).toBeTrue();
      expect(labels()).toEqual(['Name', 'Slot level', 'Form']); // its own creature type stays
      expect(field<HTMLInputElement>('Name').value).toBe('Pip (Battle Familiar)');
      expect(el().querySelector('.follower-dialog-summary')!.textContent!.trim()).toBe('AC 15 · HP 1 + 30 temporary');
      expect(text()).not.toContain('Replaces');

      button('Add follower').click();

      const expected = buildSpellFollower('Battle Familiar', druid(), { form: 'Brute', slotLevel: 2, empower: familiar })!;
      expect(followers.summon).toHaveBeenCalledOnceWith(7, 'Pip (Battle Familiar)', expected.statBlock, 'SUMMON');
      expect(expected.statBlock.clazz).toBe('Battle Familiar (Fey)');
    });

    it('unticking it conjures a separate battle familiar instead', () => {
      open('Battle Familiar', druid(), [pip()]);

      const check = el().querySelector<HTMLInputElement>('.follower-dialog-check input')!;
      check.checked = false;
      check.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(labels()).toEqual(['Name', 'Slot level', 'Form', 'Creature type']);
      expect(field<HTMLInputElement>('Name').value).toBe('Battle Familiar');
      expect(el().querySelector('.follower-dialog-summary')!.textContent!.trim()).toBe('AC 15 · HP 30');
    });

    it('a familiar at 0 Hit Points is offered, but not ticked', () => {
      open('Battle Familiar', druid(), [pip(0)]);

      expect(el().querySelector<HTMLInputElement>('.follower-dialog-check input')!.checked).toBeFalse();
      expect(field<HTMLInputElement>('Name').value).toBe('Battle Familiar');
    });
  });

  it('renders nothing to fill in for a spell that makes no follower', () => {
    open('Fireball');

    expect(el().querySelector('.modal')).toBeNull();
    component.add();
    expect(followers.summon).not.toHaveBeenCalled();
  });
});
