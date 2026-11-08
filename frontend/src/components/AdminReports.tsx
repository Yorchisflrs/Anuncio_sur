import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArchiveX, ArrowUpRight, BadgeCheck, EyeOff, Flag, LoaderCircle, RotateCcw, ShieldCheck } from 'lucide-react';
import type { ReportGroup } from '../types';
import { useResource } from '../hooks/useResource';
import { api, errorMessage, listingPrice } from '../services/api';
import { ErrorState, Loading } from './States';

type Action = 'restaurar' | 'dar_de_baja';
const when = (value: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' }).format(new Date(value));

/** Página del moderador: reportes pendientes agrupados por aviso; restaurar o dar de baja. */
export function AdminReports({ onSaved }: { onSaved: (message: string) => void }) {
  const list = useResource<ReportGroup[]>('/admin/reportes');
  const [choice, setChoice] = useState<{ id: number; action: Action } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function resolve() {
    if (!choice) return;
    setBusy(true); setError('');
    try {
      await api('/admin/anuncios/' + choice.id + '/reportes/resolver', { method: 'POST', body: JSON.stringify({ accion: choice.action }) });
      onSaved(choice.action === 'restaurar' ? 'El aviso #' + choice.id + ' volvió al catálogo y sus reportes quedaron revisados.' : 'El aviso #' + choice.id + ' fue dado de baja y sus reportes quedaron revisados.');
      setChoice(null); list.reload();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <section className="admin-reports" aria-labelledby="reportes-titulo">
    <div className="admin-section-heading"><span className="admin-section-icon"><Flag size={24}/></span><div><h2 id="reportes-titulo">Reportes de avisos</h2><p>Con tres reportes de cuentas con celular verificado, el aviso se oculta solo hasta que decidas.</p></div></div>
    <p className="admin-explanation"><ShieldCheck size={19}/>Revisa los motivos y, si hace falta, conversa con el vendedor. Restaurar devuelve el aviso al catálogo con los días que estuvo oculto; dar de baja lo retira sin borrar su registro. En ambos casos los reportes pasan a «revisados».</p>
    {error && <div className="error-banner" role="alert">{error}</div>}
    {list.error ? <ErrorState message={list.error} retry={list.reload}/> : list.loading && !list.data ? <Loading label="Cargando reportes…"/> : !list.data?.length ? <div className="admin-empty"><Flag size={34}/><h2>No hay reportes pendientes</h2><p>Cuando alguien reporte un aviso, aparecerá aquí.</p></div> : <ul className="admin-report-list">{list.data.map(({ anuncio: ad, reportes, reportantesVerificados }) => <li key={ad.id} className={'admin-report-group' + (ad.revisionReportes ? ' is-hidden' : '')}>
      <div className="admin-report-heading">
        <img src={ad.imagen} referrerPolicy="no-referrer" alt="" loading="lazy"/>
        <div><span className={'admin-status ' + (ad.revisionReportes ? 'admin-status-rechazado' : 'admin-status-activo')}>{ad.revisionReportes ? <><EyeOff size={13}/> Oculto por reportes</> : ad.estado === 'dado_de_baja' ? 'Dado de baja' : 'Visible en el catálogo'}</span><strong>#{ad.id} · {ad.titulo}</strong><span>{listingPrice(ad)} · {ad.zona} · vendedor: {ad.vendedor.nombre}{ad.vendedor.verificado ? ' (celular verificado)' : ''}</span><small>{reportes.length} {reportes.length === 1 ? 'reporte' : 'reportes'} · {reportantesVerificados} de cuentas verificadas</small></div>
        <Link className="text-link" to={'/anuncios/' + ad.id}>Ver aviso <ArrowUpRight size={15}/></Link>
      </div>
      <ul className="admin-report-items">{reportes.map(item => <li key={item.id}><strong>{item.motivoTexto}</strong>{item.detalle && <p>«{item.detalle}»</p>}<small>{item.reportante.nombre}{item.reportante.verificado && <> · <BadgeCheck size={13}/> celular verificado</>} · {when(item.fecha)}</small></li>)}</ul>
      {choice?.id === ad.id ? <div className="admin-report-confirm" role="group" aria-label="Confirmar decisión"><p>{choice.action === 'restaurar' ? '¿Restaurar este aviso al catálogo?' : '¿Dar de baja este aviso? Su registro se conserva.'}</p><button className="button button-outline" onClick={() => setChoice(null)} disabled={busy}>Cancelar</button><button className={'button ' + (choice.action === 'restaurar' ? 'button-primary' : 'admin-reject-button')} onClick={resolve} disabled={busy}>{busy && <LoaderCircle size={17} className="spin"/>}Confirmar</button></div>
        : <div className="admin-report-actions"><button className="button button-outline" onClick={() => setChoice({ id: ad.id, action: 'restaurar' })}><RotateCcw size={17}/>Restaurar aviso</button><button className="button admin-reject-button" onClick={() => setChoice({ id: ad.id, action: 'dar_de_baja' })}><ArchiveX size={17}/>Dar de baja</button></div>}
    </li>)}</ul>}
  </section>;
}
