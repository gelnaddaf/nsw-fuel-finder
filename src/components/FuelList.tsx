import type { StationWithPrice } from '../api/fuel';
import FuelCard from './FuelCard';

interface FuelListProps {
  stations: StationWithPrice[];
  visibleCount: number;
  onShowMore: () => void;
  litres?: number;
}

export default function FuelList({ stations, visibleCount, onShowMore, litres }: FuelListProps) {
  const allPrices = stations.map((s) => s.price);
  const visible = stations.slice(0, visibleCount);

  if (stations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <p className="text-gray-500">No stations found. Try searching for a suburb or postcode.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((station, i) => (
        <FuelCard
          key={`${station.code}-${station.fueltype}`}
          station={station}
          rank={i + 1}
          allPrices={allPrices}
          litres={litres}
        />
      ))}
      {visibleCount < stations.length && (
        <button
          onClick={onShowMore}
          className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
        >
          Show more ({stations.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
}
