import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { CharacterSheetComponent } from './character-sheet.component';
import { EditableNumberComponent } from './editable-number/editable-number.component';
import { SheetActionsMenuComponent } from './sheet-actions-menu/sheet-actions-menu.component';
import { PcPortraitComponent } from '../pc-portrait/pc-portrait.component';
import { PortraitSilhouetteComponent } from '../pc-portrait/portrait-silhouette.component';
import { ClassDisplayPipe } from '../../pipes/class-display.pipe';
import { SpeciesDisplayPipe } from '../../pipes/species-display.pipe';
import { PCService } from '../../services/pc.service';
import { GrantService } from '../../services/grant.service';
import { SessionService } from '../../services/session.service';
import { FollowerService } from '../../services/follower.service';
import { NotificationService } from '../../services/notification.service';
import { PortraitService } from '../../services/portrait.service';
import { PC } from '../../models/pc';

/**
 * The sheet header as rendered: which actions each viewer gets in each state.
 * The panels below the header are not under test — they render as inert
 * elements — but the header's own parts (menu, portrait, editable numbers) are real.
 */
describe('CharacterSheetComponent header', () => {
  let fixture: ComponentFixture<CharacterSheetComponent>;
  let pcService: jasmine.SpyObj<PCService>;
  let portraitUrls: Record<string, string | null>;

  const hero = (over: Partial<PC> = {}): PC =>
    ({ id: 7, name: 'Lysol', race: 'Human', clazz: 'Rogue', subclass: 'Swashbuckler', level: 16, xp: 8000,
      playerName: 'Chris', campaignId: 3, ...over } as PC);

  const el = (): HTMLElement => fixture.nativeElement;
  const q = <T extends Element = HTMLElement>(sel: string) => el().querySelector<T>(sel);
  const header = () => q('header.pc-header')!;
  const headerText = () => header().textContent!.replace(/\s+/g, ' ');
  const buttons = () => Array.from(header().querySelectorAll<HTMLButtonElement>('.sheet-actions > button'));
  const button = (label: string) => buttons().find(b => b.textContent!.trim() === label);
  const menuItems = () => Array.from(header().querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    .map(b => b.textContent!.trim());

  function render(pc: PC, inputs: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(CharacterSheetComponent);
    fixture.componentRef.setInput('pc', pc);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
  }

  function openMenu(): void {
    q<HTMLButtonElement>('.sheet-menu-trigger')!.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    portraitUrls = {};
    pcService = jasmine.createSpyObj<PCService>('PCService', ['updatePC', 'updatePCAsDm', 'grantLevelUp']);
    pcService.grantLevelUp.and.returnValue(of({} as PC));
    TestBed.configureTestingModule({
      imports: [CharacterSheetComponent],
      providers: [
        { provide: PCService, useValue: pcService },
        { provide: GrantService, useValue: {} },
        { provide: SessionService, useValue: {} },
        { provide: FollowerService, useValue: { changes$: new Subject() } },
        { provide: NotificationService, useValue: { notify: () => undefined, error: () => undefined } },
        {
          provide: PortraitService,
          useValue: { portraitUrl: (id: number, v: number | null) => signal(v == null ? null : portraitUrls[`${id}:${v}`] ?? null) },
        },
      ],
    });
    TestBed.overrideComponent(CharacterSheetComponent, {
      set: {
        imports: [FormsModule, EditableNumberComponent, SheetActionsMenuComponent, PcPortraitComponent,
          PortraitSilhouetteComponent, ClassDisplayPipe, SpeciesDisplayPipe],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });
  });

  afterEach(() => fixture?.destroy());

  describe('identity', () => {
    it('one line of species, a gold star, class and the subclass, with no italics', () => {
      render(hero());
      const subtitle = q('.sheet-subtitle')!;
      // The flex gap spaces the parts; the template carries no spaces of its own.
      expect(Array.from(subtitle.querySelectorAll('span')).map(p => p.textContent!.trim()))
        .toEqual(['Human', 'Rogue', '(Swashbuckler)']);
      expect(subtitle.querySelector('svg.sheet-star')).not.toBeNull();
      expect(subtitle.querySelector('.sheet-subclass')!.textContent).toBe('(Swashbuckler)');
      expect(subtitle.querySelector('em')).toBeNull();
    });

    it('no empty parentheses when there is no subclass', () => {
      render(hero({ subclass: undefined }));
      expect(q('.sheet-subclass')).toBeNull();
    });

    it('the level, the XP bar and the XP with thousands separators', () => {
      render(hero());
      expect(q('.sheet-level-label')!.textContent).toBe('Level');
      expect(q('.sheet-level-value')!.textContent!.trim()).toBe('16');
      expect(q('.xp-track')!.getAttribute('role')).toBe('progressbar');
      expect(q('.sheet-xp')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('8,000 / 225,000 XP');
      expect(q('.sheet-xp')!.classList).not.toContain('ready');
    });

    it('ready to level: the XP figure turns gold', () => {
      render(hero({ xp: 231400 }));
      expect(q('.sheet-xp')!.classList).toContain('ready');
    });

    it('the party location with a pin, the name and the type as a label', () => {
      render(hero(), { location: { name: "Light's Hammer - ICC", type: 'Settlement' } });
      const loc = q('.sheet-location')!;
      expect(loc.getAttribute('title')).toBe('Party location');
      expect(loc.querySelector('svg.sheet-location-pin')).not.toBeNull();
      expect(loc.querySelector('.sheet-location-name')!.textContent).toBe("Light's Hammer - ICC");
      expect(loc.querySelector('.sheet-location-type')!.textContent).toBe('Settlement');
      expect(loc.textContent).not.toContain('📍');
    });
  });

  describe('portrait', () => {
    it('the silhouette until a portrait is uploaded, with an Upload camera', () => {
      render(hero());
      expect(q('.sheet-portrait app-portrait-silhouette svg')!.getAttribute('aria-label')).toBe('No portrait yet');
      expect(q('.portrait-camera')!.getAttribute('aria-label')).toBe('Upload portrait');
    });

    it('the uploaded portrait, named for the character, with a Change camera', () => {
      portraitUrls['7:2'] = 'blob:lysol';
      render(hero({ portraitVersion: 2 }));
      const img = q<HTMLImageElement>('.sheet-portrait img')!;
      expect(img.getAttribute('src')).toBe('blob:lysol');
      expect(img.alt).toBe('Portrait of Lysol');
      expect(q('.portrait-camera')!.getAttribute('aria-label')).toBe('Change portrait');
    });

    it('the camera opens the portrait dialog', () => {
      render(hero());
      q<HTMLButtonElement>('.portrait-camera')!.click();
      expect(fixture.componentInstance.portraitDialogOpen).toBeTrue();
    });
  });

  describe('a player on their own sheet', () => {
    it('no session running: Connect is disabled, and says why beside it', () => {
      render(hero());
      const connect = button('Connect')!;
      expect(connect.disabled).toBeTrue();
      const status = q('.session-status')!;
      expect(status.textContent!.trim()).toBe('No session running');
      expect(connect.getAttribute('aria-describedby')).toBe(status.id);
    });

    it('a session running: Connect is enabled, with nothing beside it, and connects', () => {
      render(hero(), { sessionRunning: true });
      const connect = button('Connect')!;
      expect(connect.disabled).toBeFalse();
      expect(connect.hasAttribute('aria-describedby')).toBeFalse();
      expect(q('.session-status')).toBeNull();
      expect(headerText()).not.toContain('Session live');
      const asked = spyOn(fixture.componentInstance.connectRequested, 'emit');
      connect.click();
      expect(asked).toHaveBeenCalled();
    });

    it('not in a campaign: Join Campaign, always enabled, with no label', () => {
      render(hero({ campaignId: null }));
      expect(button('Connect')).toBeUndefined();
      const join = button('Join Campaign')!;
      expect(join.disabled).toBeFalse();
      expect(q('.session-status')).toBeNull();
      const asked = spyOn(fixture.componentInstance.joinCampaignRequested, 'emit');
      join.click();
      expect(asked).toHaveBeenCalled();
    });

    it('no Level Up button, "?" or badge until the character may level', () => {
      render(hero());
      expect(button('Level Up')).toBeUndefined();
      expect(q('app-context-help')).toBeNull();
      expect(q('.level-ready-badge')).toBeNull();
    });

    it('enough XP: the gold Level Up button appears and asks for the level-up', () => {
      render(hero({ xp: 231400 }));
      const levelUp = button('Level Up')!;
      expect(levelUp.classList).toContain('ready');
      expect(levelUp.disabled).toBeFalse();
      const asked = spyOn(fixture.componentInstance.levelUpRequested, 'emit');
      levelUp.click();
      expect(asked).toHaveBeenCalled();
    });

    it('a DM grant: Level Up appears too', () => {
      render(hero({ pendingLevelGrant: true }));
      expect(button('Level Up')).toBeDefined();
    });

    it('the menu offers the portrait, rename and delete — no grant', () => {
      render(hero());
      openMenu();
      expect(menuItems()).toEqual(['Upload portrait', 'Rename character', 'Delete character']);
    });

    it('Delete character in the menu asks the host to confirm the delete', () => {
      render(hero());
      const asked = spyOn(fixture.componentInstance.deleteRequested, 'emit');
      openMenu();
      header().querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[2].click();
      expect(asked).toHaveBeenCalled();
    });

    it('Rename character opens the name field, focused', () => {
      render(hero());
      document.body.appendChild(el());
      openMenu();
      header().querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[1].click();
      fixture.detectChanges();
      const input = q<HTMLInputElement>('input.sheet-name-edit')!;
      expect(input).not.toBeNull();
      expect(document.activeElement).toBe(input);
      el().remove();
    });
  });

  describe('a DM cross-viewing a member', () => {
    it('gets Grant level-up and Level up in the menu while the button is not shown', () => {
      render(hero(), { editable: true });
      expect(button('Level Up')).toBeUndefined();
      openMenu();
      expect(menuItems()).toEqual(['Upload portrait', 'Rename character', 'Grant level-up', 'Level up', 'Delete character']);
    });

    it('Grant level-up calls the grant endpoint', () => {
      render(hero(), { editable: true });
      openMenu();
      header().querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[2].click();
      expect(pcService.grantLevelUp).toHaveBeenCalledOnceWith(7, true);
    });

    it('with a grant given: Revoke in the menu, and the Level Up button rather than the menu item', () => {
      render(hero({ pendingLevelGrant: true }), { editable: true });
      expect(button('Level Up')).toBeDefined();
      openMenu();
      expect(menuItems()).toEqual(['Upload portrait', 'Rename character', 'Revoke level-up', 'Delete character']);
    });
  });

  describe('embeds and followers', () => {
    it('a read-only embed (showActions off) has no actions, menu or camera', () => {
      render(hero(), { showActions: false });
      expect(q('.sheet-actions')).toBeNull();
      expect(q('app-sheet-actions-menu')).toBeNull();
      expect(q('.portrait-camera')).toBeNull();
      // The level and XP still show.
      expect(q('.sheet-xp')).not.toBeNull();
    });

    it('a follower keeps its initials, its level and Back to Character — no XP bar, menu or camera', () => {
      render(hero({ name: 'Grub', portraitInitials: 'GR' }),
        { followerMode: true, followerOwnerName: 'Lysol', showActions: false });
      expect(q('.pc-header-portrait .portrait.xl')!.textContent!.trim()).toBe('GR');
      expect(q('app-pc-portrait')).toBeNull();
      expect(q('.portrait-camera')).toBeNull();
      expect(q('.xp-track')).toBeNull();
      expect(q('.sheet-level')!.textContent).toContain('16');
      expect(q('app-sheet-actions-menu')).toBeNull();
      expect(buttons().map(b => b.textContent!.trim())).toEqual(['Back to Character']);
      expect(headerText()).toContain('follower of Lysol');
    });
  });
});
