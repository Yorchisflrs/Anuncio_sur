import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import { EmptyState } from './components/States';
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { DetailPage } from './pages/DetailPage';
import { AuthPage } from './pages/AuthPage';
import { PublishPage } from './pages/PublishPage';
import { ProfilePage } from './pages/ProfilePage';
import { CategoriesPage } from './pages/CategoriesPage';
import { InfoPage } from './pages/InfoPage';
import { INFO_TOPICS } from './data/directory';
import { AdminPage } from './pages/AdminPage';
import { PaymentPage } from './pages/PaymentPage';

export function App() {
  const { pathname } = useLocation();
  useEffect(() => { const title = pathname === '/' ? 'Motos, cuartos y electrodomésticos en Puno y Juliaca' : pathname === '/anuncios' ? 'Avisos publicados' : pathname === '/categorias' ? 'Categorías' : pathname.startsWith('/ayuda/') ? INFO_TOPICS[pathname.slice(7)]?.title || 'Ayuda' : pathname === '/admin' ? 'Administración' : /^\/mis-anuncios\/\d+\/pago$/.test(pathname) ? 'Pago y revisión' : pathname === '/publicar' ? 'Publicar anuncio' : pathname === '/perfil' ? 'Mi perfil' : pathname === '/registro' ? 'Crear cuenta' : pathname === '/login' ? 'Iniciar sesión' : 'Detalle del anuncio'; document.title = title + ' · AvisoSur'; }, [pathname]);
  return <Routes><Route element={<Layout/>}><Route index element={<HomePage/>}/><Route path="anuncios" element={<ExplorePage/>}/><Route path="categorias" element={<CategoriesPage/>}/><Route path="ayuda/:tema" element={<InfoPage/>}/><Route path="anuncios/:id" element={<DetailPage/>}/><Route path="registro" element={<AuthPage mode="register"/>}/><Route path="login" element={<AuthPage mode="login"/>}/><Route element={<ProtectedRoute/>}><Route path="publicar" element={<PublishPage/>}/><Route path="perfil" element={<ProfilePage/>}/><Route path="mis-anuncios/:id/pago" element={<PaymentPage/>}/><Route element={<AdminRoute/>}><Route path="admin" element={<AdminPage/>}/></Route></Route><Route path="*" element={<EmptyState title="Esta página no existe" action={<Link className="button button-primary" to="/">Volver al inicio</Link>}>Vuelve al inicio o revisa los avisos publicados.</EmptyState>}/></Route></Routes>;
}
