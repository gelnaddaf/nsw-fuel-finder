import { useEffect, useRef } from 'react';
import type { StationWithPrice } from '../api/fuel';
import { getPriceCategory } from '../api/fuel';

interface MapViewProps {
  stations: StationWithPrice[];
}

const PRICE_COLORS = {
  cheap: '#22c55e',
  mid: '#f59e0b',
  expensive: '#ef4444',
};

export default function MapView({ stations }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || stations.length === 0) return;

    const loadMap = async () => {
      const L = await import('leaflet');

      // Clean up existing map
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const allPrices = stations.map((s) => s.price);

      // Center on the first station or default to Sydney
      const center = stations.length > 0
        ? [stations[0].location.latitude, stations[0].location.longitude] as [number, number]
        : [-33.8688, 151.2093] as [number, number];

      const map = L.map(mapRef.current!, {
        center,
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Add markers for visible stations (limit to 200 for performance)
      const visibleStations = stations.slice(0, 200);
      const bounds = L.latLngBounds([]);

      visibleStations.forEach((station) => {
        const category = getPriceCategory(station.price, allPrices);
        const color = PRICE_COLORS[category];

        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="background:${color};color:white;padding:2px 6px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.2)">${station.price.toFixed(1)}¢</div>`,
          iconSize: [60, 24],
          iconAnchor: [30, 12],
        });

        const marker = L.marker(
          [station.location.latitude, station.location.longitude],
          { icon }
        ).addTo(map);

        marker.bindPopup(`
          <div style="font-family:system-ui;min-width:180px">
            <strong style="font-size:14px">${station.name}</strong>
            <div style="color:#666;font-size:12px;margin-top:4px">${station.brand}</div>
            <div style="color:#666;font-size:12px;margin-top:2px">${station.address}</div>
            <div style="font-size:18px;font-weight:700;margin-top:8px;color:${color}">${station.price.toFixed(1)}¢/L</div>
          </div>
        `);

        bounds.extend([station.location.latitude, station.location.longitude]);
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }

      mapInstanceRef.current = map;
    };

    loadMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [stations]);

  if (stations.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
        <p className="text-gray-500">Search for fuel prices to see stations on the map</p>
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="h-[400px] w-full rounded-xl border border-gray-200 shadow-sm lg:h-[500px]"
    />
  );
}
