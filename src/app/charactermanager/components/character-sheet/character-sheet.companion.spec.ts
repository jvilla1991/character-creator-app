import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { CharacterSheetComponent } from './character-sheet.component';
import { EditableNumberComponent } from './editable-number/editable-number.component';
import { CompanionVitalsComponent } from './panels/companion-vitals/companion-vitals.component';
import { ClassDisplayPipe } from '../../pipes/class-display.pipe';
import { SpeciesDisplayPipe } from '../../pipes/species-display.pipe';
import { PCService } from '../../services/pc.service';
import { GrantService } from '../../services/grant.service';
import { SessionService } from '../../services/session.service';
import { FollowerService } from '../../services/follower.service';
import { NotificationService } from '../../services/notification.service';
import { PortraitService } from '../../services/portrait.service';
import { UiStateService } from '../../services/ui-state.service';
import { Follower, FollowerStatBlock } from '../../models/follower';
import { PC } from '../../models/pc';
import { buildVestigeStatBlock } from '../../models/vestige-companion';

/**
 * A companion's sheet: the follower sheet of a server-owned follower. All of it
 * is read-only but the name and the companion panel (Hit Points, temporary Hit
 * Points, conditions), and a save carries nothing else. The other panels render
 * as inert elements; the companion panel and the nested sheet are real.
 */
