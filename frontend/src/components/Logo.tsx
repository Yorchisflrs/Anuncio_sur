import { Link } from 'react-router-dom';

export function Logo({ light = false, className = '' }: { light?: boolean; className?: string }) {
  return <Link to="/" className={'logo' + (light ? ' logo-light' : '') + (className ? ' ' + className : '')} aria-label="AvisoSur, inicio"><img src={light ? '/logo-avisosur-blanco.png' : '/logo-avisosur.jpg'} alt="Logo AS con megáfono" width="58" height="43"/><span>Aviso<span className="logo-accent">Sur</span><span className="logo-dot">.</span></span></Link>;
}
