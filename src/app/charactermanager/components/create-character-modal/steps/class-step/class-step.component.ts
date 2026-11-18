import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DndClass } from '../../../../models/dnd-api.types';
import {
  ClassOption, SpecializationGuidance, WOW_INVOCATION_NOTE, WOW_MANEUVER_NOTE, fightingStyleLevelOf, invocationRows,
  isWowInvocation, isWowManeuver, orList, specializationHeading, subclassGuidanceLabel, weaponMasteryLead,
} from '../../../../models/hero-class';

/**
 * Step 3: pick a class (accordion) and, for Sorcerer/Warlock, its level-1
 * subclass. Hero classes (e.g. Death Knight (Paladin)) show their blurb, their
 * locked subclass and the required specialization picker (a Death Knight's rune,
 * a Demon Hunter's specialization), all read from the hero-class table. A WoW
 * variant without a fixed subclass (WoW Druid, WoW Paladin) shows a
 * "Recommended for <spec>" box once its specialization is picked — guidance only.
 * A WoW Warlock's recommended patron is badged in the level-1 subclass picker
 * (never auto-selected), and its recommended invocations are text only. A WoW
 * Warrior's recommended Battle Master maneuvers are text only too (✦ marks the
 * WoW ones), and its level-1 Fighting Style is a recommendation (no picker here).
 * The Evoker (Sorcerer) locks its level-1 subclass to Draconic Sorcery — shown
 * "(fixed)", with no subclass picker (the parent passes requiresLevel1Subclass
 * false) — and its box adds the spells to prepare, Metamagic and Elemental Affinity.
 * Presentational — the parent owns selection logic, the source filter and the
 * detail fetch, and passes the already-filtered rows and derived strings in.
 */
@Component({
    selector: 'app-class-step',
    templateUrl: './class-step.component.html',
    styleUrls: ['./class-step.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClassStepComponent {
  /** Class rows after the content-source filter (base classes, then hero classes). */
  readonly classOptions = input<ClassOption[]>([]);
  /** Key of the chosen row ('Death Knight (Paladin)', 'Druid (World of Warcraft)' or a base class name). */
  readonly selectedKey = input('');
  /** Display label of the chosen row (used in the hidden-by-filter note). */
  readonly selectedLabel = input('');
  /** Recommended picks for the chosen specialization; null when there are none. */
  readonly guidance = input<SpecializationGuidance | null>(null);
  /** True when the chosen class is hidden by the source filter (it stays chosen). */
  readonly selectedHidden = input(false);
  /** The chosen hero-class specialization; '' when none is picked. */
  readonly specialization = input('');
  /** The chosen BASE class — used in the level-1 subclass note. */
  readonly clazz = input('');
  readonly classDetail = input<DndClass | null>(null);
  readonly loadingClassList = input(false);
  readonly loadingClassDetail = input(false);
  readonly classSavingThrows = input('…');
  readonly requiresLevel1Subclass = input(false);
  readonly availableSubclasses = input<{
    name: string;
    desc: string;
}[]>([]);
  readonly selectedSubclass = input('');
  /**
   * The level-1 subclass the chosen specialization recommends (a WoW Warlock's
   * patron) — badged "Recommended for <spec>" in the picker, never auto-selected;
   * '' when there is none.
   */
  readonly recommendedSubclass = input('');

  /** A class row was clicked (by key) — parent runs toggleClass (select / collapse). */
  readonly toggle = output<string>();
  /** A subclass card was picked (two-way [(selectedSubclass)] on the parent). */
  readonly selectedSubclassChange = output<string>();
  /** A specialization card was picked — parent runs selectSpecialization. */
  readonly specializationChange = output<string>();

  readonly specializationHeading = specializationHeading;
  readonly orList = orList;
  readonly weaponMasteryLead = weaponMasteryLead;
  readonly subclassGuidanceLabel = subclassGuidanceLabel;
  readonly invocationRows = invocationRows;
  readonly isWowInvocation = isWowInvocation;
  readonly wowInvocationNote = WOW_INVOCATION_NOTE;
  readonly isWowManeuver = isWowManeuver;
  readonly wowManeuverNote = WOW_MANEUVER_NOTE;
  readonly fightingStyleLevelOf = fightingStyleLevelOf;
}
