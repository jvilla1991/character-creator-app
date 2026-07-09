/**
 * A single entry in a character's read-only activity log — a pre-rendered
 * display string recorded server-side at a notable mutation (level-up, shop
 * purchase/sale, loot claim, DM XP award, long rest, DM edit). Client mirror
 * of the backend PcActivityLog entity.
 */
export interface PcActivityLogEntry {
  id: number | string;
  pcId: number;
  actionType: string;      // 'LEVEL_UP' | 'PURCHASE' | 'SALE' | 'LOOT' | 'XP_AWARD' | 'LONG_REST' | 'DM_EDIT'
  description: string;
  actorUserId?: string;
  createdAt: string;       // ISO-8601
}
