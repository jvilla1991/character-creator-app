import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { PC } from '../models/pc';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay, map, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

// ---------------------------------------------------------------------------
// Demo seed data — 3 fully-detailed PCs covering both parties.
// Source: design_handoff_arcane_redesign/prototype/data.js
// ---------------------------------------------------------------------------
const DEMO_PCS: PC[] = [
  {
    id: 1,
    name: 'Lyra Moonwhisper',
    playerName: 'Alice',
    player: 'Alice',
    party: 'The Veiled Compass',
    race: 'Half-Elf',
    clazz: 'Bard',
    subclass: 'College of Whispers',
    level: 7,
    background: 'Spy',
    alignment: 'Chaotic Good',
    portraitInitials: 'LM',
    portraitTint: 'celestial',
    hp: { cur: 42, max: 52, temp: 4 },
    ac: 15, init: 4, speed: 30, prof: 3,
    stats: { STR: 8, DEX: 18, CON: 14, INT: 13, WIS: 12, CHA: 18 },
    saves: ['DEX', 'CHA'],
    skills: { Deception: 'expert', Persuasion: 'expert', Insight: 'prof', Stealth: 'prof', Investigation: 'prof', Performance: 'prof' },
    conditions: [],
    coins: { cp: 12, sp: 48, ep: 0, gp: 234, pp: 3 },
    spellSlots: { 1: { max: 4, used: 2 }, 2: { max: 3, used: 1 }, 3: { max: 3, used: 0 }, 4: { max: 1, used: 0 } },
    spells: [
      { lvl: 0, name: 'Vicious Mockery', school: 'Enchantment', time: '1 action', prepared: true },
      { lvl: 0, name: 'Minor Illusion', school: 'Illusion', time: '1 action', prepared: true },
      { lvl: 0, name: 'Mage Hand', school: 'Conjuration', time: '1 action', prepared: true },
      { lvl: 1, name: 'Charm Person', school: 'Enchantment', time: '1 action', prepared: true },
      { lvl: 1, name: 'Disguise Self', school: 'Illusion', time: '1 action', prepared: true },
      { lvl: 1, name: 'Healing Word', school: 'Evocation', time: '1 bonus action', prepared: true },
      { lvl: 2, name: 'Suggestion', school: 'Enchantment', time: '1 action', prepared: true },
      { lvl: 2, name: 'Detect Thoughts', school: 'Divination', time: '1 action', prepared: true },
      { lvl: 3, name: 'Hypnotic Pattern', school: 'Illusion', time: '1 action', prepared: true },
      { lvl: 3, name: 'Counterspell', school: 'Abjuration', time: '1 reaction', prepared: true },
      { lvl: 4, name: 'Greater Invisibility', school: 'Illusion', time: '1 action', prepared: true },
    ],
    weapons: [
      { name: "Rapier of the Last Lullaby", magic: true, dmg: '1d8+4 piercing', notes: '+1, sleep on crit' },
      { name: 'Hand Crossbow', dmg: '1d6+4 piercing', notes: '80/320 ft' },
      { name: 'Dagger', dmg: '1d4+4 piercing', notes: '20/60 ft (thrown)' },
    ],
    gear: [
      { name: 'Studded Leather Armor', equipped: true },
      { name: 'Cloak of Many Faces', magic: true, equipped: true, notes: 'attunement' },
      { name: 'Lute (silvered)', equipped: true },
      { name: "Thieves' Tools" },
      { name: 'Disguise Kit' },
      { name: 'Forgery Kit' },
      { name: 'Potion of Healing ×3' },
    ],
    features: [
      { name: 'Bardic Inspiration (d8)', source: 'Bard 5', desc: 'Bonus action; 4 uses per long rest.' },
      { name: 'Psychic Blades', source: 'Whispers 3', desc: 'Once per turn, +3d6 psychic damage when you hit with a weapon.' },
      { name: 'Words of Terror', source: 'Whispers 3', desc: 'After 1 minute of conversation, target Wis save or be frightened for 1 hour.' },
      { name: 'Jack of All Trades', source: 'Bard 2', desc: '+1 to ability checks not already proficient.' },
    ],
    traits: {
      Personality: 'Speaks in riddles when nervous; collects buttons from every city she visits.',
      Ideals: 'Truth is the rarest poison.',
      Bonds: 'Owes the Veiled Compass a debt sealed in blood ink.',
      Flaws: 'Cannot resist eavesdropping, even when it endangers the mission.',
    },
    bio: 'Born in the river-port of Vellow, Lyra learned cipher-songs from her grandmother before she could read. She joined the Compass at sixteen — first as a courier, now as something colder. The party knows her as a bard. Three of them suspect more.',
    notes: 'Owes the Crimson Lantern 60gp. Has a contact in Neverwinter named Olivar.',
  },
  {
    id: 2,
    name: 'Throk Ironjaw',
    playerName: 'Ben',
    player: 'Ben',
    party: 'The Veiled Compass',
    race: 'Half-Orc',
    clazz: 'Barbarian',
    subclass: 'Path of the Totem (Bear)',
    level: 7,
    background: 'Outlander',
    alignment: 'Neutral Good',
    portraitInitials: 'TI',
    portraitTint: 'crimson',
    hp: { cur: 78, max: 84, temp: 0 },
    ac: 16, init: 2, speed: 40, prof: 3,
    stats: { STR: 18, DEX: 14, CON: 17, INT: 8, WIS: 12, CHA: 10 },
    saves: ['STR', 'CON'],
    skills: { Athletics: 'expert', Survival: 'prof', Perception: 'prof', Intimidation: 'prof', Nature: 'prof' },
    conditions: ['raging'],
    coins: { cp: 4, sp: 12, ep: 0, gp: 89, pp: 0 },
    spellSlots: {},
    spells: [],
    weapons: [
      { name: "Greataxe 'Splitter'", magic: true, dmg: '1d12+5 slashing', notes: '+1, brutal critical' },
      { name: 'Handaxes (4)', dmg: '1d6+4 slashing', notes: '20/60 ft (thrown)' },
    ],
    gear: [
      { name: 'Hide Armor', equipped: true },
      { name: 'Bear Totem Cloak', magic: true, equipped: true, notes: 'resistance to all damage during rage' },
      { name: "Hunter's Trap (3)" },
      { name: 'Bedroll' },
      { name: 'Trophy Necklace', notes: 'tooth of the Shadow-Bear' },
    ],
    features: [
      { name: 'Rage', source: 'Barbarian 1', desc: 'Bonus action; 4 uses per long rest. +3 dmg, advantage on STR.' },
      { name: 'Bear Aspect', source: 'Totem 3', desc: 'Resistance to all damage except psychic while raging.' },
      { name: 'Reckless Attack', source: 'Barbarian 2', desc: 'Trade defense for advantage on STR attacks.' },
      { name: 'Feral Instinct', source: 'Barbarian 7', desc: "Advantage on initiative. Surprise doesn't stop you from raging." },
    ],
    traits: {
      Personality: 'Speaks rarely. When he does, listen.',
      Ideals: 'The pack survives, or no one does.',
      Bonds: 'Sworn to avenge his clan, slain by the Shadow-Bear cult.',
      Flaws: 'Cannot abide cages of any kind — including cities, contracts, or kindness.',
    },
    bio: 'The last of the Ironjaw clan. Walks south because that is where the cult fled. Travels with the Compass because Lyra found him bleeding outside Phandalin and didn\'t ask questions.',
    notes: '',
  },
  {
    id: 5,
    name: 'Pip Underfoot',
    playerName: 'Eve',
    player: 'Eve',
    party: 'Tomb of the Sleeping Crown',
    race: 'Halfling (Lightfoot)',
    clazz: 'Rogue',
    subclass: 'Arcane Trickster',
    level: 5,
    background: 'Criminal',
    alignment: 'Chaotic Good',
    portraitInitials: 'PU',
    portraitTint: 'emerald',
    hp: { cur: 34, max: 38, temp: 0 },
    ac: 16, init: 5, speed: 25, prof: 3,
    stats: { STR: 8, DEX: 20, CON: 14, INT: 14, WIS: 12, CHA: 13 },
    saves: ['DEX', 'INT'],
    skills: { Stealth: 'expert', Sleight: 'expert', Acrobatics: 'prof', Perception: 'prof', Investigation: 'prof' },
    conditions: [],
    coins: { cp: 0, sp: 0, ep: 0, gp: 412, pp: 6 },
    spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 2, used: 0 } },
    spells: [
      { lvl: 0, name: 'Mage Hand', school: 'Conjuration', time: '1 action', prepared: true },
      { lvl: 0, name: 'Minor Illusion', school: 'Illusion', time: '1 action', prepared: true },
      { lvl: 0, name: 'Prestidigitation', school: 'Transmutation', time: '1 action', prepared: true },
      { lvl: 1, name: 'Charm Person', school: 'Enchantment', time: '1 action', prepared: true },
      { lvl: 1, name: 'Disguise Self', school: 'Illusion', time: '1 action', prepared: true },
      { lvl: 1, name: 'Find Familiar', school: 'Conjuration', time: '1 hour', prepared: true },
      { lvl: 2, name: 'Invisibility', school: 'Illusion', time: '1 action', prepared: true },
    ],
    weapons: [
      { name: "Shortsword 'Whisper'", magic: true, dmg: '1d6+5 piercing', notes: '+1, silent' },
      { name: 'Shortbow', dmg: '1d6+5 piercing', notes: '80/320 ft' },
    ],
    gear: [
      { name: 'Studded Leather', equipped: true },
      { name: 'Cloak of Elvenkind', magic: true, equipped: true },
      { name: "Thieves' Tools" },
      { name: 'Caltrops (10)' },
      { name: 'Lockpicks (silvered)' },
    ],
    features: [
      { name: 'Sneak Attack', source: 'Rogue 1', desc: '+3d6 once per turn with advantage or ally adjacent.' },
      { name: 'Cunning Action', source: 'Rogue 2', desc: 'Bonus action: Dash, Disengage, or Hide.' },
      { name: 'Mage Hand Legerdemain', source: 'Trickster 3', desc: 'Invisible hand can pick pockets and locks.' },
      { name: 'Uncanny Dodge', source: 'Rogue 5', desc: 'Halve damage from an attack you can see.' },
    ],
    traits: {
      Personality: 'Always smiling. Especially when lying.',
      Ideals: 'Property is theft. So I\'m just balancing the books.',
      Bonds: 'The orphans on Brick Lane. They eat first.',
      Flaws: 'Cannot leave a locked door alone.',
    },
    bio: 'Lifted his first purse at six. Lifted his first relic at sixteen. The Sleeping Crown wants its third lifting, and Pip is the only halfling small enough to fit the keyhole.',
    notes: 'Familiar: Ash (raven). Bounty in three cities.',
  },
];

