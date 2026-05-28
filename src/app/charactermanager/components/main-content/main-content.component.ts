import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PC } from '../../models/pc';
import { DndClass, DndBackground } from '../../models/dnd-api.types';
import { PCService } from '../../services/pc.service';
import { DndResourcesService } from '../../services/dnd-resources.service';
import { MatDialog } from '@angular/material/dialog';
import { DeleteConfirmationModalComponent } from './delete-confirmation-modal/delete-confirmation-modal.component';

export type AbilityKey = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

@Component({
  selector: 'app-main-content',
  templateUrl: './main-content.component.html',
  styleUrls: ['./main-content.component.scss']
})
export class MainContentComponent implements OnInit {
  // ── view state ────────────────────────────────────────────────────────────
  pc: PC | null = null;
  isCreatingCharacter = false;

  // ── creation wizard data ──────────────────────────────────────────────────
  newPC: PC = {} as PC;

  // Step 2 – Species
  speciesList: string[] = [];

  // Step 3 – Class
  characterClasses: string[] = [];
  selectedClassDetail: DndClass | null = null;

  // Step 4 – Background
  backgroundList: string[] = [];
  selectedBackgroundDetail: DndBackground | null = null;

  // Step 5 – Ability Scores (Standard Array)
  readonly abilities: AbilityKey[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  readonly standardArray = [15, 14, 13, 12, 10, 8];
  abilityAssignments: Record<AbilityKey, number | null> = {
    STR: null, DEX: null, CON: null, INT: null, WIS: null, CHA: null
  };
  backgroundBonuses: { plus2: string | null; plus1: string | null } = {
    plus2: null, plus1: null
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pcService: PCService,
    private dndResourceService: DndResourcesService,
    private modal: MatDialog
  ) {}

  ngOnInit(): void {
    this.pcService.getActivePC().subscribe(pc => { this.pc = pc; });

    this.route.paramMap.subscribe(() => {
      this.isCreatingCharacter = this.router.url.includes('create');
    });

    if (this.isCreatingCharacter) {
      this.dndResourceService.getClassNames2024().subscribe(d => this.characterClasses = d);
      this.dndResourceService.getSpeciesList().subscribe(d => this.speciesList = d);
      this.dndResourceService.getBackgroundList().subscribe(d => this.backgroundList = d);
    }
  }

  // ── step handlers ─────────────────────────────────────────────────────────

  onClassSelected(className: string): void {
    this.dndResourceService.getClassDetail(className.toLowerCase()).subscribe(detail => {
      this.selectedClassDetail = detail;
    });
  }

  onBackgroundSelected(bgName: string): void {
    this.backgroundBonuses = { plus2: null, plus1: null };
    this.dndResourceService.getBackgroundDetail(bgName.toLowerCase()).subscribe(detail => {
      this.selectedBackgroundDetail = detail;
    });
  }

  // ── ability score helpers ─────────────────────────────────────────────────

  /** Standard array values not yet assigned to another ability */
  availableValuesFor(ability: AbilityKey): number[] {
    const usedElsewhere = new Set<number>(
      (Object.keys(this.abilityAssignments) as AbilityKey[])
        .filter(a => a !== ability && this.abilityAssignments[a] !== null)
        .map(a => this.abilityAssignments[a] as number)
    );
    return this.standardArray.filter(v => !usedElsewhere.has(v));
  }

  isStandardArrayComplete(): boolean {
    return this.abilities.every(a => this.abilityAssignments[a] !== null);
  }

  /** Ability keys the background can boost, minus whichever is already the +2 pick */
  get eligibleForPlus1(): string[] {
    const all = this.selectedBackgroundDetail?.ability_scores.map(r => r.name) ?? [];
    return all.filter(a => a !== this.backgroundBonuses.plus2);
  }

  getBonusFor(ability: string): number {
    if (this.backgroundBonuses.plus2 === ability) return 2;
    if (this.backgroundBonuses.plus1 === ability) return 1;
    return 0;
  }

  getFinalStat(ability: AbilityKey): number {
    return (this.abilityAssignments[ability] ?? 0) + this.getBonusFor(ability);
  }

  getMaxHp(): number {
    const hitDie = this.selectedClassDetail?.hit_die ?? 8;
    const conMod = Math.floor((this.getFinalStat('CON') - 10) / 2);
    return hitDie + conMod;
  }

  isStep5Complete(): boolean {
    return this.isStandardArrayComplete()
      && !!this.backgroundBonuses.plus2
      && !!this.backgroundBonuses.plus1;
  }

  // ── submission ────────────────────────────────────────────────────────────

  submitPC(): void {
    if (!this.newPC.name || !this.newPC.race || !this.newPC.clazz || !this.newPC.background) {
      alert('Please complete all required steps before creating your character.');
      return;
    }

    const finalStats = {
      STR: this.getFinalStat('STR'),
      DEX: this.getFinalStat('DEX'),
      CON: this.getFinalStat('CON'),
      INT: this.getFinalStat('INT'),
      WIS: this.getFinalStat('WIS'),
      CHA: this.getFinalStat('CHA'),
    };

    const maxHp = this.getMaxHp();

    const characterToCreate: PC = {
      ...this.newPC,
      level: 1,
      stats: finalStats,
      hp: { cur: maxHp, max: maxHp, temp: 0 },
      prof: 2,  // level 1 proficiency bonus is always +2
    };

    this.pcService.addPC(characterToCreate).subscribe(
      () => {
        this.router.navigate(['/charactermanager']);
      },
      error => {
        console.error('Error creating character', error);
        alert('Failed to create character. Please try again.');
      }
    );
  }

  stopCharacterCreation(): void {
    this.router.navigate(['/charactermanager']);
  }

  // ── deletion ──────────────────────────────────────────────────────────────

  openDeleteModal(): void {
    const dialogRef = this.modal.open(DeleteConfirmationModalComponent);
    dialogRef.afterClosed().subscribe(result => {
      if (result && this.pc) {
        this.pcService.deletePC(this.pc.id).subscribe({
          complete: () => {
            this.pcService.clearActivePC();
            this.pcService.refreshPCs();
          },
          error: err => console.error('Error deleting character:', err)
        });
      }
    });
  }
}
