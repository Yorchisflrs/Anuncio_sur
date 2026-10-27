import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, MapPin, Plus, Search, MessageCircle, Check, Handshake, Lightbulb, Megaphone, MoveUpRight } from 'lucide-react';
import type { CatalogResult, Category } from '../types';
import { ZONES } from '../types';
import { useResource } from '../hooks/useResource';
import { SearchBar } from '../components/SearchBar';
import { HeroShowcase } from '../components/HeroShowcase';
import { ProductCard } from '../components/ProductCard';
import { CategoryTiles } from '../components/CategoryTiles';
import { CardSkeletons, EmptyState, ErrorState } from '../components/States';
import { COVERAGE, PRICE_RANGES, QUICK_SEARCHES } from '../data/directory';

const BENEFITS = [
  { icon: Megaphone, title: 'Tu anuncio, tu oportunidad', text: 'Publica con fotos, precio y ubicación. Sin costo de publicación.', to: '/publicar' },
  { icon: Handshake, title: 'La conversación es directa', text: 'Habla por WhatsApp con quien publica. Tú coordinas el trato.', to: '/ayuda/terminos' },
  { icon: Lightbulb, title: 'Compra con información', text: 'Revisa el producto y conoce al vendedor antes de pagar.', to: '/ayuda/seguridad' }
];

