import { Component, Input } from '@angular/core';
import { ParticipantView, SessionStatus } from '../../../models/session';
import { SessionService, TURN_SOUNDS } from '../../../services/session.service';
import { NotificationService } from '../../../services/notification.service';
import { tintFor } from '../../../utils/character-math';

/**
 * Initiative order — one row per combatant in server-computed turn order, with
 * an Init column, HP bar, AC and conditions. Reuses the Party Vitals Board
 * markup/classes (party-board.component).
 *
 * Turn indication renders the snapshot's per-viewer glow targets verbatim:
 * green on `activeParticipantId`, yellow on `onDeckParticipantId`. Hidden
 * enemies never reach a player's `participants` at all, so no filtering happens
 * here.
 *
 * Initiative entry: the DM edits anyone anytime; a player edits their own row
 * freely in the lobby, and once the encounter is active only while theirs is
 * still unset (late joiner). The DM also gets an encounter bar: add enemy
 * (name + DM-calculated DEX mod + optional HP), the enemy-visibility checkbox,
 * and the turn-sound picker. Everyone gets a local mute toggle.
 */
@Component({
  selector: 'app-initiative-panel',
  templateUrl: './initiative-panel.component.html',
  styleUrls: ['./initiative-panel.component.scss'],
})
export class InitiativePanelComponent {
  @Input() participants: ParticipantView[] = [];
  @Input() sessionId!: number | string;
  @Input() dm = false;
  @Input() status: SessionStatus = 'LOBBY';
  @Input() activeParticipantId: number | null = null;
  @Input() onDeckParticipantId: number | null = null;
  @Input() enemiesHidden = true;
  @Input() turnSound: string | null = null;

  /** Per-row amount typed into the DM's damage/heal box, keyed by participant id. */
  amounts: { [participantId: number]: number | null } = {};

  /** Per-row XP amount typed into the DM's award box, keyed by participant id. */
  xpAmounts: { [participantId: number]: number | null } = {};

  /** Amount typed into the panel-level "award XP to all" box. */
  xpAll: number | null = null;

  // Add-enemy form (DM encounter bar).
  enemyName = '';
  enemyDexMod: number | null = null;
  enemyHp: number | null = null;
  addingEnemy = false;

  soundOptions = TURN_SOUNDS;

  /** Local (per-device) turn-cue mute — mirrored from localStorage. */
  muted = false;

  constructor(
    private sessionService: SessionService,
    private notifications: NotificationService,
  ) {
    this.muted = this.sessionService.isMuted();
  }

  /**
   * Whether the viewer may type into this row's Init cell. DM: always (until
   * the session ends). Player: own row only — freely in the lobby, and while
   * active only to enter a still-missing value, mirroring the server rule.
   */
  canEditInitiative(p: ParticipantView): boolean {
    if (this.status === 'ENDED') return false;
    if (this.dm) return true;
    if (!p.ownedByMe) return false;
    return this.status === 'LOBBY' || !p.initRolled;
  }

  isActive(p: ParticipantView): boolean {
    return p.participantId === this.activeParticipantId;
  }

  isOnDeck(p: ParticipantView): boolean {
    return p.participantId === this.onDeckParticipantId;
  }

  /** DM adds an enemy; it parks at the bottom until it gets an initiative. */
  addEnemy(): void {
    const name = this.enemyName.trim();
    if (!name || this.enemyDexMod == null || this.addingEnemy) return;
    this.addingEnemy = true;
    this.sessionService.addEnemy(this.sessionId, name, this.enemyDexMod, this.enemyHp).subscribe({
      next: () => {
        this.enemyName = '';
        this.enemyDexMod = null;
        this.enemyHp = null;
        this.addingEnemy = false;
      },
      error: err => {
        console.error('Failed to add enemy', err);
        this.addingEnemy = false;
      },
    });
  }

  /** The checkbox says "players can SEE enemies" — the inverse of the flag. */
  onVisibilityChange(playersSeeEnemies: boolean): void {
    this.sessionService.setVisibility(this.sessionId, !playersSeeEnemies).subscribe({
      error: err => console.error('Failed to set enemy visibility', err),
    });
  }

  /** DM picks the encounter cue; preview it immediately so they hear the choice. */
  onSoundChange(key: string): void {
    const sound = key || null;
    this.sessionService.setSound(this.sessionId, sound).subscribe({
      error: err => console.error('Failed to set turn sound', err),
    });
    if (sound) this.sessionService.playCue(sound);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.sessionService.setMuted(this.muted);
  }

  // 5 columns read-only; a 6th DM "Adjust" column appears for the DM.
  get columns(): string {
    const base = '44px minmax(140px, 1.6fr) 150px 56px minmax(110px, 1.2fr)';
    return this.dm ? `${base} 184px` : base;
  }

  onInitiative(p: ParticipantView, raw: string): void {
    const value = parseInt(raw, 10);
    if (isNaN(value)) return;
    this.sessionService.setInitiative(this.sessionId, p.participantId, value).subscribe({
      error: err => console.error('Failed to set initiative', err),
    });
  }

  /** Apply the row's typed amount as damage (sign +1) or healing (sign -1). */
  adjustHp(p: ParticipantView, sign: 1 | -1): void {
    const amt = this.amounts[p.participantId];
    if (amt == null || amt <= 0) return;
    this.sessionService.applyDamage(this.sessionId, p.participantId, sign * amt).subscribe({
      next: () => (this.amounts[p.participantId] = null),
      error: err => console.error('Failed to adjust HP', err),
    });
  }

  /** Award the row's typed XP to that PC, then toast the new total. */
  giveXp(p: ParticipantView): void {
    const amt = this.xpAmounts[p.participantId];
    if (amt == null || amt === 0) return;
    this.sessionService.awardXp(this.sessionId, p.participantId, amt).subscribe({
      next: result => {
        this.xpAmounts[p.participantId] = null;
        const e = result.awarded[0];
        if (e) this.notifications.notify(`${e.name}: ${e.xp} XP (${this.signed(e.delta)})`);
      },
      error: err => console.error('Failed to award XP', err),
    });
  }

  /** Award the same XP amount to every seated PC, then toast the count. */
  giveXpToAll(): void {
    const amt = this.xpAll;
    if (amt == null || amt === 0) return;
    this.sessionService.awardXpToAll(this.sessionId, amt).subscribe({
      next: result => {
        this.xpAll = null;
        const n = result.awarded.length;
        this.notifications.notify(`Awarded ${this.signed(amt)} XP to ${n} character${n === 1 ? '' : 's'}`);
      },
      error: err => console.error('Failed to award XP to all', err),
    });
  }

  /** Format a delta with an explicit sign for the toast (e.g. +500, -100). */
  private signed(n: number): string {
    return n >= 0 ? `+${n}` : `${n}`;
  }

  tintFor(p: ParticipantView): string {
    return tintFor({ portraitTint: p.portraitTint } as any);
  }

  initialsFor(p: ParticipantView): string {
    return (p.portraitInitials || p.name.slice(0, 2)).toUpperCase();
  }

  hpPct(p: ParticipantView): number {
    const max = p.hpMax ?? 0;
    const cur = p.hpCurrent ?? 0;
    return max <= 0 ? 0 : Math.max(0, Math.min(100, (cur / max) * 100));
  }

  bloodied(p: ParticipantView): boolean {
    const max = p.hpMax ?? 0;
    const cur = p.hpCurrent ?? 0;
    return max > 0 && cur <= max / 2;
  }

  trackByParticipant(_: number, p: ParticipantView): number {
    return p.participantId;
  }
}
