import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { PC } from '../../../../models/pc';
import {
  arcaneShotCount, hasArcaneShots, knownArcaneShots, subclassChoiceShort,
} from '../../../../models/arcana-subclasses';
import {
  arcaneShotDamage, arcaneShotDie, arcaneShotOption, arcaneShotSaveDc, arcaneShotSaveLine, arcaneShotSheetRule,
  arcaneShotStart, arcaneShotsComplete,
} from '../../../../models/arcane-shots';
import { PCService } from '../../../../services/pc.service';
import { NotificationService } from '../../../../services/notification.service';
import { modFromScore, proficiencyBonus } from '../../../../utils/character-math';
import { ARCANE_SHOT_RESOURCE, classResourceStates, withResourceUsed } from '../../../../utils/class-resources';
import { ResourceCounterComponent } from '../../resource-counter/resource-counter.component';
import { ArcaneShotPickerComponent } from '../../../arcane-shot-picker/arcane-shot-picker.component';

/** A known option as the panel shows it. */
export interface ArcaneShotCard {
  name: string;
  summary: string;
  /** The damage at the character's level: '2d8 Force'. */
  damage: string;
  /** 'Wisdom save, DC 15'; null for an option with no save. */
  save: string | null;
}

/**
 * Who may open the chooser, and how far it goes: 'any' may rewrite the list,
 * 'missing' may only add the options the character is short of.
 */
export type ArcaneShotChooseMode = 'none' | 'missing' | 'any';

/**
 * An Arcane Archer's Arcane Shots on the character sheet (Fighter 3 and up):
 * the uses left, the Arcane Shot Die and save DC for the character's level
 * and Intelligence, and a card for each option it knows.
 *
 * The uses are the ordinary `arcaneShot` class resource: spending one emits
 * the character with `classResources` changed, exactly as the class feature
 * list does, and the sheet saves it. The feature list leaves this one counter
 * out, so it shows once.
 *
 * The options are server-owned (`pc.subclassChoices.arcaneShots`), so choosing
 * them goes through the subclass-choices endpoint, never a sheet save. A
 * character that is short (its subclass was set by hand) can be filled up by
 * its owner or the DM. The DM, and the owner of a character in no campaign,
 * can change the options at any time; a player in a campaign cannot once the
 * list is complete. The server enforces the same split.
 *
 * Renders nothing for any other character.
 */
@Component({
  selector: 'app-arcane-shot-panel',
  templateUrl: './arcane-shot-panel.component.html',
  styleUrls: ['./arcane-shot-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ResourceCounterComponent, ArcaneShotPickerComponent],
})
export class ArcaneShotPanelComponent {
  private readonly pcService = inject(PCService);
  private readonly notifications = inject(NotificationService);

  readonly pc = input.required<PC>();
  /** The viewer may spend and regain uses, and choose options: the sheet's owner, or the DM. */
  readonly canEdit = input(false);
  /** The viewer is the campaign's DM (the cross-link view), who may change the options at any time. */
  readonly asDm = input(false);
  /** False where there is no character to write the options to (a follower's sheet). */
  readonly choosable = input(true);
  /** A use was spent or regained: the sheet saves the updated character. */
  readonly pcChange = output<PC>();

  readonly level = computed(() => this.pc().level ?? 1);
  /** True for an Arcane Archer of Fighter 3 or higher. */
  readonly active = computed(() => hasArcaneShots(this.pc(), this.pc().subclass, this.level()));

  readonly die = computed(() => arcaneShotDie(this.level()));
  /** 8 + Intelligence modifier + Proficiency Bonus (the sheet's own bonus, DM lines included). */
  readonly saveDc = computed(() =>
    arcaneShotSaveDc(modFromScore(this.pc().stats?.INT ?? 10), proficiencyBonus(this.pc())));

  /** The `arcaneShot` uses, as the class feature list would show them. */
  readonly counter = computed(() => classResourceStates(this.pc()).find(r => r.key === ARCANE_SHOT_RESOURCE));

  private readonly known = computed(() => knownArcaneShots(this.pc(), this.level()));

  readonly cards = computed<ArcaneShotCard[]>(() => {
    const level = this.level();
    const dc = this.saveDc();
    return this.known().flatMap(name => {
      const shot = arcaneShotOption(name);
      return shot
        ? [{ name: shot.name, summary: shot.summary, damage: arcaneShotDamage(shot, level), save: arcaneShotSaveLine(shot, dc) }]
        : [];
    });
  });

  /** How many options the character's level gives. */
  readonly shotCount = computed(() => arcaneShotCount(this.level()));

  /** True while the character knows fewer options than its level gives. */
  readonly short = computed(() => subclassChoiceShort(this.pc(), this.level(), 'arcaneShots'));

  readonly chooseMode = computed<ArcaneShotChooseMode>(() => {
    if (!this.active() || !this.canEdit() || !this.choosable()) return 'none';
    if (this.asDm() || this.pc().campaignId == null) return 'any';
    return this.short() ? 'missing' : 'none';
  });

  /** What the chooser lets the viewer tick; null when it cannot be opened. */
  readonly rule = computed(() => {
    const mode = this.chooseMode();
    return mode === 'none' ? null : arcaneShotSheetRule(this.pc(), mode === 'any');
  });

  // ── Spending a use ───────────────────────────────────────────────────────

  setUsed(used: number): void {
    if (!this.canEdit()) return;
    this.pcChange.emit({ ...this.pc(), classResources: withResourceUsed(this.pc(), ARCANE_SHOT_RESOURCE, used) });
  }

  // ── Choosing options ─────────────────────────────────────────────────────

  private readonly chooserOpen = signal(false);
  /** The rule of the open chooser; null while it is closed, or once the viewer may no longer use it. */
  readonly chooserRule = computed(() => (this.chooserOpen() ? this.rule() : null));
  readonly choosing = computed(() => !!this.chooserRule());
  /** The options ticked in the chooser. */
  readonly selection = signal<readonly string[]>([]);
  readonly saving = signal(false);

  readonly complete = computed(() => {
    const rule = this.rule();
    return !!rule && arcaneShotsComplete(rule, this.selection());
  });

  openChooser(): void {
    const rule = this.rule();
    if (!rule) return;
    this.selection.set(arcaneShotStart(rule));
    this.chooserOpen.set(true);
  }

  cancelChooser(): void {
    this.chooserOpen.set(false);
  }

  /** Write the ticked options through the subclass-choices endpoint; the sheet refreshes from the answer. */
  saveChooser(): void {
    if (!this.complete() || this.saving()) return;
    this.saving.set(true);
    this.pcService.setSubclassChoices(this.pc().id, { arcaneShots: [...this.selection()] }, this.asDm()).subscribe({
      next: () => {
        this.saving.set(false);
        this.chooserOpen.set(false);
      },
      error: err => {
        this.saving.set(false);
        this.notifications.error('Could not save the Arcane Shot options. Your picks are still here. Try again.', err);
      },
    });
  }
}
