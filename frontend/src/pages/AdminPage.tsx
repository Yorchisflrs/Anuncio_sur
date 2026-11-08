import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, BadgeCheck, CalendarDays, Check, Flag, CheckCircle2, ChevronRight, Clock3, CreditCard, FileCheck2, ImagePlus, Inbox, LoaderCircle, MapPin, PackageCheck, Phone, QrCode, RefreshCw, Save, Search, ShieldCheck, SlidersHorizontal, Star, Tag, Users, XCircle } from 'lucide-react';
import type { AdminResumen, ConfigPago, ListingDetail, PlanPublicacion } from '../types';
import { useResource } from '../hooks/useResource';
import { api, errorMessage, listingPrice, price } from '../services/api';
import { ErrorState, Loading } from '../components/States';
import { MAX_UPLOAD_MB } from '../services/images';
import { AdminVerifications } from '../components/AdminVerifications';
import { AdminReports } from '../components/AdminReports';
import '../admin.css';

type AdminTab = 'anuncios' | 'reportes' | 'verificaciones' | 'pagos' | 'planes';
type ReviewFilter = 'pendiente' | 'activo' | 'rechazado' | 'vencido' | 'todos';
const FILTERS: { id: ReviewFilter; label: string }[] = [{ id: 'pendiente', label: 'Pendientes' }, { id: 'activo', label: 'Activos' }, { id: 'rechazado', label: 'Rechazados' }, { id: 'vencido', label: 'Vencidos' }, { id: 'todos', label: 'Todos' }];
const PAYMENT_LABELS: Record<ListingDetail['estadoPago'], string> = { pendiente: 'Sin confirmar', en_revision: 'Comprobante por revisar', confirmado: 'Pago confirmado', rechazado: 'Pago rechazado' };
const EMPTY_PAYMENT: ConfigPago = { configurado: false, metodo: '', titular: '', numero: '', qrUrl: null, instrucciones: '' };

