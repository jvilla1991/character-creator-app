import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnChanges, computed, effect, input, output, signal, untracked } from '@angular/core';
import { PC, PcSpell } from '../../../../models/pc';
import { DndSpell } from '../../../../models/dnd-api.types';
import { heroClassFor } from '../../../../models/hero-class';
import { DndResourcesService } from '../../../../services/dnd-resources.service';
import { isPlaceholderSpell, toGrantedSpell, toPcSpell } from '../../../../utils/spell-mapping';
import { DM_GRANT_SOURCE } from '../../../../models/granted-spells';
import { canCastAsRitual, castWarning, castableLevels, spellListClass } from '../../../../utils/spellcasting';
import { countPreparedSpells, isAlwaysPrepared, isSpellPrepared, preparedSpellCap } from '../../../../utils/spell-preparation';
import { fmtMod, spellAttackBonus, spellSaveDc } from '../../../../utils/character-math';
import { SpellPickerComponent } from '../../../spell-picker/spell-picker.component';
import { Eli5ToggleComponent } from '../../../eli5-toggle/eli5-toggle.component';
import { SpellEli5Service } from '../../../../services/spell-eli5.service';
import { SpellRefreshService } from '../../../../services/spell-refresh.service';
import { SpellSlotTrackerComponent } from '../../spell-slot-tracker/spell-slot-tracker.component';
import { MysticFocusComponent } from '../../mystic-focus/mystic-focus.component';
import { MysticFocusRequest } from '../../../../models/mystic-focus';
import { SlotNotice, ordinal, slotLevels, slotsLeftText } from '../../../../utils/spell-slots';
import { SLOT_STATS, adjustmentsFor } from '../../../../models/stat-adjustment';
import { followerSpellFor } from '../../../../models/spell-followers';

export interface SpellLevel {
  lvl: number;
  label: string;
  spells: NonNullable<PC['spells']>;
  slots: { max: number; used: number } | null;
}

/** A cast the panel wants to make, resolved to a concrete slot level (0 = cantrip). */
export interface CastRequest {
  spellName: string;
  atLevel: number;
  /** Cast as a ritual: no slot is spent and `atLevel` is not used. Left out for an ordinary cast. */
  ritual?: true;
}

/** One slot level offered in the cast picker. A level with nothing left stays listed, disabled. */
export interface CastOption {
  level: number;
  /** "2nd" */
  label: string;
  /** Slots still available at this level. */
  left: number;
}

/** What the cast picker shows for one spell. */
export interface CastPicker {
  options: CastOption[];
  /** The spell may be cast as a ritual, with no slot. */
  ritual: boolean;
  /** The spell's own "at higher levels" text, when a higher slot is on offer; null otherwise. */
  higher: string | null;
}

