export interface FuelStation {
  brand: string;
  code: string;
  name: string;
  address: string;
  location: { latitude: number; longitude: number };
  state: string;
}

export interface FuelPrice {
  stationcode: string;
  fueltype: string;
  price: number;
  lastupdated: string;
}

export interface FuelPricesResponse {
  stations: FuelStation[];
  prices: FuelPrice[];
}

export interface StationWithPrice extends FuelStation {
  price: number;
  fueltype: string;
  lastupdated: string;
}

export type FuelType = 'E10' | 'U91' | 'P95' | 'P98' | 'DL' | 'PDL' | 'LPG' | 'E85' | 'EV';

export const FUEL_TYPES: { value: FuelType; label: string; color: string }[] = [
  { value: 'E10', label: 'E10', color: '#22c55e' },
  { value: 'U91', label: 'U91', color: '#3b82f6' },
  { value: 'P95', label: 'P95', color: '#8b5cf6' },
  { value: 'P98', label: 'P98', color: '#ec4899' },
  { value: 'DL', label: 'Diesel', color: '#f59e0b' },
  { value: 'PDL', label: 'Premium Diesel', color: '#d97706' },
  { value: 'LPG', label: 'LPG', color: '#14b8a6' },
  { value: 'E85', label: 'E85', color: '#06b6d4' },
];

export async function fetchAllPrices(): Promise<FuelPricesResponse> {
  const res = await fetch('/api/fuel/prices');
  if (!res.ok) throw new Error(`Failed to fetch prices: ${res.status}`);
  return res.json();
}

export async function fetchPricesByLocation(
  suburb: string,
  fueltype: string
): Promise<FuelPricesResponse> {
  const params = new URLSearchParams({ suburb, fueltype });
  const res = await fetch(`/api/fuel/prices/location?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch location prices: ${res.status}`);
  return res.json();
}

export async function fetchPricesNearby(
  lat: number,
  lng: number,
  radius: number,
  fueltype: string
): Promise<FuelPricesResponse> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lng: lng.toString(),
    radius: radius.toString(),
    fueltype,
  });
  const res = await fetch(`/api/fuel/prices/nearby?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch nearby prices: ${res.status}`);
  return res.json();
}

export interface HistoryDataPoint {
  date: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  station_count: number;
}

export interface PriceHistory {
  fueltype: string;
  days: number;
  data: HistoryDataPoint[];
}

export async function fetchPriceHistory(fueltype: string, days = 30): Promise<PriceHistory> {
  const params = new URLSearchParams({ fueltype, days: days.toString() });
  const res = await fetch(`/api/fuel/history?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch price history: ${res.status}`);
  return res.json();
}

export async function fetchSuburbs(): Promise<string[]> {
  const res = await fetch('/api/fuel/suburbs');
  if (!res.ok) throw new Error(`Failed to fetch suburbs: ${res.status}`);
  return res.json();
}

export function mergeStationsWithPrices(
  stations: FuelStation[],
  prices: FuelPrice[],
  fueltype: string
): StationWithPrice[] {
  const stationMap = new Map(stations.map((s) => [String(s.code), s]));
  const filteredPrices = prices.filter((p) => p.fueltype === fueltype);

  return filteredPrices
    .map((p) => {
      const station = stationMap.get(String(p.stationcode));
      if (!station) return null;
      return {
        ...station,
        price: p.price,
        fueltype: p.fueltype,
        lastupdated: p.lastupdated,
      };
    })
    .filter((s): s is StationWithPrice => s !== null)
    .sort((a, b) => a.price - b.price);
}

export function getPriceCategory(
  price: number,
  allPrices: number[]
): 'cheap' | 'mid' | 'expensive' {
  if (allPrices.length === 0) return 'mid';
  const sorted = [...allPrices].sort((a, b) => a - b);
  const p33 = sorted[Math.floor(sorted.length * 0.33)];
  const p66 = sorted[Math.floor(sorted.length * 0.66)];
  if (price <= p33) return 'cheap';
  if (price <= p66) return 'mid';
  return 'expensive';
}