function reviewStatus(ad: ListingDetail): ReviewFilter | 'inactivo' {
  if (ad.moderacion === 'pendiente') return 'pendiente';
  if (ad.moderacion === 'rechazado') return 'rechazado';
  if (ad.fechaVencimiento && new Date(ad.fechaVencimiento).getTime() <= Date.now()) return 'vencido';
  return ad.estado === 'activo' ? 'activo' : 'inactivo';
}
function statusLabel(ad: ListingDetail) {
  const status = reviewStatus(ad);
  if (ad.revisionReportes && status === 'activo') return 'Oculto por reportes';
  return status === 'pendiente' ? 'Pendiente de revisión' : status === 'rechazado' ? 'Rechazado' : status === 'vencido' ? 'Vencido' : status === 'activo' ? 'Activo' : 'Dado de baja';
}
function timestamp(value: string | null | undefined) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return '—';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' }).format(new Date(value));
}

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('anuncios');
  const [filter, setFilter] = useState<ReviewFilter>('pendiente');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const summary = useResource<AdminResumen>('/admin/resumen');
  const listings = useResource<ListingDetail[]>('/admin/anuncios' + (query ? '?q=' + encodeURIComponent(query) : ''));
  const plans = useResource<PlanPublicacion[]>('/admin/planes');
  const configuration = useResource<ConfigPago>('/admin/configuracion');
  const rows = useMemo(() => (listings.data || []).filter(ad => filter === 'todos' || reviewStatus(ad) === filter), [listings.data, filter]);
  const selected = rows.find(ad => ad.id === selectedId) || rows[0] || null;
  function refreshReview() { listings.reload(); summary.reload(); }
  function chooseRow(id: number) {
    setSelectedId(id); setNotice('');
    if (window.matchMedia('(max-width: 900px)').matches) requestAnimationFrame(() => {
      const detail = document.querySelector<HTMLElement>('.admin-detail');
      detail?.focus({ preventScroll: true }); detail?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }
  function submitSearch(event: FormEvent) { event.preventDefault(); setSelectedId(null); setQuery(search.trim()); }
  const stats = [
    { filter: 'pendiente' as const, icon: Inbox, title: 'Por revisar', value: summary.data?.pendientes },
    { filter: 'activo' as const, icon: PackageCheck, title: 'Publicados', value: summary.data?.activos },
    { filter: 'rechazado' as const, icon: XCircle, title: 'Rechazados', value: summary.data?.rechazados },
    { filter: 'vencido' as const, icon: Clock3, title: 'Vencidos', value: summary.data?.vencidos }
  ];
  return <div className="container page-section admin-page">
    <div className="breadcrumb"><Link to="/">Inicio</Link><ChevronRight size={14}/><span>Administración</span></div>
    <header className="admin-page-heading"><div><span className="section-kicker"><ShieldCheck size={15}/>ADMINISTRACIÓN DE AVISOSUR</span><h1>Cada anuncio, bajo control.</h1><p>Revisa las solicitudes, confirma los pagos y decide qué se publica.</p></div><span className="admin-manual-label"><FileCheck2 size={18}/>Confirmación manual</span></header>

    {summary.error ? <div className="admin-inline-error" role="alert">{summary.error}<button onClick={summary.reload}>Reintentar</button></div> : <div className="admin-stats" aria-label="Resumen de publicaciones">{stats.map(({ filter: next, icon: Icon, title, value }) => <button key={next} className={'admin-stat' + (tab === 'anuncios' && filter === next ? ' is-selected' : '')} onClick={() => { setTab('anuncios'); setFilter(next); setSelectedId(null); }}><span><Icon size={20}/>{title}</span><strong>{value ?? '—'}</strong><small>Ver anuncios <ArrowUpRight size={15}/></small></button>)}</div>}
    <div className="admin-small-summary"><span><CreditCard size={16}/><strong>{summary.data?.pagosEnRevision ?? '—'}</strong> comprobantes por revisar</span><span><CheckCircle2 size={16}/>Ingresos confirmados (sin ejemplos): <strong>{summary.data ? price(summary.data.ingresos) : '—'}</strong></span><span><Users size={16}/><strong>{summary.data?.usuarios ?? '—'}</strong> usuarios</span><button type="button" className="admin-summary-link" onClick={() => { setTab('reportes'); setNotice(''); }}><Flag size={16}/><strong>{summary.data?.reportesPendientes ?? '—'}</strong> reportes por revisar{summary.data?.ocultosPorReportes ? ` · ${summary.data.ocultosPorReportes} ocultos` : ''}</button><button type="button" className="admin-summary-link" onClick={() => { setTab('verificaciones'); setNotice(''); }}><BadgeCheck size={16}/><strong>{summary.data?.celularesSinVerificar ?? '—'}</strong> celulares sin verificar</button></div>

    <nav className="admin-tabs" aria-label="Secciones de administración">{[{ id: 'anuncios' as const, label: 'Revisar anuncios', icon: Inbox }, { id: 'reportes' as const, label: 'Reportes', icon: Flag }, { id: 'verificaciones' as const, label: 'Verificar celulares', icon: BadgeCheck }, { id: 'pagos' as const, label: 'QR y datos de pago', icon: QrCode }, { id: 'planes' as const, label: 'Planes y tarifas', icon: SlidersHorizontal }].map(({ id, label, icon: Icon }) => <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); setNotice(''); }}><Icon size={19}/>{label}</button>)}</nav>
    {notice && <div className="admin-notice" role="status"><CheckCircle2 size={19}/>{notice}</div>}

    {tab === 'anuncios' && <section className="admin-review" aria-label="Bandeja de revisión">
      <div className="admin-review-toolbar"><div className="admin-review-filters" aria-label="Filtrar por estado">{FILTERS.map(item => <button key={item.id} aria-pressed={filter === item.id} onClick={() => { setFilter(item.id); setSelectedId(null); }}>{item.label}</button>)}</div><button className="admin-refresh" onClick={refreshReview} disabled={listings.loading || summary.loading}><RefreshCw size={17} className={listings.loading ? 'spin' : ''}/>Actualizar</button></div>
      <form className="admin-search" role="search" onSubmit={submitSearch}><label htmlFor="admin-search"><Search size={19}/><span className="sr-only">Buscar solicitudes por título o descripción</span></label><input id="admin-search" placeholder="Buscar por título o descripción" value={search} onChange={event => setSearch(event.target.value)} maxLength={100}/><button className="button button-primary" type="submit">Buscar</button></form>
      {query && <p className="admin-search-note">Resultados para “{query}” <button onClick={() => { setQuery(''); setSearch(''); }}>Quitar búsqueda</button></p>}
      {listings.error ? <ErrorState message={listings.error} retry={listings.reload}/> : listings.loading && !listings.data ? <Loading label="Cargando solicitudes…"/> : !rows.length ? <div className="admin-empty"><Inbox size={34}/><h2>No hay anuncios en esta bandeja</h2><p>{query ? 'Prueba con otra búsqueda o cambia el estado.' : 'Cuando existan solicitudes con este estado, aparecerán aquí.'}</p></div> : <div className="admin-review-grid" aria-busy={listings.loading}>
        <div className="admin-queue"><div className="admin-queue-label"><span>{rows.length} {rows.length === 1 ? 'anuncio' : 'anuncios'}</span><span>Elige uno para revisarlo</span></div>{rows.map(ad => <button className={'admin-queue-row' + (ad.id === selected?.id ? ' is-selected' : '')} key={ad.id} onClick={() => chooseRow(ad.id)} aria-pressed={ad.id === selected?.id}><img src={ad.imagen} referrerPolicy="no-referrer" alt="" loading="lazy"/><span className="admin-queue-copy"><span className={'admin-status admin-status-' + reviewStatus(ad)}>{statusLabel(ad)}</span><strong>{ad.titulo}</strong><span>{ad.zona} · {ad.categoria}</span><small>Tarifa: {price(ad.montoPublicacion)} · #{ad.id}</small></span><ChevronRight size={17}/></button>)}</div>
        {selected && <AdminListingDetail key={selected.id} listing={selected} plans={plans.data || []} onSaved={message => { setNotice(message); refreshReview(); }}/>}</div>}
    </section>}
    {tab === 'pagos' && (configuration.loading && !configuration.data ? <Loading label="Cargando datos de pago…"/> : configuration.error ? <ErrorState message={configuration.error} retry={configuration.reload}/> : <PaymentSettings value={configuration.data || EMPTY_PAYMENT} onSaved={message => { setNotice(message); configuration.reload(); }}/>) }
    {tab === 'reportes' && <AdminReports onSaved={message => { setNotice(message); summary.reload(); }}/>}
    {tab === 'verificaciones' && <AdminVerifications onSaved={message => { setNotice(message); summary.reload(); }}/>}
    {tab === 'planes' && <section className="admin-plans-section"><div className="admin-section-heading"><span className="admin-section-icon"><Tag size={24}/></span><div><h2>Planes de publicación</h2><p>Define precio, vigencia y días extra antes de activar cada plan.</p></div></div><p className="admin-explanation"><ShieldCheck size={19}/>Las tarifas son configurables. Un pago no publica un anuncio por sí solo: la aprobación del administrador sigue siendo necesaria.</p>{plans.error ? <ErrorState message={plans.error} retry={plans.reload}/> : plans.loading && !plans.data ? <Loading label="Cargando planes…"/> : plans.data?.length ? <div className="admin-plan-grid">{plans.data.map(plan => <PlanEditor key={plan.id + '-' + JSON.stringify(plan)} value={plan} onSaved={() => { setNotice('El plan “' + plan.nombre + '” se actualizó correctamente.'); plans.reload(); }}/>)}</div> : <div className="admin-empty"><Tag size={32}/><h2>No hay planes configurados</h2><p>Revisa la configuración del servidor para cargar los planes de publicación.</p></div>}</section>}
  </div>;
}

function AdminListingDetail({ listing: ad, plans, onSaved }: { listing: ListingDetail; plans: PlanPublicacion[]; onSaved: (message: string) => void }) {
  const [photo, setPhoto] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [reference, setReference] = useState(ad.pago?.referenciaPago || '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [decided, setDecided] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const photos = (ad.fotos?.length ? ad.fotos : [{ id: 0, archivo: ad.imagen, orden: 0 }]).slice(0, 7);
  const plan = plans.find(item => item.id === ad.planId);
  const pending = ad.moderacion === 'pendiente' && !decided;
  async function approve(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || !pending || !confirmed) return;
    if (!ad.pago?.comprobanteUrl && reference.trim().length < 4) { setError('Este anuncio no tiene comprobante. Escribe una referencia de al menos 4 caracteres para identificar el pago que verificaste externamente.'); return; }
    inFlight.current = true; setBusy('approve'); setError('');
    try { await api('/admin/anuncios/' + ad.id + '/aprobar', { method: 'POST', body: JSON.stringify({ confirmarPago: true, referenciaPago: reference.trim() }) }); setDecided(true); onSaved('Pago confirmado y anuncio #' + ad.id + ' aprobado. Su vigencia comienza con esta aprobación.'); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { inFlight.current = false; setBusy(null); }
  }
  async function reject() {
    if (inFlight.current || !pending) return;
    if (reason.trim().length < 5) { setError('Escribe un motivo claro de al menos 5 caracteres.'); return; }
    inFlight.current = true; setBusy('reject'); setError('');
    try { await api('/admin/anuncios/' + ad.id + '/rechazar', { method: 'POST', body: JSON.stringify({ motivo: reason.trim() }) }); setDecided(true); onSaved('El anuncio #' + ad.id + ' fue rechazado. El motivo estará disponible para su propietario.'); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { inFlight.current = false; setBusy(null); }
  }
  return <article className="admin-detail" tabIndex={-1} aria-label={'Revisión del anuncio ' + ad.id}>
    <div className="admin-detail-heading"><div><span className="admin-overline">SOLICITUD #{ad.id}</span><h2>{ad.titulo}</h2></div><span className={'admin-status admin-status-' + reviewStatus(ad)}>{statusLabel(ad)}</span></div>
    <div className="admin-detail-photo"><img src={photos[photo]?.archivo || ad.imagen} referrerPolicy="no-referrer" alt={ad.titulo + ' · fotografía ' + (photo + 1)}/><span>{photo + 1} / {photos.length}</span></div>
    {photos.length > 1 && <div className="admin-photo-thumbnails" aria-label="Fotografías del anuncio">{photos.map((item, index) => <button key={item.id} onClick={() => setPhoto(index)} aria-pressed={index === photo} aria-label={'Ver fotografía ' + (index + 1)}><img src={item.archivo} referrerPolicy="no-referrer" alt=""/></button>)}</div>}
    <div className="admin-ad-price"><strong>{listingPrice(ad)}</strong><span>{ad.tipoOperacion === 'alquiler' ? 'Alquiler mensual' : 'Precio de venta'}</span></div>
    <div className="admin-facts"><Fact icon={Tag} label="Categoría" value={ad.categoria + (ad.subcategoria ? ' · ' + ad.subcategoria : '')}/><Fact icon={MapPin} label="Localidad" value={ad.zona}/><Fact icon={MapPin} label="Dirección" value={ad.direccion || 'No indicada'}/><Fact icon={MapPin} label="Referencia" value={ad.referencia || 'No indicada'}/><Fact icon={Users} label="Publicado por" value={ad.vendedor.nombre}/><Fact icon={Phone} label="Contacto del anuncio" value={ad.contacto || ad.vendedor.celular || "—"}/></div>
    <section className="admin-detail-section"><h3>Descripción completa</h3><p className="admin-full-description">{ad.descripcion}</p></section>
    <section className="admin-detail-section"><h3><CalendarDays size={18}/>Plan y vigencia</h3><dl className="admin-data-list"><div><dt>Plan solicitado</dt><dd>{plan?.nombre || (ad.planId ? 'Plan #' + ad.planId : 'Sin plan registrado')}</dd></div><div><dt>Monto de publicación</dt><dd>{price(ad.montoPublicacion)}</dd></div><div><dt>Vigencia contratada</dt><dd>{ad.diasVigencia} días</dd></div><div><dt>Días promocionales</dt><dd>{ad.diasPromocion} días</dd></div><div><dt>Destacado</dt><dd>{ad.destacado ? 'Sí' : 'No'}</dd></div><div><dt>Solicitud recibida</dt><dd>{timestamp(ad.fechaPublicacion)}</dd></div><div><dt>Aprobación</dt><dd>{timestamp(ad.fechaAprobacion)}</dd></div><div><dt>Vencimiento</dt><dd>{timestamp(ad.fechaVencimiento)}</dd></div></dl></section>
    <section className="admin-detail-section admin-payment-review"><h3><CreditCard size={18}/>Pago y comprobante</h3><span className={'admin-payment-state admin-payment-' + ad.estadoPago}>{PAYMENT_LABELS[ad.estadoPago]}</span><dl className="admin-data-list"><div><dt>Referencia declarada</dt><dd>{ad.pago?.referenciaPago || 'No indicada'}</dd></div><div><dt>Comprobante recibido</dt><dd>{timestamp(ad.pago?.fechaComprobante)}</dd></div><div><dt>Pago confirmado</dt><dd>{timestamp(ad.pago?.fechaConfirmacion)}</dd></div></dl>{ad.pago?.comprobanteUrl ? <a className="admin-receipt" href={ad.pago.comprobanteUrl} target="_blank" rel="noopener noreferrer"><img src={ad.pago.comprobanteUrl} alt={'Comprobante de pago del anuncio ' + ad.id} loading="lazy"/><span><FileCheck2 size={17}/>Abrir comprobante completo <ArrowUpRight size={16}/></span></a> : <p className="admin-missing-receipt"><FileCheck2 size={19}/>El propietario todavía no adjuntó un comprobante.</p>}</section>
    {ad.motivoRevision && <div className="admin-rejection-note"><strong>Motivo de revisión</strong><p>{ad.motivoRevision}</p></div>}
    {error && <div className="error-banner" role="alert">{error}</div>}
    {pending ? <section className="admin-decision"><div className="admin-decision-title"><ShieldCheck size={21}/><div><h3>Decisión del administrador</h3><p>Verifica la información y el abono antes de aprobar.</p></div></div><form onSubmit={approve}><label className="admin-field">Referencia de pago confirmada <span>{ad.pago?.comprobanteUrl ? '(opcional)' : '(obligatoria sin comprobante)'}</span><input value={reference} onChange={event => setReference(event.target.value)} maxLength={160} placeholder="Número de operación o referencia" disabled={Boolean(busy)}/></label><label className="admin-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={Boolean(busy)}/><span>{ad.montoPublicacion > 0 ? <>Confirmé manualmente el pago de <strong>{price(ad.montoPublicacion)}</strong> y revisé el anuncio.</> : 'Revisé los datos y las condiciones de esta publicación sin costo.'}</span></label><button className="button button-primary full-width" type="submit" disabled={Boolean(busy) || !confirmed}>{busy === 'approve' ? <LoaderCircle size={19} className="spin"/> : <CheckCircle2 size={19}/>}Confirmar pago y aprobar</button></form><div className="admin-reject-box"><label className="admin-field" htmlFor={'rejection-' + ad.id}>Motivo de rechazo<textarea id={'rejection-' + ad.id} value={reason} onChange={event => setReason(event.target.value)} placeholder="Explica qué debe corregir el propietario." rows={3} minLength={5} maxLength={1000} disabled={Boolean(busy)}/></label><button className="button admin-reject-button full-width" onClick={reject} disabled={Boolean(busy)}>{busy === 'reject' ? <LoaderCircle size={19} className="spin"/> : <XCircle size={19}/>}Rechazar con este motivo</button></div></section> : <p className="admin-review-done"><CheckCircle2 size={20}/>Esta solicitud ya fue revisada. No se volverá a publicar al abrirla.</p>}
    <div className="admin-detail-links">{reviewStatus(ad) === 'activo' && <Link className="button button-outline" to={'/anuncios/' + ad.id}>Ver publicación <ArrowUpRight size={17}/></Link>}<button className="admin-back-to-queue" onClick={() => document.querySelector('.admin-review-toolbar')?.scrollIntoView({ behavior: 'instant', block: 'start' })}><ArrowLeft size={17}/>Volver a la bandeja</button></div>
  </article>;
}

function Fact({ icon: Icon, label, value }: { icon: typeof Tag; label: string; value: string }) {
  return <div className="admin-fact"><Icon size={17}/><span>{label}<strong>{value || '—'}</strong></span></div>;
}

function PaymentSettings({ value, onSaved }: { value: ConfigPago; onSaved: (message: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'settings' | 'qr' | null>(null);
  const inFlight = useRef(false);
  useEffect(() => setDraft(value), [value]);
  async function save(event: FormEvent) {
    event.preventDefault(); if (inFlight.current) return;
    if (!draft.metodo.trim() || !draft.titular.trim()) { setError('Indica el método de pago y el nombre del titular.'); return; }
    inFlight.current = true; setBusy('settings'); setError('');
    try { await api<ConfigPago>('/admin/configuracion', { method: 'PUT', body: JSON.stringify({ metodo: draft.metodo.trim(), titular: draft.titular.trim(), numero: draft.numero.trim(), instrucciones: draft.instrucciones.trim() }) }); onSaved('Los datos de pago se guardaron correctamente.'); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { inFlight.current = false; setBusy(null); }
  }
  function selectFile(next: File | undefined) {
    setError(''); setFile(null); setPreview('');
    if (!next) return;
    // El QR no se reduce en el navegador para no perder nitidez; el servidor lo guarda sin pérdida.
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type) || next.size > MAX_UPLOAD_MB * 1024 * 1024) { setError(`Selecciona una imagen JPG, PNG o WebP de hasta ${MAX_UPLOAD_MB} MB.`); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') { setFile(next); setPreview(reader.result); } };
    reader.onerror = () => setError('No se pudo leer la imagen. Vuelve a seleccionarla.');
    reader.readAsDataURL(next);
  }
  async function upload(event: FormEvent) {
    event.preventDefault(); if (inFlight.current || !file) return;
    const body = new FormData(); body.append('qr', file);
    inFlight.current = true; setBusy('qr'); setError('');
    try { await api<ConfigPago>('/admin/configuracion/qr', { method: 'POST', body }); setFile(null); setPreview(''); onSaved('La imagen QR real se actualizó correctamente.'); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { inFlight.current = false; setBusy(null); }
  }
  return <section className="admin-settings"><div className="admin-section-heading"><span className="admin-section-icon"><QrCode size={25}/></span><div><h2>Cómo recibir los pagos</h2><p>Publica tus datos y sube el QR real de la cuenta receptora.</p></div><span className={'admin-status ' + (value.configurado ? 'admin-status-activo' : 'admin-status-pendiente')}>{value.configurado ? 'Configurado' : 'Pendiente de configurar'}</span></div><p className="admin-explanation"><ShieldCheck size={19}/>AvisoSur muestra estos datos al propietario. El sistema no verifica transferencias ni cobra automáticamente; el administrador confirma cada pago.</p>{error && <div className="error-banner" role="alert">{error}</div>}<div className="admin-payment-grid"><form className="admin-config-form" onSubmit={save}><label className="admin-field">Método de pago<input value={draft.metodo} onChange={event => setDraft({ ...draft, metodo: event.target.value })} placeholder="Nombre de la billetera o entidad" maxLength={80} required disabled={Boolean(busy)}/></label><label className="admin-field">Titular de la cuenta<input value={draft.titular} onChange={event => setDraft({ ...draft, titular: event.target.value })} placeholder="Nombre que debe verificar el cliente" maxLength={160} required disabled={Boolean(busy)}/></label><label className="admin-field">Número o cuenta de destino<input value={draft.numero} onChange={event => setDraft({ ...draft, numero: event.target.value })} placeholder="Número de celular o cuenta" maxLength={100} disabled={Boolean(busy)}/></label><label className="admin-field">Instrucciones para el propietario<textarea rows={4} value={draft.instrucciones} onChange={event => setDraft({ ...draft, instrucciones: event.target.value })} placeholder="Explica cómo pagar y qué comprobante debe adjuntar." maxLength={1000} disabled={Boolean(busy)}/></label><button className="button button-primary" type="submit" disabled={Boolean(busy)}>{busy === 'settings' ? <LoaderCircle size={19} className="spin"/> : <Save size={19}/>}Guardar datos de pago</button></form><form className="admin-qr-card" onSubmit={upload}><h3>Imagen QR de pago</h3><div className="admin-qr-preview">{preview || value.qrUrl ? <img src={preview || value.qrUrl || ''} alt={preview ? 'Nueva imagen QR seleccionada, todavía sin guardar' : 'QR de pago configurado por el administrador'}/> : <div className="admin-qr-placeholder"><QrCode size={48}/><strong>Todavía no hay un QR</strong><p>Sube la imagen original de tu cuenta. Aquí no se genera ningún código de pago.</p></div>}</div>{preview && <p className="admin-qr-unsaved">Vista previa. Guarda la imagen para mostrarla a los usuarios.</p>}<label className="admin-file-picker"><ImagePlus size={19}/>{file ? file.name : 'Elegir imagen del QR'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => selectFile(event.target.files?.[0])} disabled={Boolean(busy)}/></label><span className="admin-field-hint">JPG, PNG o WebP · máximo {MAX_UPLOAD_MB} MB</span><button className="button button-primary full-width" type="submit" disabled={!file || Boolean(busy)}>{busy === 'qr' ? <LoaderCircle size={19} className="spin"/> : <Save size={19}/>}Guardar imagen QR</button>{value.qrUrl && <a className="admin-qr-original" href={value.qrUrl} target="_blank" rel="noopener noreferrer">Abrir imagen configurada <ArrowUpRight size={16}/></a>}</form></div></section>;
}

function PlanEditor({ value, onSaved }: { value: PlanPublicacion; onSaved: () => void }) {
  const [draft, setDraft] = useState({ nombre: value.nombre, precio: value.precio === null ? '' : String(value.precio), dias: String(value.dias), bonoPrimerAnuncio: String(value.bonoPrimerAnuncio), destacado: value.destacado, activo: value.activo });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  async function save(event: FormEvent) {
    event.preventDefault(); if (inFlight.current) return;
    const amount = draft.precio.trim() === '' ? null : Number(draft.precio), days = Number(draft.dias), bonus = Number(draft.bonoPrimerAnuncio);
    if (draft.nombre.trim().length < 3 || (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 99999)) || (draft.activo && (amount === null || amount <= 0)) || !Number.isInteger(days) || days < 1 || days > 365 || !Number.isInteger(bonus) || bonus < 0 || bonus > 365) { setError('Revisa los días y el precio. Para activar un plan debes definir su tarifa; vigencia de 1 a 365 y bono de 0 a 365 días.'); return; }
    inFlight.current = true; setBusy(true); setError('');
    try { await api<PlanPublicacion>('/admin/planes/' + value.id, { method: 'PATCH', body: JSON.stringify({ ...draft, nombre: draft.nombre.trim(), precio: amount, dias: days, bonoPrimerAnuncio: bonus }) }); onSaved(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <form className={'admin-plan-card' + (draft.activo ? ' is-active' : '')} onSubmit={save}><div className="admin-plan-top"><span className="admin-plan-icon"><CalendarDays size={24}/></span><span className={'admin-status ' + (value.activo ? 'admin-status-activo' : 'admin-status-inactivo')}>{value.activo ? 'Disponible' : 'Inactivo'}</span></div><h3>{value.nombre}</h3><div className="admin-plan-price">{value.precio === null ? 'Por definir' : price(value.precio)}<span>/ {value.dias} {value.dias === 1 ? 'día' : 'días'}</span></div><label className="admin-field">Nombre del plan<input value={draft.nombre} onChange={event => setDraft({ ...draft, nombre: event.target.value })} minLength={3} maxLength={80} required disabled={busy}/></label><div className="admin-plan-inputs"><label className="admin-field">Precio en soles<input type="number" inputMode="decimal" min={draft.activo ? 0.01 : 0} step="0.01" value={draft.precio} placeholder="Por definir" onChange={event => setDraft({ ...draft, precio: event.target.value })} required={draft.activo} disabled={busy}/></label><label className="admin-field">Días de vigencia<input type="number" inputMode="numeric" min={1} max={365} step={1} value={draft.dias} onChange={event => setDraft({ ...draft, dias: event.target.value })} required disabled={busy}/></label></div><label className="admin-field">Días extra del primer anuncio<input type="number" inputMode="numeric" min={0} max={365} step={1} value={draft.bonoPrimerAnuncio} onChange={event => setDraft({ ...draft, bonoPrimerAnuncio: event.target.value })} required disabled={busy}/><span className="admin-field-hint">0 significa que no se otorgan días adicionales.</span></label><label className="admin-check"><input type="checkbox" checked={draft.destacado} onChange={event => setDraft({ ...draft, destacado: event.target.checked })} disabled={busy}/><span><Star size={17}/>Incluye anuncio destacado</span></label><label className="admin-check"><input type="checkbox" checked={draft.activo} onChange={event => setDraft({ ...draft, activo: event.target.checked })} disabled={busy}/><span><Check size={17}/>Ofrecer este plan al publicar</span></label>{error && <div className="admin-field-error" role="alert">{error}</div>}<button className="button button-primary full-width" type="submit" disabled={busy}>{busy ? <LoaderCircle size={18} className="spin"/> : <Save size={18}/>}Guardar plan</button></form>;
}