@Injectable({
  providedIn: 'root',
})
export class PCService {
  /** @internal Use pcs$ or service methods; direct mutation breaks reactivity. */
  private pcs: PC[] = environment.demoMode ? [...DEMO_PCS] : [];

  private pcsSubject = new BehaviorSubject<PC[]>(environment.demoMode ? [...DEMO_PCS] : []);
  pcs$ = this.pcsSubject.asObservable();

  private activePCSubject = new BehaviorSubject<PC | null>(null);
  activePC$ = this.activePCSubject.asObservable();

  /** PCs grouped by party name, derived from pcs$ */
  pcsByParty$ = this.pcs$.pipe(
    map(pcs => {
      const groups = new Map<string, PC[]>();
      for (const pc of pcs) {
        const party = pc.party ?? 'Unassigned';
        if (!groups.has(party)) groups.set(party, []);
        groups.get(party)!.push(pc);
      }
      return groups;
    })
  );

  constructor(private http: HttpClient) {}

  readonly pcUrl = 'http://localhost:8080/api/v1/pc/';

  // Pushes a known list into the reactive stream (used by external loaders)
  setPCs(pcs: PC[]) {
    this.pcs = pcs;
    this.pcsSubject.next(pcs);
  }

  // Fetches PCs from the backend and pushes the result into pcs$
  refreshPCs(): void {
    if (environment.demoMode) {
      this.pcsSubject.next(this.pcs);
      return;
    }
    this.http.get<PC[]>(this.pcUrl + 'all').subscribe({
      next: (pcs) => {
        const parsed = pcs.map(pc => this.parseSpells(pc));
        this.pcs = parsed;
        this.pcsSubject.next(parsed);
      },
      error: (err) => console.error('Failed to load PCs', err)
    });
  }

