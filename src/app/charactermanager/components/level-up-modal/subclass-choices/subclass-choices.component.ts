import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, output, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PC, PcSpell } from '../../../models/pc';
import { DndSpell } from '../../../models/dnd-api.types';
import { spellKey } from '../../../models/spell-names';
import {
  SubclassChoices, SubclassSpellPickNeed, subclassPickAllows, subclassSkillChoice, subclassSpellPickGroups,
  subclassSpellPickNeeds,
} from '../../../models/arcana-subclasses';
import { DndResourcesService } from '../../../services/dnd-resources.service';
import { SpellEli5Service } from '../../../services/spell-eli5.service';
import { toGrantedSpell } from '../../../utils/spell-mapping';
import { SpellPickerComponent } from '../../spell-picker/spell-picker.component';
import { Eli5ToggleComponent } from '../../eli5-toggle/eli5-toggle.component';

/**
 * What the player has chosen for the subclass so far, as the level-up request
 * carries it. The level-up dialog merges it into its own choices and keeps
 * Confirm blocked while `valid` is false.
 */
export interface SubclassChoiceResult {
  /** Keys to write to `pc.subclassChoices`; empty when the subclass stores nothing this level. */
  subclassChoices: SubclassChoices;
  /** The spells picked for subclass features, each with the feature as its `grantedBy`. */
  newSpells: PcSpell[];
  /** Held subclass picks being swapped out, by name; each has its replacement in `newSpells`. */
  forgetSpells: string[];
  /** True when everything this level asks of the subclass is chosen. */
  valid: boolean;
}

/** One spell picker of a feature: so many spells of one level. */
export interface SubclassPickGroupView {
  /** Stable id of the picker within the component (`Student of Arcana|0`). */
  id: string;
  level: number;
  count: number;
  /** Heading above the picker. */
  label: string;
  /** The count beside the heading ('Wizard cantrips 1/2'). */
  counts: string;
  options: DndSpell[];
  picked: DndSpell[];
}

/** One feature with spells to pick: its optional swap and its pickers. */
export interface SubclassPickFeatureView {
  feature: string;
  /** Id of the swap select. */
  selectId: string;
  /** Label of the swap select ('Replace a Student of Arcana cantrip (optional)'). */
  replaceLabel: string;
  /** The held picks one of which may be swapped out; empty when none may. */
  replaceable: readonly PcSpell[];
  /** The held pick being swapped out, by name; '' for none. */
  forget: string;
  groups: SubclassPickGroupView[];
}

/** The choices in progress, for one subclass: picking another subclass starts over. */
interface Draft {
  subclass: string;
  skills: readonly string[];
  /** Spells picked, by picker id. */
  picks: Readonly<Record<string, DndSpell[]>>;
  /** The held pick being swapped out, by feature. */
  forget: Readonly<Record<string, string>>;
}

const NO_KEYS: readonly string[] = [];
const NO_SPELLS: DndSpell[] = [];

const subclassKey = (name: string | null | undefined): string => (name ?? '').trim().toLowerCase();
const emptyDraft = (subclass: string): Draft => ({ subclass, skills: [], picks: {}, forget: {} });
const capitalized = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * The choices a subclass asks for at a level-up, as sections inside the
 * level-up dialog. It reads the rules from models/arcana-subclasses and renders
 * one section per kind of choice:
 *
 * - **Skills** — the skill proficiency a feature lets the player choose (an
 *   Arcana Domain cleric's one skill; an Arcane Archer's replacement for
 *   Arcana or Nature when it already had one), with the skills given outright
 *   listed above.
 * - **Spell picks** — the spells a feature lets the player pick (Student of
 *   Arcana's two Wizard cantrips, Magical Mastery's four Wizard spells), one
 *   picker per spell level, and at a later level-up the option to swap one
 *   held pick for another of the same level.
 *
 * It renders nothing for a subclass, class or level with no choice to make. It
 * owns no rules: what is owed comes from the model, and the server checks the
 * result again. A new kind of choice is a new section here plus its rule in the
 * model; the dialog itself only passes the character through and merges
 * {@link SubclassChoiceResult}.
 *
 * It reports only when the player changes something. Until then the dialog
 * reads `subclassChoicesDue()` from the model to know whether anything is owed.
 */