describe('CharacterSheetComponent (a companion\'s sheet)', () => {
  let fixture: ComponentFixture<CharacterSheetComponent>;
  let followerService: jasmine.SpyObj<FollowerService>;
  let pcService: jasmine.SpyObj<PCService>;

  const owner = (over: Partial<PC> = {}): PC => ({
    id: 7, name: 'Aelindra', clazz: 'Warlock', subclass: 'Vestige Patron', level: 5, playerName: 'Sam',
    campaignId: 3, subclassChoices: { vestigeType: 'Fiend', vestigeDomain: 'War' }, ...over,
  } as PC);
  const block = (): FollowerStatBlock =>
    buildVestigeStatBlock({ type: 'Fiend', level: 5, charisma: 18, prof: 3, languages: ['Common'] });
  const vestige = (): Follower => ({ id: 3, pcId: 7, name: 'Ashmaw', kind: 'COMPANION', statBlock: block() });
  const brannoc = (): Follower =>
    ({ id: 12, pcId: 7, name: 'Brannoc', statBlock: { clazz: 'Guard', level: 2, ac: 16, hp: { max: 11, cur: 11, temp: 0 } } });

  beforeEach(() => {
    pcService = jasmine.createSpyObj<PCService>('PCService', ['updatePC', 'updatePCAsDm']);
    followerService = jasmine.createSpyObj<FollowerService>('FollowerService', ['update', 'list'],
      { changes$: new Subject<{ pcId: number }>() });
    followerService.update.and.callFake((pcId, id, name, statBlock) =>
      of<Follower>({ id, pcId, name, statBlock, kind: 'COMPANION' }));
    TestBed.configureTestingModule({
      imports: [CharacterSheetComponent],
      providers: [
        { provide: PCService, useValue: pcService },
        { provide: GrantService, useValue: {} },
        { provide: SessionService, useValue: {} },
        { provide: FollowerService, useValue: followerService },
        { provide: NotificationService, useValue: { notify: () => undefined, error: () => undefined } },
        { provide: PortraitService, useValue: { portraitUrl: () => signal(null) } },
      ],
    });
    TestBed.overrideComponent(CharacterSheetComponent, {
      set: {
        imports: [FormsModule, EditableNumberComponent, CompanionVitalsComponent, ClassDisplayPipe, SpeciesDisplayPipe],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });
  });

  afterEach(() => {
    TestBed.inject(UiStateService).closeFollower();
    fixture?.destroy();
  });

  function open(follower: Follower, inputs: Record<string, unknown> = {}): CharacterSheetComponent {
    fixture = TestBed.createComponent(CharacterSheetComponent);
    fixture.componentRef.setInput('pc', owner());
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    fixture.componentInstance.onFollowerOpened(follower);
    fixture.detectChanges();
    return nested();
  }
  /** The follower-mode sheet nested inside the character's. */
  const nested = (): CharacterSheetComponent =>
    fixture.debugElement.query(By.css('app-character-sheet')).componentInstance as CharacterSheetComponent;
  const el = () => fixture.nativeElement as HTMLElement;
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const chip = (name: string) => (Array.from(el().querySelectorAll('app-companion-vitals .condition')) as HTMLElement[])
    .find(c => c.firstChild!.textContent!.trim() === name)!;

  describe('what the nested sheet is told', () => {
    it('the owner gets the companion panel to edit, and nothing else', () => {
      const sheet = open(vestige());
      expect(sheet.followerMode).toBeTrue();
      expect(sheet.followerCompanion).toBe('edit');
      expect(sheet.editable).toBeFalse();
      expect(sheet.inventoryEditable).toBeFalse();
      expect(sheet.showActions).toBeFalse();
      // So the sheet's own rules leave nothing open: no sheet edits, no slots, no prepared spells.
      expect(sheet.ownSheet).toBeFalse();
      expect(sheet.canSpendSlots).toBeFalse();
      expect(sheet.canPrepareSpells).toBeFalse();
      expect(sheet.canAdjustStats).toBeFalse();
    });

    it('the DM gets the same: the stat block is not the DM\'s to edit either', () => {
      const sheet = open(vestige(), { editable: true });
      expect(sheet.followerCompanion).toBe('edit');
      expect(sheet.editable).toBeFalse();
      expect(sheet.inventoryEditable).toBeFalse();
    });

    it('the owner in a live session gets it too', () => {
      const sheet = open(vestige(), { showActions: false, inventoryEditable: true });
      expect(sheet.followerCompanion).toBe('edit');
      expect(sheet.inventoryEditable).toBeFalse();
    });

    it('anyone else only looks', () => {
      const sheet = open(vestige(), { showActions: false });
      expect(sheet.followerCompanion).toBe('view');
      expect((el().querySelector('app-companion-vitals input') as HTMLInputElement).disabled).toBeTrue();
    });

    it('any other follower keeps its whole sheet as before', () => {
      const sheet = open(brannoc(), { editable: true });
      expect(sheet.followerCompanion).toBeNull();
      expect(sheet.editable).toBeTrue();
      expect(sheet.inventoryEditable).toBeTrue();
      expect(el().querySelector('app-companion-vitals')).toBeNull();
      expect(el().querySelector('app-character-sheet app-conditions-panel')).not.toBeNull();
    });
  });

  describe('the companion panel on the sheet', () => {
    it('stands where the Conditions panel does', () => {
      open(vestige());
      expect(el().querySelector('app-character-sheet app-companion-vitals')).not.toBeNull();
      expect(el().querySelector('app-character-sheet app-conditions-panel')).toBeNull();
    });

    it('saves a new Hit Point value through the follower service, the rest of the block untouched', () => {
      open(vestige());
      type(el().querySelector('app-companion-vitals input') as HTMLInputElement, '9');

      expect(followerService.update).toHaveBeenCalledOnceWith(7, 3, 'Ashmaw',
        { ...block(), hp: { max: 24, cur: 9, temp: 0 } });
      expect(nested().pc.hp).toEqual({ max: 24, cur: 9, temp: 0 });
      expect(pcService.updatePC).not.toHaveBeenCalled();
      expect(pcService.updatePCAsDm).not.toHaveBeenCalled();
    });

    it('saves a condition the same way, for the DM as well', () => {
      open(vestige(), { editable: true });
      chip('poisoned').click();
      fixture.detectChanges();

      expect(followerService.update).toHaveBeenCalledOnceWith(7, 3, 'Ashmaw', { ...block(), conditions: ['poisoned'] });
      expect(chip('poisoned').classList).toContain('active');
    });
  });

  describe('what a save carries', () => {
    it('a rename, and only the name', () => {
      const sheet = open(vestige());
      sheet.startNameEdit();
      sheet.nameDraft = 'Cinder';
      sheet.commitName();

      expect(followerService.update).toHaveBeenCalledOnceWith(7, 3, 'Cinder', block());
    });

    it('nothing at all when an edit changes only what the server owns', () => {
      const character = fixture = TestBed.createComponent(CharacterSheetComponent);
      character.componentRef.setInput('pc', owner());
      character.detectChanges();
      character.componentInstance.onFollowerOpened(vestige());

      const pc = character.componentInstance.openFollowerPc()!;
      character.componentInstance.onFollowerChanged({ ...pc, ac: 40, level: 20, spells: [], conditionImmunities: [] });

      expect(followerService.update).not.toHaveBeenCalled();
      expect(character.componentInstance.openFollowerPc()!.ac).toBe(17);
    });

    it('only the three values when an edit mixes them with the rest', () => {
      const character = fixture = TestBed.createComponent(CharacterSheetComponent);
      character.componentRef.setInput('pc', owner());
      character.detectChanges();
      character.componentInstance.onFollowerOpened(vestige());

      const pc = character.componentInstance.openFollowerPc()!;
      character.componentInstance.onFollowerChanged(
        { ...pc, ac: 40, hp: { max: 99, cur: 30, temp: 5 }, conditions: ['prone', 'stunned'] });

      expect(followerService.update).toHaveBeenCalledOnceWith(7, 3, 'Ashmaw',
        { ...block(), hp: { max: 24, cur: 24, temp: 5 }, conditions: ['stunned'] });
    });

    it('everything, as before, for any other follower', () => {
      const character = fixture = TestBed.createComponent(CharacterSheetComponent);
      character.componentRef.setInput('pc', owner());
      character.detectChanges();
      character.componentInstance.onFollowerOpened(brannoc());

      const pc = character.componentInstance.openFollowerPc()!;
      character.componentInstance.onFollowerChanged({ ...pc, ac: 18 });

      expect(followerService.update).toHaveBeenCalledOnceWith(7, 12, 'Brannoc',
        { clazz: 'Guard', level: 2, ac: 18, hp: { max: 11, cur: 11, temp: 0 } });
    });
  });
});
