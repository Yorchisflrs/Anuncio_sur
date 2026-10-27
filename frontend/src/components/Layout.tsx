import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowUpRight, MapPin, Menu, X, UserRound, FlaskConical, Handshake, Plus, LogIn, House, Compass, LayoutGrid } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import '../site-landscape.css';

const NAV_ITEMS = [
  { to: '/', label: 'Inicio', icon: House, end: true },
  { to: '/anuncios', label: 'Explorar anuncios', icon: Compass },
  { to: '/categorias', label: 'Categorías', icon: LayoutGrid },
];

export function Layout() {
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const { user, error } = useAuth();
  const userName = user ? (user.demo ? 'Cuenta demo' : user.correo.split('@')[0]) : '';
  useEffect(() => {
    setMenu(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return <div className="site-shell">
    <div className="site-landscape" aria-hidden="true"><img src="/images/avisosur-titicaca-hero.webp" alt="" width={1672} height={941} fetchPriority="high"/></div>
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <div className="topbar"><div className="container topbar-inner">
      <span><MapPin size={13}/>Hecho para Puno y el sur del Perú</span>
      <span className="topbar-right"><Handshake size={14}/>Personas cerca. Trato directo.</span>
    </div></div>
    <header className="site-header">
      <div className="container nav-inner">
        <Logo/>
        <nav className="desktop-nav" aria-label="Navegación principal">
          {NAV_ITEMS.map(({ icon: Icon, ...item }) => <NavLink key={item.to} to={item.to} end={item.end}><Icon size={17} aria-hidden="true"/>{item.label}</NavLink>)}
        </nav>
        <div className="nav-actions">
          <Link className="nav-login" to={user ? '/perfil' : '/login'}><UserRound size={18}/>{user ? userName : 'Ingresar'}</Link>
          <Link className="button button-primary nav-publish" to="/publicar"><Plus size={18}/>Publicar anuncio</Link>
        </div>
        <button className="mobile-menu-button" aria-expanded={menu} aria-controls="mobile-nav" aria-label={menu ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenu(value => !value)}>{menu ? <X/> : <Menu/>}<span>{menu ? 'Cerrar' : 'Menú'}</span></button>
      </div>
      {menu && <nav id="mobile-nav" className="mobile-nav" aria-label="Navegación móvil">
        {NAV_ITEMS.map(({ icon: Icon, ...item }) => <NavLink key={item.to} to={item.to} end={item.end}><span className="mobile-nav-label"><Icon size={19} aria-hidden="true"/>{item.label}</span><ArrowUpRight size={16}/></NavLink>)}
        <NavLink to="/perfil">Mi cuenta<UserRound size={16}/></NavLink>
        <div className="mobile-nav-auth"><Link className="button button-outline" to={user ? '/perfil' : '/login'}><LogIn size={16}/>{user ? userName : 'Ingresar'}</Link><Link className="button button-primary" to="/publicar"><Plus size={17}/>Publicar anuncio</Link></div>
        {!user && <Link className="mobile-register" to="/registro">¿Nuevo por aquí? Crea tu cuenta gratis</Link>}
      </nav>}
    </header>
    {error && <div className="connection-banner" role="alert">{error}</div>}
    <main id="contenido"><Outlet/></main>
    <footer className="site-footer">
      <div className="container footer-lead"><h2>Una nueva oportunidad,<br/><span>más cerca de ti.</span></h2><Link to="/anuncios" className="footer-explore">Encuentra la tuya <ArrowUpRight size={27}/></Link></div>
      <div className="container footer-columns">
        <div className="footer-brand"><Logo light/><p>El punto de encuentro para comprar y vender en Puno, Juliaca y el sur del Perú.</p><span className="footer-region"><MapPin size={15}/>Comercio local, conexiones reales.</span></div>
        <div className="footer-links"><strong>Descubre</strong><Link to="/anuncios?categoriaId=1">Vehículos</Link><Link to="/anuncios?categoriaId=2">Inmuebles</Link><Link to="/anuncios?categoriaId=3">Electrodomésticos</Link><Link to="/categorias">Todas las categorías</Link></div>
        <div className="footer-links"><strong>Cerca de ti</strong><Link to="/anuncios?zona=Puno">Puno</Link><Link to="/anuncios?zona=Juliaca">Juliaca</Link><Link to={'/anuncios?zona=' + encodeURIComponent('Otras localidades del sur del Perú')}>Otras localidades del sur</Link><Link to="/publicar">Publica tu anuncio</Link></div>
        <div className="footer-links"><strong>Estamos para orientarte</strong><Link to="/ayuda/seguridad">Consejos para comprar y vender</Link><Link to="/ayuda/terminos">Términos de publicación</Link><Link to="/ayuda/privacidad">Privacidad</Link><Link to="/ayuda/soporte">Ayuda y soporte</Link><Link to="/ayuda/reclamaciones">Reclamaciones · Prototipo</Link></div>
      </div>
      <div className="container footer-bottom"><span>© {new Date().getFullYear()} AvisoSur · UNA Puno</span><span className="footer-demo"><FlaskConical size={14}/>Prototipo académico. Los anuncios DEMO son ficticios.</span></div>
    </footer>
  </div>;
}
