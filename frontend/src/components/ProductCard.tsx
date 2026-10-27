import { Link } from 'react-router-dom';
import { MapPin, ArrowUpRight } from 'lucide-react';
import type { Listing } from '../types';
import { date, price } from '../services/api';

export function ListingCardContent({ listing, eager = false }: { listing: Listing; eager?: boolean }) {
  return <>
    <span className="product-image" data-category={listing.categoriaId}>
      <img src={listing.imagen} alt={listing.titulo} loading={eager ? 'eager' : 'lazy'} width="600" height="440" draggable={false}/>
      {listing.demo && <span className="image-badge">DEMO</span>}
      {listing.estado === 'dado_de_baja' && <span className="inactive-badge">Dado de baja</span>}
      <span className="card-arrow"><ArrowUpRight size={18}/></span>
    </span>
    <span className="product-body">
      <span className="product-category">{listing.categoria}{listing.subcategoria ? ' / ' + listing.subcategoria : ''}</span>
      <span className="product-title">{listing.titulo}</span>
      <span className="product-price">{price(listing.precio)}</span>
      <span className="product-location"><span><MapPin size={13}/>{listing.zona.startsWith('Otras localidades') ? 'Sur del Perú' : listing.zona}</span><time dateTime={listing.fechaPublicacion}>{date(listing.fechaPublicacion)}</time></span>
    </span>
  </>;
}

export function ProductCard({ listing }: { listing: Listing }) {
  return <Link to={'/anuncios/' + listing.id} className={'product-card' + (listing.estado === 'dado_de_baja' ? ' inactive-card' : '')}><ListingCardContent listing={listing}/></Link>;
}
