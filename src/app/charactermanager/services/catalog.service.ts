import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ShopCategory, ShopItem } from '../models/shop';

/**
 * Read-only SRD catalog client. Backs "add from catalog" on the inventory panel
 * (outside any session shop). Real mode hits GET /api/v1/catalog?category=…;
 * demo mode returns a small static slice so the panel still works with no
 * backend, mirroring how ShopService degrades gracefully in demo.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {

  private readonly base = `${environment.characterApiUrl}/api/v1/catalog`;

  constructor(private http: HttpClient) {}

  /** Browse a catalog slice by category (WEAPON|ARMOR|MATERIAL_COMPONENT). */
  list(category: ShopCategory): Observable<ShopItem[]> {
    if (environment.demoMode) return of(DEMO_CATALOG[category] ?? []);
    return this.http.get<ShopItem[]>(this.base, { params: { category } });
  }
}

/** Tiny static catalog so demo mode can still add items. Not the full SRD. */
const DEMO_CATALOG: Record<ShopCategory, ShopItem[]> = {
  WEAPON: [
    { itemKey: 'dagger', name: 'Dagger', category: 'WEAPON', costCp: 200, weight: 1,
      details: { damage: '1d4 piercing', properties: ['finesse', 'light', 'thrown'] }, stock: null },
    { itemKey: 'longsword', name: 'Longsword', category: 'WEAPON', costCp: 1500, weight: 3,
      details: { damage: '1d8 slashing', properties: ['versatile'] }, stock: null },
    { itemKey: 'shortbow', name: 'Shortbow', category: 'WEAPON', costCp: 2500, weight: 2,
      details: { damage: '1d6 piercing', properties: ['ammunition', 'two-handed'] }, stock: null },
  ],
  ARMOR: [
    { itemKey: 'leather-armor', name: 'Leather Armor', category: 'ARMOR', costCp: 1000, weight: 10,
      details: { armorClass: '11 + Dex modifier' }, stock: null },
    { itemKey: 'chain-mail', name: 'Chain Mail', category: 'ARMOR', costCp: 7500, weight: 55,
      details: { armorClass: '16' }, stock: null },
    { itemKey: 'shield', name: 'Shield', category: 'ARMOR', costCp: 1000, weight: 6,
      details: { armorClass: '+2' }, stock: null },
  ],
  MATERIAL_COMPONENT: [
    { itemKey: 'component-pouch', name: 'Component Pouch', category: 'MATERIAL_COMPONENT', costCp: 2500,
      weight: 2, details: {}, stock: null },
    { itemKey: 'diamond-300gp', name: 'Diamond (300 gp)', category: 'MATERIAL_COMPONENT', costCp: 30000,
      weight: 0, details: { consumedOnCast: true, spell: 'Revivify' }, stock: null },
  ],
};
