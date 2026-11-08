import { useState } from 'react';
import { ArrowUpRight, BadgeCheck, KeyRound, LoaderCircle, MessageCircle, Phone, ShieldCheck, UserCheck } from 'lucide-react';
import type { AdminVerification } from '../types';
import { useResource } from '../hooks/useResource';
import { api, errorMessage } from '../services/api';
import { ErrorState, Loading } from './States';

interface SentCode { codigo: string; whatsappUrl: string; expira: string }
const when = (value: string | null) => value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' }).format(new Date(value)) : '—';

/** Administración envía el código por WhatsApp desde el celular de AvisoSur o verifica en persona. */
export function AdminVerifications({ onSaved }: { onSaved: (message: string) => void }) {
  const list = useResource<AdminVerification[]>('/admin/verificaciones');
  const [sent, setSent] = useState<Record<number, SentCode>>({});
  const [confirming, setConfirming] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  async function generate(row: AdminVerification) {
    setBusy(row.usuarioId); setError('');
    try { const code = await api<SentCode>('/admin/verificaciones/' + row.usuarioId + '/codigo', { method: 'POST', body: '{}' }); setSent(previous => ({ ...previous, [row.usuarioId]: code })); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(null); }
  }
  async function inPerson(row: AdminVerification) {
    if (!checked) return;
    setBusy(row.usuarioId); setError('');
    try { await api('/admin/verificaciones/' + row.usuarioId + '/presencial', { method: 'POST', body: JSON.stringify({ confirmado: true }) }); setConfirming(null); setChecked(false); onSaved('El celular de ' + row.nombre + ' quedó verificado en persona.'); list.reload(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(null); }
  }
  return <section className="admin-verifications" aria-labelledby="verificaciones-titulo">
    <div className="admin-section-heading"><span className="admin-section-icon"><BadgeCheck size={24}/></span><div><h2 id="verificaciones-titulo">Verificación de celulares</h2><p>Sin celular verificado, una cuenta puede mirar avisos, pero no publicar.</p></div></div>
    <p className="admin-explanation"><ShieldCheck size={19}/>Genera el código y envíalo por WhatsApp desde el celular de AvisoSur: el mensaje ya va escrito. La persona lo escribe en Mi cuenta y así demuestra que el número es suyo. El código vence en 24 horas y solo se muestra aquí una vez.</p>
    {error && <div className="error-banner" role="alert">{error}</div>}
    {list.error ? <ErrorState message={list.error} retry={list.reload}/> : list.loading && !list.data ? <Loading label="Cargando cuentas por verificar…"/> : !list.data?.length ? <div className="admin-empty"><BadgeCheck size={34}/><h2>No hay cuentas por verificar</h2><p>Las cuentas nuevas aparecerán aquí al registrarse.</p></div> : <ul className="admin-verification-list">{list.data.map(row => {
      const code = sent[row.usuarioId];
      return <li key={row.usuarioId} className="admin-verification-row">
        <div className="admin-verification-person"><strong>{row.nombre}</strong><span><Phone size={15}/>+51 {row.celular}</span><small>Registrada el {when(row.fechaRegistro)}{row.solicitado ? ' · pidió su código el ' + when(row.solicitado) : ''}</small>{row.codigoVigente && !code && <small className="admin-verification-sent">Ya tiene un código vigente hasta el {when(row.expira)}.</small>}</div>
        {code ? <div className="admin-verification-code" role="status"><span>Código</span><strong>{code.codigo}</strong><small>Vence el {when(code.expira)}</small><a className="button button-primary" href={code.whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/>Enviar por WhatsApp <ArrowUpRight size={16}/></a></div>
          : <div className="admin-verification-actions">
            <button className="button button-primary" onClick={() => generate(row)} disabled={busy !== null}>{busy === row.usuarioId && confirming !== row.usuarioId ? <LoaderCircle size={18} className="spin"/> : <KeyRound size={18}/>}{row.codigoVigente ? 'Generar otro código' : 'Generar código'}</button>
            {confirming === row.usuarioId ? <div className="admin-verification-confirm"><label className="admin-check"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)}/><span>Comprobé en persona o por llamada que el celular +51 {row.celular} es de esta persona.</span></label><button className="button button-outline" onClick={() => inPerson(row)} disabled={!checked || busy !== null}><UserCheck size={18}/>Confirmar verificación</button></div>
              : <button className="button button-outline" onClick={() => { setConfirming(row.usuarioId); setChecked(false); }} disabled={busy !== null}><UserCheck size={18}/>Verificado en persona</button>}
          </div>}
      </li>;
    })}</ul>}
  </section>;
}
