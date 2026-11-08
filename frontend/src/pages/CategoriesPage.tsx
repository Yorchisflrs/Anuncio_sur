import { Link } from 'react-router-dom';
import { ChevronRight, ArrowUpRight, LayoutGrid, ArrowRight } from 'lucide-react';
import type { Category } from '../types';
import { useResource } from '../hooks/useResource';
import { ErrorState, Loading } from '../components/States';
import { CATEGORY_ICONS } from '../data/directory';

const DESCRIPTIONS: Record<number, string> = {
  1: 'Motos, autos y mototaxis en venta en Puno, Juliaca y el sur.',
  2: 'Habitaciones y departamentos en alquiler, casas, terrenos y locales comerciales.',
  3: 'Refrigeradoras, lavadoras, televisores, cocinas y otros equipos para el hogar.',
};

export function CategoriesPage() {
  const categories = useResource<Category[]>('/categorias');
  const total = categories.data?.reduce((sum, category) => sum + category.total, 0);
  return <div className="container page-section categories-page">
    <div className="breadcrumb"><Link to="/">Inicio</Link><ChevronRight size={12}/><span>Categorías</span></div>
    <div className="directory-hero"><div><span className="section-kicker">CATEGORÍAS</span><h1>Vehículos, inmuebles<br/><span>y electrodomésticos.</span></h1><p>Elige una categoría o subcategoría para ver sus avisos con precio, zona y fotos.</p></div><div className="directory-summary"><LayoutGrid size={30}/><strong>{total ?? '—'}</strong><span>anuncios activos</span><Link to="/anuncios">Ver todo el catálogo <ArrowUpRight size={17}/></Link></div></div>
    {categories.loading ? <Loading label="Cargando categorías…"/> : categories.error ? <ErrorState message={categories.error} retry={categories.reload}/> : <div className="category-directory">{categories.data?.map((category, index) => {
      const Icon = CATEGORY_ICONS[category.id] || LayoutGrid;
      return <article key={category.id} className="category-panel" data-category={category.id}>
        <Link to={'/anuncios?categoriaId=' + category.id} className="category-panel-cover"><span className="category-panel-number">0{index + 1}</span><Icon className="category-cover-icon" size={100}/><span className="category-cover-link"><ArrowUpRight size={24}/></span></Link>
        <div className="category-panel-content"><div className="category-panel-head"><div><span className="category-panel-count">{category.total} anuncios disponibles</span><h2>{category.nombre}</h2></div></div><p>{DESCRIPTIONS[category.id]}</p>
          <div className="subcategory-list">{category.subcategorias.map(sub => <Link key={sub} to={'/anuncios?categoriaId=' + category.id + '&subcategoria=' + encodeURIComponent(sub)}>{sub}<ChevronRight size={13}/></Link>)}</div>
          <Link className="text-link" to={'/anuncios?categoriaId=' + category.id}>Explorar {category.nombre.toLowerCase()} <ArrowRight size={17}/></Link>
        </div>
      </article>;
    })}</div>}
  </div>;
}
