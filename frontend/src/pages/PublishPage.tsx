import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, ImagePlus, X, MapPin, CheckCircle2, Lightbulb, MessageCircle, Package, Mail, UserRound, CalendarDays, ShieldCheck, CreditCard } from 'lucide-react';
import type { Category, ListingDetail, PublicacionConfig } from '../types';
import { ZONES } from '../types';
import { useResource } from '../hooks/useResource';
import { api, ApiError, errorMessage, price } from '../services/api';
import { validatePublication } from '../services/validation';
import { ErrorState, FieldError } from '../components/States';
import { useAuth } from '../context/AuthContext';
import '../detail-publish.css';
import '../publication-commerce.css';

interface SelectedPhoto { file: File; url: string }
export function PublishPage() {
  const categories = useResource<Category[]>('/categorias');
  const publication = useResource<PublicacionConfig>('/publicacion');
  const { user } = useAuth();
  const successRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState({ titulo: '', descripcion: '', categoriaId: '', subcategoria: '', precio: '', zona: '', direccion: '', referencia: '', contacto: '', planId: '' });
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]); const fileInput = useRef<HTMLInputElement>(null); const errorRef = useRef<HTMLDivElement>(null);
  const [fields, setFields] = useState<Record<string, string>>({}); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [dragging, setDragging] = useState(false);
  const [published, setPublished] = useState<ListingDetail | null>(null);
  const submissionInFlight = useRef(false);
  useEffect(() => { if (published) { successRef.current?.focus({ preventScroll: true }); successRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); } }, [published]);
  useEffect(() => { if (message) errorRef.current?.focus(); }, [message]);
  useEffect(() => { if (user?.celular) setData(previous => ({ ...previous, contacto: previous.contacto || user.celular })); }, [user?.celular]);
  useEffect(() => { const first = publication.data?.planes.find(item => item.activo); if (first) setData(previous => ({ ...previous, planId: previous.planId || String(first.id) })); }, [publication.data]);
  const category = categories.data?.find(item => String(item.id) === data.categoriaId);
  const plan = publication.data?.planes.find(item => String(item.id) === data.planId);
  function change(name: string, value: string) { setData(previous => ({ ...previous, [name]: value, ...(name === 'categoriaId' ? { subcategoria: '' } : {}) })); setFields(previous => ({ ...previous, [name]: '' })); }
  async function addFiles(files: FileList | File[] | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    let error = '';
    if (photos.length + selected.length > 7) error = 'Puedes añadir hasta 7 fotografías.';
    else if (selected.some(file => !['image/jpeg', 'image/png'].includes(file.type) || !/\.(jpe?g|png)$/i.test(file.name))) error = 'Selecciona únicamente fotografías JPG o PNG.';
    else if (selected.some(file => file.size > 2 * 1024 * 1024)) error = 'Cada fotografía debe pesar como máximo 2 MB.';
    if (error) { setFields(previous => ({ ...previous, fotos: error })); return; }
    try {
      const previews = await Promise.all(selected.map(file => new Promise<SelectedPhoto>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve({ file, url: reader.result }) : reject(new Error('No se pudo preparar la vista previa.'));
        reader.onerror = () => reject(new Error('No se pudo leer la fotografía. Inténtalo de nuevo.'));
        reader.readAsDataURL(file);
      })));
      setPhotos(previous => [...previous, ...previews].slice(0, 7));
      setFields(previous => ({ ...previous, fotos: '' }));
    } catch (error) { setFields(previous => ({ ...previous, fotos: errorMessage(error) })); }
  }
  function removePhoto(index: number) { setPhotos(previous => previous.filter((_, item) => item !== index)); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submissionInFlight.current || published) return;
    setMessage('');
    const errors = validatePublication(data, photos.length); setFields(errors);
    if (Object.keys(errors).length) { setMessage('Completa los campos señalados. Conservamos lo que ya escribiste.'); return; }
    submissionInFlight.current = true;
    setBusy(true);
    const form = new FormData(); Object.entries(data).forEach(([key, value]) => form.append(key, value)); photos.forEach(photo => form.append('fotos', photo.file));
    try {
      const listing = await api<ListingDetail>('/anuncios', { method: 'POST', body: form });
      setPublished(listing);
    } catch (error) {
      submissionInFlight.current = false;
      setMessage(errorMessage(error));
      if (error instanceof ApiError) setFields(error.fields);
    } finally {
      setBusy(false);
    }
  }
  const completed = [photos.length > 0, Boolean(data.titulo.trim() && data.descripcion.trim() && data.categoriaId && Number(data.precio) > 0 && data.zona), /^9\d{8}$/.test(data.contacto), Boolean(plan)];
  const inputProps = (name: string, hint?: string) => ({ 'aria-invalid': Boolean(fields[name]), 'aria-describedby': [hint, fields[name] ? name + '-error' : ''].filter(Boolean).join(' ') || undefined });
  return <div className="container page-section publish-page">
    {/* Bloque 2: ubicación y título de la pantalla. */}
    <div className="breadcrumb"><Link to="/">Inicio</Link><ChevronRight size={14}/><Link to="/perfil">Mi perfil</Link><ChevronRight size={14}/><span>Publicar anuncio</span></div>
    <div className="publish-intro-row">
      <div className="page-heading"><span className="section-kicker">TU ANUNCIO, EN EL LUGAR CORRECTO</span><h1>Publica en AvisoSur</h1><p>Añade tus fotos, elige un plan y envía el anuncio.<br/>Se hará visible cuando administración confirme el pago y lo apruebe.</p></div>
      <nav className="publish-progress" aria-label="Secciones de tu anuncio">{['Fotos', 'Datos del anuncio', 'Contacto', 'Plan'].map((label, index) => <a className={completed[index] ? 'is-complete' : ''} key={label} href={'#publicar-paso-' + (index + 1)}><span>{completed[index] ? <CheckCircle2 size={18} aria-hidden="true"/> : index + 1}</span>{label}{completed[index] && <span className="sr-only">: completo</span>}</a>)}</nav>
    </div>
    {/* Bloque 3: formulario y vista previa del objeto Anuncio. */}
    {categories.error ? <ErrorState message={categories.error} retry={categories.reload}/> : <div className="publish-layout">
      <form className="publish-form" onSubmit={submit} noValidate>
        {message && <div className="error-banner" role="alert" ref={errorRef} tabIndex={-1}>{message}</div>}
        <fieldset className="publish-fields" disabled={busy || Boolean(published)}>
          <legend className="sr-only">Completa tu anuncio</legend>
          <section className="form-section" id="publicar-paso-1" aria-labelledby="publish-photos-title">
            <div className="form-section-heading"><span><ImagePlus size={25} aria-hidden="true"/></span><div><h2 id="publish-photos-title">1. Fotos <span className="required">*</span></h2><p>Muestra lo que ofreces. La primera foto será la principal.</p></div></div>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" multiple hidden aria-label="Seleccionar fotos del anuncio" onChange={event => { addFiles(event.target.files); event.target.value = ''; }}/>
            <button type="button" className={'upload-zone' + (dragging ? ' dragging' : '')} disabled={photos.length >= 7 || busy || Boolean(published)} aria-describedby="publish-photo-hint fotos-error" onClick={() => fileInput.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!busy && !published) addFiles(event.dataTransfer.files); }}><span><ImagePlus size={30} aria-hidden="true"/></span><strong>{photos.length >= 7 ? 'Ya añadiste 7 fotos' : 'Añadir mis fotos'}</strong><small id="publish-photo-hint">Elige de 1 a 7 fotos propias JPG o PNG, de hasta 2 MB cada una.<br/>La primera será la portada. También puedes arrastrarlas aquí.</small></button>
            <FieldError id="fotos-error" message={fields.fotos}/>
            {photos.length > 0 && <><p className="publish-photo-count" role="status">{photos.length} de 7 fotos añadidas</p><div className="photo-previews">{photos.map((photo, index) => <div key={photo.url}><img src={photo.url} alt={'Vista previa de fotografía ' + (index + 1)}/><span>{index === 0 ? 'Principal' : 'Foto ' + (index + 1)}</span><button type="button" aria-label={'Quitar foto ' + (index + 1)} onClick={() => removePhoto(index)} disabled={busy || Boolean(published)}><X size={18} aria-hidden="true"/>Quitar</button></div>)}</div></>}
          </section>
          <section className="form-section" id="publicar-paso-2" aria-labelledby="publish-data-title">
            <div className="form-section-heading"><span><Package size={25} aria-hidden="true"/></span><div><h2 id="publish-data-title">2. Datos del anuncio</h2><p>Explica qué ofreces, cuánto cuesta y dónde se encuentra.</p></div></div>
            <label className="form-field">¿Qué ofreces? <span className="required">*</span><input name="titulo" placeholder="Ej. Moto Honda CB190R en buen estado" value={data.titulo} onChange={event => change('titulo', event.target.value)} maxLength={100} {...inputProps('titulo', 'titulo-hint')}/><FieldError id="titulo-error" message={fields.titulo}/><span className="field-hint" id="titulo-hint">Escribe un título corto y claro. {data.titulo.length}/100 caracteres.</span></label>
            <div className="form-row"><label className="form-field">Categoría <span className="required">*</span><select name="categoriaId" value={data.categoriaId} onChange={event => change('categoriaId', event.target.value)} {...inputProps('categoriaId')}><option value="">Elige una categoría</option>{categories.data?.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><FieldError id="categoriaId-error" message={fields.categoriaId}/></label><label className="form-field">Subcategoría <span className="field-optional">(opcional)</span><select name="subcategoria" value={data.subcategoria} disabled={!category || busy || Boolean(published)} onChange={event => change('subcategoria', event.target.value)} {...inputProps('subcategoria')}><option value="">Elige una subcategoría</option>{category?.subcategorias.map(item => <option key={item}>{item}</option>)}</select><FieldError id="subcategoria-error" message={fields.subcategoria}/></label></div>
            <label className="form-field">Descripción <span className="required">*</span><textarea name="descripcion" placeholder="Ej. Moto de 2022, en buen estado. Tiene 12 000 km y documentos al día. Se puede ver en Puno." rows={5} value={data.descripcion} onChange={event => change('descripcion', event.target.value)} maxLength={3000} {...inputProps('descripcion', 'descripcion-hint')}/><FieldError id="descripcion-error" message={fields.descripcion}/><span className="field-hint" id="descripcion-hint">Cuenta su estado, características y cualquier detalle importante. {data.descripcion.length}/3000.</span></label>
            <div className="form-row"><label className="form-field">Precio en soles <span className="required">*</span><div className="input-with-icon"><span className="price-prefix">S/</span><input type="number" name="precio" min="0.01" max="99999999.99" step="0.01" inputMode="decimal" placeholder="Ej. 5000" value={data.precio} onChange={event => change('precio', event.target.value)} {...inputProps('precio', 'precio-hint')}/></div><FieldError id="precio-error" message={fields.precio}/><span className="field-hint" id="precio-hint">Indica el precio total, mayor a S/ 0.</span></label><label className="form-field">¿Dónde se encuentra? <span className="required">*</span><select name="zona" value={data.zona} onChange={event => change('zona', event.target.value)} {...inputProps('zona')}><option value="">Elige la ubicación</option>{ZONES.map(zone => <option key={zone}>{zone}</option>)}</select><FieldError id="zona-error" message={fields.zona}/></label></div>
            <label className="form-field">Dirección <span className="field-optional">(opcional)</span><input name="direccion" value={data.direccion} onChange={event => change('direccion', event.target.value)} maxLength={200} placeholder="Ej. Jr. Los Andes 123, segundo piso" {...inputProps('direccion')}/><FieldError id="direccion-error" message={fields.direccion}/></label>
            <label className="form-field">Referencia <span className="field-optional">(opcional)</span><input name="referencia" value={data.referencia} onChange={event => change('referencia', event.target.value)} maxLength={200} placeholder="Ej. A una cuadra de la Universidad Nacional del Altiplano" {...inputProps('referencia')}/><FieldError id="referencia-error" message={fields.referencia}/></label>
          </section>
          <section className="form-section publish-contact-section" id="publicar-paso-3" aria-labelledby="publish-contact-title">
            <div className="form-section-heading"><span><MessageCircle size={25} aria-hidden="true"/></span><div><h2 id="publish-contact-title">3. Contacto</h2><p>Las personas interesadas podrán escribirte por WhatsApp.</p></div></div>
            <label className="form-field">Celular de contacto / WhatsApp <span className="required">*</span><input name="contacto" type="tel" inputMode="tel" value={data.contacto} onChange={event => change('contacto', event.target.value.replace(/\D/g, '').slice(0, 9))} maxLength={9} placeholder="9 dígitos" {...inputProps('contacto')}/><FieldError id="contacto-error" message={fields.contacto}/><span className="field-hint">Este número se mostrará a las personas interesadas cuando se publique el anuncio.</span></label>
            {user?.demo && <p className="publish-demo-note"><UserRound size={18} aria-hidden="true"/>Tu cuenta de ejemplo usa un teléfono ficticio. Para vender utiliza tu cuenta personal.</p>}
            {user?.correo && <p className="publish-account-email"><Mail size={18} aria-hidden="true"/><span>{user.correo}</span></p>}
            <Link to="/perfil" className="publish-profile-link">Ver mi perfil <ArrowRight size={18} aria-hidden="true"/></Link>
          </section>
          <section className="form-section" id="publicar-paso-4" aria-labelledby="publish-plan-title"><div className="form-section-heading"><span><CreditCard size={25}/></span><div><h2 id="publish-plan-title">4. Tu plan de publicación</h2><p>La vigencia empieza cuando administración confirma el pago y aprueba tu anuncio.</p></div></div>
            {publication.error ? <ErrorState message={publication.error} retry={publication.reload}/> : <div className="publication-plans">{publication.data?.planes.filter(item => item.activo).map(item => <label className={'publication-plan'+(data.planId===String(item.id)?' is-selected':'')} key={item.id}><input type="radio" name="planId" value={item.id} checked={data.planId===String(item.id)} onChange={event => change('planId',event.target.value)}/><span><strong>{item.nombre}</strong><span><CalendarDays size={16}/>{item.dias} días de publicación{item.destacado?' · Destacado':''}</span>{item.bonoPrimerAnuncio>0&&<small>+{item.bonoPrimerAnuncio} días en tu primera publicación aprobada</small>}</span><b>{price(item.precio)}</b></label>)}</div>}
            {!publication.loading&&!publication.error&&!publication.data?.planes.some(item=>item.activo)&&<p role="status">Todavía no hay planes disponibles. Inténtalo más tarde.</p>}<FieldError id="planId-error" message={fields.planId}/><p className="field-hint">El precio de este plan es el costo de publicar, distinto del precio de lo que ofreces.</p>
          </section>
        </fieldset>
        {/* Bloque 4: acción principal que guarda el Anuncio. */}
        <div className="publish-actions"><span><ShieldCheck size={20}/>{plan?`${price(plan.precio)} por ${plan.dias} días · Revisión y confirmación de pago`:'Elige un plan para continuar'}</span><div><Link className="button button-outline" to="/perfil">Cancelar</Link><button type="submit" className="button button-primary publish-submit" disabled={busy || Boolean(published) || categories.loading || publication.loading || !plan}>{busy ? 'Enviando…' : published ? 'Anuncio enviado' : 'Enviar para revisión'}<ArrowRight size={20}/></button></div></div>
        {/* Bloque 5: estado posterior a la publicación. */}
        {published && <div className="publish-success" role="status" aria-live="polite" ref={successRef} tabIndex={-1}><CheckCircle2 size={24}/><div><p>Tu anuncio se envió para revisión.</p><span>Aún no se muestra al público. Completa el pago y adjunta tu comprobante.</span><Link to={'/mis-anuncios/' + published.id + '/pago'}>Continuar con el pago <ArrowRight size={18}/></Link></div></div>}
      </form>
      <aside className="publish-aside"><span className="section-kicker">ASÍ SE VERÁ DESPUÉS DE APROBARSE</span><div className="preview-card"><div className="preview-image">{photos[0] ? <img src={photos[0].url} alt="Vista previa de tu anuncio"/> : <><ImagePlus size={40}/><span>Aquí aparecerá tu foto principal</span></>}</div><div className="product-body"><span className="product-category">{category?.nombre || 'Tu categoría'}</span><h3>{data.titulo || 'Aquí aparecerá tu título'}</h3><p className="product-price">{data.precio && Number(data.precio) > 0 ? price(Number(data.precio)) : 'S/ —'}</p><p className="product-location"><MapPin size={17}/>{data.zona || 'Tu ubicación'}</p></div></div><div className="publish-checklist"><strong>Antes de enviar</strong>{['Añade hasta siete fotos propias', 'Completa los datos del anuncio', 'Revisa tu contacto', 'Elige el plan de publicación'].map((label, index) => <span className={completed[index] ? 'is-complete' : ''} key={label}><CheckCircle2 size={19}/>{label}{completed[index] && <span className="sr-only">: completo</span>}</span>)}</div><div className="publish-tip"><Lightbulb size={25}/><h3>Fotos y datos que ayuden</h3><p>Para un cuarto, muestra la habitación, baño y acceso. Indica el piso, dirección, servicios y condiciones de alquiler.</p></div></aside>
    </div>}
  </div>;
}
