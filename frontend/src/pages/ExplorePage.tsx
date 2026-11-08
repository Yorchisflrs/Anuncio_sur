import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, ChevronDown, ArrowRight, ChevronLeft, ChevronRight, MapPin, LayoutGrid, List } from 'lucide-react';
import type { CatalogResult, Category } from '../types';
import { ZONES } from '../types';
import { useResource } from '../hooks/useResource';
import { ListingRow, ProductCard } from '../components/ProductCard';
import { CardSkeletons, EmptyState, ErrorState } from '../components/States';
import { CATEGORY_ICONS } from '../data/directory';

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState({ q: '', categoriaId: '', subcategoria: '', zona: '', min: '', max: '' });
  const [rangeError, setRangeError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  // La lista es la vista inicial: permite comparar precios de un vistazo.
  const [view, setView] = useState<'lista' | 'tarjetas'>('lista');
  const catalog = useResource<CatalogResult>('/anuncios?' + params.toString());
  const categories = useResource<Category[]>('/categorias');
  useEffect(() => {
    setDraft({ q: params.get('q') || '', categoriaId: params.get('categoriaId') || '', subcategoria: params.get('subcategoria') || '', zona: params.get('zona') || '', min: params.get('min') || '', max: params.get('max') || '' });
    setRangeError('');
  }, [params]);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setShowFilters(false); }; if (showFilters) window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [showFilters]);
  const selectedCategory = categories.data?.find(category => String(category.id) === draft.categoriaId);
  function apply(event?: FormEvent) {
    event?.preventDefault();
    if ((draft.min !== '' && Number(draft.min) < 0) || (draft.max !== '' && Number(draft.max) < 0) || (draft.min !== '' && draft.max !== '' && Number(draft.min) > Number(draft.max))) {
      setRangeError('Revisa el rango: el máximo debe ser mayor o igual al mínimo.'); return;
    }
    const next = new URLSearchParams();
    Object.entries(draft).forEach(([key, value]) => { if (value.trim()) next.set(key, value.trim()); });
    if (params.get('sort')) next.set('sort', params.get('sort')!);
    setParams(next); setShowFilters(false); setRangeError('');
  }
  function removeFilter(key: string) {
    const next = new URLSearchParams(params); next.delete(key); next.delete('page');
    if (key === 'categoriaId') next.delete('subcategoria');
    setParams(next);
  }
  function selectCategory(id: string) {
    const next = new URLSearchParams(params);
    if (id) next.set('categoriaId', id); else next.delete('categoriaId');
    next.delete('subcategoria'); next.delete('page'); setParams(next);
  }
  const activeFilters = Array.from(params.entries()).filter(([key]) => !['page', 'limit', 'sort'].includes(key));
  const categoryLabel = (value: string) => categories.data?.find(category => String(category.id) === value)?.nombre || value;
  const filterLabel = (key: string, value: string) => key === 'categoriaId' ? categoryLabel(value) : key === 'min' ? 'Desde S/ ' + value : key === 'max' ? 'Hasta S/ ' + value : key === 'zona' && value.startsWith('Otras') ? 'Sur del Perú' : value;
  function page(value: number) {
    const next = new URLSearchParams(params); next.set('page', String(value)); setParams(next);
    window.scrollTo({ top: 140, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  return <><div className="container page-section explore-page">
    <div className="breadcrumb"><Link to="/">Inicio</Link><ChevronRight size={12}/><span>Explorar anuncios</span></div>
    <div className="explore-intro"><div><h1>Avisos en Puno, <span>Juliaca y el sur.</span></h1><p>Filtra por categoría, zona y precio para comparar.</p></div>
      <form className="catalog-search" onSubmit={apply}><Search size={20}/><input type="search" aria-label="Buscar anuncios por texto" placeholder="¿Qué estás buscando?" value={draft.q} onChange={event => setDraft({ ...draft, q: event.target.value })} maxLength={100}/><button className="button button-primary">Buscar <ArrowRight size={16}/></button></form>
    </div>
    <div className="explore-categories" aria-label="Filtrar por categoría"><button type="button" aria-pressed={!params.get('categoriaId')} onClick={() => selectCategory('')}><LayoutGrid size={16}/>Todo el catálogo</button>{categories.data?.map(category => {
      const Icon = CATEGORY_ICONS[category.id] || LayoutGrid;
      return <button key={category.id} type="button" aria-pressed={params.get('categoriaId') === String(category.id)} onClick={() => selectCategory(String(category.id))}><Icon size={17}/>{category.nombre}<span>{category.total}</span></button>;
    })}<span className="explore-region"><MapPin size={14}/>Puno y el sur</span></div>
    <div className="catalog-layout">
      <aside id="catalog-filters" className={'filters-panel' + (showFilters ? ' filters-open' : '')}>
        <form onSubmit={apply}>
          <div className="filters-title"><h2><SlidersHorizontal size={17}/>A tu medida</h2><button type="button" className="text-link" onClick={() => { setParams({}); setShowFilters(false); }}>Limpiar</button><button type="button" className="icon-button filter-close" aria-label="Cerrar filtros" onClick={() => setShowFilters(false)}><X size={17}/></button></div>
          <label className="form-field">Categoría<select value={draft.categoriaId} onChange={event => setDraft({ ...draft, categoriaId: event.target.value, subcategoria: '' })}><option value="">Todas las categorías</option>{categories.data?.map(category => <option key={category.id} value={category.id}>{category.nombre}</option>)}</select></label>
          {categories.error && <p className="field-error">{categories.error}</p>}
          <label className="form-field">Subcategoría<select value={draft.subcategoria} disabled={!selectedCategory} onChange={event => setDraft({ ...draft, subcategoria: event.target.value })}><option value="">Todas las subcategorías</option>{selectedCategory?.subcategorias.map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="form-field">Ubicación<select value={draft.zona} onChange={event => setDraft({ ...draft, zona: event.target.value })}><option value="">Todo el sur del Perú</option>{ZONES.map(zone => <option key={zone}>{zone}</option>)}</select></label>
          <div className="filter-divider"/><span className="field-label">Tu presupuesto</span>
          <div className="price-fields"><label><span>Desde S/</span><input type="number" min="0" max="99999999.99" step="0.01" aria-label="Precio mínimo" placeholder="0" value={draft.min} onChange={event => setDraft({ ...draft, min: event.target.value })}/></label><label><span>Hasta S/</span><input type="number" min="0" max="99999999.99" step="0.01" aria-label="Precio máximo" placeholder="Sin límite" value={draft.max} onChange={event => setDraft({ ...draft, max: event.target.value })}/></label></div>
          {rangeError && <p className="field-error" role="alert">{rangeError}</p>}
          <button className="button button-primary full-width filter-apply" type="submit">Aplicar filtros <ArrowRight size={16}/></button>
        </form>
        <div className="filter-tip"><MapPin size={21}/><strong>Filtra por tu ciudad.</strong><p>Así ves primero los avisos que puedes revisar en persona.</p></div>
      </aside>
      <div className="catalog-results">
        <div className="results-bar"><span aria-live="polite">{catalog.loading ? 'Buscando avisos…' : catalog.data ? <><strong>{catalog.data.total}</strong> {catalog.data.total === 1 ? 'aviso encontrado' : 'avisos encontrados'}</> : 'Catálogo'}</span><div>
          <div className="catalog-view-switch" role="group" aria-label="Forma de ver los avisos"><button type="button" aria-pressed={view === 'lista'} onClick={() => setView('lista')}><List size={17}/>Lista</button><button type="button" aria-pressed={view === 'tarjetas'} onClick={() => setView('tarjetas')}><LayoutGrid size={16}/>Tarjetas</button></div>
          <button type="button" className="filter-toggle" onClick={() => setShowFilters(value => !value)} aria-expanded={showFilters} aria-controls="catalog-filters"><SlidersHorizontal size={16}/>Filtros<ChevronDown size={14}/></button>
          <label><span>Ordenar</span><select aria-label="Ordenar anuncios" value={params.get('sort') || 'recent'} onChange={event => { const next = new URLSearchParams(params); next.set('sort', event.target.value); next.delete('page'); setParams(next); }}><option value="recent">Más recientes</option><option value="price_asc">Menor precio</option><option value="price_desc">Mayor precio</option></select></label>
        </div></div>
        {activeFilters.length > 0 && <div className="filter-chips">{activeFilters.map(([key, value]) => <button type="button" key={key} onClick={() => removeFilter(key)} aria-label={'Quitar filtro ' + filterLabel(key, value)}>{filterLabel(key, value)}<X size={12}/></button>)}<button type="button" className="clear-chip" onClick={() => setParams({})}>Limpiar todo</button></div>}
        {catalog.loading ? <CardSkeletons count={6}/> : catalog.error ? <ErrorState message={catalog.error} retry={catalog.reload}/> : catalog.data?.anuncios.length ? <>
          {view === 'lista' ? <ul className="listing-rows" aria-label="Avisos encontrados">{catalog.data.anuncios.map(listing => <li key={listing.id}><ListingRow listing={listing}/></li>)}</ul> : <div className="product-grid catalog-cards">{catalog.data.anuncios.map(listing => <ProductCard key={listing.id} listing={listing}/>)}</div>}
          {catalog.data.totalPages > 1 && <div className="pagination"><button className="button button-outline" disabled={catalog.data.page === 1} onClick={() => page(catalog.data!.page - 1)}><ChevronLeft size={16}/>Anterior</button><span>Página {catalog.data.page} de {catalog.data.totalPages}</span><button className="button button-outline" disabled={catalog.data.page >= catalog.data.totalPages} onClick={() => page(catalog.data!.page + 1)}>Siguiente<ChevronRight size={16}/></button></div>}
        </> : <EmptyState title="No hay avisos con estos filtros" action={<button className="button button-primary" onClick={() => setParams({})}>Ver todos los avisos</button>}>Prueba con otra categoría, amplía el precio o cambia de localidad.</EmptyState>}
      </div>
    </div>
  </div></>;
}
