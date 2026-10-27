import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Hand, Layers3, List, Pause, Play } from 'lucide-react';
import type { Listing } from '../types';
import { price } from '../services/api';
import { ListingCardContent } from './ProductCard';
import { balancedListings } from './balancedListings';
import './OrbitGallery.css';

type PointerGesture = { id: number; x: number; y: number; lastX: number; startAngle: number; dragging: boolean; scrolling: boolean };
type Motion = { angle: number; target: number | null; hovered: boolean; focused: boolean; visible: boolean; holdUntil: number; pointer: PointerGesture | null };
type Props = { listings: Listing[]; paused: boolean; onSelect: (id: number) => void; compact?: boolean; balanceCategories?: boolean };
const wrap = (value: number, length: number) => ((value % length) + length) % length;

/** A circular trajectory in three dimensions; cards face the reader throughout the turn. */
export function OrbitGallery({ listings, paused, onSelect, compact = false, balanceCategories = true }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const drawRef = useRef<() => void>(() => {});
  const suppressClickUntil = useRef(0);
  const motion = useRef<Motion>({ angle: 0, target: null, hovered: false, focused: false, visible: true, holdUntil: 0, pointer: null });
  const [width, setWidth] = useState(900);
  const [group, setGroup] = useState(0);
  const [view, setView] = useState<'bubble' | 'simple'>('bubble');
  // null follows the initial desktop/mobile choice. An explicit pause survives other interactions.
  const [rotationChoice, setRotationChoice] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [phone, setPhone] = useState(() => matchMedia('(max-width: 600px)').matches);
  const [front, setFront] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  const narrow = width < 560;
  const perGroup = compact || narrow ? 3 : 6;
  const presentation = useMemo(() => view === 'bubble' && balanceCategories ? balancedListings(listings) : listings, [listings, view, balanceCategories]);
  const groups = Math.max(1, Math.ceil(presentation.length / perGroup));
  const currentGroup = Math.min(group, groups - 1);
  const first = currentGroup * perGroup;
  const visible = presentation.slice(first, first + perGroup);
  const visibleIds = visible.map(item => item.id).join(',');
  const listingIds = listings.map(item => item.id).join(',');
  const count = visible.length;
  const step = count > 0 ? 360 / count : 360;
  const autoEnabled = !reducedMotion && (rotationChoice ?? !phone);
  const cardWidth = narrow ? Math.min(268, width * .76) : compact ? 218 : Math.min(264, Math.max(228, width * .29));
  const stageHeight = narrow ? 390 : compact ? 458 : 550;

  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReducedMotion(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const query = matchMedia('(max-width: 600px)');
    const change = () => setPhone(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const resize = new ResizeObserver(entries => setWidth(Math.round(entries[0].contentRect.width)));
    resize.observe(root);
    const intersection = new IntersectionObserver(entries => { motion.current.visible = entries[0].isIntersecting; }, { rootMargin: '100px' });
    intersection.observe(root);
    return () => { resize.disconnect(); intersection.disconnect(); };
  }, [Boolean(count)]);
  useEffect(() => { setGroup(0); }, [listingIds, perGroup, view, balanceCategories]);
  useLayoutEffect(() => {
    motion.current.angle = 0; motion.current.target = null;
    cardsRef.current.length = count;
    setFront(0);
  }, [visibleIds, count]);

  useLayoutEffect(() => {
    const state = motion.current;
    // Horizontal circles tilt gently upward at the back. translateZ changes actual
    // perspective; scale also keeps the foremost card comfortably readable.
    const radiusX = narrow ? width * .42 : Math.max(70, (width - cardWidth) / 2 - 26);
    const radiusY = narrow ? 8 : compact ? 48 : 80;
    const radiusZ = narrow ? 38 : 96;
    const draw = () => {
      if (view !== 'bubble') return;
      let closest = 0;
      let greatestDepth = -Infinity;
      cardsRef.current.forEach((card, index) => {
        if (!card) return;
        const degrees = wrap(state.angle + index * step, 360);
        const radians = degrees * Math.PI / 180;
        const depth = count === 1 ? 1 : Math.cos(radians);
        const x = count === 1 ? 0 : Math.sin(radians) * radiusX;
        const y = count === 1 ? 0 : depth * radiusY;
        const scale = narrow ? .79 + (depth + 1) * .105 : .72 + (depth + 1) * .105;
        card.style.transform = `translate3d(-50%, -50%, 0) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${(depth * radiusZ).toFixed(2)}px) scale(${scale.toFixed(4)})`;
        card.style.zIndex = String(100 + Math.round(depth * 50));
        card.style.opacity = '1';
        card.dataset.angle = degrees.toFixed(2);
        card.dataset.depth = depth.toFixed(4);
        if (depth > greatestDepth) { greatestDepth = depth; closest = index; }
      });
      cardsRef.current.forEach((card, index) => { if (card) card.dataset.front = String(index === closest); });
      // React is updated only when the foremost item changes, never on each frame.
      setFront(previous => previous === closest ? previous : closest);
    };
    drawRef.current = draw;
    draw();
    if (view !== 'bubble') return;
    let frameId = 0;
    let previous = performance.now();
    const frame = (now: number) => {
      const delta = Math.min(48, now - previous); previous = now;
      const isVisible = document.visibilityState === 'visible' && state.visible;
      const canRotate = isVisible && autoEnabled && !paused && !state.hovered && !state.focused && !state.pointer && now > state.holdUntil && count > 1;
      let changed = false;
      if (state.target !== null && !paused) {
        const remaining = state.target - state.angle;
        state.angle = reducedMotion || Math.abs(remaining) < .05 ? state.target : state.angle + remaining * (1 - Math.exp(-delta / 135));
        if (Math.abs(state.target - state.angle) < .05) { state.angle = state.target; state.target = null; }
        changed = true;
      } else if (canRotate) { state.angle -= delta * .0072; changed = true; }
      if (sceneRef.current) sceneRef.current.dataset.moving = String(canRotate || state.target !== null);
      if (changed) draw();
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [visibleIds, count, width, cardWidth, narrow, compact, view, step, reducedMotion, paused, autoEnabled]);

  function turn(direction: -1 | 1) {
    if (count < 2) return;
    const state = motion.current;
    const aligned = Math.round((state.target ?? state.angle) / step) * step;
    state.target = aligned - direction * step;
    state.holdUntil = performance.now() + 5500;
    const index = wrap(Math.round(-state.target / step), count);
    setAnnouncement(`Anuncio ${index + 1} de ${count}: ${visible[index].titulo}`);
    if (reducedMotion) { state.angle = state.target; state.target = null; drawRef.current(); }
  }
  function changeGroup(direction: -1 | 1) {
    setGroup(value => wrap(value + direction, groups));
    motion.current.holdUntil = performance.now() + 5500;
    setAnnouncement('Mostrando otro grupo de anuncios.');
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (view !== 'bubble' || paused || (event.pointerType === 'mouse' && event.button !== 0)) return;
    motion.current.target = null;
    motion.current.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, startAngle: motion.current.angle, dragging: false, scrolling: false };
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = motion.current;
    const pointer = state.pointer;
    if (!pointer || pointer.id !== event.pointerId || pointer.scrolling) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!pointer.dragging) {
      if (Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx) * 1.15) { pointer.scrolling = true; return; }
      if (Math.abs(dx) < 9 || Math.abs(dx) <= Math.abs(dy)) return;
      pointer.dragging = true;
      sceneRef.current?.setPointerCapture(event.pointerId);
      sceneRef.current?.classList.add('bubble-dragging');
    }
    state.angle += (event.clientX - pointer.lastX) * (narrow ? .5 : .28);
    pointer.lastX = event.clientX;
    drawRef.current();
    if (event.cancelable) event.preventDefault();
  }
  function pointerEnd(event: PointerEvent<HTMLDivElement>) {
    const state = motion.current;
    const pointer = state.pointer;
    if (!pointer || pointer.id !== event.pointerId) return;
    if (pointer.dragging) {
      suppressClickUntil.current = performance.now() + 350;
      const travel = event.clientX - pointer.x;
      const nearest = Math.round(state.angle / step) * step;
      // A modest phone swipe reliably advances one card, even below half a turn.
      state.target = narrow && Math.abs(travel) > 30
        ? Math.round(pointer.startAngle / step) * step + (travel < 0 ? -step : step) : nearest;
      if (reducedMotion) { state.angle = state.target; state.target = null; drawRef.current(); }
      if (sceneRef.current?.hasPointerCapture(event.pointerId)) sceneRef.current.releasePointerCapture(event.pointerId);
    }
    state.pointer = null;
    state.holdUntil = performance.now() + 5500;
    sceneRef.current?.classList.remove('bubble-dragging');
  }
  function preventDraggedClick(event: MouseEvent<HTMLDivElement>) {
    if (performance.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); }
  }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (view !== 'bubble') return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); turn(event.key === 'ArrowLeft' ? -1 : 1); }
  }

  if (!count) return <div className="bubble-empty" role="status">Preparando los anuncios de tu comunidad…</div>;

  return <section ref={rootRef} className="bubble-gallery" data-view={view} data-compact={compact} data-group={currentGroup + 1} data-groups={groups} data-auto={autoEnabled} aria-label="Burbuja interactiva de anuncios"
    onPointerEnter={event => { if (event.pointerType === 'mouse') motion.current.hovered = true; }}
    onPointerLeave={event => { if (event.pointerType === 'mouse') motion.current.hovered = false; }}
    onFocusCapture={event => { const target = event.target; motion.current.focused = target instanceof HTMLElement && (target.matches(':focus-visible') || Boolean(target.closest('.bubble-stage'))); }}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) motion.current.focused = false; }}>
    <header className="bubble-heading"><div><span className="bubble-label"><Layers3 size={17}/>{compact ? 'DESCUBRE EL SUR' : 'ANUNCIOS EN MOVIMIENTO'}</span><p>{view === 'bubble' ? 'Gira, elige y descubre cada detalle.' : 'Todos los detalles, a tu ritmo.'}</p></div><div className="bubble-view-switch" aria-label="Presentación de anuncios"><button type="button" data-action="bubble-view" aria-pressed={view === 'bubble'} onClick={() => setView('bubble')}><Layers3 size={16}/><span>Burbuja</span></button><button type="button" data-action="simple-view" aria-pressed={view === 'simple'} onClick={() => setView('simple')}><List size={17}/><span>{compact ? 'Sencilla' : 'Vista sencilla'}</span></button></div></header>
    <div ref={sceneRef} className="bubble-stage" data-moving="false" style={{ '--bubble-card-width': cardWidth + 'px', '--bubble-stage-height': stageHeight + 'px' } as CSSProperties}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
      onClickCapture={preventDraggedClick} onDragStart={event => event.preventDefault()} onKeyDown={keyboard}>
      {view === 'bubble' && <div className="bubble-glass" aria-hidden="true"><span className="bubble-glass-shine"/></div>}
      {visible.map((listing, index) => <button ref={element => { cardsRef.current[index] = element; }} key={listing.id} type="button" className="bubble-card" data-listing-id={listing.id} data-category={listing.categoriaId}
        onClick={() => onSelect(listing.id)} aria-label={`Ver anuncio: ${listing.titulo}, ${price(listing.precio)}, ${listing.zona}`}><ListingCardContent listing={listing} eager/><span className="bubble-card-open">Ver detalles <ArrowUpRight size={16}/></span></button>)}
    </div>
    {view === 'bubble' && <div className="bubble-navigation" aria-label="Girar los anuncios"><button type="button" data-action="previous" onClick={() => turn(-1)} disabled={count < 2}><ChevronLeft size={19}/><span>Anterior</span></button><button type="button" data-action="motion" className="bubble-motion" onClick={event => { if (event.detail > 0) motion.current.focused = false; setRotationChoice(!autoEnabled); }} aria-pressed={!autoEnabled} disabled={reducedMotion} title={reducedMotion ? 'Movimiento reducido activado. Usa Anterior y Siguiente.' : undefined}>{autoEnabled ? <Pause size={17}/> : <Play size={17}/>}<span>{autoEnabled ? 'Pausar' : 'Girar'}</span></button><button type="button" data-action="next" onClick={() => turn(1)} disabled={count < 2}><span>Siguiente</span><ChevronRight size={19}/></button></div>}
    <footer className="bubble-footer"><span className="bubble-instruction"><Hand size={16}/>{reducedMotion ? 'Sin giro automático. Usa las flechas.' : narrow ? 'Desliza o toca un anuncio para abrirlo.' : 'Arrastra para girar. Toca un anuncio para abrirlo.'}</span><div className="bubble-groups"><span>{first + 1}–{Math.min(first + perGroup, presentation.length)} de {presentation.length}</span>{groups > 1 && <><button type="button" data-action="previous-group" aria-label="Grupo anterior de anuncios" onClick={() => changeGroup(-1)}><ChevronLeft size={18}/></button><button type="button" data-action="next-group" onClick={() => changeGroup(1)}>Más anuncios <ChevronRight size={17}/></button></>}</div></footer>
    {view === 'bubble' && <span className="bubble-current">{front + 1} de {count} en esta burbuja</span>}
    <span className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
  </section>;
}
