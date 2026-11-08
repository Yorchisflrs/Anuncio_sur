import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, CreditCard, ImagePlus, LockKeyhole, QrCode, ShieldCheck, UploadCloud } from 'lucide-react';
import type { ListingDetail, PublicacionConfig } from '../types';
import { useResource } from '../hooks/useResource';
import { api, date, errorMessage, listingPrice, price } from '../services/api';
import { ErrorState, Loading } from '../components/States';
import { publicationStatus } from '../services/publication';
import { IMAGE_ACCEPT, prepareImage, readAsDataUrl } from '../services/images';
import '../publication-commerce.css';

export function PaymentPage() {
  const { id } = useParams();
  const listing = useResource<ListingDetail>('/anuncios/' + id);
  const configuration = useResource<PublicacionConfig>('/publicacion');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const inFlight = useRef(false);
  async function choose(selected?: File) {
    setMessage('');setSuccess('');setFile(null);setPreview('');
    if (!selected) return;
    // Una captura o foto del comprobante se reduce igual que las fotos del anuncio.
    try { const prepared=await prepareImage(selected);setFile(prepared);setPreview(await readAsDataUrl(prepared)); }
    catch(error){setMessage(errorMessage(error));}
  }
  async function submit(event:FormEvent) {
    event.preventDefault();if(inFlight.current)return;setMessage('');setSuccess('');
    if(!file){setMessage('Añade la imagen de tu comprobante de pago.');return;}
    inFlight.current=true;setBusy(true);
    try{const body=new FormData();body.append('comprobante',file);body.append('referenciaPago',reference.trim());await api('/anuncios/'+id+'/comprobante',{method:'POST',body});setSuccess('Comprobante enviado. Administración verificará el pago y revisará tu anuncio.');setFile(null);setPreview('');listing.reload();}
    catch(error){setMessage(errorMessage(error));}finally{inFlight.current=false;setBusy(false);}
  }
  if(listing.loading&&!listing.data)return <Loading label="Preparando tu publicación…"/>;
  if(listing.error||!listing.data)return <ErrorState message={listing.error||'No encontramos tu anuncio.'} retry={listing.reload}/>;
  const ad=listing.data, status=publicationStatus(ad), payment=configuration.data?.pago;
  const published=status.key==='activo',closed=['vencido','baja'].includes(status.key);
  return <div className="container page-section payment-page">
    <div className="breadcrumb"><Link to="/perfil">Mi perfil</Link><ArrowRight size={14}/><span>Pago y revisión</span></div>
    <div className="page-heading"><span className="section-kicker">TU PUBLICACIÓN, PASO A PASO</span><h1>{published?'Tu anuncio ya está publicado':'Completa tu publicación'}</h1><p>El pago se verifica de forma manual. Subir el comprobante todavía no activa el anuncio.</p></div>
    <ol className="payment-steps"><li className="is-complete"><CheckCircle2/>Anuncio enviado</li><li className={ad.estadoPago==='confirmado'?'is-complete':''}><CreditCard/>Pago</li><li className={ad.pago?.comprobanteUrl?'is-complete':''}><UploadCloud/>Comprobante</li><li className={published?'is-complete':''}><ShieldCheck/>Aprobación</li></ol>
    <div className="payment-layout"><section className="commerce-panel payment-summary"><img src={ad.imagen} referrerPolicy="no-referrer" alt={ad.titulo}/><div><span className={'publication-status status-'+status.key}>{status.label}</span><h2>{ad.titulo}</h2><p>{ad.categoria} · {ad.zona}</p><dl><div><dt>Costo de publicar</dt><dd>{price(ad.montoPublicacion)}</dd></div><div><dt>Duración del plan</dt><dd>{ad.diasVigencia} días</dd></div>{ad.diasPromocion>0&&<div><dt>Promoción aplicada</dt><dd>+{ad.diasPromocion} días</dd></div>}<div><dt>{ad.tipoOperacion === 'alquiler' ? 'Alquiler que pides' : 'Precio de lo que vendes'}</dt><dd>{listingPrice(ad)}</dd></div></dl>{ad.fechaVencimiento&&<p className="payment-expiration"><CalendarDays size={18}/>Vigencia hasta el {date(ad.fechaVencimiento)}</p>}{ad.motivoRevision&&<div className="commerce-notice" role="status"><strong>Observación de administración</strong><p>{ad.motivoRevision}</p></div>}<Link className="text-link" to={'/anuncios/'+ad.id}>Revisar mi anuncio <ArrowRight size={17}/></Link></div></section>
    <div className="payment-content">{published?<section className="commerce-panel payment-ready"><CheckCircle2 size={38}/><h2>Tu anuncio está visible</h2><p>La vigencia comenzó cuando administración confirmó el pago y aprobó tu publicación.</p><Link className="button button-primary" to={'/anuncios/'+ad.id}>Ver anuncio publicado <ArrowRight size={18}/></Link></section>:closed?<section className="commerce-panel"><Clock3 size={34}/><h2>{status.label}</h2><p>Este anuncio ya no aparece en el catálogo público. Su registro permanece en tu perfil.</p><Link className="button button-primary" to="/publicar">Preparar otro anuncio</Link></section>:<>
      <section className="commerce-panel payment-instructions"><div className="commerce-panel-title"><QrCode size={25}/><div><h2>1. Realiza el pago</h2><p>Importe de tu publicación: <strong>{price(ad.montoPublicacion)}</strong></p></div></div>{configuration.error?<ErrorState message={configuration.error} retry={configuration.reload}/>:payment?.configurado?<div className="payment-qr">{payment.qrUrl&&<a href={payment.qrUrl} target="_blank" rel="noopener noreferrer" className="payment-qr-link"><img src={payment.qrUrl} alt={'QR de pago de '+payment.titular}/><span>Abrir QR a tamaño completo</span></a>}<div><strong>{payment.metodo}</strong><p>Titular: <b>{payment.titular}</b></p>{payment.numero&&<p>Número: <b>{payment.numero}</b></p>}<p>{payment.instrucciones||'Comprueba el titular y el importe en tu aplicación antes de confirmar.'}</p><span className="payment-manual-note"><ShieldCheck size={17}/>El administrador verificará el pago.</span></div></div>:<div className="commerce-notice"><QrCode size={30}/><div><strong>El QR todavía no está configurado</strong><p>Administración debe añadir el medio de pago, el titular y su QR real. Tu anuncio queda guardado en tu perfil; vuelve a esta pantalla cuando se habilite el pago.</p></div></div>}</section>
      <section className="commerce-panel"><div className="commerce-panel-title"><UploadCloud size={25}/><div><h2>2. Adjunta tu comprobante</h2><p>Una captura legible permite revisar el pago con más facilidad.</p></div></div>{ad.pago?.comprobanteUrl&&<div className="existing-receipt"><CheckCircle2 size={20}/><div><strong>Ya recibimos un comprobante</strong><a href={ad.pago.comprobanteUrl} target="_blank" rel="noopener noreferrer">Ver mi comprobante</a></div></div>}<form className="receipt-form" onSubmit={submit}>{message&&<p className="error-banner" role="alert">{message}</p>}{success&&<p className="commerce-success" role="status">{success}</p>}<label className="receipt-picker"><ImagePlus size={28}/><strong>{file?file.name:'Seleccionar comprobante'}</strong><span>Captura o foto: JPG, PNG, WebP o HEIC</span><input type="file" accept={IMAGE_ACCEPT} aria-label="Comprobante de pago" disabled={busy||ad.estadoPago==='confirmado'} onChange={event=>choose(event.target.files?.[0])}/></label>{preview&&<img className="receipt-preview" src={preview} alt="Vista previa del comprobante seleccionado"/>}<label className="form-field">Número de operación <span className="field-optional">(opcional)</span><input value={reference} onChange={event=>setReference(event.target.value)} maxLength={100} placeholder="Tal como aparece en el comprobante" disabled={busy}/></label><p className="receipt-privacy"><LockKeyhole size={17}/>Solo tú y administración pueden consultar este comprobante.</p><button className="button button-primary full-width" disabled={busy||!file||ad.estadoPago==='confirmado'}>{busy?'Enviando…':'Enviar comprobante para revisión'}<ArrowRight size={18}/></button></form></section>
    </>}</div></div><Link className="text-link" to="/perfil"><ArrowLeft size={17}/>Volver a mis anuncios</Link>
  </div>;
}
