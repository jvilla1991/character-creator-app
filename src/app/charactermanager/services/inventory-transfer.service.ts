import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, defer, forkJoin, of, throwError } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { PC, PcItem } from '../models/pc';
import { PCService } from './pc.service';
import { FollowerService } from './follower.service';
import { withRecomputedAc } from '../utils/armor-math';

export interface InventoryRecipient {
  kind: 'player' | 'follower';
  id: number;
  name: string;
  playerName?: string;
}
export interface InventoryTransferResult { inventory: PcItem[]; ac?: number; }

@Injectable({ providedIn: 'root' })
export class InventoryTransferService {
  constructor(private http: HttpClient, private pcs: PCService, private followers: FollowerService) {}

  private url(pcId: number): string {
    return `${environment.characterApiUrl}/api/v1/pc/${pcId}/inventory`;
  }

  recipients(pc: PC): Observable<InventoryRecipient[]> {
    if (!environment.demoMode) return this.http.get<InventoryRecipient[]>(`${this.url(pc.id)}/recipients`);
    return forkJoin({ pcs: this.pcs.getPCs(), followers: this.followers.list(pc.id) }).pipe(
      map(({ pcs, followers }) => [
        ...pcs.filter(p => p.id !== pc.id && pc.campaignId != null && String(p.campaignId) === String(pc.campaignId))
          .map(p => ({ kind: 'player' as const, id: p.id, name: p.name, playerName: p.playerName })),
        ...followers.map(f => ({ kind: 'follower' as const, id: f.id, name: f.name })),
      ]),
    );
  }

  give(pc: PC, index: number, recipient: InventoryRecipient): Observable<InventoryTransferResult> {
    if (!environment.demoMode) {
      return this.http.post<InventoryTransferResult>(`${this.url(pc.id)}/give`, {
        kind: recipient.kind, recipientId: recipient.id, itemIndex: index, inventory: pc.inventory ?? [],
      }).pipe(tap(result => this.pcs.patchLocalPC(pc.id, result)));
    }
    return defer(() => {
      const current = this.pcs.getPCById(pc.id) ?? pc;
      const item = current.inventory?.[index];
      if (!item || item.status === 'dropped' || JSON.stringify(current.inventory) !== JSON.stringify(pc.inventory)) {
        return throwError(() => new Error('Inventory changed. Close this dialog and try again.'));
      }
      const gift = { ...item, equipped: false };
      const updated = withRecomputedAc({ ...current, inventory: current.inventory!.filter((_, i) => i !== index) }, current.inventory);
      const result = { inventory: updated.inventory!, ac: updated.ac };
      const finish = () => this.pcs.patchLocalPC(pc.id, result);
      if (recipient.kind === 'player') {
        const target = this.pcs.getPCById(recipient.id);
        if (!target || target.id === pc.id || pc.campaignId == null || String(target.campaignId) !== String(pc.campaignId)) {
          return throwError(() => new Error('Choose a character in your campaign.'));
        }
        this.pcs.patchLocalPC(target.id, { inventory: [...(target.inventory ?? []), gift] });
        finish();
        return of(result);
      }
      return this.followers.list(pc.id).pipe(
        // The demo follower store is local; only patch the source once its update succeeds.
        switchMap(followers => {
          const follower = followers.find(f => f.id === recipient.id);
          if (!follower) return throwError(() => new Error('Follower not found.'));
          return this.followers.update(pc.id, follower.id, follower.name, {
            ...follower.statBlock, inventory: [...(follower.statBlock.inventory ?? []), gift],
          }).pipe(map(() => result), tap(finish));
        }),
      );
    });
  }
}
