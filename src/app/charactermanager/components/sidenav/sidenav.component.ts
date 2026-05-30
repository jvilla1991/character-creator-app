import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { PC } from '../../models/pc';
import { PCService } from '../../services/pc.service';
import { CharacterModalService } from '../../services/character-modal.service';
import { tintFor } from '../../utils/character-math';

interface PartyGroup {
  party: string;
  members: PC[];
}

@Component({
  selector: 'app-sidenav',
  templateUrl: './sidenav.component.html',
  styleUrls: ['./sidenav.component.scss']
})
export class SidenavComponent implements OnInit, OnDestroy {
  // Still declared so the parent template's [pcs]="pcs" binding compiles cleanly.
  // Internal data comes directly from pcsByParty$ below.
  @Input() pcs!: PC[];

  query = '';
  collapsedParties = new Set<string>();
  activePC$ = this.pcService.activePC$;

  private allGroups: PartyGroup[] = [];
  private sub!: Subscription;

  constructor(private pcService: PCService, private characterModal: CharacterModalService) {}

  ngOnInit(): void {
    this.sub = this.pcService.pcsByParty$.subscribe(groupMap => {
      this.allGroups = Array.from(groupMap.entries()).map(([party, members]) => ({ party, members }));
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /** Party groups filtered by the current search query. */
  get filteredByParty(): PartyGroup[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.allGroups;

    return this.allGroups
      .map(({ party, members }) => ({
        party,
        members: members.filter(pc =>
          pc.name.toLowerCase().includes(q) ||
          (pc.player ?? pc.playerName ?? '').toLowerCase().includes(q) ||
          pc.clazz.toLowerCase().includes(q)
        )
      }))
      .filter(g => g.members.length > 0);
  }

  setActivePC(pc: PC): void {
    this.pcService.setActivePC(pc);
  }

  toggleCollapse(party: string): void {
    this.collapsedParties.has(party)
      ? this.collapsedParties.delete(party)
      : this.collapsedParties.add(party);
  }

  /** Maps portraitTint to a CSS background value. Delegates to shared utility. */
  tintFor(pc: PC): string { return tintFor(pc); }

  /** Zero-pad a member count to 2 digits, matching the prototype's display. */
  padCount(n: number): string {
    return n.toString().padStart(2, '0');
  }

  /** Initials for the portrait circle — uses portraitInitials if set, else first two letters of name. */
  initialsFor(pc: PC): string {
    return (pc.portraitInitials || pc.name.slice(0, 2)).toUpperCase();
  }

  forgeHero(): void { this.characterModal.openCreateModal(); }
}
