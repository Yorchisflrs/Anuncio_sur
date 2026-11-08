import { useState } from 'react';
import { ArrowUpRight, LoaderCircle, MessageCircle, Phone } from 'lucide-react';
import { api, errorMessage } from '../services/api';

const groups = (celular: string) => celular.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');

/** El celular no viene con el aviso: se pide al pulsar, para que nadie pueda reunir números en masa. */
export function ContactButton({ listingId, className = '' }: { listingId: number; className?: string }) {
  const [contact, setContact] = useState<{ celular: string; whatsappUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function reveal() {
    setBusy(true); setError('');
    try { setContact(await api<{ celular: string; whatsappUrl: string }>('/anuncios/' + listingId + '/contacto')); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  if (!contact) return <div className={('contact-reveal ' + className).trim()}>
    <button type="button" className="button button-whatsapp full-width" onClick={reveal} disabled={busy}>{busy ? <LoaderCircle size={20} className="spin" aria-hidden="true"/> : <Phone size={20} aria-hidden="true"/>}Ver contacto del vendedor</button>
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
  return <div className={('contact-reveal is-revealed ' + className).trim()}>
    <p className="contact-number" role="status"><Phone size={18} aria-hidden="true"/><span>Celular <strong>+51 {groups(contact.celular)}</strong></span></p>
    <a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" className="button button-whatsapp full-width"><MessageCircle size={20} aria-hidden="true"/>Escribir por WhatsApp <ArrowUpRight size={17} aria-hidden="true"/></a>
  </div>;
}
