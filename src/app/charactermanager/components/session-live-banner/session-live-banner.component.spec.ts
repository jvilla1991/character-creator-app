import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { SessionLiveBannerComponent } from './session-live-banner.component';
import { PCService } from '../../services/pc.service';
import { CampaignService } from '../../services/campaign.service';
import { SessionService } from '../../services/session.service';
import { UiStateService } from '../../services/ui-state.service';
import { PC } from '../../models/pc';
import { SessionState } from '../../models/session';

describe('SessionLiveBannerComponent', () => {
  let fixture: ComponentFixture<SessionLiveBannerComponent>;
  let pcs$: BehaviorSubject<PC[]>;
  let active: SessionState | null;

  beforeEach(() => {
    pcs$ = new BehaviorSubject<PC[]>([{ id: 1, name: 'Lyra', campaignId: 'c1' } as unknown as PC]);
    active = null;

    TestBed.configureTestingModule({
      imports: [SessionLiveBannerComponent],
      providers: [
        { provide: PCService, useValue: { pcs$ } },
        { provide: CampaignService, useValue: { getById: () => ({ name: 'The Veiled Compass' }) } },
        { provide: SessionService, useValue: { getActiveForCampaign: () => of(active) } },
        { provide: UiStateService, useValue: {} },
      ],
    });
    fixture = TestBed.createComponent(SessionLiveBannerComponent);
  });

  const status = (): HTMLElement => fixture.nativeElement.querySelector('[role="status"]');

  it('keeps an empty status region in the page while no session is live', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(status()).not.toBeNull();
    expect(status().textContent!.trim()).toBe('');
    expect(fixture.nativeElement.querySelector('.session-banner')).toBeNull();
    discardPeriodicTasks();
  }));

  it('announces the session through that same region when the DM starts one', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    const region = status();

    active = { id: 9 } as unknown as SessionState;
    tick(5000); // next discovery poll
    fixture.detectChanges();

    // Same element (it existed before the change), now holding the news.
    expect(status()).toBe(region);
    expect(region.textContent!.trim())
      .toBe('A session is live in The Veiled Compass. Join Session to take your place.');
    expect(fixture.nativeElement.querySelector('.session-banner')).not.toBeNull();
    // The visible banner is not itself a live region, so nothing is read twice.
    expect(fixture.nativeElement.querySelector('.session-banner').closest('[role="status"]')).toBeNull();
    discardPeriodicTasks();
  }));
});
