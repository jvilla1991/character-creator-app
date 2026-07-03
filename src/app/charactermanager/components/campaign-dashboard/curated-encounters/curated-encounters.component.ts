import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Campaign } from '../../../models/campaign';
import { Encounter, EncounterCreature, EncounterSummary } from '../../../models/encounter';
import { CuratedEncounterService } from '../../../services/curated-encounter.service';

/**
 * DM-curated encounters panel on the campaign dashboard. The DM creates reusable
 * encounters and fills them with free-hand enemy creatures (name, DEX modifier,
 * optional HP, quantity); the encounter is later loaded into Session Mode, where
 * each creature becomes an enemy combatant. Mirrors the curated-shops panel:
 * reloads when the selected campaign changes.
 */
@Component({
  selector: 'app-curated-encounters',
  templateUrl: './curated-encounters.component.html',
  styleUrls: ['./curated-encounters.component.scss'],
})
export class CuratedEncountersComponent implements OnChanges {
  @Input() campaign!: Campaign;

  encounters: EncounterSummary[] = [];
  selected: Encounter | null = null;
  newName = '';
  notesDraft = '';
  busy = false;

  // The "add creature" form.
  cName = '';
  cDex: number | null = null;
  cHp: number | null = null;
  cQty = 1;

  constructor(private curatedEncounters: CuratedEncounterService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['campaign']) {
      this.selected = null;
      this.loadEncounters();
    }
  }

  private loadEncounters(): void {
    if (!this.campaign) { this.encounters = []; return; }
    this.curatedEncounters.list(this.campaign.id).subscribe({
      next: encounters => (this.encounters = encounters),
      error: err => console.error('Failed to load curated encounters', err),
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
      error: err => { this.busy = false; console.error('Failed to create encounter', err); },
    });
  }

  open(summary: EncounterSummary): void {
    this.curatedEncounters.get(summary.id).subscribe({
      next: encounter => this.select(encounter),
      error: err => console.error('Failed to open encounter', err),
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
      error: err => console.error('Failed to save notes', err),
    });
  }

  addCreature(): void {
    if (!this.selected || this.busy) return;
    const name = this.cName.trim();
    if (!name || this.cDex == null) return;
    const qty = this.cQty && this.cQty >= 1 ? Math.floor(this.cQty) : 1;
    this.busy = true;
    this.curatedEncounters.addCreature(this.selected.id, name, this.cDex, this.cHp, qty).subscribe({
      next: encounter => {
        this.select(encounter);
        this.cName = '';
        this.cDex = null;
        this.cHp = null;
        this.cQty = 1;
        this.busy = false;
      },
      error: err => { this.busy = false; console.error('Failed to add creature', err); },
    });
  }

  removeCreature(creature: EncounterCreature): void {
    if (!this.selected) return;
    this.curatedEncounters.removeCreature(this.selected.id, creature.id).subscribe({
      next: encounter => this.select(encounter),
      error: err => console.error('Failed to remove creature', err),
    });
  }

  deleteEncounter(): void {
    if (!this.selected) return;
    this.curatedEncounters.delete(this.selected.id).subscribe({
      next: () => this.back(),
      error: err => console.error('Failed to delete encounter', err),
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
