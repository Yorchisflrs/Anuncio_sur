import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, PencilLine, Save, ShieldCheck } from 'lucide-react';
import type { ListingDetail } from '../types';
import { ZONES } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useResource } from '../hooks/useResource';
import { api, ApiError, errorMessage } from '../services/api';
import { EmptyState, ErrorState, FieldError, Loading } from '../components/States';
import '../detail-publish.css';
import '../publication-commerce.css';

const formValues = (ad: ListingDetail) => ({ titulo: ad.titulo, descripcion: ad.descripcion, precio: String(ad.precio), zona: ad.zona, tipoOperacion: String(ad.tipoOperacion), direccion: ad.direccion, referencia: ad.referencia });

export function EditPage() {
  const { id } = useParams();
  const { user } = useAuth();
  // useResource carga con api('/anuncios/' + id) y cancela el pedido al salir.
  const listing = useResource<ListingDetail>('/anuncios/' + id);
  if (listing.loading) return <Loading label="Cargando tu aviso…"/>;
  if (listing.error || !listing.data) return <div className="container page-section"><ErrorState message={listing.error || 'No encontramos este aviso.'} retry={listing.reload}/></div>;
  const ad = listing.data;
  if (ad.usuarioId !== user?.id || ad.fechaAprobacion !== null || ad.estado === 'dado_de_baja') {
    return <div className="container page-section"><EmptyState title="Este aviso no se puede editar" action={<Link className="button button-outline" to={'/anuncios/' + ad.id}>Volver al aviso</Link>}>Solo puedes editar tus propios avisos antes de que sean aprobados y mientras no estén dados de baja.</EmptyState></div>;
  }
  return <div className="container page-section publish-page">
    <div className="breadcrumb"><Link to="/perfil">Mi cuenta</Link><ChevronRight size={14}/><Link to={'/anuncios/' + ad.id}>Mi aviso</Link><ChevronRight size={14}/><span>Editar aviso</span></div>
    <div className="page-heading"><span className="section-kicker">CORRIGE LOS DATOS DE TU AVISO</span><h1>Editar aviso</h1><p>Puedes corregir estos datos antes de que administración apruebe tu publicación.</p></div>
    <div className="publish-layout"><EditForm key={ad.id} listing={ad}/><aside className="publish-aside"><div className="publish-tip"><ShieldCheck size={25} aria-hidden="true"/><h2>Revisión del aviso</h2><p>Si tu aviso fue rechazado, al guardar las correcciones volverá a quedar pendiente de revisión.</p></div></aside></div>
  </div>;
}

function EditForm({ listing }: { listing: ListingDetail }) {
  const [data, setData] = useState(() => formValues(listing));
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const inFlight = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const toast = useToast();
  useEffect(() => { if (message) errorRef.current?.focus(); }, [message]);
  function change(field: keyof typeof data, value: string) {
    setData(previous => ({ ...previous, [field]: value }));
    setFields(previous => ({ ...previous, [field]: '' }));
  }
  const inputProps = (field: string) => ({ 'aria-invalid': Boolean(fields[field]), 'aria-describedby': fields[field] ? 'edit-' + field + '-error' : undefined });
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || locked) return;
    setMessage(''); setFields({});
    const original = formValues(listing);
    const changes = Object.fromEntries(Object.entries(data).filter(([field, value]) => value !== original[field as keyof typeof original]));
    if (!Object.keys(changes).length) { setMessage('Cambia al menos un dato del aviso antes de guardar.'); return; }
    inFlight.current = true; setBusy(true);
    try {
      await api<ListingDetail>('/anuncios/' + listing.id, { method: 'PATCH', body: JSON.stringify(changes) });
      toast('Cambios guardados.');
      navigate('/anuncios/' + listing.id, { replace: true });
    } catch (error) {
      setMessage(errorMessage(error));
      if (error instanceof ApiError) { setFields(error.fields); if (error.status === 409) setLocked(true); }
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <form className="publish-form" onSubmit={submit} noValidate>
    {message && <div className="error-banner" role="alert" tabIndex={-1} ref={errorRef}>{message}<FieldError id="edit-formulario-error" message={fields.formulario}/></div>}
    {listing.moderacion === 'rechazado' && listing.motivoRevision && <div className="commerce-notice"><div><strong>Qué debes corregir</strong><p>{listing.motivoRevision}</p></div></div>}
    <fieldset className="publish-fields" disabled={busy || locked}>
      <legend className="sr-only">Datos de tu aviso</legend>
      <section className="form-section" aria-labelledby="edit-data-title">
        <div className="form-section-heading"><span><PencilLine size={25} aria-hidden="true"/></span><div><h2 id="edit-data-title">Datos del aviso</h2><p>Revisa la descripción, el precio y la ubicación.</p></div></div>
        <label className="form-field">Título del aviso<input name="titulo" value={data.titulo} onChange={event => change('titulo', event.target.value)} minLength={5} maxLength={100} required {...inputProps('titulo')}/><FieldError id="edit-titulo-error" message={fields.titulo}/></label>
        <label className="form-field">Descripción<textarea name="descripcion" rows={5} value={data.descripcion} onChange={event => change('descripcion', event.target.value)} maxLength={3000} required {...inputProps('descripcion')}/><FieldError id="edit-descripcion-error" message={fields.descripcion}/></label>
        <div className="form-row">
          <label className="form-field">Tipo de operación<select name="tipoOperacion" value={data.tipoOperacion} onChange={event => change('tipoOperacion', event.target.value)} {...inputProps('tipoOperacion')}><option value="venta">Venta</option><option value="alquiler">Alquiler mensual</option></select><FieldError id="edit-tipoOperacion-error" message={fields.tipoOperacion}/></label>
          <label className="form-field">{data.tipoOperacion === 'alquiler' ? 'Precio mensual en soles' : 'Precio en soles'}<input name="precio" type="number" inputMode="decimal" min="0.01" max="99999999.99" step="0.01" value={data.precio} onChange={event => change('precio', event.target.value)} required {...inputProps('precio')}/><FieldError id="edit-precio-error" message={fields.precio}/></label>
        </div>
        <label className="form-field">Ubicación<select name="zona" value={data.zona} onChange={event => change('zona', event.target.value)} required {...inputProps('zona')}>{ZONES.map(zone => <option key={zone} value={zone}>{zone}</option>)}</select><FieldError id="edit-zona-error" message={fields.zona}/></label>
        <label className="form-field">Dirección <span className="field-optional">(opcional)</span><input name="direccion" value={data.direccion} onChange={event => change('direccion', event.target.value)} maxLength={200} {...inputProps('direccion')}/><FieldError id="edit-direccion-error" message={fields.direccion}/></label>
        <label className="form-field">Referencia <span className="field-optional">(opcional)</span><input name="referencia" value={data.referencia} onChange={event => change('referencia', event.target.value)} maxLength={300} {...inputProps('referencia')}/><FieldError id="edit-referencia-error" message={fields.referencia}/></label>
      </section>
    </fieldset>
    <div className="publish-actions"><Link className="button button-outline" to={'/anuncios/' + listing.id}><ArrowLeft size={18} aria-hidden="true"/>Volver al aviso</Link><button className="button button-primary" type="submit" disabled={busy || locked}><Save size={18} aria-hidden="true"/>{busy ? 'Guardando…' : 'Guardar cambios'}</button></div>
  </form>;
}
