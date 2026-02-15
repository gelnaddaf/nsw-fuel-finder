import { MapPin, Clock, Building2, Navigation2 } from 'lucide-react';
import type { StationWithPrice } from '../api/fuel';
import { getPriceCategory } from '../api/fuel';

interface FuelCardProps {
  station: StationWithPrice;
  rank: number;
  allPrices: number[];
  litres?: number;
}

export default function FuelCard({ station, rank, allPrices, litres }: FuelCardProps) {
  const category = getPriceCategory(station.price, allPrices);

  const priceClass = {
    cheap: 'price-badge price-cheap',
    mid: 'price-badge price-mid',
    expensive: 'price-badge price-expensive',
  }[category];

  const rankBadge = rank <= 3 ? (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
      #{rank}
    </span>
  ) : (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-500">
      #{rank}
    </span>
  );

  const formattedTime = (() => {
    if (!station.lastupdated) return 'Unknown';
    // API format: "DD/MM/YYYY HH:MM:SS" — convert to ISO for reliable parsing
    const parts = station.lastupdated.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (!parts) return station.lastupdated;
    const [, dd, mm, yyyy, hh, min, ss] = parts;
    const date = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`);
    if (isNaN(date.getTime())) return station.lastupdated;
    return date.toLocaleString('en-AU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  })();

  return (
    <div className="fuel-card flex items-start gap-4">
      <div className="flex flex-col items-center gap-1 pt-1">
        {rankBadge}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-gray-900">
              {station.name}
            </h3>
            <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
              <Building2 className="h-3 w-3 flex-shrink-0" />
              <span>{station.brand}</span>
            </div>
          </div>
          <div className={priceClass}>
            {station.price.toFixed(1)}¢
          </div>
        </div>
        {litres && litres > 0 && (
          <div className="mt-2 rounded-lg bg-nsw-lightblue px-3 py-1.5 text-sm font-semibold text-nsw-blue">
            {litres}L = ${((station.price * litres) / 100).toFixed(2)}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{station.address}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span>{formattedTime}</span>
          </div>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${station.location.latitude},${station.location.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md bg-nsw-blue/10 px-2 py-0.5 text-nsw-blue transition-colors hover:bg-nsw-blue/20"
          >
            <Navigation2 className="h-3 w-3" />
            <span>Directions</span>
          </a>
        </div>
      </div>
    </div>
  );
}
