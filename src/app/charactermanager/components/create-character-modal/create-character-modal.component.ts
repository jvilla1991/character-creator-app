import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { PC } from '../../models/pc';
import { DndBackground, DndClass } from '../../models/dnd-api.types';
import { DndResourcesService } from '../../services/dnd-resources.service';

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;
const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
type Ability = typeof ABILITIES[number];

@Component({
  selector: 'app-create-character-modal',
  templateUrl: './create-character-modal.component.html',
  styleUrls: ['./create-character-modal.component.scss']
})
export class CreateCharacterModalComponent implements OnInit {

  // ── Wizard state ─────────────────────────────────────────────────────────
  step = 1;
  readonly totalSteps = 5;

  // ── Step 1: Identity ─────────────────────────────────────────────────────
  name   = '';
  player = '';
  party  = '';
  partyList: string[] = [];

  // ── Step 2: Species ──────────────────────────────────────────────────────
  speciesList: string[] = [];
  species     = '';
  loadingSpecies = true;

  // ── Step 3: Class ────────────────────────────────────────────────────────
  classList:    string[]   = [];
  clazz        = '';
  classDetail:  DndClass | null = null;
  loadingClassList   = true;
  loadingClassDetail = false;

  // ── Step 4: Background ───────────────────────────────────────────────────
  backgroundList:   string[]      = [];
  background        = '';
  backgroundDetail: DndBackground | null = null;
  loadingBackgroundList   = true;
  loadingBackgroundDetail = false;

  // ── Step 5: Ability Scores ───────────────────────────────────────────────
  readonly abilities     = ABILITIES;
  readonly standardArray = [...STANDARD_ARRAY] as number[];
  assignments: Record<Ability, number | null> = {
    STR: null, DEX: null, CON: null, INT: null, WIS: null, CHA: null,
  };
  bonusPlus2: Ability | '' = '';
  bonusPlus1: Ability | '' = '';

  constructor(
    public dialogRef: MatDialogRef<CreateCharacterModalComponent>,
    private dndResources: DndResourcesService,
  ) {}

