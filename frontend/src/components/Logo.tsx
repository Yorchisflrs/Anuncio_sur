import { Link } from 'react-router-dom';

export function Logo({ light = false }: { light?: boolean }) {
  return <Link to="/" className={'logo' + (light ? ' logo-light' : '')} aria-label="AvisoSur, inicio"><img src="/logo-avisosur.jpg" alt="Logo AS con megáfono" width="58" height="43"/><span>Aviso<span className="logo-accent">Sur</span><span className="logo-dot">.</span></span></Link>;
}
