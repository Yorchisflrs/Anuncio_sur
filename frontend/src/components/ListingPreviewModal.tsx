import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, MapPin, MessageCircle, UserRound, X } from 'lucide-react';
import type { ListingDetail } from '../types';
import { useResource } from '../hooks/useResource';
import { date, price } from '../services/api';
import '../detail-publish.css';

export function ListingPreviewModal({ id, onClose }: { id: number; onClose: () => void }) {
  const listing = useResource<ListingDetail>('/anuncios/' + id);
  const [photo, setPhoto] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => setPhoto(0), [id]);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById('root');
    const previousInert = appRoot?.inert ?? false;
    document.body.style.overflow = 'hidden';
    if (appRoot) appRoot.inert = true;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]'))
        .filter(element => element.getClientRects().length > 0 && !element.closest('[inert]'));
      if (!focusable.length) { event.preventDefault(); dialogRef.current.focus(); return; }
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (appRoot) appRoot.inert = previousInert;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  const ad = listing.data;
  const photos = ad?.fotos.length ? ad.fotos.map(item => item.archivo) : ad ? [ad.imagen] : [];
  function changePhoto(direction: number) { setPhoto(current => (current + direction + photos.length) % photos.length); }

  return createPortal(<div className="listing-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className="listing-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title" tabIndex={-1}>
      <div className="listing-modal-header"><span>Detalles del anuncio</span><button ref={closeRef} type="button" className="listing-modal-close" onClick={onClose}><X size={20} aria-hidden="true"/>Cerrar</button></div>
      {listing.loading ? <div className="modal-state" role="status"><span className="loading-dot"/><h2 id="preview-title">Cargando el anuncio…</h2><p>Estamos preparando sus fotos y detalles.</p></div> : listing.error || !ad ? <div className="modal-state" role="alert"><h2 id="preview-title">No pudimos abrir el anuncio</h2><p>{listing.error || 'Inténtalo nuevamente.'}</p><button type="button" className="button button-primary" onClick={listing.reload}>Reintentar</button></div> : <>
        <div className="listing-modal-media" data-category={ad.categoriaId}>
          <div className="modal-photo-stage"><img className="listing-modal-image" src={photos[photo] || ad.imagen} alt={ad.titulo + (photos.length > 1 ? ' · Foto ' + (photo + 1) : '')}/>{ad.demo && <span className="modal-demo">DEMO · Anuncio de demostración</span>}</div>
          {photos.length > 1 && <>
            <div className="modal-photo-controls"><button type="button" onClick={() => changePhoto(-1)} aria-label="Ver foto anterior"><ArrowLeft size={18} aria-hidden="true"/><span>Anterior</span></button><span role="status" aria-live="polite">{photo + 1} / {photos.length}</span><button type="button" onClick={() => changePhoto(1)} aria-label="Ver foto siguiente"><span>Siguiente</span><ArrowRight size={18} aria-hidden="true"/></button></div>
            <div className="modal-thumbnails" aria-label="Fotografías del anuncio">{photos.map((image, index) => <button type="button" key={image + index} aria-label={'Ver foto ' + (index + 1)} aria-pressed={photo === index} onClick={() => setPhoto(index)}><img src={image} alt=""/><span>Foto {index + 1}</span></button>)}</div>
          </>}
          <p className="modal-media-caption"><MapPin size={17} aria-hidden="true"/>{ad.zona}</p>
        </div>
        <div className="listing-modal-info">
          <span className="section-kicker">{ad.categoria}{ad.subcategoria ? ' / ' + ad.subcategoria : ''}</span><h2 id="preview-title">{ad.titulo}</h2><p className="modal-price">{price(ad.precio)}</p>
          <div className="modal-metadata"><span><MapPin size={17} aria-hidden="true"/>{ad.zona}</span><span><CalendarDays size={17} aria-hidden="true"/>Publicado el {date(ad.fechaPublicacion)}</span></div>
          <div className="modal-description"><h3>Descripción del anuncio</h3><p id="preview-description">{ad.descripcion}</p></div>
          <div className="modal-seller"><span className="seller-avatar"><UserRound size={24} aria-hidden="true"/></span><div><small>Publicado por</small><strong>{ad.vendedor.nombre}</strong><span>{ad.vendedor.demo ? 'Cuenta de demostración' : 'Vendedor de AvisoSur'}</span></div></div>
          {ad.estado !== 'activo' && <p className="modal-unavailable">Este anuncio ya no está disponible.</p>}
          <div className="modal-actions">{ad.estado === 'activo' && ad.whatsappUrl && <a className="button button-whatsapp" href={ad.whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={20} aria-hidden="true"/>Contactar por WhatsApp <ArrowUpRight size={18} aria-hidden="true"/></a>}<Link className="button button-outline" to={'/anuncios/' + ad.id} onClick={onClose}>Ver ficha completa <ArrowUpRight size={18} aria-hidden="true"/></Link></div>
          <p className="modal-note">{ad.vendedor.demo ? 'El vendedor y su teléfono son de demostración. Abrir WhatsApp no envía ningún mensaje automáticamente.' : 'WhatsApp abrirá una conversación con el teléfono del vendedor. Revisa el producto antes de pagar.'}</p>
        </div>
      </>}
    </div>
  </div>, document.body);
}
