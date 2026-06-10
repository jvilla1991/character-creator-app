import { Component } from '@angular/core';
import { PreferencesService } from './charactermanager/services/preferences.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  title = 'character-creator';

  // Injected at bootstrap so the persisted theme (data-theme on <html>) is
  // applied on the first paint, before any settings panel is opened.
  constructor(private _prefs: PreferencesService) {}
}
