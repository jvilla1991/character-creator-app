import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { Campaign } from '../../../models/campaign';
import { Encounter, EncounterCreature, EncounterSummary } from '../../../models/encounter';
import { CuratedEncounterService } from '../../../services/curated-encounter.service';
import { NotificationService } from '../../../services/notification.service';
import { FormsModule } from '@angular/forms';

/**
 * DM-curated encounters panel on the campaign dashboard. The DM creates reusable
 * encounters and fills them with free-hand enemy creatures (name, optional AC,
 * optional HP, quantity); the encounter is later loaded into Session Mode, where
 * each creature becomes an enemy combatant. Mirrors the curated-shops panel:
 * reloads when the selected campaign changes. Prepped loot lives on the
 * standalone Curated Loot panel, not here.
 */
@Component({
    selector: 'app-curated-encounters',
    templateUrl: './curated-encounters.component.html',
    styleUrls: ['./curated-encounters.component.scss'],
    imports: [FormsModule]
})
export class CuratedEncountersComponent implements OnChanges {
  @Input() campaign!: Campaign;

  encounters: EncounterSummary[] = [];
  selected: Encounter | null = null;
  newName = '';
  notesDraft = '';
  busy = false;
  /** The list request failed — the empty state must not claim there are none. */
  loadFailed = false;

  // The "add creature" form.
  cName = '';
  cAc: number | null = null;
  cHp: number | null = null;
  cQty = 1;

  private readonly notifications = inject(NotificationService);

  constructor(private curatedEncounters: CuratedEncounterService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['campaign']) {
      this.selected = null;
      this.loadEncounters();
    }
  }

  loadEncounters(): void {
    if (!this.campaign) { this.encounters = []; return; }
    this.curatedEncounters.list(this.campaign.id).subscribe({
      next: encounters => { this.encounters = encounters; this.loadFailed = false; },
      error: err => {
        this.loadFailed = true;
        this.notifications.error('Could not load the encounters. Try again.', err);
      },
    });
  }

  createEncounter(): void {
    const name = this.newName.trim();
    if (!name || this.busy) return;
    this.busy = true;
    this.curatedEncounters.create(this.campaign.id, name, '').subscribe({
      next: encounter => {
        this.newName = '';
        this.busy = false;
        this.select(encounter);
        this.loadEncounters();
      },
      error: err => {
        this.busy = false;
        this.notifications.error('Could not create the encounter. Try again.', err);
      },
    });
  }

  open(summary: EncounterSummary): void {
    this.curatedEncounters.get(summary.id).subscribe({
      next: encounter => this.select(encounter),
      error: err => this.notifications.error('Could not open that encounter. Try again.', err),
    });
  }

  back(): void {
    this.selected = null;
    this.loadEncounters(); // refresh creature counts
  }

  /** Persist the notes textarea (name unchanged). */
  saveNotes(): void {
    if (!this.selected) return;
    this.curatedEncounters.update(this.selected.id, this.selected.name, this.notesDraft).subscribe({
      next: encounter => this.select(encounter),
      error: err => this.notifications.error('Could not save the notes. Your text is still here — try again.', err),
    });
  }

  addCreature(): void {
    if (!this.selected || this.busy) return;
    const name = this.cName.trim();
    if (!name) return;
    const qty = this.cQty && this.cQty >= 1 ? Math.floor(this.cQty) : 1;
    this.busy = true;
    this.curatedEncounters.addCreature(this.selected.id, name, this.cAc, this.cHp, qty).subscribe({
      next: encounter => {
        this.select(encounter);
        this.cName = '';
        this.cAc = null;
        this.cHp = null;
        this.cQty = 1;
        this.busy = false;
      },
      error: err => {
        this.busy = false;
        this.notifications.error('Could not add the creature. Try again.', err);
      },
    });
  }

  removeCreature(creature: EncounterCreature): void {
    if (!this.selected) return;
    this.curatedEncounters.removeCreature(this.selected.id, creature.id).subscribe({
      next: encounter => this.select(encounter),
      error: err => this.notifications.error(`Could not remove ${creature.name}. Try again.`, err),
    });
  }

  deleteEncounter(): void {
    if (!this.selected) return;
    this.curatedEncounters.delete(this.selected.id).subscribe({
      next: () => this.back(),
      error: err => this.notifications.error('Could not delete the encounter. Try again.', err),
    });
  }

  /** Total combatants this encounter will spawn (sum of quantities). */
  totalCombatants(encounter: Encounter): number {
    return encounter.creatures.reduce((sum, c) => sum + Math.max(1, c.quantity), 0);
  }

  trackById(_index: number, x: { id: number }): number {
    return x.id;
  }

  private select(encounter: Encounter): void {
    this.selected = encounter;
    this.notesDraft = encounter.notes ?? '';
  }
}
