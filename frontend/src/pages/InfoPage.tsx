import { Link, NavLink, useParams } from 'react-router-dom';
import { ChevronRight, CheckCircle2 } from 'lucide-react';
import { EmptyState } from '../components/States';
import { INFO_TOPICS } from '../data/directory';

export function InfoPage() {
  const { tema = '' } = useParams();
  const topic = INFO_TOPICS[tema];
  if (!topic) return <EmptyState title="Esta página no existe" action={<Link className="button button-primary" to="/">Volver al inicio</Link>}>Puedes seguir explorando las oportunidades de AvisoSur.</EmptyState>;
  return <div className="container page-section"><div className="breadcrumb"><Link to="/">Inicio</Link><ChevronRight size={14}/><span>Ayuda</span><ChevronRight size={14}/><span>{topic.title}</span></div>
    <div className="info-layout"><nav className="info-nav" aria-label="Temas de ayuda">{Object.entries(INFO_TOPICS).map(([key, item]) => <NavLink key={key} to={'/ayuda/' + key}>{item.title}</NavLink>)}</nav>
      <article className="info-article"><span className="section-kicker">{topic.kicker}</span><h1>{topic.title}</h1><p className="info-intro">{topic.intro}</p><ul>{topic.points.map(point => <li key={point}><CheckCircle2 size={18}/><span>{point}</span></li>)}</ul><p className="info-note">Contenido de referencia para el prototipo académico de AvisoSur.</p></article>
    </div>
  </div>;
}
