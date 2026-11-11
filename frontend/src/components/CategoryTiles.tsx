import { Link } from 'react-router-dom';
import { ArrowUpRight, LayoutGrid } from 'lucide-react';
import type { Category } from '../types';
import { CATEGORY_FALLBACK, CATEGORY_ICONS } from '../data/directory';

const DESCRIPTIONS: Record<number, string> = { 1: 'Motos, autos y mototaxis.', 2: 'Cuartos, departamentos, casas, terrenos y locales.', 3: 'Refrigeradoras, lavadoras, televisores y cocinas.' };

export function CategoryTiles({ categories, loading }: { categories: Category[] | null; loading: boolean }) {
  return <div className="directory-grid">{(categories || CATEGORY_FALLBACK).map(category => {
    const Icon = CATEGORY_ICONS[category.id] || LayoutGrid;
    return <Link key={category.id} to={'/anuncios?categoriaId=' + category.id} className="directory-tile" data-category={category.id}>
      <span className="directory-top"><span className="directory-icon"><Icon size={26}/></span><span className="directory-count">{loading || !categories ? '—' : category.total} anuncios<ArrowUpRight size={17}/></span></span>
      <strong>{category.nombre}</strong><p>{DESCRIPTIONS[category.id] || 'Descubre las publicaciones de tu comunidad.'}</p>
      <span className="directory-detail">Explorar categoría <ArrowUpRight size={16}/></span>
    </Link>;
  })}</div>;
}
