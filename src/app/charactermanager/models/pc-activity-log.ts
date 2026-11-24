/**
 * A single entry in a character's read-only activity log — a pre-rendered
 * display string recorded server-side at a notable mutation (level-up, shop
 * purchase/sale, loot claim, DM XP award, a rest, a spell slot spent or
 * restored by hand, DM edit). Client mirror
 * of the backend PcActivityLog entity.
 */
export interface PcActivityLogEntry {
  id: number | string;
  pcId: number;
  // 'LEVEL_UP' | 'PURCHASE' | 'SALE' | 'LOOT' | 'XP_AWARD' | 'LONG_REST' | 'SHORT_REST'
  // | 'INSPIRATION' | 'DM_EDIT' | 'SPELL_SLOT' (a slot spent or restored by hand)
  // | 'FOLLOWER' (the player summoned or dismissed a summon or a familiar of their own)
  actionType: string;
  description: string;
  actorUserId?: string;
  createdAt: string;       // ISO-8601
}
