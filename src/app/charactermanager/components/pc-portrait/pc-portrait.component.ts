import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PC } from '../../models/pc';
import { PortraitService } from '../../services/portrait.service';

/**
 * A character's uploaded portrait, filling the `.portrait` circle it sits in,
 * or — when there is none, while it loads, or when it could not be fetched —
 * whatever the host projects instead (the sheet's silhouette, the roster's
 * initials). The circle itself, its size, ring and tint stay with the host.
 *
 * ```html
 * <div class="portrait" [style.background]="tintFor(pc)">
 *   <app-pc-portrait [pc]="pc">{{ initialsFor(pc) }}</app-pc-portrait>
 * </div>
 * ```
 *
 * `alt` names the picture where nothing beside it does (the sheet); leave it
 * empty where the name is right next to it (the roster).
 */
@Component({
  selector: 'app-pc-portrait',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  styles: [`
    .pc-portrait-img {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }
  `],
  template: `
    @if (url(); as src) {
      <img class="pc-portrait-img" [src]="src" [alt]="alt()" draggable="false">
    } @else {
      <ng-content />
    }
  `,
})
export class PcPortraitComponent {
  readonly pc = input.required<Pick<PC, 'id' | 'portraitVersion'>>();
  readonly alt = input('');

  private readonly portraits = inject(PortraitService);

  /** The cached image signal for this character's current portrait version. */
  private readonly image = computed(() => {
    const pc = this.pc();
    return this.portraits.portraitUrl(pc.id, pc.portraitVersion);
  });

  readonly url = computed(() => this.image()());
}