  getPCs() {
    if (environment.demoMode) {
      return of(this.pcs).pipe(delay(300));
    }
    return this.http.get<PC[]>(this.pcUrl + 'all').pipe(
      map(pcs => pcs.map(pc => this.parseSpells(pc)))
    );
  }

  PCById(params: HttpParams) {
    if (environment.demoMode) {
      const idParam = params.get('id');
      if (idParam) {
        const pc = this.pcs.find(p => p.id === parseInt(idParam, 10));
        return of(pc || {} as PC).pipe(delay(300));
      }
      return of({} as PC).pipe(delay(300));
    }
    return this.http.get<PC>(this.pcUrl + 'find/', { params });
  }

  getPCById(id: number) {
    return this.pcs.find((x) => x.id == id);
  }

  setActivePC(pc: PC): void {
    this.activePCSubject.next(pc);
  }

  clearActivePC(): void {
    this.activePCSubject.next(null);
  }

  getActivePC(): Observable<PC | null> {
    return this.activePC$;
  }

  /**
   * Optimistically update a PC in the local store and push to all subscribers.
   * In non-demo mode, also persists to the backend.
   */
  updatePC(pc: PC): Observable<PC> {
    if (environment.demoMode) {
      this.pcs = this.pcs.map(p => p.id === pc.id ? pc : p);
      this.pcsSubject.next(this.pcs);
      // If this PC is currently active, refresh the active stream too
      const active = this.activePCSubject.getValue();
      if (active && active.id === pc.id) {
        this.activePCSubject.next(pc);
      }
      return of(pc).pipe(delay(50));
    }
    // Non-demo: persist to backend, then mirror the same optimistic update locally
    // so activePC$ and pcs$ stay in sync without a full refresh.
    return this.http.put<PC>(this.pcUrl + pc.id, pc).pipe(
      tap(updated => {
        this.pcs = this.pcs.map(p => p.id === updated.id ? updated : p);
        this.pcsSubject.next(this.pcs);
        const active = this.activePCSubject.getValue();
        if (active && active.id === updated.id) {
          this.activePCSubject.next(updated);
        }
      })
    );
  }

