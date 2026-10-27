import { Link } from 'react-router-dom';
import { ChevronRight, ArrowUpRight, LayoutGrid, Clock3, ArrowRight } from 'lucide-react';
import type { Category } from '../types';
import { useResource } from '../hooks/useResource';
import { ErrorState, Loading } from '../components/States';
import { CATEGORY_ICONS, UPCOMING_CATEGORIES } from '../data/directory';

const DESCRIPTIONS: Record<number, string> = {
  1: 'De la ciudad a tu próxima aventura. Encuentra vehículos para seguir tu camino.',
  2: 'Un nuevo hogar, un proyecto o ese espacio que estabas imaginando.',
  3: 'Haz más fácil tu día a día. Equipos y oportunidades para tu hogar.',
};

export function CategoriesPage() {
  const categories = useResource<Category[]>('/categorias');
  const total = categories.data?.reduce((sum, category) => sum + category.total, 0);
  return <div className="container page-section categories-page">
    <div className="breadcrumb"><Link to="/">Inicio</Link><ChevronRight size={12}/><span>Categorías</span></div>
    <div className="directory-hero"><div><span className="section-kicker">UN MUNDO DE POSIBILIDADES LOCALES</span><h1>¿Por dónde<br/><span>quieres empezar?</span></h1><p>Cada categoría, una puerta a tu próximo hallazgo.</p></div><div className="directory-summary"><LayoutGrid size={30}/><strong>{total ?? '—'}</strong><span>anuncios activos</span><Link to="/anuncios">Ver todo el catálogo <ArrowUpRight size={17}/></Link></div></div>
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
    <section className="upcoming-section"><div className="section-heading"><div><span className="section-kicker">EL SUR TIENE MÁS POR OFRECER</span><h2>Lo próximo por descubrir.</h2><p>Estas categorías aún están en preparación.</p></div><span className="upcoming-label"><Clock3 size={15}/>Próximamente</span></div><div className="upcoming-grid">{UPCOMING_CATEGORIES.map(({ nombre, icon: Icon, detalle }) => <article key={nombre} className="upcoming-card"><span className="directory-icon"><Icon size={24}/></span><h3>{nombre}</h3><p>{detalle}</p><span className="upcoming-badge">Todavía no disponible</span></article>)}</div></section>
  </div>;
}