export function HomePage() {
  const [filters, setFilters] = useState({ categoriaId: '', zona: '', precio: '', sort: 'recent' });
  const query = new URLSearchParams();
  if (filters.categoriaId) query.set('categoriaId', filters.categoriaId);
  if (filters.zona) query.set('zona', filters.zona);
  const [min, max] = filters.precio.split('-');
  if (min) query.set('min', min);
  if (max) query.set('max', max);
  if (filters.sort !== 'recent') query.set('sort', filters.sort);
  const catalog = useResource<CatalogResult>('/anuncios?limit=8&' + query);
  const showcase = useResource<CatalogResult>('/anuncios?limit=24');
  const categories = useResource<Category[]>('/categorias');
  const hasFilters = filters.categoriaId || filters.zona || filters.precio;

  return <div className="home-page">
    <section className="hero">
      <div className="container hero-inner">
      <div className="hero-content">
        <span className="eyebrow"><span className="live-dot"/>EL SUR TIENE MUCHO POR DESCUBRIR</span>
        <h1>Tu próxima<br/>oportunidad está<br/><span>más cerca</span><span className="heading-dot">.</span></h1>
        <p>Eso que buscas. Eso que ya no usas.<br/>Un lugar para encontrarse en Puno y el sur del Perú.</p>
        <SearchBar/>
        <div className="quick-searches"><span>Prueba con</span>{QUICK_SEARCHES.slice(0, 3).map(item => <Link key={item.label} to={item.to}>{item.label}<ArrowUpRight size={12}/></Link>)}</div>
        <div className="hero-links"><Link className="button button-primary" to="/anuncios">Explorar anuncios <ArrowRight size={18}/></Link><Link className="hero-publish" to="/publicar"><Plus size={18}/>Quiero publicar</Link></div>
        <div className="hero-note"><span><Check size={15}/>Publicar es gratis</span><span><MessageCircle size={15}/>Contacto directo</span></div>
      </div>
      <HeroShowcase listings={showcase.data?.anuncios || []} total={showcase.data?.total ?? null}/>
    </div></section>
    <div className="demo-strip"><div className="container"><span className="demo-dot"/>Prototipo académico de AvisoSur. Las publicaciones marcadas DEMO son ejemplos ficticios.</div></div>

    <section className="container categories-section"><div className="section-heading"><div><span className="section-kicker">CADA BÚSQUEDA TIENE UN COMIENZO</span><h2>Encuentra lo que va contigo.</h2></div><Link className="text-link" to="/categorias">Todas las categorías <ArrowUpRight size={18}/></Link></div><CategoryTiles categories={categories.data} loading={categories.loading}/></section>

    <section className="container recent-section">
      <div className="section-heading"><div><span className="section-kicker">RECIÉN LLEGADOS AL BARRIO</span><h2>Oportunidades para descubrir.</h2><p>Los anuncios más recientes de tu comunidad.</p></div><Link className="text-link" to="/anuncios">Explorar todo <ArrowUpRight size={18}/></Link></div>
      <div className="recent-toolbar"><span className="toolbar-label">Hazlo más tuyo</span><div className="quick-filters" role="group" aria-label="Filtrar anuncios recientes">
        <label><span>Categoría</span><select value={filters.categoriaId} onChange={event => setFilters({ ...filters, categoriaId: event.target.value })}><option value="">Todas las categorías</option>{categories.data?.map(category => <option key={category.id} value={category.id}>{category.nombre}</option>)}</select></label>
        <label><span>Zona</span><select value={filters.zona} onChange={event => setFilters({ ...filters, zona: event.target.value })}><option value="">Todas las zonas</option>{ZONES.map(zone => <option key={zone} value={zone}>{zone.startsWith('Otras') ? 'Otras localidades' : zone}</option>)}</select></label>
        <label><span>Precio</span><select value={filters.precio} onChange={event => setFilters({ ...filters, precio: event.target.value })}>{PRICE_RANGES.map(range => <option key={range.value} value={range.value}>{range.label}</option>)}</select></label>
        <label><span>Orden</span><select value={filters.sort} onChange={event => setFilters({ ...filters, sort: event.target.value })}><option value="recent">Más recientes</option><option value="price_asc">Menor precio</option><option value="price_desc">Mayor precio</option></select></label>
      </div></div>
      {catalog.loading && !catalog.data ? <CardSkeletons count={8}/> : catalog.error ? <ErrorState message={catalog.error} retry={catalog.reload}/> : catalog.data?.anuncios.length ? <div className={'product-grid' + (catalog.loading ? ' is-refreshing' : '')}>{catalog.data.anuncios.map(listing => <ProductCard key={listing.id} listing={listing}/>)}</div> : <EmptyState title="No hay anuncios con esos filtros" action={<button className="button button-primary" onClick={() => setFilters({ categoriaId: '', zona: '', precio: '', sort: 'recent' })}>Limpiar filtros</button>}>Prueba con otra categoría, zona o rango de precio.</EmptyState>}
      {catalog.data && catalog.data.total > 0 && <div className="recent-footer"><span><strong>{catalog.data.anuncios.length}</strong> de <strong>{catalog.data.total}</strong> anuncios{hasFilters ? ' con estos filtros' : ' activos'}</span><Link className="text-link" to={'/anuncios?' + query}>Hay más por descubrir <ArrowRight size={17}/></Link></div>}
    </section>

    <section className="benefits-section"><div className="container"><div className="section-heading"><div><span className="section-kicker">COMERCIO LOCAL, A TU MANERA</span><h2>Conexiones simples.<br/>Nuevas posibilidades.</h2></div><p className="section-aside">Un espacio para encontrar, conversar<br/>y darle una nueva historia a lo que tienes.</p></div><div className="trust-grid">{BENEFITS.map(({ icon: Icon, title, text, to }, i) => <Link key={title} to={to} className="trust-card"><div className="benefit-top"><span><Icon size={24}/></span><small>0{i + 1}</small></div><h3>{title}</h3><p>{text}</p><ArrowUpRight className="benefit-arrow" size={19}/></Link>)}</div></div></section>

    <section className="container coverage-section"><div className="coverage-copy"><span className="section-kicker">NUESTRO PUNTO DE ENCUENTRO</span><h2>De aquí.<br/><span>Para el sur.</span></h2><p>Explora por localidad y encuentra anuncios en tu ciudad. Porque algunas de las mejores oportunidades están a unas calles de ti.</p><Link className="text-link" to="/anuncios">Conocer el catálogo <ArrowUpRight size={18}/></Link></div><div className="coverage-directory"><div className="coverage-directory-head"><span><MapPin size={17}/>DIRECTORIO REGIONAL</span><span>Perú / Puno</span></div><ul className="coverage-list">{COVERAGE.map((item, index) => <ZoneRow key={item.zona} zona={item.zona} label={item.label} index={index}/>)}</ul><p className="coverage-footnote">Elige una localidad para ver sus anuncios disponibles.</p></div></section>

    <section className="how-section"><div className="container"><div className="section-heading centered"><span className="section-kicker">ASÍ DE SIMPLE</span><h2>Del hallazgo al encuentro.</h2></div><div className="steps-grid"><div><span className="step-icon"><Search size={25}/><small>01</small></span><h3>Descubre</h3><p>Busca y filtra hasta encontrar lo que va contigo.</p></div><div><span className="step-icon"><MessageCircle size={25}/><small>02</small></span><h3>Conversa</h3><p>Resuelve tus dudas directamente por WhatsApp.</p></div><div><span className="step-icon"><Handshake size={25}/><small>03</small></span><h3>Coordina</h3><p>Revisa el producto y acuerda la entrega con el vendedor.</p></div></div></div></section>

    <section className="container cta-section"><div><span className="cta-badge"><Plus size={14}/>TU SIGUIENTE PASO</span><h2>Alguien está buscando<br/>eso que tú tienes.</h2><p>Dale una nueva oportunidad. Tu próximo anuncio empieza aquí.</p></div><Link className="button button-white" to="/publicar">Publicar gratis <MoveUpRight size={20}/></Link></section>
  </div>;
}

function ZoneRow({ zona, label, index }: { zona: string; label: string; index: number }) {
  const result = useResource<CatalogResult>('/anuncios?limit=1&zona=' + encodeURIComponent(zona));
  return <li><Link to={'/anuncios?zona=' + encodeURIComponent(zona)}><span className="zone-index">0{index + 1}</span><span className="zone-name"><strong>{zona.startsWith('Otras') ? 'Más al sur' : zona}</strong><small>{label}</small></span><span className="zone-total">{result.data ? result.data.total + (result.data.total === 1 ? ' anuncio' : ' anuncios') : '—'}<ArrowUpRight size={18}/></span></Link></li>;
}
