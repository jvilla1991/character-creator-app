import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { Campaign, CampaignDraft } from '../models/campaign';
import { PC } from '../models/pc';
import { PCService } from './pc.service';

// ---------------------------------------------------------------------------
// Demo seed campaigns. `party` links to PC.party (see prototype/data.js).
// Phase 2 replaces this with a backend; the localStorage layer below is the
// stand-in store until then.
// ---------------------------------------------------------------------------
const DEMO_CAMPAIGNS: Campaign[] = [
  {
    id: 'veiled',
    party: 'The Veiled Compass',
    name: 'The Veiled Compass',
    setting: 'Waterdeep & the Sword Coast',
    session: 14,
    next: 'Thu · Jun 12',
    arc: "The Lantern's Debt",
    tint: 'celestial',
    chronicle:
      "What began as a simple courier job has unspooled into a war of whispers. The Crimson Lantern called in Lyra's debt three sessions ago, and the price was a name — a name that belongs to someone at this very table. The party doesn't know yet. Throk suspects.",
    secrets:
      "The Lantern's true patron is Vex's archfey. The 'debt' is a leash. Brother Aldric's missing years were spent in the same war the Lantern profits from — reveal at session 16.",
    threads: [
      "Who sold the Compass's route to the Shadow-Bear cult?",
      "Aldric's letter from the orphanage — unopened for 4 sessions",
      "Vex's patron wants the Crown of the Hollow Court back",
    ],
  },
  {
    id: 'tomb',
    party: 'Tomb of the Sleeping Crown',
    name: 'Tomb of the Sleeping Crown',
    setting: 'The Barrowlands of Eshvar',
    session: 6,
    next: 'Sun · Jun 15',
    arc: 'Descent to the Third Seal',
    tint: 'violet',
    chronicle:
      "Two delvers, one keyhole, and a crown that does not wish to be found. Pip can fit where Zarev cannot; Zarev can survive what Pip cannot. The Third Seal hums with old bronze — Zarev's blood remembers it, though he was never here before.",
    secrets:
      'The Sleeping Crown is bonded to House Ashenheart. Zarev IS the key — the tomb opens for his bloodline, the cult knows it, and Pip\'s employer is the cult.',
    threads: [
      "Pip's employer sent a second, sealed contract",
      'The bronze dragon below the Third Seal — ancestor or warden?',
      "Three cities want Pip's head; one will follow him here",
    ],
  },
];

const STORAGE_KEY = 'tm_campaigns';

@Injectable({ providedIn: 'root' })
export class CampaignService {
  private campaignsSubject = new BehaviorSubject<Campaign[]>(this.loadCampaigns());
  campaigns$ = this.campaignsSubject.asObservable();

  constructor(private pcService: PCService) {}

  /** Members of a campaign = PCs whose party matches the campaign's party key. */
  membersOf(campaign: Campaign | null, pcs: PC[]): PC[] {
    if (!campaign) return [];
    return pcs.filter(p => p.party === campaign.party);
  }

  /** Reactive members stream for a campaign id, recomputed as PCs change. */
  members$(campaignId: string | null): Observable<PC[]> {
    return combineLatest([this.campaigns$, this.pcService.pcs$]).pipe(
      map(([campaigns, pcs]) => {
        const campaign = campaigns.find(c => c.id === campaignId) ?? null;
        return this.membersOf(campaign, pcs);
      })
    );
  }

  getById(id: string | null): Campaign | undefined {
    return this.campaignsSubject.getValue().find(c => c.id === id);
  }

  createCampaign(draft: CampaignDraft): Campaign {
    const campaign: Campaign = {
      id: 'c-' + Date.now(),
      name: draft.name,
      // Phase 1: a fresh campaign's party key is its own name; players join by
      // setting their PC's party to match. Phase 2 swaps this for a real FK.
      party: draft.name,
      setting: draft.setting || 'An unwritten realm',
      session: 1,
      next: draft.next || 'Unscheduled',
      arc: 'A new beginning',
      tint: draft.tint,
      chronicle: 'The chronicle is yet unwritten. Your first session will fill this page.',
      secrets: '',
      threads: [],
    };
    const next = [...this.campaignsSubject.getValue(), campaign];
    this.persist(next);
    return campaign;
  }

  private persist(campaigns: Campaign[]): void {
    this.campaignsSubject.next(campaigns);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns));
    } catch {
      // Storage unavailable (private mode / quota) — keep in-memory only.
    }
  }

  private loadCampaigns(): Campaign[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Campaign[];
    } catch {
      // fall through to demo seed
    }
    return [...DEMO_CAMPAIGNS];
  }
}
