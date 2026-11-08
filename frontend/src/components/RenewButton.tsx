import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoaderCircle, RotateCcw } from 'lucide-react';
import type { Listing } from '../types';
import { api, errorMessage } from '../services/api';

/** «Volver a publicar»: copia un aviso vencido en una solicitud nueva y lleva a su pago y revisión. */
export function RenewButton({ listingId }: { listingId: number }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function renew() {
    setBusy(true); setError('');
    try {
      const nuevo = await api<Listing>('/anuncios/' + listingId + '/renovar', { method: 'POST', body: JSON.stringify({}) });
      navigate('/mis-anuncios/' + nuevo.id + '/pago');
    }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" onClick={renew} disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" aria-hidden="true"/> : <RotateCcw size={16} aria-hidden="true"/>}Volver a publicar</button>
    {error && <p className="field-error" role="alert">{error}</p>}
  </>;
}