@Component({
  selector: 'app-subclass-choices',
  templateUrl: './subclass-choices.component.html',
  styleUrls: ['./subclass-choices.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SpellPickerComponent, Eli5ToggleComponent],
})
export class SubclassChoicesComponent {
  /** The character as it is before the level-up. */
  readonly pc = input.required<PC>();
  /** The subclass the choices are for: the one being picked this level, else the character's own. */
  readonly subclass = input<string | null | undefined>(null);
  /** The level being reached. */
  readonly newLevel = input.required<number>();
  /**
   * Spells the dialog already has spoken for this level (its own picks and the
   * spells the level hands over), as lookup keys (spellKey): never offered here.
   */
  readonly exclude = input<readonly string[]>(NO_KEYS);
  /** The player changed a choice. */
  readonly choicesChange = output<SubclassChoiceResult>();

  /** Player's ELI5 switch: when active, the spell pickers show one-sentence summaries. */
  readonly eli5 = inject(SpellEli5Service);
  private readonly dndResources = inject(DndResourcesService);

  /** The spell data the picks are offered from; null until loaded. */
  private readonly spells = signal<DndSpell[] | null>(null);
  readonly loadingSpells = signal(false);
  readonly spellsFailed = signal(false);

  /**
   * What the player has chosen so far. It starts over whenever the subclass
   * changes, as the dialog's copy of the result does: picking another subclass
   * and coming back never brings an old answer back.
   */
  private readonly draft = linkedSignal<string, Draft>({
    source: () => subclassKey(this.subclass()),
    computation: key => emptyDraft(key),
  });

  /** The skill choice owed, with the skills the feature gives outright; null when there is none. */
  readonly skillChoice = computed(() => subclassSkillChoice(this.pc(), this.subclass(), this.newLevel()));
  readonly pickedSkills = computed(() => this.draft().skills);

  private readonly needs = computed<SubclassSpellPickNeed[]>(() =>
    subclassSpellPickNeeds(this.pc(), this.subclass(), this.newLevel())
      .filter(need => need.owed.length > 0 || need.replaceable.length > 0));

  /** The features with spells to pick or swap, with their pickers. */
  readonly features = computed<SubclassPickFeatureView[]>(() => {
    const draft = this.draft();
    return this.needs().map((need, index) => {
      const feature = need.rule.feature;
      const forget = draft.forget[feature] ?? '';
      const cantrips = need.rule.levels.every(level => level === 0);
      return {
        feature,
        selectId: `subclass-choice-replace-${index}`,
        replaceLabel: `Replace a ${feature} ${cantrips ? 'cantrip' : 'spell'} (optional)`,
        replaceable: need.replaceable,
        forget,
        groups: subclassSpellPickGroups(need, forget).map(group => {
          const id = `${feature}|${group.level}`;
          const picked = draft.picks[id] ?? NO_SPELLS;
          const list = need.rule.spellList ? `${capitalized(need.rule.spellList)} ` : '';
          return {
            id, level: group.level, count: group.count, picked,
            label: group.level === 0
              ? `${feature} ${group.count === 1 ? 'cantrip' : 'cantrips'}`
              : `${feature}, level ${group.level} ${group.count === 1 ? 'spell' : 'spells'}`,
            counts: group.level === 0
              ? `${list}cantrips ${picked.length}/${group.count}`
              : `${list}spells ${picked.length}/${group.count}`,
            options: this.optionsFor(need, group.level),
          };
        }),
      };
    });
  });

  constructor() {
    // The spell data is only fetched for a character with spells to pick.
    effect(() => {
      if (this.needs().length && !this.spells() && !this.loadingSpells() && !this.spellsFailed()) this.loadSpells();
    });
  }

  private loadSpells(): void {
    this.loadingSpells.set(true);
    this.dndResources.getSpells().subscribe({
      next: spells => {
        this.spells.set(spells);
        this.loadingSpells.set(false);
      },
      error: () => {
        this.loadingSpells.set(false);
        this.spellsFailed.set(true);
      },
    });
  }

  /**
   * The spells on offer for one picker: every spell that fits the rule at that
   * level, less a cantrip the character knows, a spell it already has always
   * prepared, a pick it holds for this feature, and anything the dialog has
   * spoken for. A leveled spell the character merely knows stays on offer: the
   * feature makes it always prepared.
   */
  private optionsFor(need: SubclassSpellPickNeed, level: number): DndSpell[] {
    const all = this.spells();
    if (!all) return NO_SPELLS;
    const taken = this.exclude();
    const held = new Map((this.pc().spells ?? []).map(s => [spellKey(s.name), s]));
    const feature = need.rule.feature.toLowerCase();
    return all.filter(spell => {
      const key = spellKey(spell.name);
      if (!subclassPickAllows(need.rule, spell, level) || taken.includes(key)) return false;
      const mine = held.get(key);
      if (!mine) return true;
      return spell.level > 0 && !mine.alwaysPrepared && (mine.grantedBy ?? '').toLowerCase() !== feature;
    });
  }

  // ── Skills ───────────────────────────────────────────────────────────────

  isSkillPicked(skill: string): boolean {
    return this.pickedSkills().includes(skill);
  }

  /** True when no more skills may be ticked (a single choice is a radio group and never blocks). */
  skillBlocked(skill: string): boolean {
    const count = this.skillChoice()?.count ?? 0;
    return count > 1 && !this.isSkillPicked(skill) && this.pickedSkills().length >= count;
  }

  /** Pick a skill: one choice replaces the pick, several toggle it up to the count. */
  toggleSkill(skill: string): void {
    const rule = this.skillChoice();
    if (!rule || !rule.options.includes(skill)) return;
    const picked = this.pickedSkills();
    let skills: readonly string[];
    if (rule.count === 1) skills = [skill];
    else if (picked.includes(skill)) skills = picked.filter(s => s !== skill);
    else if (picked.length < rule.count) skills = [...picked, skill];
    else return;
    this.update({ ...this.draft(), skills });
  }

  // ── Spell picks ──────────────────────────────────────────────────────────

  setPicks(group: SubclassPickGroupView, spells: DndSpell[]): void {
    const draft = this.draft();
    this.update({ ...draft, picks: { ...draft.picks, [group.id]: spells } });
  }

  /** Choose the held pick to swap out ('' for none); picks the swap no longer has room for are dropped. */
  setForget(feature: string, name: string): void {
    const draft = this.draft();
    const need = this.needs().find(n => n.rule.feature === feature);
    if (!need) return;
    const picks: Record<string, DndSpell[]> = {};
    for (const [id, spells] of Object.entries(draft.picks)) {
      if (!id.startsWith(`${feature}|`)) picks[id] = spells;
    }
    for (const group of subclassSpellPickGroups(need, name)) {
      const id = `${feature}|${group.level}`;
      const kept = (draft.picks[id] ?? NO_SPELLS).slice(0, group.count);
      if (kept.length) picks[id] = kept;
    }
    this.update({ ...draft, picks, forget: { ...draft.forget, [feature]: name } });
  }

  // ── Result ───────────────────────────────────────────────────────────────

  private update(draft: Draft): void {
    this.draft.set(draft);
    this.choicesChange.emit(this.result());
  }

  /** The choices as the level-up request carries them. */
  result(): SubclassChoiceResult {
    const rule = this.skillChoice();
    const skills = this.pickedSkills();
    const features = this.features();
    const groups = features.flatMap(view => view.groups);
    return {
      // An Arcane Archer who owes no skill sends no key: the server stores an empty list itself.
      subclassChoices: rule && rule.count > 0 ? { skills: [...skills] } : {},
      newSpells: features.flatMap(view =>
        view.groups.flatMap(group => group.picked.map(spell => toGrantedSpell(spell, view.feature)))),
      forgetSpells: features.map(view => view.forget).filter(name => !!name),
      valid: (!rule || skills.length === rule.count) && groups.every(group => group.picked.length === group.count),
    };
  }
}
