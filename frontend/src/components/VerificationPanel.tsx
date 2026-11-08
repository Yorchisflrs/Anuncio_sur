import { useState } from 'react';
import type { FormEvent } from 'react';
import { BadgeCheck, LoaderCircle, MessageCircle, ShieldAlert } from 'lucide-react';
import type { User, VerificationStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useResource } from '../hooks/useResource';
import { api, ApiError, date, errorMessage } from '../services/api';

/** Verificación del celular: administración envía un código por WhatsApp y la persona lo escribe aquí. */
export function VerificationPanel() {
  const { user, replaceUser } = useAuth();
  const toast = useToast();
  const status = useResource<VerificationStatus>('/perfil/verificacion');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'confirm' | 'request' | null>(null);
  if (!user || user.demo) return null;
  if (user.celularVerificado) return <section id="verificacion" className="verification-panel is-verified" aria-label="Verificación del celular"><BadgeCheck size={28} aria-hidden="true"/><div><strong>Celular verificado</strong><p>Tus avisos muestran la insignia «Celular verificado» junto a tu nombre.</p></div></section>;

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) { setError('Escribe los 6 números del código que recibiste por WhatsApp.'); return; }
    setBusy('confirm'); setError('');
    try {
      const result = await api<{ usuario: User }>('/perfil/verificacion/confirmar', { method: 'POST', body: JSON.stringify({ codigo: code }) });
      replaceUser(result.usuario); toast('¡Listo! Tu celular quedó verificado y ya puedes publicar.');
    } catch (failure) { setError(errorMessage(failure)); if (failure instanceof ApiError) status.reload(); }
    finally { setBusy(null); }
  }
  async function requestCode() {
    setBusy('request'); setError('');
    try { await api('/perfil/verificacion', { method: 'POST', body: '{}' }); status.reload(); toast('Pedimos un código nuevo. Te llegará por WhatsApp.'); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(null); }
  }
  const data = status.data;
  return <section id="verificacion" className="verification-panel" aria-labelledby="verificacion-titulo">
    <ShieldAlert size={28} aria-hidden="true"/>
    <div>
      <h2 id="verificacion-titulo">Verifica tu celular para publicar</h2>
      <p>AvisoSur te enviará un código de 6 números por WhatsApp al <strong>+51 {user.celular}</strong>. Escríbelo aquí. Sin verificar puedes mirar avisos, pero no publicar.</p>
      <p className="verification-state" role="status">{status.loading && !data ? 'Consultando tu verificación…' : data?.codigoVigente ? <><MessageCircle size={16} aria-hidden="true"/>Ya te enviamos un código. Vence el {date(data.expira!)} · te quedan {data.intentosRestantes} intentos.</> : data?.solicitado ? 'Tu pedido está en la lista de administración. Cuando recibas el código por WhatsApp, escríbelo aquí.' : 'Pide tu código para que administración te lo envíe.'}</p>
      <form className="verification-form" onSubmit={confirm} noValidate>
        <label className="form-field">Código de verificación<input inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} value={code} onChange={event => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} aria-invalid={Boolean(error)} aria-describedby={error ? 'codigo-error' : undefined}/></label>
        <button className="button button-primary" disabled={Boolean(busy)}>{busy === 'confirm' && <LoaderCircle size={18} className="spin" aria-hidden="true"/>}Verificar mi celular</button>
      </form>
      {error && <p id="codigo-error" className="field-error" role="alert">{error}</p>}
      <button type="button" className="text-link verification-request" onClick={requestCode} disabled={Boolean(busy)}>{data?.solicitado ? 'Pedir un código nuevo' : 'Pedir mi código'}</button>
    </div>
  </section>;
}
