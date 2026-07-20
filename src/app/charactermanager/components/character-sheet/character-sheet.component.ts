import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { PC, PcSpell, PcItem } from '../../models/pc';
import { CampaignLocation } from '../../models/campaign';
import { PCService } from '../../services/pc.service';
import { GrantService } from '../../services/grant.service';
import { SessionService } from '../../services/session.service';
import { tintFor } from '../../utils/character-math';
import { SurvivalAction, applyConsumeToPc } from '../../utils/survival';
import { CastRequest } from './panels/spellbook-panel/spellbook-panel.component';
import { SkillProfChange } from './panels/skills-list/skills-list.component';
import { isReadyToLevel, xpForNextLevel, xpProgressPct } from '../../models/xp-thresholds';
import { DmEditRequest } from './dm-edit-modal/dm-edit-request';
import { DmEditConfirm } from './dm-edit-modal/dm-edit-modal.component';

@Component({
    selector: 'app-character-sheet',
    templateUrl: './character-sheet.component.html',
    styleUrls: ['./character-sheet.component.scss'],
    standalone: false
})
export class CharacterSheetComponent implements OnChanges {
  @Input() pc!: PC;
  /**
   * When true, the sheet's numbers become click-to-edit and changes persist via
   * the DM-authorized path. Driven by the UiState.dmReturn signal — i.e. a DM viewing one
   * of their campaign members (cross-linked from the dashboard).
   */
  @Input() editable = false;
  /** Hide the header action buttons (Connect/Roll/Long Rest/Level Up/Delete) when
   *  the sheet is embedded read-only, e.g. inside Session Mode. */
  @Input() showActions = true;
  /** Keep the inventory panel interactive even when showActions is false — used by
   *  Session Mode, where the header actions stay hidden but players still need to
   *  manage their inventory mid-session. */
  @Input() inventoryEditable = false;
  /** True while a shop is open and this PC is targeted — passed through to the
   *  inventory panel to reveal its Sell button. */
  @Input() shopOpenForMe = false;
  /** The open shop's category (backend format), or null for curated/no shop. */
  @Input() shopCategory: string | null = null;
  /** True when this PC's campaign runs the Darker Dungeons slot-based inventory
   *  variant — switches the inventory panel to slots/bulk and hides the legacy
   *  equipment panel (a converted PC's weapons/gear were consolidated on join). */
  @Input() slotInventory = false;
  /** True when this PC's campaign runs the Darker Dungeons survival-conditions
   *  variant — reveals the hunger/thirst/fatigue tracker panel. */
  @Input() survivalConditions = false;
  /** True when this PC's campaign runs the strict material-components variant —
   *  a missing costly component blocks the cast instead of warning. */
  @Input() strictComponents = false;
  /** True when the sheet is embedded in a live session — enables the in-session
   *  spellbook Cast buttons and tags new character notes with the session. */
  @Input() sessionLive = false;
  /** The live session id (session embeds only) — tags new character notes. */
  @Input() noteSessionId: number | string | null = null;
  /** True while the DM's short-rest window is open (session embeds only) —
   *  reveals the vitals strip's Spend Hit Die button on the player's sheet. */
  @Input() shortRestOpen = false;
  /** The party's current location (campaign-level), shown at the top of the
   *  sheet. Set by the DM in Session Mode; null until then. */
  @Input() location: CampaignLocation | null = null;
  @Output() deleteRequested = new EventEmitter<void>();
  @Output() rollRequested = new EventEmitter<void>();
  @Output() levelUpRequested = new EventEmitter<void>();
  /** Player asks to connect to their campaign's live session. */
  @Output() connectRequested = new EventEmitter<void>();
  /** Character has no campaign — player asks to join one (opens the join modal). */
  @Output() joinCampaignRequested = new EventEmitter<void>();
  /** Player sells the inventory item at this index; bubbled from the inventory panel. */
  @Output() sellRequested = new EventEmitter<number>();
  /** In-session survival action (eat/drink); bubbled from the survival panel so
   *  the host can call the server-authoritative consume endpoint. */
  @Output() survivalActionRequested = new EventEmitter<SurvivalAction>();
  /** In-session spell cast (resolved to a slot level); bubbled from the spellbook panel. */
  @Output() castRequested = new EventEmitter<CastRequest>();
  /** In-session hit-die spend (short rest); bubbled from the vitals strip so the
   *  host can call the server-authoritative spend endpoint. */
  @Output() spendHitDieRequested = new EventEmitter<void>();

  /** Whether this PC belongs to a campaign (gates the Connect button). */
  get inCampaign(): boolean {
    return this.pc?.campaignId != null;
  }

