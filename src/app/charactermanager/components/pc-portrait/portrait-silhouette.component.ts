import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The "unknown" head-and-shoulders bust a character shows until a portrait is
 * uploaded. It fills whatever circle it is put in and takes its tones from the
 * surface tokens, so it reads in every theme. Decorative unless given a label.
 */
@Component({
  selector: 'app-portrait-silhouette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  styles: [`
    svg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
    .ground { fill: var(--surface); }
    .bust { fill: var(--surface-3); }
  `],
  template: `
    <svg viewBox="0 0 124 124" preserveAspectRatio="xMidYMid slice"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() || null"
      [attr.aria-hidden]="label() ? null : 'true'">
      <rect class="ground" width="124" height="124"/>
      <circle class="bust" cx="62" cy="50" r="22"/>
      <path class="bust" d="M16 124c0-28 20-42 46-42s46 14 46 42z"/>
    </svg>
  `,
})
export class PortraitSilhouetteComponent {
  readonly label = input('');
}