@Component({
    selector: 'app-spellbook-panel',
    templateUrl: './spellbook-panel.component.html',
    styleUrls: ['./spellbook-panel.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SpellPickerComponent, Eli5ToggleComponent, SpellSlotTrackerComponent, MysticFocusComponent]
})
export class SpellbookPanelComponent implements OnChanges {
  readonly collapsedLevels = new Set<number>();
  toggleLevel(level: number): void {
    if (this.collapsedLevels.has(level)) this.collapsedLevels.delete(level);
    else this.collapsedLevels.add(level);
  }

  readonly pc = input.required<PC>();
  /** DM cross-link view. The DM casts nothing from here, so the Cast buttons are left out. */
  readonly editable = input(false);
  /** Campaign runs strict material components: a missing costly component blocks the cast. */
  readonly strictComponents = input(false);
  /** True only inside a live session — casting is a session-mode action, so the
   *  Cast buttons appear only when this is set. Away from a session a slot is
   *  spent by hand on the strip at the top of the tab. */
  readonly castable = input(false);
  /** DM cross-link: reveals the "Grant spells" control. Distinct from `editable`
   *  (slot editing) — a DM may be able to grant spells without also editing slots. */
  readonly addAllowed = input(false);
  /** The viewer may toggle spells prepared/unprepared: the character's owner on
   *  their own sheet, or the DM cross-link. Swap timing (long-rest-only, etc.)
   *  is deliberately not enforced — tables manage that socially; only the 2024
   *  PHB prepared-count cap is. */
  readonly preparable = input(false);
  /** Show the "Prepared n / cap" count to a viewer who may not change it: the
   *  owner of a campaign character, whose prepared spells change at a long rest. */
  readonly showPreparedCount = input(false);
  /** The viewer owns this character: a spell that makes a creature (Find
   *  Familiar, the summons) offers "Add as follower". Off for the DM's view of
   *  someone else's character and on a follower's own sheet. */
  readonly followerSpells = input(false);
  /** "Add as follower" was pressed on a spell; carries the spell's name. The sheet opens the dialog. */
  readonly followerRequested = output<string>();
  // ── Spell slot strip ─────────────────────────────────────────────────────
  // Who may do what is the sheet's call; the panel only passes it through to
  // the strip and the requests back up. The server enforces the same rules.

  /** The viewer may spend a slot by hand: the DM, or the owner of a character in no campaign. */
  readonly slotsSpendable = input(false);
  /** The viewer may give slots back: the DM, or the owner of a character in no campaign. */
  readonly slotsRestorable = input(false);
  /** "Slot maximum" in the strip's detail row: left out, look only, or the viewer may change it. */
  readonly slotMaximum = input<'hidden' | 'view' | 'edit'>('hidden');
  /** A spend or restore is on its way to the server. */
  readonly slotsBusy = input(false);
  /** What just happened to the slots, for the strip to say (and the level to select). */
  readonly slotNotice = input<SlotNotice | null>(null);
  readonly slotSpend = output<number>();
  readonly slotRestore = output<number>();
  readonly slotsRestoreAll = output<void>();
  /** The viewer asked how a spell level's maximum is made up; carries the spell level. */
  readonly slotMaximumRequested = output<number>();

  // ── Mystic Focus (Warrior of the Mystic Arts, Monk 6) ─────────────────────
  /** The viewer may trade spell slots and Focus Points: the owner or the DM. */
  readonly mysticFocusUsable = input(false);
  /** A conversion is on its way to the server. */
  readonly mysticFocusBusy = input(false);
  /** The viewer confirmed a conversion; the sheet sends it. */
  readonly mysticFocus = output<MysticFocusRequest>();

  /**
   * Spell levels whose maximum the DM's lines took to nothing. The server drops
   * such a level from the slots, which would leave nobody a way back to its
   * lines; whoever may change them keeps seeing the column (as 0/0).
   */
  readonly zeroedSlotLevels = computed<number[]>(() => {
    if (this.slotMaximum() !== 'edit') return [];
    const pc = this.pc();
    const present = new Set(slotLevels(pc.spellSlots).map(l => l.level));
    return SLOT_STATS
      .map((stat, i) => ({ level: i + 1, lines: adjustmentsFor(pc, stat).length }))
      .filter(l => l.lines > 0 && !present.has(l.level))
      .map(l => l.level);
  });

  readonly pcChange = output<PC>();
  /** A cast resolved to a slot level — the host forwards it to the live session. */
  readonly castRequested = output<CastRequest>();
  /**
   * DM-granted spells, already mapped to the PcSpell snapshot shape. Emitted as a bare
   * payload rather than a merged PC because a grant must go through GrantService's
   * refetch-merge-save (the sheet's `pc` copy can be stale — PUTting it directly risks
   * clobbering a concurrent player edit). CharacterSheetComponent owns the actual save.
   */
  readonly spellsGranted = output<PcSpell[]>();

  constructor(
    private dndResources: DndResourcesService,
    private cdr: ChangeDetectorRef,
    /** One-sentence spell summaries for the player's ELI5 switch (signal-backed). */
    readonly eli5: SpellEli5Service,
    private spellRefresh: SpellRefreshService,
  ) {
    // Only a sheet that still shows a "TBD" placeholder spell fetches the catalog.
    effect(() => {
      if ((this.pc().spells ?? []).some(isPlaceholderSpell)) untracked(() => this.spellRefresh.load());
    });
  }

  /**
   * The spells as displayed: saved snapshots, except a stale "TBD" placeholder
   * shows the catalog's finished text. Display only; every save path maps a
   * displayed spell back to its saved snapshot via originalOf().
   */
  private readonly shown = computed(() => {
    const originals = new Map<PcSpell, PcSpell>();
    const spells = (this.pc().spells ?? []).map(saved => {
      const display = this.spellRefresh.refresh(saved);
      originals.set(display, saved);
      return display;
    });
    return { spells, originals };
  });

  /** The saved snapshot behind a displayed spell (itself when it was not refreshed). */
  private originalOf(spell: PcSpell): PcSpell {
    return this.shown().originals.get(spell) ?? spell;
  }

  readonly hasSpells = computed(() => (this.pc().spells ?? []).length > 0);
  /** Prepared leveled spells (cantrips excluded) vs the 2024 PHB class-table cap. */
  readonly preparedCount = computed(() => countPreparedSpells(this.pc().spells ?? []));
  readonly preparedCap = computed(() => preparedSpellCap(this.pc().clazz, this.pc().level, this.pc().subclass));
  /** True when the hero has leveled spells to choose a prepared list from (always-prepared ones are not a choice). */
  readonly hasLeveledSpells = computed(() => (this.pc().spells ?? []).some(s => s.lvl > 0 && !isAlwaysPrepared(s)));

  // ── Player filters (name search + magic school) ──────────────────────────
  // Purely a view over the known-spells list; they narrow what spellsByLevel()
  // renders and never mutate the PC. Both are case-insensitive.
  readonly search = signal('');
  readonly schoolFilter = signal('');
  /** Distinct schools present on this PC's spells, sorted — drives the dropdown. */
  readonly schools = computed<string[]>(() => {
    const set = new Set<string>();
    for (const s of this.shown().spells) {
      if (s.school) set.add(s.school);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });
  /** True when either filter is active — reveals the Clear button / empty note. */
  readonly filtering = computed(() => this.search().trim().length > 0 || this.schoolFilter().length > 0);

  clearFilters(): void {
    this.search.set('');
    this.schoolFilter.set('');
  }
  /** 8 + prof + casting-ability mod; null for non-casters/unknown classes —
   *  the header then simply omits the "Save DC · Spell Atk" readout. */
  readonly saveDc = computed(() => spellSaveDc(this.pc()));
  /** "+7"-style spell attack bonus, pre-formatted; null with saveDc. */
  readonly spellAtk = computed(() => {
    const atk = spellAttackBonus(this.pc());
    return atk == null ? null : fmtMod(atk);
  });

  readonly spellsByLevel = computed<SpellLevel[]>(() => {
    const pc = this.pc();
    const spells = this.shown().spells;
    if (!spells.length) return [];

    // Apply the player's name/school filters before grouping. A level with no
    // surviving spells is dropped, so filtered results collapse to just matches.
    const term = this.search().trim().toLowerCase();
    const school = this.schoolFilter();
    const matches = spells.filter(s =>
      (!term || s.name.toLowerCase().includes(term)) &&
      (!school || s.school === school));

    const map = new Map<number, NonNullable<PC['spells']>>();
    for (const s of matches) {
      if (!map.has(s.lvl)) map.set(s.lvl, []);
      map.get(s.lvl)!.push(s);
    }
    return Array.from(map.keys())
      .sort((a, b) => a - b)
      .map(lvl => {
        const slots = pc.spellSlots?.[lvl] ?? null;
        return {
          lvl,
          label:       lvl === 0 ? 'Cantrips' : `Level ${lvl}`,
          spells:      map.get(lvl)!,
          slots,
        };
      });
  });

  /** What the open cast picker / confirm were built from, to notice when it moved. */
  private castInputs = '';

  ngOnChanges(): void {
    // A character whose slots, spells or components changed (a cast does that)
    // closes any open picker/confirm, so stale cast UI never survives the data
    // it was built from. Only a real change counts: the session hands this
    // panel a new but equal character object on every pass, and closing on
    // that would shut the picker the moment it opened.
    const pc = this.pc();
    const inputs = JSON.stringify([
      pc.id, pc.spellSlots ?? null,
      (pc.spells ?? []).map(s => [s.name, s.lvl, s.prepared, s.alwaysPrepared ?? false, s.ritual ?? false]),
      (pc.inventory ?? []).filter(i => i.category === 'material-component'),
      this.strictComponents(),
    ]);
    if (inputs === this.castInputs) return;
    this.castInputs = inputs;
    this.pickerFor = null;
    this.pendingCast = null;
    this.blockedFor = null;
  }

  trackByLvl(_: number, row: SpellLevel): number { return row.lvl; }

  /** Whether this spell's card carries "Add as follower" for this viewer. */
  offersFollower(spell: PcSpell): boolean {
    return this.followerSpells() && !!followerSpellFor(spell.name);
  }

  requestFollower(spell: PcSpell, event: Event): void {
    event.stopPropagation();
    this.followerRequested.emit(spell.name);
  }

  /** "2 of 4 left" / "None left" beside a spell level's heading. */
  readonly slotsLeft = slotsLeftText;

  // ── Expand/collapse spell detail ─────────────────────────────────────────
  // Spells render expanded by default; the map only records the ones a reader
  // has explicitly collapsed (false), so a fresh sheet shows every spell open.
  expandedSpells: Record<string, boolean> = {};

  isExpanded(name: string): boolean {
    return this.expandedSpells[name] !== false;
  }

  toggleExpand(name: string): void {
    // New object reference required for OnPush change detection
    this.expandedSpells = { ...this.expandedSpells, [name]: !this.isExpanded(name) };
  }

  // ── Casting ──────────────────────────────────────────────────────────────
  // Cast resolves to a slot level (or to a ritual, which spends none), warns
  // (or, in strict campaigns, blocks) when a costly material component is
  // missing, then emits — the host owns the actual state change (the
  // live-session endpoint). A slot above the spell's own level is only ever
  // spent because the player picked it.

  /** Spell whose slot picker is open. */
  pickerFor: string | null = null;
  /** Cast awaiting a "component missing — cast anyway?" confirmation. */
  pendingCast: { spellName: string; atLevel: number; ritual: boolean; message: string } | null = null;
  /** Strict-campaign block message for a spell. */
  blockedFor: { spellName: string; message: string } | null = null;

  /** Slot levels with a free slot that this spell could be cast with, lowest first. */
  levelsFor(spell: PcSpell): number[] {
    return castableLevels(this.pc(), spell);
  }

  /** A leveled spell marked as a ritual: it can be cast with no slot (the server checks the same). */
  isRitual(spell: PcSpell): boolean {
    return canCastAsRitual(spell);
  }

  canCast(spell: PcSpell): boolean {
    if (!this.isPrepared(spell)) return false;
    return spell.lvl === 0 || this.levelsFor(spell).length > 0 || this.isRitual(spell);
  }

  castTitle(spell: PcSpell): string {
    if (!this.isPrepared(spell)) return `${spell.name} is not prepared`;
    return this.canCast(spell) ? `Cast ${spell.name}` : 'No slots available';
  }

  /**
   * Whether Cast opens the slot picker for this spell instead of casting at
   * once. It casts at once only when there is nothing to choose: exactly one
   * slot level is free, it is the spell's own level, and the spell is not a
   * ritual. A free slot only at a HIGHER level is a choice (an upcast), so it
   * always asks.
   */
  castAsks(spell: PcSpell): boolean {
    if (spell.lvl === 0) return false;
    const levels = this.levelsFor(spell);
    return !(levels.length === 1 && levels[0] === spell.lvl && !this.isRitual(spell));
  }

  /**
   * The picker for a spell: every slot level the character has from the
   * spell's own level up (a spent level stays in the list, disabled), and
   * whether the ritual option belongs.
   */
  castPicker(spell: PcSpell): CastPicker {
    const options = slotLevels(this.pc().spellSlots)
      .filter(slot => slot.level >= spell.lvl)
      .map(slot => ({ level: slot.level, label: ordinal(slot.level), left: slot.left }));
    const upcast = options.some(option => option.level > spell.lvl);
    return {
      options,
      ritual: this.isRitual(spell),
      higher: upcast && spell.higherLevelSlot?.trim() ? spell.higherLevelSlot.trim() : null,
    };
  }

  onCastClick(spell: PcSpell, event: Event): void {
    event.stopPropagation(); // don't toggle the detail expand
    if (!this.canCast(spell)) return; // button is disabled; belt and braces
    const reopening = this.pickerFor === spell.name;
    this.pickerFor = null;
    this.pendingCast = null;
    this.blockedFor = null;
    if (reopening) return; // a second press on Cast closes the picker again

    const warning = castWarning(this.pc(), this.originalOf(spell));
    if (warning && this.strictComponents()) {
      this.blockedFor = { spellName: spell.name, message: `${warning} — this campaign requires it to cast.` };
      return;
    }

    if (spell.lvl === 0) {
      this.resolveCast(spell.name, 0, false, warning);
    } else if (this.castAsks(spell)) {
      this.pickerFor = spell.name;
    } else {
      this.resolveCast(spell.name, spell.lvl, false, warning);
    }
  }

  pickLevel(spell: PcSpell, atLevel: number, event: Event): void {
    event.stopPropagation();
    if (!this.levelsFor(spell).includes(atLevel)) return; // a spent level's option is disabled; belt and braces
    this.pickerFor = null;
    this.resolveCast(spell.name, atLevel, false, castWarning(this.pc(), this.originalOf(spell)));
  }

  /** Cast as a ritual: ten minutes longer at the table, and no slot. */
  pickRitual(spell: PcSpell, event: Event): void {
    event.stopPropagation();
    if (!this.isRitual(spell)) return;
    this.pickerFor = null;
    this.resolveCast(spell.name, spell.lvl, true, castWarning(this.pc(), this.originalOf(spell)));
  }

  closePicker(event: Event): void {
    event.stopPropagation();
    this.pickerFor = null;
  }

  /** Emit the cast, or park it behind the missing-component confirmation. */
  private resolveCast(spellName: string, atLevel: number, ritual: boolean, warning: string | null): void {
    if (warning) {
      this.pendingCast = { spellName, atLevel, ritual, message: warning };
      return;
    }
    this.emitCast(spellName, atLevel, ritual);
  }

  private emitCast(spellName: string, atLevel: number, ritual: boolean): void {
    this.castRequested.emit(ritual ? { spellName, atLevel, ritual: true } : { spellName, atLevel });
  }

  confirmPendingCast(event: Event): void {
    event.stopPropagation();
    if (!this.pendingCast) return;
    const { spellName, atLevel, ritual } = this.pendingCast;
    this.pendingCast = null;
    this.emitCast(spellName, atLevel, ritual);
  }

  cancelPendingCast(event: Event): void {
    event.stopPropagation();
    this.pendingCast = null;
  }

  // ── Spell preparation (2024 PHB) ─────────────────────────────────────────
  // Owner/DM toggling of the per-spell `prepared` flag, capped by the class
  // table's Prepared Spells column. Cantrips are always prepared and exempt.
  // Deliberately no long-rest-only swap timing — the cap is the only rule.

  /** Missing flag (pre-feature data) and cantrips both count as prepared. */
  isPrepared(spell: PcSpell): boolean {
    return isSpellPrepared(spell);
  }

  /** A spell a feature always keeps prepared: no Prepare button, never counted against the cap. */
  isAlwaysPrepared(spell: PcSpell): boolean {
    return isAlwaysPrepared(spell);
  }

  /** 'Always prepared (Favored Enemy).' — the line in the spell's detail. */
  alwaysPreparedLine(spell: PcSpell): string {
    const source = spell.grantedBy ? ` (${spell.grantedBy})` : '';
    return `Always prepared${source}. It does not count against your prepared spells.`;
  }

  /**
   * DM only: mark a leveled spell always prepared, or put it back among the
   * chosen ones. The way to fix a spell a feature gives that was learned or
   * granted before the marker existed (an older Ranger's Hunter's Mark).
   */
  toggleAlwaysPrepared(spell: PcSpell, event: Event): void {
    event.stopPropagation();
    if (!this.addAllowed() || spell.lvl === 0) return;
    const pc = this.pc();
    const saved = this.originalOf(spell);
    const spells = (pc.spells ?? []).map(s => {
      if (s !== saved) return s;
      if (isAlwaysPrepared(s)) {
        const { alwaysPrepared: _marker, grantedBy: _source, ...rest } = s;
        return { ...rest, prepared: true };
      }
      return { ...s, prepared: true, alwaysPrepared: true, grantedBy: s.grantedBy ?? DM_GRANT_SOURCE };
    });
    this.pcChange.emit({ ...pc, spells });
  }

  /** Unpreparing is always allowed; preparing is blocked at the class cap. */
  canTogglePrepared(spell: PcSpell): boolean {
    if (this.isPrepared(spell)) return true;
    const cap = this.preparedCap();
    return cap == null || this.preparedCount() < cap;
  }

  prepareTitle(spell: PcSpell): string {
    if (this.isPrepared(spell)) return `Unprepare ${spell.name}`;
    return this.canTogglePrepared(spell)
      ? `Prepare ${spell.name}`
      : `Prepared spells are at the ${this.pc().clazz} cap (${this.preparedCap()}) — unprepare another spell first`;
  }

  togglePrepared(spell: PcSpell, event: Event): void {
    event.stopPropagation(); // don't toggle the detail expand
    if (spell.lvl === 0) return;                 // cantrips have no toggle
    if (isAlwaysPrepared(spell)) return;         // always prepared: nothing to toggle
    const preparing = !this.isPrepared(spell);
    if (preparing && !this.canTogglePrepared(spell)) return; // at cap; belt and braces
    const pc = this.pc();
    // Persist the SAVED snapshot (only its flag flipped), never the refreshed display copy.
    const saved = this.originalOf(spell);
    const spells = (pc.spells ?? []).map(s =>
      s === saved ? { ...s, prepared: preparing } : s);
    this.pcChange.emit({ ...pc, spells });
  }

  // ── DM grant form ────────────────────────────────────────────────────────
  // Defaults to "All classes" (the full spell list) — DM grants are usually
  // off-list rewards; unticking narrows to the PC's own class list. Either way,
  // candidates already known to the PC are excluded (case-insensitive, matching
  // the level-up modal's rule) so grants can't duplicate a spell the player
  // already has.

  grantFormOpen = false;
  allClasses = true;
  /** Grant the picked leveled spells as always prepared (a feature's spell), outside the prepared limit. */
  grantAlwaysPrepared = false;
  loadingGrantSpells = false;
  grantCandidates: DndSpell[] = [];
  grantSelection: DndSpell[] = [];

  openGrantForm(): void {
    this.grantFormOpen = true;
    this.loadGrantCandidates();
  }

  cancelGrant(): void {
    this.resetGrantForm();
  }

  toggleAllClasses(allClasses: boolean): void {
    this.allClasses = allClasses;
    this.loadGrantCandidates();
  }

  confirmGrant(): void {
    if (!this.grantSelection.length) return;
    this.spellsGranted.emit(this.grantSelection.map(s => (this.grantAlwaysPrepared && s.level > 0
      ? toGrantedSpell(s, DM_GRANT_SOURCE) : toPcSpell(s))));
    this.resetGrantForm();
  }

  private loadGrantCandidates(): void {
    this.loadingGrantSpells = true;
    this.grantSelection = [];
    const known = new Set((this.pc().spells ?? []).map(s => s.name.toLowerCase()));
    // A WoW variant may add spells to its class list (e.g. the Priest's Blur and Levitate).
    const extras = heroClassFor(this.pc())?.extraSpellList;
    // The character's own list: its class's, or the Sorcerer list for a Warrior of the Mystic Arts monk.
    const listClass = spellListClass(this.pc());
    const spells$ = this.allClasses ? this.dndResources.getSpells()
      : extras?.length ? this.dndResources.getSpellsForClass(listClass, extras)
      : this.dndResources.getSpellsForClass(listClass);
    spells$.subscribe({
      next: spells => {
        this.grantCandidates = spells.filter(s => !known.has(s.name.toLowerCase()));
        this.loadingGrantSpells = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingGrantSpells = false;
        this.cdr.markForCheck();
      },
    });
  }

  private resetGrantForm(): void {
    this.grantFormOpen = false;
    this.allClasses = true;
    this.grantAlwaysPrepared = false;
    this.grantCandidates = [];
    this.grantSelection = [];
  }
}
