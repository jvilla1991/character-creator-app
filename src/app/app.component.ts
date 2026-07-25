import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PreferencesService } from './charactermanager/services/preferences.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    imports: [RouterOutlet]
})
export class AppComponent {

  title = 'character-creator';

  // Injected at bootstrap so the persisted theme (data-theme on <html>) is
  // applied on the first paint, before any settings panel is opened.
  constructor(private _prefs: PreferencesService) {}
}
