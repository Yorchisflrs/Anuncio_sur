import type { Listing } from '../types';

/** Only changes the display order; every original listing remains reachable. */
export function balancedListings(listings: Listing[]): Listing[] {
  const byCategory = new Map<number, Listing[]>();
  for (const listing of listings) {
    const category = byCategory.get(listing.categoriaId) ?? [];
    category.push(listing);
    byCategory.set(listing.categoriaId, category);
  }
  const categories = [...byCategory.values()];
  // Prefer descriptive catalogue entries to connection/test posts for the cover.
  // Stable sorting preserves the server's order among entries of the same kind.
  const score = (item: Listing) => (/prueba|prototipo|práctica|demostrativ/i.test(item.titulo) ? -2 : 0) + (item.imagen.startsWith('/uploads/') ? 1 : 0);
  for (const category of categories) category.sort((a, b) => score(b) - score(a));
  const ordered: Listing[] = [];
  for (let row = 0; ordered.length < listings.length; row++) {
    for (const category of categories) if (category[row]) ordered.push(category[row]);
  }
  return ordered;
}
