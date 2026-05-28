import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { DndBackground, DndClass, DndListResponse, DndResource } from '../models/dnd-api.types';

// ---------------------------------------------------------------------------
// Static fallback data used in demo mode (no backend / API calls needed)
// ---------------------------------------------------------------------------
const RACE_LIST = [
  'Human', 'Elf', 'Dwarf', 'Halfling', 'Half-Elf', 'Half-Orc',
  'Tiefling', 'Dragonborn', 'Gnome',
];

const PARTY_LIST = [
  'The Veiled Compass',
  'Tomb of the Sleeping Crown',
  'Unassigned',
];

const CLASS_LIST_2024 = [
  'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter',
  'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard',
];

const BACKGROUND_LIST_2024 = ['Acolyte', 'Criminal', 'Sage', 'Soldier'];

/** Hit die per class (2024 ruleset) */
const CLASS_HIT_DICE: Record<string, number> = {
  barbarian: 12, bard: 8, cleric: 8, druid: 8, fighter: 10,
  monk: 8, paladin: 10, ranger: 10, rogue: 8, sorcerer: 6, warlock: 8, wizard: 6,
};

/** Saving-throw proficiencies per class */
const CLASS_SAVES: Record<string, string[]> = {
  barbarian: ['STR', 'CON'], bard: ['DEX', 'CHA'], cleric: ['WIS', 'CHA'],
  druid: ['INT', 'WIS'], fighter: ['STR', 'CON'], monk: ['STR', 'DEX'],
  paladin: ['WIS', 'CHA'], ranger: ['STR', 'DEX'], rogue: ['DEX', 'INT'],
  sorcerer: ['CON', 'CHA'], warlock: ['WIS', 'CHA'], wizard: ['INT', 'WIS'],
};

/** Ability scores eligible for background bonus (+2/+1) */
const BACKGROUND_ABILITY_SCORES: Record<string, string[]> = {
  acolyte: ['INT', 'WIS', 'CHA'],
  criminal: ['DEX', 'CON', 'CHA'],
  sage: ['INT', 'WIS', 'CHA'],
  soldier: ['STR', 'CON', 'WIS'],
};

function toRef(name: string): DndResource {
  return { index: name.toLowerCase(), name, url: '' };
}

@Injectable({
  providedIn: 'root'
})
export class DndResourcesService {
  /** 2014 ruleset — kept for backward compatibility */
  private dndResourceUrl = 'https://www.dnd5eapi.co/api/2014/';
  /** 2024 ruleset — used by the character creation wizard */
  private dnd2024Url = 'https://www.dnd5eapi.co/api/2024/';

  constructor(private http: HttpClient) {}

  // --------------- 2014 methods (unchanged) ---------------

  getClassNames(): Observable<string[]> {
    if (environment.demoMode) {
      return of(CLASS_LIST_2024);
    }
    return this.http.get<DndListResponse<DndResource>>(this.dndResourceUrl + 'classes').pipe(
      map(r => r.results.map(item => item.name))
    );
  }

  getRaceNames(): Observable<string[]> {
    return of(RACE_LIST);
  }

  getPartyNames(): Observable<string[]> {
    return of(PARTY_LIST);
  }

  // --------------- 2024 methods (character creation wizard) ---------------

  /** List of class names from the 2024 ruleset */
  getClassNames2024(): Observable<string[]> {
    if (environment.demoMode) {
      return of(CLASS_LIST_2024).pipe(delay(100));
    }
    return this.http.get<DndListResponse<DndResource>>(this.dnd2024Url + 'classes').pipe(
      map(r => r.results.map(item => item.name))
    );
  }

  /** List of species names from the 2024 ruleset */
  getSpeciesList(): Observable<string[]> {
    if (environment.demoMode) {
      return of(RACE_LIST).pipe(delay(100));
    }
    return this.http.get<DndListResponse<DndResource>>(this.dnd2024Url + 'species').pipe(
      map(r => r.results.map(item => item.name))
    );
  }

  /** List of background names from the 2024 ruleset */
  getBackgroundList(): Observable<string[]> {
    if (environment.demoMode) {
      return of(BACKGROUND_LIST_2024).pipe(delay(100));
    }
    return this.http.get<DndListResponse<DndResource>>(this.dnd2024Url + 'backgrounds').pipe(
      map(r => r.results.map(item => item.name))
    );
  }

  /** Full detail for a single class (hit_die, saving throws, etc.) */
  getClassDetail(index: string): Observable<DndClass> {
    const key = index.toLowerCase();
    if (environment.demoMode) {
      const saves = (CLASS_SAVES[key] ?? ['STR', 'CON']).map(toRef);
      return of<DndClass>({
        index: key,
        name: index.charAt(0).toUpperCase() + index.slice(1),
        hit_die: CLASS_HIT_DICE[key] ?? 8,
        saving_throws: saves,
        proficiency_choices: [],
        proficiencies: [],
        subclasses: [],
      }).pipe(delay(100));
    }
    return this.http.get<DndClass>(this.dnd2024Url + `classes/${key}`);
  }

  /** Full detail for a single background (ability score bonus options, etc.) */
  getBackgroundDetail(index: string): Observable<DndBackground> {
    const key = index.toLowerCase();
    if (environment.demoMode) {
      const abilities = (BACKGROUND_ABILITY_SCORES[key] ?? ['STR', 'DEX', 'CON']).map(toRef);
      return of<DndBackground>({
        index: key,
        name: index.charAt(0).toUpperCase() + index.slice(1),
        ability_scores: abilities,
        proficiencies: [],
      }).pipe(delay(100));
    }
    return this.http.get<DndBackground>(this.dnd2024Url + `backgrounds/${key}`);
  }
}
