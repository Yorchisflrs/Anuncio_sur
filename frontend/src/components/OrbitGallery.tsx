import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Hand, Layers3, List, Pause, Play } from 'lucide-react';
import type { Listing } from '../types';
import { price } from '../services/api';
import { ListingCardContent } from './ProductCard';
import { balancedListings } from './balancedListings';
import './OrbitGallery.css';

/** One card drifting freely: position from the stage centre, a heading that wanders and a breathing depth. */
type Floater = { x: number; y: number; heading: number; turn: number; speed: number; phase: number; pulse: number; scale: number };
type Motion = { floaters: Floater[]; seededFor: string; hovered: number; visible: boolean; front: number };
type Props = { listings: Listing[]; paused: boolean; onSelect: (id: number) => void; compact?: boolean; balanceCategories?: boolean };
const wrap = (value: number, length: number) => ((value % length) + length) % length;
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
const angleDiff = (to: number, from: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/** Cards float without a fixed path anywhere inside the stage; hovering a card only slows it so it can be clicked. */
export function OrbitGallery({ listings, paused, onSelect, compact = false, balanceCategories = true }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const drawRef = useRef<() => void>(() => {});
  const motion = useRef<Motion>({ floaters: [], seededFor: '', hovered: -1, visible: true, front: 0 });
  const [width, setWidth] = useState(900);
  const [group, setGroup] = useState(0);
  const [view, setView] = useState<'bubble' | 'simple'>('bubble');
  // null keeps the default (moving). An explicit pause survives other interactions.
  const [motionChoice, setMotionChoice] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
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
  const autoEnabled = !reducedMotion && (motionChoice ?? true);
  const cardWidth = narrow ? Math.min(230, width * .62) : compact ? 214 : Math.min(250, Math.max(220, width * .25));
  const stageHeight = narrow ? 430 : compact ? 470 : 580;

  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReducedMotion(query.matches);
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
    cardsRef.current.length = count;
    motion.current.front = 0;
    motion.current.hovered = -1;
    setFront(0);
  }, [visibleIds, count]);

  useLayoutEffect(() => {
    const state = motion.current;
    const stage = sceneRef.current;
    if (view !== 'bubble' || !stage) return;
    const baseScale = narrow ? .76 : compact ? .78 : .86;
    const frontScale = narrow ? .88 : compact ? .9 : 1;
    // How far a card centre may travel from the stage centre without leaving the stage.
    const limits = (index: number, scale: number) => {
      const card = cardsRef.current[index];
      const halfW = (card?.offsetWidth ?? cardWidth) * scale / 2;
      const halfH = (card?.offsetHeight ?? 300) * scale / 2;
      return { x: Math.max(0, stage.clientWidth / 2 - halfW - 10), y: Math.max(0, stage.clientHeight / 2 - halfH - 10) };
    };

    // New group of cards: spread them over a loose grid so they start apart.
    if (state.seededFor !== visibleIds || state.floaters.length !== count) {
      const columns = Math.max(1, Math.round(Math.sqrt(count * stage.clientWidth / Math.max(1, stage.clientHeight))));
      const rows = Math.ceil(count / columns);
      state.floaters = visible.map((_, index) => {
        const { x: limitX, y: limitY } = limits(index, baseScale);
        const column = index % columns;
        const row = Math.floor(index / columns);
        return {
          x: columns > 1 ? -limitX + (2 * limitX) * (column / (columns - 1)) * .9 + limitX * .05 : 0,
          y: rows > 1 ? -limitY + (2 * limitY) * (row / (rows - 1)) : (Math.random() - .5) * limitY,
          heading: Math.random() * Math.PI * 2,
          turn: 0,
          speed: (narrow ? 16 : 24) + Math.random() * 14,
          phase: Math.random() * Math.PI * 2,
          pulse: .35 + Math.random() * .4,
          scale: baseScale,
        };
      });
      state.seededFor = visibleIds;
    }

    const draw = () => {
      cardsRef.current.forEach((card, index) => {
        const floater = state.floaters[index];
        if (!card || !floater) return;
        const { x: limitX, y: limitY } = limits(index, floater.scale);
        floater.x = clamp(floater.x, limitX);
        floater.y = clamp(floater.y, limitY);
        card.style.transform = `translate3d(-50%, -50%, 0) translate3d(${floater.x.toFixed(2)}px, ${floater.y.toFixed(2)}px, 0) scale(${floater.scale.toFixed(4)})`;
        card.style.zIndex = String(index === state.front ? 400 : 100 + Math.round(floater.scale * 100));
        card.style.opacity = '1';
        card.dataset.front = String(index === state.front);
      });
    };
    drawRef.current = draw;
    draw();

    let frameId = 0;
    let previous = performance.now();
    const frame = (now: number) => {
      const seconds = Math.min(48, now - previous) / 1000; previous = now;
      const isVisible = document.visibilityState === 'visible' && state.visible;
      if (isVisible) {
        const moving = autoEnabled && !paused;
        state.floaters.forEach((floater, index) => {
          // Depth breathes slowly; the highlighted card stays in front and larger.
          const breathing = moving ? Math.sin(now / 1000 * floater.pulse + floater.phase) * .045 : 0;
          const target = (index === state.front ? frontScale : baseScale) + breathing;
          floater.scale += (target - floater.scale) * (1 - Math.exp(-seconds * 5));
          if (!moving) return;
          // The turning rate itself wanders at random, so the path never repeats.
          floater.turn += (Math.random() - .5) * 3.2 * seconds;
          floater.turn = Math.max(-1.1, Math.min(1.1, floater.turn * (1 - .5 * seconds)));
          floater.heading += floater.turn * seconds;
          const { x: limitX, y: limitY } = limits(index, floater.scale);
          // Near an edge, steer gently back towards the open space.
          const nearEdge = Math.max(limitX ? Math.abs(floater.x) / limitX : 1, limitY ? Math.abs(floater.y) / limitY : 1);
          if (nearEdge > .8) floater.heading += angleDiff(Math.atan2(-floater.y, -floater.x), floater.heading) * Math.min(1, (nearEdge - .8) * 6 * seconds);
          const speed = floater.speed * (index === state.hovered ? .2 : 1);
          floater.x += Math.cos(floater.heading) * speed * seconds;
          floater.y += Math.sin(floater.heading) * speed * seconds;
          if (Math.abs(floater.x) > limitX) { floater.x = clamp(floater.x, limitX); floater.heading = Math.PI - floater.heading; }
          if (Math.abs(floater.y) > limitY) { floater.y = clamp(floater.y, limitY); floater.heading = -floater.heading; }
        });
        // Soft separation keeps cards from piling up: overlapping boxes drift apart
        // along the axis where they overlap least, allowing only a light touch.
        if (moving) {
          for (let a = 0; a < state.floaters.length; a++) for (let b = a + 1; b < state.floaters.length; b++) {
            const one = state.floaters[a]; const two = state.floaters[b];
            const cardA = cardsRef.current[a]; const cardB = cardsRef.current[b];
            if (!cardA || !cardB) continue;
            const dx = two.x - one.x; const dy = two.y - one.y;
            const overlapX = (cardA.offsetWidth * one.scale + cardB.offsetWidth * two.scale) / 2 * .8 - Math.abs(dx);
            const overlapY = (cardA.offsetHeight * one.scale + cardB.offsetHeight * two.scale) / 2 * .8 - Math.abs(dy);
            if (overlapX <= 0 || overlapY <= 0) continue;
            const push = Math.min(overlapX, overlapY) * 2.5 * seconds;
            if (overlapX < overlapY) { const side = Math.sign(dx) || 1; one.x -= side * push; two.x += side * push; }
            else { const side = Math.sign(dy) || 1; one.y -= side * push; two.y += side * push; }
          }
        }
        draw();
      }
      if (sceneRef.current) sceneRef.current.dataset.moving = String(isVisible && autoEnabled && !paused);
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [visibleIds, count, width, cardWidth, narrow, compact, view, paused, autoEnabled]);

  /** Anterior / Siguiente bring another card to the front of the floating group. */
  function highlight(direction: -1 | 1) {
    if (count < 2) return;
    const index = wrap(motion.current.front + direction, count);
    motion.current.front = index;
    setFront(index);
    setAnnouncement(`Anuncio ${index + 1} de ${count}: ${visible[index].titulo}`);
    drawRef.current();
  }
  function changeGroup(direction: -1 | 1) {
    setGroup(value => wrap(value + direction, groups));
    setAnnouncement('Mostrando otro grupo de anuncios.');
  }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (view !== 'bubble') return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); highlight(event.key === 'ArrowLeft' ? -1 : 1); }
  }

  if (!count) return <div className="bubble-empty" role="status">Preparando los anuncios de tu comunidad…</div>;

  return <section ref={rootRef} className="bubble-gallery" data-view={view} data-compact={compact} data-group={currentGroup + 1} data-groups={groups} data-auto={autoEnabled} aria-label="Anuncios flotantes">
    <header className="bubble-heading"><div><span className="bubble-label"><Layers3 size={17}/>{compact ? 'DESCUBRE EL SUR' : 'ANUNCIOS EN MOVIMIENTO'}</span><p>{view === 'bubble' ? 'Elige y descubre cada detalle.' : 'Todos los detalles, a tu ritmo.'}</p></div><div className="bubble-view-switch" aria-label="Presentación de anuncios"><button type="button" data-action="bubble-view" aria-pressed={view === 'bubble'} onClick={() => setView('bubble')}><Layers3 size={16}/><span>Flotante</span></button><button type="button" data-action="simple-view" aria-pressed={view === 'simple'} onClick={() => setView('simple')}><List size={17}/><span>{compact ? 'Lista' : 'Vista sencilla'}</span></button></div></header>
    <div ref={sceneRef} className="bubble-stage" data-moving="false" style={{ '--bubble-card-width': cardWidth + 'px', '--bubble-stage-height': stageHeight + 'px' } as CSSProperties} onKeyDown={keyboard}>
      {visible.map((listing, index) => <button ref={element => { cardsRef.current[index] = element; }} key={listing.id} type="button" className="bubble-card" data-listing-id={listing.id} data-category={listing.categoriaId}
        onPointerEnter={() => { motion.current.hovered = index; }} onPointerLeave={() => { if (motion.current.hovered === index) motion.current.hovered = -1; }}
        onClick={() => onSelect(listing.id)} aria-label={`Ver anuncio: ${listing.titulo}, ${price(listing.precio)}, ${listing.zona}`}><ListingCardContent listing={listing} eager/><span className="bubble-card-open">Ver detalles <ArrowUpRight size={16}/></span></button>)}
    </div>
    {view === 'bubble' && <div className="bubble-navigation" aria-label="Destacar anuncios"><button type="button" data-action="previous" onClick={() => highlight(-1)} disabled={count < 2}><ChevronLeft size={19}/><span>Anterior</span></button><button type="button" data-action="motion" className="bubble-motion" onClick={() => setMotionChoice(!autoEnabled)} aria-pressed={!autoEnabled} disabled={reducedMotion} title={reducedMotion ? 'Movimiento reducido activado. Usa Anterior y Siguiente.' : undefined}>{autoEnabled ? <Pause size={17}/> : <Play size={17}/>}<span>{autoEnabled ? 'Pausar' : 'Mover'}</span></button><button type="button" data-action="next" onClick={() => highlight(1)} disabled={count < 2}><span>Siguiente</span><ChevronRight size={19}/></button></div>}
    <footer className="bubble-footer"><span className="bubble-instruction"><Hand size={16}/>{reducedMotion ? 'Sin movimiento automático. Usa Anterior y Siguiente.' : 'Toca un anuncio para abrirlo.'}</span><div className="bubble-groups"><span>{first + 1}–{Math.min(first + perGroup, presentation.length)} de {presentation.length}</span>{groups > 1 && <><button type="button" data-action="previous-group" aria-label="Grupo anterior de anuncios" onClick={() => changeGroup(-1)}><ChevronLeft size={18}/></button><button type="button" data-action="next-group" onClick={() => changeGroup(1)}>Más anuncios <ChevronRight size={17}/></button></>}</div></footer>
    {view === 'bubble' && <span className="bubble-current">Destacado: {front + 1} de {count}</span>}
    <span className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
  </section>;
}
