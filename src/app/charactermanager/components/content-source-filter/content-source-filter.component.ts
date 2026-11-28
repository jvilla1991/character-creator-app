import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CONTENT_SOURCES, ContentSource, ContentSourceSelection, allContentSources } from '../../models/content-source';

/**
 * The content-source checkboxes: one per entry of CONTENT_SOURCES (Base Game,
 * World of Warcraft, Arcana Unleashed), in that order. Presentational: the parent
 * owns the selection and applies it to its own list; this only renders real
 * checkboxes inside a labelled fieldset and reports which source was toggled.
 * Shared by the create-character wizard, the spell picker and the level-up
 * dialog's subclass picker.
 */
@Component({
  selector: 'app-content-source-filter',
  templateUrl: './content-source-filter.component.html',
  styleUrls: ['./content-source-filter.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentSourceFilterComponent {
  readonly selection = input<ContentSourceSelection>(allContentSources());
  /** A source checkbox was flipped — the parent toggles it in its selection. */
  readonly toggle = output<ContentSource>();

  readonly sources = CONTENT_SOURCES;
}
