import { useState, useEffect, useMemo } from 'react';
import { TrendingDown, TrendingUp, BarChart3 } from 'lucide-react';
import { fetchPriceHistory, FUEL_TYPES, type FuelType, type HistoryDataPoint } from '../api/fuel';

interface PriceChartProps {
  selectedFuel: FuelType;
}

export default function PriceChart({ selectedFuel }: PriceChartProps) {
  const [history, setHistory] = useState<HistoryDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const fuelLabel = FUEL_TYPES.find((f) => f.value === selectedFuel)?.label || selectedFuel;
  const fuelColor = FUEL_TYPES.find((f) => f.value === selectedFuel)?.color || '#3b82f6';

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetchPriceHistory(selectedFuel, days)
      .then((res) => setHistory(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [selectedFuel, days]);

  const stats = useMemo(() => {
    if (history.length === 0) return null;
    const latest = history[history.length - 1];
    const earliest = history[0];
    const trend = latest.avg_price - earliest.avg_price;
    const allAvg = history.reduce((s, d) => s + d.avg_price, 0) / history.length;
    return {
      latest: latest.avg_price,
      min: Math.min(...history.map((d) => d.min_price)),
      max: Math.max(...history.map((d) => d.max_price)),
      avg: Math.round(allAvg * 10) / 10,
      trend: Math.round(trend * 10) / 10,
    };
  }, [history]);

  // SVG chart dimensions
  const W = 600;
  const H = 200;
  const PAD = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const { path, areaPath, yTicks, xLabels } = useMemo(() => {
    if (history.length < 2) return { path: '', areaPath: '', yTicks: [] as number[], xLabels: [] as { x: number; label: string }[] };

    const prices = history.map((d) => d.avg_price);
    const yMin = Math.floor(Math.min(...history.map((d) => d.min_price)) / 5) * 5;
    const yMax = Math.ceil(Math.max(...history.map((d) => d.max_price)) / 5) * 5;
    const yRange = yMax - yMin || 10;

    const points = prices.map((p, i) => {
      const x = PAD.left + (i / (prices.length - 1)) * chartW;
      const y = PAD.top + (1 - (p - yMin) / yRange) * chartH;
      return { x, y };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const area = `${linePath} L ${points[points.length - 1].x} ${PAD.top + chartH} L ${points[0].x} ${PAD.top + chartH} Z`;

    // Y axis ticks (5 ticks)
    const tickCount = 5;
    const ticks = Array.from({ length: tickCount }, (_, i) => {
      const val = yMin + (i / (tickCount - 1)) * yRange;
      return Math.round(val * 10) / 10;
    });

    // X axis labels (show ~5 date labels)
    const step = Math.max(1, Math.floor(history.length / 5));
    const labels = history
      .filter((_, i) => i % step === 0 || i === history.length - 1)
      .map((d, _i, arr) => {
        const idx = history.indexOf(d);
        const x = PAD.left + (idx / (history.length - 1)) * chartW;
        const date = new Date(d.date);
        const label = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
        return { x, label };
      });

    return { path: linePath, areaPath: area, yTicks: ticks, xLabels: labels };
  }, [history, chartW, chartH]);

  const noData = !isLoading && history.length === 0 && !error;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-nsw-blue" />
          <h2 className="text-lg font-bold text-gray-900">
            {fuelLabel} Price Trend
          </h2>
        </div>
        <div className="flex gap-1">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                days === d
                  ? 'bg-nsw-blue text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <div className="text-xs text-gray-500">Latest Avg</div>
            <div className="text-lg font-bold text-gray-900">{stats.latest}¢</div>
          </div>
          <div className="rounded-xl bg-green-50 p-3 text-center">
            <div className="text-xs text-gray-500">Lowest</div>
            <div className="text-lg font-bold text-green-700">{stats.min}¢</div>
          </div>
          <div className="rounded-xl bg-red-50 p-3 text-center">
            <div className="text-xs text-gray-500">Highest</div>
            <div className="text-lg font-bold text-red-700">{stats.max}¢</div>
          </div>
          <div className={`rounded-xl p-3 text-center ${stats.trend <= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="text-xs text-gray-500">Trend</div>
            <div className={`flex items-center justify-center gap-1 text-lg font-bold ${stats.trend <= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {stats.trend <= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              {stats.trend > 0 ? '+' : ''}{stats.trend}¢
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {isLoading && (
        <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">
          Loading price history...
        </div>
      )}
      {error && (
        <div className="flex h-[200px] items-center justify-center text-sm text-red-500">
          {error}
        </div>
      )}
      {noData && (
        <div className="flex h-[200px] flex-col items-center justify-center text-sm text-gray-400">
          <BarChart3 className="h-8 w-8 mb-2 opacity-30" />
          <p>No historical data yet.</p>
          <p className="text-xs mt-1">Price history builds automatically every 6 hours.</p>
        </div>
      )}
      {history.length >= 2 && (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {yTicks.map((tick) => {
            const y = PAD.top + (1 - (tick - yTicks[0]) / (yTicks[yTicks.length - 1] - yTicks[0])) * chartH;
            return (
              <g key={tick}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                <text x={PAD.left - 8} y={y + 4} textAnchor="end" fill="#9ca3af" fontSize="11">
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill={fuelColor} opacity="0.1" />

          {/* Line */}
          <path d={path} fill="none" stroke={fuelColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data points */}
          {history.map((d, i) => {
            const x = PAD.left + (i / (history.length - 1)) * chartW;
            const yMin = yTicks[0];
            const yMax = yTicks[yTicks.length - 1];
            const y = PAD.top + (1 - (d.avg_price - yMin) / (yMax - yMin)) * chartH;
            return <circle key={i} cx={x} cy={y} r="3" fill={fuelColor} />;
          })}

          {/* X axis labels */}
          {xLabels.map((l, i) => (
            <text key={i} x={l.x} y={H - 5} textAnchor="middle" fill="#9ca3af" fontSize="10">
              {l.label}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}
