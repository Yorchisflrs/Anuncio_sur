import { AlertCircle, SearchX, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className="state-box" role="alert"><div className="state-icon"><AlertCircle/></div><h2>No pudimos cargar esta información</h2><p>{message}</p>{retry && <button className="button button-outline" onClick={retry}>Volver a intentar</button>}</div>; }
export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) { return <div className="state-box"><div className="state-icon"><SearchX/></div><h2>{title}</h2><p>{children}</p>{action}</div>; }
// `page` reserva el alto de la pantalla mientras carga una página entera: así el pie no salta (CLS) al llegar el contenido.
export function Loading({ label = 'Cargando información…', page = false }: { label?: string; page?: boolean }) { return <div className={'loading-state' + (page ? ' loading-page' : '')} role="status"><LoaderCircle className="spin" size={24}/><span>{label}</span></div>; }
export function CardSkeletons({ count = 4 }: { count?: number }) { return <div className="product-grid" aria-label="Cargando anuncios" aria-busy="true">{Array.from({ length: count }, (_, i) => <div className="skeleton-card" key={i}><div className="skeleton skeleton-image"/><div className="skeleton-lines"><div className="skeleton"/><div className="skeleton"/><div className="skeleton"/></div></div>)}</div>; }
export function FieldError({ id, message }: { id: string; message?: string }) { return message ? <span id={id} className="field-error">{message}</span> : null; }