  ngOnInit(): void {
    this.dndResources.getPartyNames().subscribe(list => {
      this.partyList = list;
      this.party     = list[0] ?? '';
    });

    this.dndResources.getSpeciesList().subscribe(list => {
      this.speciesList   = list;
      this.species       = list[0] ?? '';
      this.loadingSpecies = false;
    });

    this.dndResources.getClassNames2024().subscribe(list => {
      this.classList       = list;
      this.clazz           = list[0] ?? '';
      this.loadingClassList = false;
      // Pre-fetch detail for the default selection so step 3 loads instantly
      this.fetchClassDetail(this.clazz);
    });

    this.dndResources.getBackgroundList().subscribe(list => {
      this.backgroundList       = list;
      this.background           = list[0] ?? '';
      this.loadingBackgroundList = false;
      // Pre-fetch detail for the default selection so step 4 loads instantly
      this.fetchBackgroundDetail(this.background);
    });
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  get canAdvance(): boolean {
    switch (this.step) {
      case 1: return this.name.trim().length > 0;
      case 2: return !!this.species;
      case 3: return !!this.clazz;
      case 4: return !!this.background;
      case 5: return this.isArrayComplete
                  && !!this.bonusPlus2
                  && !!this.bonusPlus1
                  && this.bonusPlus2 !== this.bonusPlus1;
      default: return false;
    }
  }

  next(): void {
    if (!this.canAdvance) return;
    this.step++;
    // Safety: ensure detail is fetched if not yet loaded when entering a step
    if (this.step === 3 && !this.classDetail      && !this.loadingClassDetail)      this.fetchClassDetail(this.clazz);
    if (this.step === 4 && !this.backgroundDetail && !this.loadingBackgroundDetail) this.fetchBackgroundDetail(this.background);
  }

  back(): void { if (this.step > 1) this.step--; }

  // ── Class detail ─────────────────────────────────────────────────────────

  onClassChange(): void {
    this.classDetail = null;
    this.fetchClassDetail(this.clazz);
  }

  private fetchClassDetail(name: string): void {
    if (!name) return;
    this.loadingClassDetail = true;
    this.dndResources.getClassDetail(name).subscribe(detail => {
      this.classDetail        = detail;
      this.loadingClassDetail = false;
    });
  }

  get classSavingThrows(): string {
    return this.classDetail?.saving_throws.map(s => s.name).join(', ') ?? '…';
  }

  // ── Background detail ────────────────────────────────────────────────────

  onBackgroundChange(): void {
    this.backgroundDetail = null;
    this.bonusPlus2 = '';
    this.bonusPlus1 = '';
    this.fetchBackgroundDetail(this.background);
  }

  private fetchBackgroundDetail(name: string): void {
    if (!name) return;
    this.loadingBackgroundDetail = true;
    this.dndResources.getBackgroundDetail(name).subscribe(detail => {
      this.backgroundDetail        = detail;
      this.loadingBackgroundDetail = false;
    });
  }

  get backgroundAbilityNames(): string {
    return this.backgroundDetail?.ability_scores.map(s => s.name).join(', ') ?? '…';
  }

  get backgroundProficiencyNames(): string {
    return this.backgroundDetail?.proficiencies.map(s => s.name).join(', ') ?? '';
  }

  // ── Standard Array helpers ───────────────────────────────────────────────

  /** Values from the Standard Array not yet assigned to another ability */
  availableFor(ability: Ability): number[] {
    return STANDARD_ARRAY.filter(v =>
      !Object.entries(this.assignments).some(
        ([ab, assigned]) => ab !== ability && assigned === v
      )
    ) as number[];
  }

  get isArrayComplete(): boolean {
    return Object.values(this.assignments).every(v => v !== null);
  }

  // ── Background bonus helpers ─────────────────────────────────────────────

  /** Abilities eligible for the background's +2/+1 bonus */
  get bonusAbilities(): Ability[] {
    return (this.backgroundDetail?.ability_scores ?? []).map(s => s.name as Ability);
  }

  // ── Derived stats ────────────────────────────────────────────────────────

  finalScore(ability: Ability): number {
    const base  = this.assignments[ability] ?? 0;
    const bonus = (this.bonusPlus2 === ability ? 2 : 0)
                + (this.bonusPlus1 === ability ? 1 : 0);
    return base + bonus;
  }

  modifier(score: number): string {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  private modNum(score: number): number {
    return Math.floor((score - 10) / 2);
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  submit(): void {
    if (!this.canAdvance) return;

    const trimmedName = this.name.trim();
    const initials    = trimmedName
      .split(/\s+/)
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const hitDie = this.classDetail?.hit_die ?? 8;
    const conMod = this.modNum(this.finalScore('CON'));
    const dexMod = this.modNum(this.finalScore('DEX'));
    const maxHp  = hitDie + conMod;

    const stats = {
      STR: this.finalScore('STR'),
      DEX: this.finalScore('DEX'),
      CON: this.finalScore('CON'),
      INT: this.finalScore('INT'),
      WIS: this.finalScore('WIS'),
      CHA: this.finalScore('CHA'),
    };

    const saves = (this.classDetail?.saving_throws ?? [])
      .map(s => s.name) as Array<'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'>;

    const draft: Partial<PC> = {
      name:             trimmedName,
      player:           this.player.trim() || '—',
      party:            this.party,
      race:             this.species,
      clazz:            this.clazz,
      background:       this.background,
      level:            1,
      prof:             2,
      portraitInitials: initials,
      portraitTint:     'celestial',
      hp:               { cur: maxHp, max: maxHp, temp: 0 },
      ac:               10 + dexMod,
      init:             dexMod,
      speed:            30,
      stats,
      saves,
      conditions:       [],
      coins:            { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 },
      weapons:          [],
      gear:             [],
      features:         [],
      spells:           [],
      spellSlots:       {},
    };

    this.dialogRef.close(draft);
  }

  cancel(): void { this.dialogRef.close(null); }
}
