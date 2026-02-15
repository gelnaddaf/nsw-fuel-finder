import { TrendingDown, TrendingUp, BarChart3, Fuel } from 'lucide-react';
import type { StationWithPrice } from '../api/fuel';

interface StatsBarProps {
  stations: StationWithPrice[];
  fuelTypeLabel: string;
}

export default function StatsBar({ stations, fuelTypeLabel }: StatsBarProps) {
  if (stations.length === 0) return null;

  const prices = stations.map((s) => s.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 text-green-600">
          <TrendingDown className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Cheapest</span>
        </div>
        <p className="mt-1 text-2xl font-bold text-gray-900">{min.toFixed(1)}¢</p>
        <p className="text-xs text-gray-500">{fuelTypeLabel}</p>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 text-amber-600">
          <BarChart3 className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Average</span>
        </div>
        <p className="mt-1 text-2xl font-bold text-gray-900">{avg.toFixed(1)}¢</p>
        <p className="text-xs text-gray-500">{fuelTypeLabel}</p>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 text-red-600">
          <TrendingUp className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Most Expensive</span>
        </div>
        <p className="mt-1 text-2xl font-bold text-gray-900">{max.toFixed(1)}¢</p>
        <p className="text-xs text-gray-500">{fuelTypeLabel}</p>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 text-blue-600">
          <Fuel className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Stations</span>
        </div>
        <p className="mt-1 text-2xl font-bold text-gray-900">{stations.length}</p>
        <p className="text-xs text-gray-500">with {fuelTypeLabel}</p>
      </div>
    </div>
  );
}
