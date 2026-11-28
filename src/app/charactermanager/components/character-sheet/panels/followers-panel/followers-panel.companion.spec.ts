import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';

import { FollowersPanelComponent } from './followers-panel.component';
import { FollowerService } from '../../../../services/follower.service';
import { PCService } from '../../../../services/pc.service';
import { NotificationService } from '../../../../services/notification.service';
import { Follower } from '../../../../models/follower';
import { PC } from '../../../../models/pc';
import { buildVestigeStatBlock } from '../../../../models/vestige-companion';

/** The Followers tab as rendered for a character with a companion: a Vestige Patron and its vestige. */
describe('FollowersPanelComponent (companions)', () => {
  let fixture: ComponentFixture<FollowersPanelComponent>;
  let followerService: jasmine.SpyObj<FollowerService>;
  let pcService: jasmine.SpyObj<PCService>;
  let changes: Subject<{ pcId: number }>;

  const patron = (over: Partial<PC> = {}): PC => ({
    id: 7, name: 'Aelindra', clazz: 'Warlock', subclass: 'Vestige Patron', level: 5, playerName: 'Sam',
    subclassChoices: { vestigeType: 'Fiend', vestigeDomain: 'War' },
    ...over,
  });
  const vestige = (): Follower => ({
    id: 3, pcId: 7, name: 'Ashmaw', kind: 'COMPANION',
    statBlock: buildVestigeStatBlock({ type: 'Fiend', level: 5, charisma: 18, prof: 3, languages: ['Common'] }),
  });
  const brannoc: Follower = { id: 1, pcId: 7, name: 'Brannoc', statBlock: { clazz: 'Guard', level: 2, ac: 16 } };
  const pip: Follower = { id: 2, pcId: 7, name: 'Pip', kind: 'FAMILIAR', statBlock: { clazz: 'Fey (Tiny)', race: 'Owl' } };

  beforeEach(() => {
    changes = new Subject<{ pcId: number }>();
    followerService = jasmine.createSpyObj<FollowerService>('FollowerService', ['list', 'grant', 'dismiss'],
      { changes$: changes });
    followerService.list.and.returnValue(of([brannoc, pip, vestige()]));
    pcService = jasmine.createSpyObj<PCService>('PCService', ['setSubclassChoices']);
    pcService.setSubclassChoices.and.returnValue(of(patron()));
    TestBed.configureTestingModule({
      providers: [
        { provide: FollowerService, useValue: followerService },
        { provide: PCService, useValue: pcService },
        { provide: NotificationService, useValue: { notify: () => undefined, error: () => undefined } },
      ],
    });
  });

  function render(pc: PC, who: { ownSheet?: boolean; canGrant?: boolean }): HTMLElement {
    fixture = TestBed.createComponent(FollowersPanelComponent);
    fixture.componentRef.setInput('pc', pc);
    fixture.componentRef.setInput('ownSheet', !!who.ownSheet);
    fixture.componentRef.setInput('canGrant', !!who.canGrant);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (node: Element) => node.textContent!.replace(/\s+/g, ' ').trim();
  const rows = () => Array.from(el().querySelectorAll('.follower-row')) as HTMLElement[];
  const row = (name: string) => rows().find(r => text(r.querySelector('.follower-name')!) === name)!;
  const dismissButtons = (r: HTMLElement) =>
    (Array.from(r.querySelectorAll('button')) as HTMLButtonElement[]).filter(b => !b.classList.contains('follower-open'));

  it('lists the vestige as a companion, with what it is and how it stands', () => {
    render(patron(), { ownSheet: true });
    expect(rows().length).toBe(3);
    expect(text(row('Ashmaw').querySelector('.follower-summary')!)).toBe('Companion · Fiend Vestige · Level 5');
    expect(text(row('Ashmaw').querySelector('.follower-stats')!)).toBe('HP 24/24 · AC 17');
  });

  it('gives the DM no Dismiss on the companion, and one on every other follower', () => {
    render(patron(), { canGrant: true });
    expect(dismissButtons(row('Ashmaw'))).toEqual([]);
    expect(dismissButtons(row('Brannoc')).map(text)).toEqual(['Dismiss']);
    expect(dismissButtons(row('Pip')).map(text)).toEqual(['Dismiss']);
  });

  it('gives the owner no Dismiss on the companion, only on their own familiar', () => {
    render(patron(), { ownSheet: true });
    expect(dismissButtons(row('Ashmaw'))).toEqual([]);
    expect(dismissButtons(row('Brannoc'))).toEqual([]);
    expect(dismissButtons(row('Pip')).map(text)).toEqual(['Dismiss']);
  });

  it('opens the companion\'s sheet like any follower\'s', () => {
    render(patron(), { ownSheet: true });
    const opened: Follower[] = [];
    fixture.componentInstance.followerOpened.subscribe(f => opened.push(f));
    (row('Ashmaw').querySelector('.follower-open') as HTMLButtonElement).click();
    expect(opened.map(f => f.id)).toEqual([3]);
  });

  it('shows a Vestige Patron its type and domain above the list, and changes the type from there', () => {
    render(patron(), { ownSheet: true });
    const panel = el().querySelector('app-vestige-panel')!;
    expect(panel).not.toBeNull();
    expect(panel.compareDocumentPosition(el().querySelector('.follower-list')!) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    const undead = (Array.from(panel.querySelectorAll('.vestige-type')) as HTMLButtonElement[])
      .find(b => text(b) === 'Undead')!;
    undead.click();
    expect(pcService.setSubclassChoices).toHaveBeenCalledOnceWith(7, { vestigeType: 'Undead' }, false);
  });

  it('passes the DM on to the type control', () => {
    render(patron(), { canGrant: true });
    const celestial = (Array.from(el().querySelectorAll('app-vestige-panel .vestige-type')) as HTMLButtonElement[])
      .find(b => text(b) === 'Celestial')!;
    celestial.click();
    expect(pcService.setSubclassChoices).toHaveBeenCalledOnceWith(7, { vestigeType: 'Celestial' }, true);
  });

  it('reads the followers again when the service says they changed (the type was changed)', () => {
    render(patron(), { ownSheet: true });
    expect(followerService.list).toHaveBeenCalledTimes(1);
    const undead = { ...vestige(), statBlock: { ...vestige().statBlock, race: 'Undead' } };
    followerService.list.and.returnValue(of([brannoc, pip, undead]));

    changes.next({ pcId: 7 });
    fixture.detectChanges();

    expect(followerService.list).toHaveBeenCalledTimes(2);
    expect(text(row('Ashmaw').querySelector('.follower-summary')!)).toBe('Companion · Undead Vestige · Level 5');
  });

  it('offers the type to a patron without a companion yet, so the sheet can create it', () => {
    followerService.list.and.returnValue(of([]));
    render(patron({ level: 7, subclassChoices: null }), { ownSheet: true });
    expect(rows()).toEqual([]);
    expect(el().querySelectorAll('app-vestige-panel .vestige-type').length).toBe(3);
    expect(el().querySelector('app-vestige-panel select')).not.toBeNull();
  });

  it('shows no vestige panel to any other character, or below Warlock 3', () => {
    for (const pc of [patron({ level: 2 }), patron({ subclass: 'Fiend Patron' }),
      patron({ clazz: 'Barbarian', subclass: undefined })]) {
      render(pc, { ownSheet: true, canGrant: true });
      expect(el().querySelector('app-vestige-panel')).withContext(`${pc.clazz} ${pc.subclass}`).toBeNull();
    }
  });
});
