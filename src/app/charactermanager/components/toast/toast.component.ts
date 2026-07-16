import { Component } from '@angular/core';
import { NotificationService } from '../../services/notification.service';

/**
 * App-shell toast. Renders the current NotificationService message (if any) as a
 * small themed, dismissible toast. Lives at the shell level so it persists when
 * the view that raised it closes.
 */
@Component({
    selector: 'app-toast',
    templateUrl: './toast.component.html',
    styleUrls: ['./toast.component.scss'],
    standalone: false
})
export class ToastComponent {
  message$ = this.notifications.message$;

  constructor(private notifications: NotificationService) {}

  dismiss(): void {
    this.notifications.dismiss();
  }
}
