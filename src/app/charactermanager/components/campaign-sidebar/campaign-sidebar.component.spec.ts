import { signal } from '@angular/core';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { CampaignSidebarComponent } from './campaign-sidebar.component';
import { CampaignService } from '../../services/campaign.service';
import { PCService } from '../../services/pc.service';
import { UiStateService } from '../../services/ui-state.service';
import { Campaign } from '../../models/campaign';
import { PC } from '../../models/pc';

// Class-only tests (no TestBed), matching the house style.
describe('CampaignSidebarComponent', () => {
  let campaignService: jasmine.SpyObj<CampaignService>;
  let pcService: Partial<PCService>;
  let uiState: jasmine.SpyObj<UiStateService>;
  let campaigns$: BehaviorSubject<Campaign[]>;
  let pcs$: BehaviorSubject<PC[]>;

  const campaign = (id: string, name: string): Campaign =>
    ({ id, name, party: name, setting: '', session: 1, next: '', arc: '', tint: 'celestial',
       chronicle: '', secrets: '', threads: [] } as Campaign);

  const pc = (id: number, level: number): PC =>
    ({ id, name: 'M' + id, clazz: 'Fighter', level, playerName: 'P' } as PC);

  beforeEach(() => {
    campaigns$ = new BehaviorSubject<Campaign[]>([]);
    pcs$ = new BehaviorSubject<PC[]>([]);
    campaignService = jasmine.createSpyObj<CampaignService>('CampaignService', ['getMembers'],
      { campaigns$: campaigns$.asObservable() });
    pcService = { pcs$: pcs$.asObservable() } as Partial<PCService>;
    uiState = jasmine.createSpyObj<UiStateService>('UiStateService', ['setActiveCampaign'],
      { activeCampaignId: signal<string | null>(null).asReadonly() });
  });

  function build(): CampaignSidebarComponent {
    return new CampaignSidebarComponent(
      campaignService, pcService as PCService, uiState);
  }

  it('counts heroes from the member projection, not the local PC store', done => {
    // The local store is EMPTY (real mode: only the DM's own PCs live there) —
    // the projection still reports the two members other players bound.
    campaignService.getMembers.and.returnValue(of([pc(1, 5), pc(2, 7)]));
    campaigns$.next([campaign('c1', 'The Veiled Compass')]);

    build().rows$.subscribe(rows => {
      expect(rows.length).toBe(1);
      expect(rows[0].heroes).toBe(2);
      expect(rows[0].range).toBe('Lv 5–7');
      expect(campaignService.getMembers).toHaveBeenCalledWith('c1');
      done();
    });
  });

  it('shows "no heroes" for an empty campaign and survives a failed lookup', done => {
    campaignService.getMembers.and.callFake((id: string) =>
      id === 'ok' ? of([] as PC[]) : throwError(() => new Error('403')));
    campaigns$.next([campaign('ok', 'A'), campaign('denied', 'B')]);

    build().rows$.subscribe(rows => {
      expect(rows[0].heroes).toBe(0);
      expect(rows[0].range).toBe('no heroes');
      expect(rows[1].heroes).toBe(0); // errored lookup degrades to zero, no crash
      done();
    });
  });

  it('emits an empty row list when there are no campaigns', done => {
    campaigns$.next([]);
    build().rows$.subscribe(rows => {
      expect(rows).toEqual([]);
      expect(campaignService.getMembers).not.toHaveBeenCalled();
      done();
    });
  });
});
