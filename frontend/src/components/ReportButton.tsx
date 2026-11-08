import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, Flag, LoaderCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, ApiError, errorMessage } from '../services/api';
import { REPORT_REASONS } from '../data/directory';

/** «Reportar este aviso»: motivos fijos; con tres reportes de cuentas verificadas el aviso se oculta. */
export function ReportButton({ listingId }: { listingId: number }) {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  if (!user) return <Link className="report-link" to={'/login?next=' + encodeURIComponent(location.pathname)}><Flag size={16} aria-hidden="true"/>Inicia sesión para reportar este aviso</Link>;
  if (done) return <p className="report-done" role="status"><CheckCircle2 size={18} aria-hidden="true"/>{done}</p>;
  if (!open) return <button type="button" className="report-link" onClick={() => setOpen(true)}><Flag size={16} aria-hidden="true"/>Reportar este aviso</button>;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!motivo) { setError('Elige el motivo del reporte.'); return; }
    setBusy(true); setError('');
    try { setDone((await api<{ message: string }>('/anuncios/' + listingId + '/reportes', { method: 'POST', body: JSON.stringify({ motivo, detalle: detalle.trim() }) })).message); }
    catch (failure) { if (failure instanceof ApiError && failure.status === 409) setDone(failure.message); else setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <form className="report-form" onSubmit={submit} noValidate>
    <fieldset><legend>¿Por qué reportas este aviso?</legend>{REPORT_REASONS.map(reason => <label key={reason.value} className="report-reason"><input type="radio" name="motivo" value={reason.value} checked={motivo === reason.value} onChange={() => { setMotivo(reason.value); setError(''); }}/><span>{reason.label}</span></label>)}</fieldset>
    <label className="form-field">Cuéntanos qué pasó <span className="field-optional">(opcional)</span><textarea rows={3} maxLength={500} value={detalle} onChange={event => setDetalle(event.target.value)} placeholder="Ej. Me pidió pagar por Yape antes de mostrarme el cuarto."/></label>
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="report-actions"><button type="button" className="button button-outline" onClick={() => setOpen(false)} disabled={busy}>Cancelar</button><button className="button button-primary" disabled={busy}>{busy && <LoaderCircle size={18} className="spin" aria-hidden="true"/>}Enviar reporte</button></div>
    <p className="report-note">El vendedor no sabe quién lo reportó. Si tres personas con celular verificado lo reportan, el aviso se oculta hasta que administración lo revise.</p>
  </form>;
}
