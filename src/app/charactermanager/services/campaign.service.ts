import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, combineLatest, of, throwError } from 'rxjs';
import { delay, map, take, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { Campaign, CampaignDraft } from '../models/campaign';
import { PC } from '../models/pc';
import { PCService } from './pc.service';

// ---------------------------------------------------------------------------
// Demo seed campaigns. Members are the demo PCs bound via PC.campaignId.
// Used only in demo mode; real mode talks to the backend.
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
    inviteCode: 'VEIL23',
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
    inviteCode: 'TOMB45',
  },
];

const STORAGE_KEY = 'tm_campaigns';

@Injectable({ providedIn: 'root' })
export class CampaignService {
  private campaignsSubject = new BehaviorSubject<Campaign[]>(
    environment.demoMode ? this.loadDemoCampaigns() : []
  );
  campaigns$ = this.campaignsSubject.asObservable();

  readonly campaignUrl = `${environment.characterApiUrl}/api/v1/campaign`;

  constructor(private http: HttpClient, private pcService: PCService) {
    if (!environment.demoMode) this.refreshCampaigns();
  }

  /** Fetch the DM's campaigns from the backend into campaigns$. */
  refreshCampaigns(): void {
    if (environment.demoMode) {
      this.campaignsSubject.next(this.campaignsSubject.getValue());
      return;
    }
    this.http.get<unknown[]>(`${this.campaignUrl}/mine`).subscribe({
      next: raw => this.campaignsSubject.next(raw.map(r => this.deserialize(r))),
      error: err => console.error('Failed to load campaigns', err),
    });
  }

  /**
   * Members of a campaign — the PCs explicitly bound to it via PC.campaignId.
   */
  membersOf(campaign: Campaign | null, pcs: PC[]): PC[] {
    if (!campaign) return [];
    return pcs.filter(p => p.campaignId != null && String(p.campaignId) === campaign.id);
  }

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

  /**
   * Campaign members for the dashboard. In real mode this hits the DM-scoped
   * member projection (so the DM sees other players' bound characters too,
   * without their private narrative). In demo mode it derives locally.
   */
  getMembers(campaignId: string): Observable<PC[]> {
    if (environment.demoMode) {
      const campaign = this.getById(campaignId) ?? null;
      return this.pcService.pcs$.pipe(
        take(1),
        map(pcs => this.membersOf(campaign, pcs)),
      );
    }
    return this.http.get<unknown[]>(`${this.campaignUrl}/${campaignId}/members`).pipe(
      map(rows => rows.map(r => this.pcService.deserialize(r))),
    );
  }

  /** A player binds one of their own characters to a campaign via its invite code. */
  join(code: string, pcId: number): Observable<PC> {
    const trimmed = code.trim().toUpperCase();
    if (environment.demoMode) {
      const campaign = this.campaignsSubject.getValue().find(c => c.inviteCode === trimmed);
      if (!campaign) {
        return throwError(() => new Error('No campaign found for that invite code'));
      }
      const pc = this.pcService.getPCById(pcId);
      if (!pc) return throwError(() => new Error('Character not found'));
      return this.pcService.updatePC({ ...pc, campaignId: campaign.id });
    }
    return this.http.post<unknown>(`${this.campaignUrl}/join`, { code: trimmed, pcId }).pipe(
      map(r => this.pcService.deserialize(r)),
      tap(updated => this.pcService.refreshPCs()),
    );
  }

  /** Create a campaign. Returns an Observable so callers can react to the saved row. */
  createCampaign(draft: CampaignDraft): Observable<Campaign> {
    const base: Omit<Campaign, 'id'> = {
      name: draft.name,
      // A fresh campaign's party key defaults to its own name (Phase 1
      // compatibility); real membership is the PC.campaignId FK.
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

    if (environment.demoMode) {
      const campaign: Campaign = { ...base, id: 'c-' + Date.now() };
      this.persistDemo([...this.campaignsSubject.getValue(), campaign]);
      return of(campaign).pipe(delay(50));
    }

    return this.http.post<unknown>(`${this.campaignUrl}/add`, this.serialize(base)).pipe(
      map(raw => this.deserialize(raw)),
      tap(campaign => this.campaignsSubject.next([...this.campaignsSubject.getValue(), campaign]))
    );
  }

  // --- serialization (mirrors PCService) -----------------------------------

  /** Frontend Campaign → backend shape (threads JSON, next→nextSession). */
  private serialize(c: Omit<Campaign, 'id'> | Campaign): Record<string, unknown> {
    return {
      name: c.name,
      party: c.party,
      setting: c.setting,
      session: c.session,
      nextSession: c.next,
      arc: c.arc,
      tint: c.tint,
      chronicle: c.chronicle,
      secrets: c.secrets,
      threads: JSON.stringify(c.threads ?? []),
    };
  }

  /** Backend row → frontend Campaign (id→string, nextSession→next, threads parse). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private deserialize(raw: any): Campaign {
    return {
      id: String(raw.id),
      name: raw.name,
      party: raw.party ?? raw.name,
      setting: raw.setting ?? '',
      session: raw.session ?? 1,
      next: raw.nextSession ?? 'Unscheduled',
      arc: raw.arc ?? '',
      tint: raw.tint ?? 'celestial',
      chronicle: raw.chronicle ?? '',
      secrets: raw.secrets ?? '',
      threads: this.parseThreads(raw.threads),
      inviteCode: raw.inviteCode ?? undefined,
    };
  }

  private parseThreads(value: unknown): string[] {
    if (Array.isArray(value)) return value as string[];
    if (typeof value === 'string') {
      try { return JSON.parse(value) as string[]; } catch { return []; }
    }
    return [];
  }

  // --- demo persistence -----------------------------------------------------

  private persistDemo(campaigns: Campaign[]): void {
    this.campaignsSubject.next(campaigns);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns));
    } catch {
      // Storage unavailable — keep in-memory only.
    }
  }

  private loadDemoCampaigns(): Campaign[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Campaign[];
    } catch {
      // fall through to demo seed
    }
    return [...DEMO_CAMPAIGNS];
  }
}
