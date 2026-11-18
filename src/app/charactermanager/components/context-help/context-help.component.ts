import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

/** Hover/focus help on desktop; a native modal provides focus and dismissal on touch. */
@Component({
  selector: 'app-context-help',
  imports: [MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="help-trigger" [attr.aria-label]="'Help: ' + label()"
      [matTooltip]="text()" matTooltipClass="context-help-tooltip" matTooltipTouchGestures="off" #tip="matTooltip"
      aria-haspopup="dialog" (click)="$event.preventDefault(); $event.stopPropagation(); tip.hide(); help.showModal()">?</button>
    <dialog #help [attr.aria-label]="label()" (click)="$event.stopPropagation()"
      (keydown.escape)="$event.stopPropagation()">
      <h2>{{ label() }}</h2>
      <p>{{ text() }}</p>
      <button type="button" class="btn" autofocus (click)="help.close()">Close</button>
    </dialog>
  `,
  styles: [`
    :host { display: inline-block; margin-inline-start: 6px; align-self: center; }
    .help-trigger { width: 28px; height: 28px; border: 1px solid var(--border);
      border-radius: 50%; background: var(--surface); color: var(--text); cursor: help; }
    .help-trigger:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
    dialog { box-sizing: border-box; width: min(420px, calc(100vw - 32px));
      max-height: 80dvh; overflow: auto; padding: 24px; border: 1px solid var(--border);
      background: var(--surface); color: var(--text); border-radius: var(--radius-sm);
      /* The dialog is drawn in the top layer but still inherits from where the
         trigger sits (an uppercase Cinzel label row, a centred header). */
      font: 400 var(--text-base)/1.6 'Newsreader', Georgia, serif;
      letter-spacing: normal; text-transform: none; text-align: start; }
    .help-trigger { font: 500 var(--text-sm)/1 'Newsreader', Georgia, serif; letter-spacing: normal; padding: 0; }
    dialog::backdrop { background: rgb(0 0 0 / 65%); }
    h2 { margin: 0 0 12px; font-size: 1.1rem; }
    /* pre-line: a help text may hold two short paragraphs. */
    p { white-space: pre-line; line-height: 1.6; }
    /* Touch: the circle stays 28px so it can sit in a dense row (beside pips,
       a chip, a button); an invisible 44px halo keeps the tap target. */
    .help-trigger { position: relative; }
    @media (pointer: coarse) { .help-trigger::after { content: ''; position: absolute; inset: -8px; } }
  `],
})
export class ContextHelpComponent {
  readonly label = input.required<string>();
  readonly text = input.required<string>();
}
