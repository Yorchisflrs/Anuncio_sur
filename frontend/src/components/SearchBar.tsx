import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, LayoutGrid } from 'lucide-react';
import type { Category } from '../types';
import { ZONES } from '../types';
import { useResource } from '../hooks/useResource';

export function SearchBar() {
  const [q, setQ] = useState(''); const [zona, setZona] = useState(''); const [categoriaId, setCategoriaId] = useState(''); const navigate = useNavigate();
  const categories = useResource<Category[]>('/categorias');
  return <form className="hero-search" onSubmit={event => { event.preventDefault(); const params = new URLSearchParams(); if (q.trim()) params.set('q', q.trim()); if (categoriaId) params.set('categoriaId', categoriaId); if (zona) params.set('zona', zona); navigate('/anuncios?' + params); }}><div className="search-input"><Search size={20}/><input aria-label="Buscar productos" placeholder="¿Qué estás buscando?" value={q} onChange={event => setQ(event.target.value)} maxLength={100}/></div><div className="search-zone search-category"><LayoutGrid size={16}/><select aria-label="Categoría de búsqueda" value={categoriaId} onChange={event => setCategoriaId(event.target.value)}><option value="">Todas las categorías</option>{categories.data?.map(category => <option key={category.id} value={category.id}>{category.nombre}</option>)}</select></div><div className="search-zone"><MapPin size={17}/><select aria-label="Zona de búsqueda" value={zona} onChange={event => setZona(event.target.value)}><option value="">Todo el sur</option>{ZONES.map(zone => <option key={zone} value={zone}>{zone.startsWith('Otras') ? 'Otras localidades' : zone}</option>)}</select></div><button className="button button-primary" type="submit"><Search size={17}/><span>Buscar</span></button></form>;
}
