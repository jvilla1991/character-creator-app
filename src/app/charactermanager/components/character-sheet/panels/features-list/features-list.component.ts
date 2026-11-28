import { ChangeDetectionStrategy, Component, DestroyRef, Input, computed, inject, output, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { PC } from '../../../../models/pc';
import { ClassFeatureProgressionEntry } from '../../../../models/class-feature';
import { ClassFeatureService } from '../../../../services/class-feature.service';
import { DndResourcesService } from '../../../../services/dnd-resources.service';
import { PreferencesService } from '../../../../services/preferences.service';
import { FormsModule } from '@angular/forms';
import { featSourceNote } from '../../../../models/wow-feats';
import { isFeatEntry } from '../../../../models/character-feats';
import { ResourceCounterComponent } from '../../resource-counter/resource-counter.component';
import {
  ARCANE_SHOT_RESOURCE, ClassResourceState, HERO_PANEL_RESOURCES, classResourceStates, withResourceUsed,
} from '../../../../utils/class-resources';

type Feature = { name: string; source: string; desc: string; category?: 'class' | 'other' };

/** A feature the character has yet to unlock: the roadmap entry plus its display label. */
type LockedFeature = { name: string; desc: string; level: number; source: string };

const nameKey = (name: string): string => name.trim().toLowerCase();

/** Stable empty list for a feature without a counter. */
const NO_RESOURCES: readonly ClassResourceState[] = [];

@Component({
    selector: 'app-features-list',
    templateUrl: './features-list.component.html',
    styleUrls: ['./features-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, ResourceCounterComponent]
})
export class FeaturesListComponent {
  private readonly classFeatureService = inject(ClassFeatureService);
  private readonly preferences = inject(PreferencesService);

  private readonly pcSignal = signal<PC | undefined>(undefined);

  @Input({ required: true })
  set pc(value: PC) {
    this.pcSignal.set(value);
    this.loadProgression(value);
  }
  get pc(): PC {
    return this.pcSignal() as PC;
  }

  /** True when the viewer is a DM cross-linked into this sheet — reveals the Grant control. */
  @Input() addAllowed = false;
  /**
   * A DM-granted feature. Emitted as a bare payload rather than a merged PC because a grant
   * must go through GrantService's refetch-merge-save (the sheet's `pc` copy can be stale —
   * PUTting it directly risks clobbering a concurrent player edit). CharacterSheetComponent
   * owns the actual save.
   */
  readonly featureGranted = output<Feature>();

  constructor(private dndResources: DndResourcesService) {
    inject(DestroyRef).onDestroy(() => this.progressionSub?.unsubscribe());
  }

  // ── Class feature roadmap (levels 2–20) ──────────────────────────────────

  /** The class + subclass roadmap from the server; empty until loaded, and in demo mode. */
  private readonly progression = signal<ClassFeatureProgressionEntry[]>([]);
  private progressionKey: string | null = null;
  private progressionSub?: Subscription;

  /** Refetches the roadmap only when the class, subclass or specialization actually changed. */
  private loadProgression(pc: PC | undefined): void {
    const key = pc?.clazz ? `${pc.clazz}|${pc.subclass ?? ''}|${pc.specialization ?? ''}` : '';
    if (key === this.progressionKey) return;
    this.progressionKey = key;
    this.progressionSub?.unsubscribe();
    this.progression.set([]);
    if (!pc?.clazz) return;
    this.progressionSub = this.classFeatureService
      .progression(pc.clazz, pc.subclass, pc.specialization)
      .subscribe(entries => this.progression.set(entries));
  }

  /**
   * Splits the roadmap around the character's level. Entries at or below it that are not saved
   * on the character are "filled in" as unlocked — a character who passed a level before its
   * features were catalogued (every subclass feature, for older characters) would otherwise
   * show a hole. Saved features are matched by name, one saved entry per roadmap entry, so a
   * feature gained twice (a Bard's two Expertise picks) is not filled in twice.
   */
  private readonly roadmap = computed(() => {
    const pc = this.pcSignal();
    const level = pc?.level ?? 1;
    const saved = new Map<string, number>();
    for (const f of pc?.features ?? []) {
      saved.set(nameKey(f.name), (saved.get(nameKey(f.name)) ?? 0) + 1);
    }

    const filledIn: Feature[] = [];
    const locked: LockedFeature[] = [];
    for (const entry of this.progression()) {
      if (entry.level > level) {
        const unlockAt = `Level ${entry.level}`;
        locked.push({
          name: entry.name,
          desc: entry.desc,
          level: entry.level,
          source: entry.subclass && pc?.subclass ? `${pc.subclass} · ${unlockAt}` : unlockAt,
        });
        continue;
      }
      const left = saved.get(nameKey(entry.name)) ?? 0;
      if (left > 0) {
        saved.set(nameKey(entry.name), left - 1);
      } else {
        // Same source wording the server writes when a level-up grants the feature.
        filledIn.push({ name: entry.name, source: `${pc?.clazz} ${entry.level}`, desc: entry.desc });
      }
    }
    return { filledIn, locked };
  });

  private readonly unlocked = computed<Feature[]>(() => [
    ...(this.pcSignal()?.features ?? []).filter(f => f.category !== 'other'),
    ...this.roadmap().filledIn,
  ]);

  /**
   * Unlocked entries shown in this panel: everything saved on the character that is NOT tagged
   * category 'other' (absent = class, so every pre-existing entry stays here; 'other' entries
   * render in the sibling Other Features panel), followed by any roadmap features at or below
   * the character's level that are missing from the saved list.
   */
  get classFeatures(): Feature[] {
    return this.unlocked();
  }

  // ── Limited-use features (class resource counters) ───────────────────────

  /** The viewer may spend and regain uses: the sheet's owner, or the DM. */
  @Input() resourcesEditable = false;
  /** A resource was spent or regained — the sheet saves the updated character. */
  readonly pcChange = output<PC>();

  /**
   * Where each counter goes. A resource sits under the listed feature it
   * belongs to (Sorcery Points under Font of Magic; a feat's counters under the
   * feat, two of them for Familiar Friend). One whose feature is not in the
   * list — the level 1 features, which the roadmap does not carry — gets a row
   * of its own, named after that feature. Death Coil and Soul Fragments are
   * left to the hero-class panel, beside the hero feature, and Arcane Shot to
   * the Arcane Shot panel, beside the options it powers.
   */
  private readonly resourcePlacement = computed(() => {
    const byFeature = new Map<Feature, ClassResourceState[]>();
    const unlisted: ClassResourceState[] = [];
    const features = this.unlocked();
    for (const resource of classResourceStates(this.pcSignal())) {
      if (HERO_PANEL_RESOURCES.includes(resource.key) || resource.key === ARCANE_SHOT_RESOURCE) continue;
      const home = features.find(f => nameKey(f.name) === nameKey(resource.feature));
      if (!home) unlisted.push(resource);
      else if (byFeature.has(home)) byFeature.get(home)!.push(resource);
      else byFeature.set(home, [resource]);
    }
    return { byFeature, unlisted };
  });

  /** The counters that belong under a listed feature; empty for most. */
  resourcesFor(feature: Feature): readonly ClassResourceState[] {
    return this.resourcePlacement().byFeature.get(feature) ?? NO_RESOURCES;
  }

  /** The (first) counter that belongs under a listed feature, if any. */
  resourceFor(feature: Feature): ClassResourceState | undefined {
    return this.resourcesFor(feature)[0];
  }

  /** What an unlisted counter's row says it comes from: the class, or 'Feat' for a feat's counter. */
  unlistedSource(resource: ClassResourceState): string {
    return resource.fromFeat ? 'Feat' : this.pc.clazz;
  }

  /** Resources whose feature is not listed above; each is shown as a feature row of its own. */
  get unlistedResources(): ClassResourceState[] {
    return this.resourcePlacement().unlisted;
  }

  setResourceUsed(resource: ClassResourceState, used: number): void {
    if (!this.resourcesEditable) return;
    this.pcChange.emit({ ...this.pc, classResources: withResourceUsed(this.pc, resource.key, used) });
  }

  /** Roadmap features above the character's level, in level order. */
  get lockedFeatures(): LockedFeature[] {
    return this.roadmap().locked;
  }

  /** Whether the locked features are listed; remembered across visits (PreferencesService). */
  readonly showLocked = this.preferences.showLockedFeatures;

  toggleLocked(): void {
    this.preferences.setShowLockedFeatures(!this.showLocked());
  }

  /**
   * Description to show for a feature. Feats taken on level-up are stored with a blank desc
   * (the backend doesn't own feat descriptions — they live in the frontend), so for those we
   * fall back to the local feat-description lookup. Class features carry their own desc.
   */
  /**
   * Hover text for the ✦ on a feat from a book other than the base game
   * ('World of Warcraft feat', 'Arcana Unleashed feat') — marked in the grant
   * typeahead; undefined for a base-game feat.
   */
  featNote(name: string): string | undefined {
    return featSourceNote(name);
  }

  /**
   * The same for a listed entry, when it is a feat the character has (an Origin
   * feat, a feat taken at a level-up or granted by the DM, a Fighting Style) and
   * not some other feature of that name.
   */
  featNoteFor(feature: Feature): string | undefined {
    return isFeatEntry(feature) ? featSourceNote(feature.name) : undefined;
  }

  descFor(feature: Feature): string {
    if (feature.desc) return feature.desc;
    if (feature.source?.toLowerCase().startsWith('feat')) {
      return this.dndResources.getFeatDescription(feature.name);
    }
    return '';
  }

  // ── DM grant form ────────────────────────────────────────────────────────

  grantFormOpen = false;
  nameDraft = '';
  sourceDraft = 'DM Grant';
  descDraft = '';

  /** All known Origin feat names, loaded once — backs the Name field typeahead. */
  allFeatNames: string[] = this.dndResources.getFeatNames();
  featDropdownOpen = false;

  openGrantForm(): void {
    this.grantFormOpen = true;
  }

  cancelGrant(): void {
    this.resetGrantForm();
  }

  /** Feat names matching the current Name draft; blank query shows the full list. */
  get filteredFeats(): string[] {
    const q = this.nameDraft.trim().toLowerCase();
    if (!q) return this.allFeatNames;
    return this.allFeatNames.filter(n => n.toLowerCase().includes(q));
  }

  onNameFocus(): void {
    this.featDropdownOpen = true;
  }

  onNameInput(): void {
    this.featDropdownOpen = true;
  }

  onNameBlur(): void {
    this.featDropdownOpen = false;
  }

  /** Escape closes the dropdown first; a second Escape (dropdown already closed) cancels the form. */
  onNameEscape(): void {
    if (this.featDropdownOpen) {
      this.featDropdownOpen = false;
      return;
    }
    this.cancelGrant();
  }

  /** Selecting a feat from the dropdown auto-fills Name/Source/Description. */
  selectFeat(name: string): void {
    this.nameDraft = name;
    this.sourceDraft = 'Feat';
    this.descDraft = this.dndResources.getFeatDescription(name);
    this.featDropdownOpen = false;
  }

  submitGrant(): void {
    const name = this.nameDraft.trim();
    if (!name) return;
    const source = this.sourceDraft.trim() || 'DM Grant';
    const desc = this.descDraft.trim();
    this.featureGranted.emit({ name, source, desc });
    this.resetGrantForm();
  }

  private resetGrantForm(): void {
    this.grantFormOpen = false;
    this.nameDraft = '';
    this.sourceDraft = 'DM Grant';
    this.descDraft = '';
    this.featDropdownOpen = false;
  }
}