  addPC(newPC: PC) {
    if (environment.demoMode) {
      const mockPC: PC = { ...newPC, id: Date.now(), level: newPC.level ?? 1 };
      this.pcs = [...this.pcs, mockPC];
      this.pcsSubject.next(this.pcs);
      return of(mockPC).pipe(delay(300));
    }
    // Map the frontend's nested stats object to individual backend columns.
    // Spells are serialized to a JSON string so the TEXT column accepts them.
    const payload = {
      ...newPC,
      abilityStr: newPC.stats?.STR ?? null,
      abilityDex: newPC.stats?.DEX ?? null,
      abilityCon: newPC.stats?.CON ?? null,
      abilityInt: newPC.stats?.INT ?? null,
      abilityWis: newPC.stats?.WIS ?? null,
      abilityCha: newPC.stats?.CHA ?? null,
      spells: JSON.stringify(newPC.spells ?? []),
    };
    return this.http.post<PC>(this.pcUrl + 'add', payload).pipe(
      map(pc => this.parseSpells(pc))
    );
  }

  /** Deserialize spells TEXT column back to array (backend stores JSON string). */
  private parseSpells(pc: PC): PC {
    if (typeof (pc.spells as unknown) === 'string') {
      try {
        return { ...pc, spells: JSON.parse(pc.spells as unknown as string) };
      } catch {
        return { ...pc, spells: [] };
      }
    }
    return { ...pc, spells: pc.spells ?? [] };
  }

  deletePC(id: number) {
    if (environment.demoMode) {
      this.pcs = this.pcs.filter(p => p.id !== id);
      this.pcsSubject.next(this.pcs);
      return of([] as PC[]).pipe(delay(300));
    }
    return this.http.delete<PC[]>(this.pcUrl + 'delete/' + id);
  }
}