  // ── XP (display only) ────────────────────────────────────────────────────
  // XP accumulates via DM awards in Session Mode; leveling stays the explicit
  // flow below. These getters drive the header's XP total and a "ready to level
  // up" badge — they never advance a level on their own.

  /** Total XP required to reach the next level, or null at max level. */
  get xpForNextLevel(): number | null {
    return xpForNextLevel(this.pc?.level ?? 1);
  }

  /** True once total XP has crossed the next 2024 PHB threshold. */
  get readyToLevel(): boolean {
    return isReadyToLevel(this.pc?.level ?? 1, this.pc?.xp ?? 0);
  }

  /** The DM granted a level-up this character hasn't spent yet. */
  get dmGrantedLevel(): boolean {
    return this.pc?.pendingLevelGrant === true;
  }

  /** Leveling is gated: enough XP for the next level OR a DM grant. In DM
   *  cross-link mode the DM may always level the character (the DM-authorized
   *  path has no XP gate — acting is the authorization). The backend enforces
   *  the same rules (409 / as-dm); this only drives the button. */
  get canLevelUp(): boolean {
    return this.editable || this.readyToLevel || this.dmGrantedLevel;
  }

  /** Tooltip for the Level Up button, explaining a disabled state. */
  get levelUpHint(): string {
    if (this.editable) return 'Level up this character (no XP threshold required)';
    if (this.canLevelUp) return 'Advance a level';
    return this.xpForNextLevel == null
      ? 'Maximum level reached'
      : 'Not enough XP yet — reach ' + this.xpForNextLevel + ' XP or ask your DM to grant a level';
  }

  /** DM cross-link: toggle the pending level-up grant for this character. */
  toggleLevelGrant(): void {
    this.pcService.grantLevelUp(this.pc.id, !this.dmGrantedLevel).subscribe({
      error: err => console.error('Failed to change the level-up grant', err),
    });
  }

  /** Fill % (0–100) of the XP bar — progress through the current level. */
  get xpProgressPct(): number {
    return xpProgressPct(this.pc?.level ?? 1, this.pc?.xp ?? 0);
  }

  onConnectClick(): void {
    this.connectRequested.emit();
  }

  /** Active section tab. The sheet is split so Notes (and Spells/Inventory) get
   *  their own space; on mobile the tab bar is pinned to the bottom of the screen. */
  activeTab: 'sheet' | 'spells' | 'inventory' | 'notes' | 'log' = 'sheet';
  setTab(tab: 'sheet' | 'spells' | 'inventory' | 'notes' | 'log'): void { this.activeTab = tab; }

  editingName = false;
  nameDraft = '';
  editingLevel = false;
  levelDraft: number | null = null;

