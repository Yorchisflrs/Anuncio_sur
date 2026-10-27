import { useCallback, useState } from 'react';
import { MapPin } from 'lucide-react';
import type { Listing } from '../types';
import { OrbitGallery } from './OrbitGallery';
import { ListingPreviewModal } from './ListingPreviewModal';

export function HeroShowcase({ listings, total }: { listings: Listing[]; total: number | null }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const closePreview = useCallback(() => setSelectedId(null), []);
  return <div className="hero-bubble-showcase">
    <OrbitGallery listings={listings} compact paused={selectedId !== null} onSelect={setSelectedId}/>
    <p className="hero-bubble-local"><MapPin size={16}/><span>{total === null ? 'Oportunidades de Puno y el sur' : `${total} anuncios para descubrir en el sur`}</span></p>
    {selectedId !== null && <ListingPreviewModal id={selectedId} onClose={closePreview}/>}
  </div>;
}
