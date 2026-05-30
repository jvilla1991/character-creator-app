import { Component, Input } from '@angular/core';
import { PC } from '../../../../models/pc';

@Component({
  selector: 'app-background-story',
  templateUrl: './background-story.component.html',
  styleUrls: ['./background-story.component.scss']
})
export class BackgroundStoryComponent {
  @Input() pc!: PC;

  get bioFirst(): string { return this.pc.bio?.charAt(0) ?? ''; }
  get bioRest(): string  { return this.pc.bio?.slice(1) ?? ''; }

  get traitEntries(): { key: string; value: string }[] {
    if (!this.pc.traits) return [];
    return Object.entries(this.pc.traits).map(([key, value]) => ({ key, value }));
  }
}
