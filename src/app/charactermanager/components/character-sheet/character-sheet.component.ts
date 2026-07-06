import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { PC, PcSpell, PcItem } from '../../models/pc';
import { PCService } from '../../services/pc.service';
import { GrantService } from '../../services/grant.service';
import { tintFor } from '../../utils/character-math';
import { CastRequest } from './panels/spellbook-panel/spellbook-panel.component';
import { isReadyToLevel, xpForNextLevel, xpProgressPct } from '../../models/xp-thresholds';

@Component({
  selector: 'app-character-sheet',
  templateUrl: './character-sheet.component.html',
  styleUrls: ['./character-sheet.component.scss']
})
export class CharacterSheetComponent implements OnChanges {
  @Input() pc!: PC;
  /**
   * When true, the sheet's numbers become click-to-edit and changes persist via
   * the DM-authorized path. Driven by UiState.dmReturn$ — i.e. a DM viewing one
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
  @Output() deleteRequested = new EventEmitter<void>();
  @Output() rollRequested = new EventEmitter<void>();
  @Output() levelUpRequested = new EventEmitter<void>();
  /** Player asks to connect to their campaign's live session. */
  @Output() connectRequested = new EventEmitter<void>();
  /** Player sells the inventory item at this index; bubbled from the inventory panel. */
  @Output() sellRequested = new EventEmitter<number>();
  /** In-session spell cast (resolved to a slot level); bubbled from the spellbook panel. */
  @Output() castRequested = new EventEmitter<CastRequest>();

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

  /** Fill % (0–100) of the XP bar — progress through the current level. */
  get xpProgressPct(): number {
    return xpProgressPct(this.pc?.level ?? 1, this.pc?.xp ?? 0);
  }

  /** Briefly shows the "not in a campaign" hint after a click (hover shows it via CSS). */
  connectHintPinned = false;

  onConnectClick(): void {
    if (this.inCampaign) {
      this.connectRequested.emit();
      return;
    }
    this.connectHintPinned = true;
    setTimeout(() => (this.connectHintPinned = false), 2500);
  }

  editingName = false;
  nameDraft = '';
  editingLevel = false;
  levelDraft: number | null = null;

  constructor(private pcService: PCService, private grantService: GrantService) {}

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
   * refreshes itself.
   */
  private persist(updated: PC): void {
    const save$ = this.editable
      ? this.pcService.updatePCAsDm(updated)
      : this.pcService.updatePC(updated);
    save$.subscribe({ error: err => console.error('Failed to save character', err) });
  }

  /** A child panel emitted a fully-updated PC (e.g. an ability score changed). */
  onPcChange(updated: PC): void {
    this.persist(updated);
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

  // ── Conditions (wired fully in Phase 5) ─────────────────────────────────────

  onConditionToggle(condition: string): void {
    const conditions = this.pc.conditions ?? [];
    const next = conditions.includes(condition)
      ? conditions.filter(c => c !== condition)
      : [...conditions, condition];
    this.persist({ ...this.pc, conditions: next });
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

  onItemGrant(item: PcItem): void {
    this.grantService
      .grantToPc(this.pc.id, fresh => {
        // Stack onto an existing catalog line (mirrors the backend purchase path);
        // ad-hoc items have no catalogKey and always append. Granted items arrive
        // unequipped, so there's no AC to recompute.
        const inventory = (fresh.inventory ?? []).map(i => ({ ...i }));
        const line = item.catalogKey ? inventory.find(i => i.catalogKey === item.catalogKey) : undefined;
        if (line) line.qty = (line.qty ?? 0) + (item.qty ?? 1);
        else inventory.push(item);
        return { ...fresh, inventory };
      })
      .subscribe({ error: err => console.error('Failed to grant item', err) });
  }
}
