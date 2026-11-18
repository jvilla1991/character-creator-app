import { ChangeDetectionStrategy, Component, Input, OnInit, inject, output, signal } from '@angular/core';
import { PC } from '../../../../models/pc';
import { InventoryRecipient, InventoryTransferResult, InventoryTransferService } from '../../../../services/inventory-transfer.service';
import { ModalComponent } from '../../../modal/modal.component';

@Component({
  selector: 'app-give-item-modal',
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-backdrop" (click)="cancel()">
      <app-modal [title]="'Give ' + (pc.inventory?.[itemIndex]?.name ?? 'item')"
        [dialogDismissible]="!busy()" [closable]="!busy()" (dismiss)="cancel()">
        <p>Select a recipient to transfer this whole stack ({{ pc.inventory?.[itemIndex]?.qty ?? 1 }}).
          It will arrive unequipped.</p>
        @if (loading()) { <p role="status">Loading recipients…</p> }
        @if (error()) { <p role="alert">{{ error() }}</p> }
        @if (!loading() && !loadFailed() && !recipients().length) {
          <p>No recipients available. Join a campaign with other players or ask your DM for a follower.</p>
        }
        @for (kind of kinds; track kind) {
          @if (group(kind).length) {
            <h3>{{ kind === 'player' ? 'Players in your campaign' : 'Your followers' }}</h3>
            <div class="recipients">
              @for (recipient of group(kind); track recipient.id) {
                <button type="button" class="btn" [disabled]="busy() || stale()" (click)="give(recipient)">
                  {{ recipient.name }}
                  @if (recipient.playerName) { <span> ({{ recipient.playerName }})</span> }
                </button>
              }
            </div>
          }
        }
        @if (busy()) { <p role="status">Transferring item…</p> }
        <div class="modal-actions">
          @if (loadFailed()) { <button type="button" class="btn" (click)="load()">Retry</button> }
          <button type="button" class="btn" [disabled]="busy()" (click)="cancel()">Cancel</button>
        </div>
      </app-modal>
    </div>
  `,
  styles: [`
    app-modal { max-height: 90dvh; overflow-y: auto; }
    p { color: var(--text-dim); line-height: 1.5; }
    h3 { font-size: 15px; margin: 20px 0 10px; }
    .recipients { display: grid; gap: 8px; }
    .recipients button { text-align: left; white-space: normal; overflow-wrap: anywhere; }
    [role=alert] { color: var(--crimson); }
  `],
})
export class GiveItemModalComponent implements OnInit {
  @Input() pc!: PC;
  @Input() itemIndex!: number;
  readonly close = output<void>();
  readonly transferred = output<InventoryTransferResult>();
  private readonly transfers = inject(InventoryTransferService);
  readonly recipients = signal<InventoryRecipient[]>([]);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly busy = signal(false);
  readonly stale = signal(false);
  readonly error = signal('');
  readonly kinds = ['player', 'follower'] as const;

  ngOnInit(): void { this.load(); }
  group(kind: InventoryRecipient['kind']): InventoryRecipient[] { return this.recipients().filter(r => r.kind === kind); }
  cancel(): void { if (!this.busy()) this.close.emit(); }
  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.error.set('');
    this.transfers.recipients(this.pc).subscribe({
      next: recipients => { this.recipients.set(recipients); this.loading.set(false); },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
        this.error.set('Could not load recipients. Please try again.');
      },
    });
  }
  give(recipient: InventoryRecipient): void {
    if (this.busy() || this.stale()) return;
    this.busy.set(true);
    this.error.set('');
    this.transfers.give(this.pc, this.itemIndex, recipient).subscribe({
      next: result => { this.busy.set(false); this.transferred.emit(result); },
      error: err => {
        this.busy.set(false);
        // A failed/ambiguous response must never encourage sending the gift twice.
        this.stale.set(true);
        this.error.set(err.status === 409
          ? 'Inventory changed. Close this dialog and refresh before trying again.'
          : 'Could not confirm the transfer. Close this dialog and refresh your inventory before trying again.');
      },
    });
  }
}