  constructor(
    private pcService: PCService,
    private grantService: GrantService,
    private sessionService: SessionService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pc']) {
      // Reset edit state whenever a new PC is loaded
      this.editingName = false;
      this.nameDraft = this.pc?.name ?? '';
      this.editingLevel = false;
      this.levelDraft = this.pc?.level ?? 1;
    }
  }

  /**
   * Persist an updated PC. In editable (DM cross-link) mode this goes through the
   * DM-authorized path so a DM may save another player's character; otherwise it
   * uses the owner path. PCService pushes the result into activePC$, so the sheet
   * refreshes itself. `description`, when given, is a DM-authored log entry that
   * replaces the backend's automatic before/after diff — only ever passed from
   * the DM edit modal and the skills-panel proficiency toggle; every other call
   * site (name/level/conditions/pcChange) omits it and keeps the auto-diff
   * behavior unchanged.
   */
  private persist(updated: PC, description: string | null = null): void {
    const save$ = this.editable
      ? this.pcService.updatePCAsDm(updated, description)
      : this.pcService.updatePC(updated);
    save$.subscribe({ error: err => console.error('Failed to save character', err) });
  }

  /** A child panel emitted a fully-updated PC (e.g. an ability score changed). */
  onPcChange(updated: PC): void {
    this.persist(updated);
  }

  /** DM cycled a skill's proficiency marker (skills panel, cross-link mode only).
   *  The panel supplies the log line — a skills-map change has no readable
   *  auto-diff on the backend, so we pass the description through. */
  onSkillProfChange(change: SkillProfChange): void {
    this.persist(change.pc, change.description);
  }

  /** Whether the viewer owns this sheet — drives the survival Eat/Drink buttons.
   *  Mirrors the pc-notes canWrite rule: interactive contexts minus DM cross-link. */
  get ownSheet(): boolean {
    return (this.showActions || this.inventoryEditable) && !this.editable;
  }

  /**
   * A survival action from the panel. In a live session the host owns it (the
   * server decrements the supply charge and bumps the poll version); on the
   * plain sheet the local reducer applies the same rules and persists.
   */
  onSurvivalAction(action: SurvivalAction): void {
    if (this.sessionLive) {
      this.survivalActionRequested.emit(action);
      return;
    }
    this.persist(applyConsumeToPc(this.pc, action));
  }

  /**
   * A cast from the spellbook panel — only reachable inside a live session (the
   * Cast buttons are hidden otherwise). The host forwards it to Session Mode,
   * which spends the slot, consumes the component, and bumps the poll version.
   */
  onCastRequested(ev: CastRequest): void {
    this.castRequested.emit(ev);
  }

  // ── Portrait helpers ────────────────────────────────────────────────────────

  /** CSS background value for portrait circle. Delegates to shared utility. */
  tintFor(pc: PC): string { return tintFor(pc); }

  initialsFor(pc: PC): string {
    return (pc.portraitInitials || pc.name.slice(0, 2)).toUpperCase();
  }

  // ── Name editing ─────────────────────────────────────────────────────────────

  startNameEdit(): void {
    this.nameDraft = this.pc.name;
    this.editingName = true;
  }

  commitName(): void {
    this.editingName = false;
    const trimmed = this.nameDraft.trim();
    if (trimmed && trimmed !== this.pc.name) {
      this.persist({ ...this.pc, name: trimmed });
    } else {
      this.nameDraft = this.pc.name;
    }
  }

  cancelNameEdit(): void {
    this.editingName = false;
    this.nameDraft = this.pc.name;
  }

  // ── Level editing (DM cross-link) ───────────────────────────────────────────
  // Level drives proficiency and the hit-dice pool display; editing it here keeps
  // the header as the single place a level is shown and changed.

  onLevelCommit(level: number): void {
    this.persist({ ...this.pc, level });
  }

  /** DM clicked (intercepted) the level number — request the edit modal instead
   *  of the inline editor. Label matches the backend's own diff vocabulary. */
  requestLevel(): void {
    this.onDmEditRequested({
      label: 'level',
      value: this.pc.level ?? null,
      min: 1,
      max: 20,
      apply: v => ({ ...this.pc, level: v }),
    });
  }

  // ── XP editing (DM cross-link) ──────────────────────────────────────────────
  // XP normally accumulates via session awards; this is the DM's correction
  // path on the member sheet — same intercepted-edit-modal flow as the level.

  onXpCommit(xp: number): void {
    this.persist({ ...this.pc, xp: Math.max(0, xp) });
  }

  /** DM clicked (intercepted) the XP total — request the edit modal instead of
   *  the inline editor. Label matches the backend's own diff vocabulary. */
  requestXp(): void {
    this.onDmEditRequested({
      label: 'XP',
      value: this.pc.xp ?? 0,
      min: 0,
      max: null,
      apply: v => ({ ...this.pc, xp: v }),
    });
  }

  // ── Heroic Inspiration meter ────────────────────────────────────────────────
  // Server-owned fields: the DM adds pips (the fifth converts into Heroic
  // Inspiration), the owner (or DM) spends the badge. In a live session the
  // snapshot carries these fields but a use doesn't bump the session version,
  // so we force one off-cadence refresh to keep every viewer honest.

  readonly inspirationSlots = [0, 1, 2, 3, 4];
  inspirationBusy = false;

  /** DM cross-link: award one pip (the fifth grants Heroic Inspiration). */
  addInspirationPip(): void {
    if (this.inspirationBusy) return;
    this.inspirationBusy = true;
    this.pcService.awardInspirationPip(this.pc.id).subscribe({
      next: () => { this.inspirationBusy = false; this.refreshSessionIfLive(); },
      error: err => {
        this.inspirationBusy = false;
        console.error('Failed to award an inspiration pip', err);
      },
    });
  }

  /** Owner (or DM) spends Heroic Inspiration after using the reroll. */
  useInspiration(): void {
    if (this.inspirationBusy) return;
    this.inspirationBusy = true;
    this.pcService.useInspiration(this.pc.id).subscribe({
      next: () => { this.inspirationBusy = false; this.refreshSessionIfLive(); },
      error: err => {
        this.inspirationBusy = false;
        console.error('Failed to use Heroic Inspiration', err);
      },
    });
  }

  private refreshSessionIfLive(): void {
    if (this.sessionLive) this.sessionService.refresh();
  }

  /** In-session: the player spends a hit die (short-rest window open). */
  onSpendHitDie(): void {
    this.spendHitDieRequested.emit();
  }

  // ── DM edit modal ────────────────────────────────────────────────────────
  // Opened when any intercepted app-editable-number on this sheet (level here,
  // or one bubbled up from vitals-strip/coin-purse/ability-scores) is clicked
  // in DM cross-link mode, instead of that control's own inline editor.

  dmEdit: DmEditRequest | null = null;

  onDmEditRequested(request: DmEditRequest): void {
    this.dmEdit = request;
  }

  onDmEditConfirmed(result: DmEditConfirm): void {
    if (!this.dmEdit) return;
    this.persist(this.dmEdit.apply(result.value), result.description);
    this.dmEdit = null;
  }

  closeDmEdit(): void {
    this.dmEdit = null;
  }

  // ── Conditions (wired fully in Phase 5) ─────────────────────────────────────

  onConditionToggle(condition: string): void {
    const conditions = this.pc.conditions ?? [];
    const next = conditions.includes(condition)
      ? conditions.filter(c => c !== condition)
      : [...conditions, condition];
    this.persist({ ...this.pc, conditions: next });
  }

  /** Exhaustion tracker (conditions panel, 2024 PHB levels 0–6). Clamped here
   *  and persisted exactly like a condition toggle: owner path on the player's
   *  own sheet, DM-authorized path in cross-link mode. */
  onExhaustionChange(level: number): void {
    this.persist({ ...this.pc, exhaustion: Math.max(0, Math.min(6, level)) });
  }

  // ── DM grants ────────────────────────────────────────────────────────────
  // Grants go through GrantService's refetch-merge-save rather than persist() —
  // the sheet's `pc` copy can be stale by the time the DM submits the form, and
  // PUTting it directly risks clobbering a concurrent player edit.

  onFeatureGrant(f: { name: string; source: string; desc: string }): void {
    this.grantService
      .grantToPc(this.pc.id, fresh => ({ ...fresh, features: [...(fresh.features ?? []), f] }))
      .subscribe({ error: err => console.error('Failed to grant feature', err) });
  }

  /** Same refetch-merge-save as onFeatureGrant, but the entry lands in the
   *  Other Features panel — tagged category 'other' here (the single place the
   *  tag is stamped) so the panels can split one features array cleanly. */
  onOtherFeatureGrant(f: { name: string; source: string; desc: string }): void {
    this.grantService
      .grantToPc(this.pc.id, fresh => ({
        ...fresh,
        features: [...(fresh.features ?? []), { ...f, category: 'other' as const }],
      }))
      .subscribe({ error: err => console.error('Failed to grant feature', err) });
  }

  onSpellsGrant(granted: PcSpell[]): void {
    this.grantService
      .grantToPc(this.pc.id, fresh => {
        // Dedupe against the FRESH copy — the player may have learned one of these
        // spells (e.g. via level-up) in the moments between the picker opening and
        // the DM confirming the grant.
        const known = new Set((fresh.spells ?? []).map(s => s.name.toLowerCase()));
        const toAdd = granted.filter(s => !known.has(s.name.toLowerCase()));
        return { ...fresh, spells: [...(fresh.spells ?? []), ...toAdd] };
      })
      .subscribe({ error: err => console.error('Failed to grant spells', err) });
  }

  onLanguageGrant(language: string): void {
    this.grantService
      .grantToPc(this.pc.id, fresh => {
        // Dedupe against the FRESH copy — the player may have gained the language
        // between the form opening and the DM confirming the grant.
        const known = new Set((fresh.languages ?? []).map(l => l.toLowerCase()));
        if (known.has(language.toLowerCase())) return fresh;
        return { ...fresh, languages: [...(fresh.languages ?? []), language] };
      })
      .subscribe({ error: err => console.error('Failed to grant language', err) });
  }

  onItemGrant(item: PcItem): void {
    this.grantService
      .grantToPc(this.pc.id, fresh => {
        // Stack onto an existing catalog line (mirrors the backend purchase path);
        // ad-hoc items have no catalogKey and always append. Granted items arrive
        // unequipped, so there's no AC to recompute.
        const inventory = (fresh.inventory ?? []).map(i => ({ ...i }));
        const line = item.catalogKey ? inventory.find(i => i.catalogKey === item.catalogKey) : undefined;
        if (line) {
          line.qty = (line.qty ?? 0) + (item.qty ?? 1);
          // Backfill the catalog bulk/weight onto a pre-slot-variant line that
          // never got stamped — otherwise the stack keeps deriving its bulk
          // from a weight band that can disagree with the official rating.
          // Never overwrites an existing value (same rule as the conversion).
          if (line.bulk == null && item.bulk != null) line.bulk = item.bulk;
          if (line.weight == null && item.weight != null) line.weight = item.weight;
        } else {
          inventory.push(item);
        }
        return { ...fresh, inventory };
      })
      .subscribe({ error: err => console.error('Failed to grant item', err) });
  }
}
