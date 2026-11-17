import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NotificationService } from '../../services/notification.service';
import { AsyncPipe } from '@angular/common';

/**
 * App-shell toast. Renders the current NotificationService message (if any) as a
 * small themed, dismissible toast. Lives at the shell level so it persists when
 * the view that raised it closes.
 */
@Component({
    selector: 'app-toast',
    templateUrl: './toast.component.html',
    styleUrls: ['./toast.component.scss'],
    // The live region is an always-rendered element in the template (not the
    // toast itself), so the dismiss button can sit in the toast without being
    // read out as part of every message.
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AsyncPipe]
})
export class ToastComponent {
  message$ = this.notifications.message$;

  constructor(private notifications: NotificationService) {}

  dismiss(): void {
    this.notifications.dismiss();
  }
}
