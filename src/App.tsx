import { useState, useCallback } from 'react';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import FuelTypeFilter from './components/FuelTypeFilter';
import StatsBar from './components/StatsBar';
import FuelList from './components/FuelList';
import MapView from './components/MapView';
import PriceChart from './components/PriceChart';
import InstallPrompt from './components/InstallPrompt';
import {
  fetchAllPrices,
  fetchPricesByLocation,
  fetchPricesNearby,
  mergeStationsWithPrices,
  FUEL_TYPES,
  type FuelType,
  type StationWithPrice,
} from './api/fuel';

type ViewMode = 'list' | 'map';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFuel, setSelectedFuel] = useState<FuelType>('E10');
  const [stations, setStations] = useState<StationWithPrice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [visibleCount, setVisibleCount] = useState(20);
  const [hasSearched, setHasSearched] = useState(false);
  const [litres, setLitres] = useState<number>(0);

  const fuelLabel = FUEL_TYPES.find((f) => f.value === selectedFuel)?.label || selectedFuel;

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setError(null);
    setVisibleCount(20);
    setHasSearched(true);

    try {
      const data = await fetchPricesByLocation(searchQuery.trim(), selectedFuel);
      const merged = mergeStationsWithPrices(
        data.stations,
        data.prices,
        selectedFuel
      );
      setStations(merged);
      if (merged.length === 0) {
        setError(`No ${fuelLabel} prices found for "${searchQuery}". Try a different suburb or fuel type.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch fuel prices');
      setStations([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedFuel, fuelLabel]);

  const handleUseLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    setError(null);
    setVisibleCount(20);
    setHasSearched(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const data = await fetchPricesNearby(
            position.coords.latitude,
            position.coords.longitude,
            10,
            selectedFuel
          );
          const merged = mergeStationsWithPrices(
            data.stations,
            data.prices,
            selectedFuel
          );
          setStations(merged);
          setSearchQuery('📍 My Location');
          if (merged.length === 0) {
            setError(`No ${fuelLabel} stations found nearby. Try increasing the search area.`);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch nearby prices');
          setStations([]);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setError(`Location error: ${err.message}`);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [selectedFuel, fuelLabel]);

  const handleFuelTypeChange = useCallback(
    (fuelType: FuelType) => {
      setSelectedFuel(fuelType);
      // Re-fetch if we already have a search
      if (hasSearched && searchQuery.trim() && searchQuery !== '📍 My Location') {
        setTimeout(async () => {
          setIsLoading(true);
          setError(null);
          try {
            const data = await fetchPricesByLocation(searchQuery.trim(), fuelType);
            const merged = mergeStationsWithPrices(data.stations, data.prices, fuelType);
            setStations(merged);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch prices');
          } finally {
            setIsLoading(false);
          }
        }, 0);
      }
    },
    [hasSearched, searchQuery]
  );

  const handleLoadAllPrices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setVisibleCount(20);
    setHasSearched(true);
    setSearchQuery('');

    try {
      const data = await fetchAllPrices();
      const merged = mergeStationsWithPrices(data.stations, data.prices, selectedFuel);
      setStations(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch all prices');
      setStations([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFuel]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="space-y-6">
          {/* Search */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <SearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSearch={handleSearch}
              onUseLocation={handleUseLocation}
              isLoading={isLoading}
              isLocating={isLocating}
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <FuelTypeFilter selected={selectedFuel} onChange={handleFuelTypeChange} />
              <button
                onClick={handleLoadAllPrices}
                disabled={isLoading}
                className="text-sm font-medium text-nsw-blue hover:underline disabled:opacity-50"
              >
                Browse all NSW stations
              </button>
            </div>
          </div>

          {/* Price History Chart */}
          <PriceChart selectedFuel={selectedFuel} />

          {/* Trip Calculator */}
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Trip Calculator:</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="200"
                  step="5"
                  value={litres || ''}
                  onChange={(e) => setLitres(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="Litres"
                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nsw-blue focus:outline-none focus:ring-2 focus:ring-nsw-blue/20"
                />
                <span className="text-sm text-gray-500">litres</span>
              </div>
              {litres > 0 && stations.length > 0 && (
                <span className="text-sm text-gray-500">
                  Cheapest fill: <span className="font-semibold text-green-700">${((stations[0]?.price * litres) / 100).toFixed(2)}</span>
                  {stations.length > 1 && (
                    <> — save up to <span className="font-semibold text-green-700">
                      ${(((stations[stations.length - 1]?.price - stations[0]?.price) * litres) / 100).toFixed(2)}
                    </span> vs most expensive</>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Stats */}
          {stations.length > 0 && (
            <StatsBar stations={stations} fuelTypeLabel={fuelLabel} />
          )}

          {/* View Toggle */}
          {stations.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-nsw-blue text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                List View
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'map'
                    ? 'bg-nsw-blue text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Map View
              </button>
            </div>
          )}

          {/* Content */}
          {viewMode === 'list' ? (
            <FuelList
              stations={stations}
              visibleCount={visibleCount}
              onShowMore={() => setVisibleCount((c) => c + 20)}
              litres={litres}
            />
          ) : (
            <MapView stations={stations} />
          )}

          {/* Welcome message when no search */}
          {!hasSearched && (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm border border-gray-100">
              <div className="mx-auto max-w-md">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-nsw-lightblue">
                  <span className="text-3xl">⛽</span>
                </div>
                <h2 className="mt-4 text-xl font-bold text-gray-900">
                  Find the cheapest fuel in NSW
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  Search by suburb or postcode, or use your location to find the cheapest fuel prices
                  at over 3,200 service stations across New South Wales.
                </p>
                <p className="mt-4 text-xs text-gray-400">
                  Powered by NSW Government Fuel Check API · Prices updated in real-time
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="mt-12 border-t border-gray-200 bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-gray-400">
          <p>
            Data sourced from the{' '}
            <a
              href="https://api.nsw.gov.au"
              target="_blank"
              rel="noopener noreferrer"
              className="text-nsw-blue hover:underline"
            >
              NSW Government Fuel API
            </a>
            . Prices are indicative and may not reflect current prices at the pump.
          </p>
        </div>
      </footer>

      <InstallPrompt />
    </div>
  );
}
