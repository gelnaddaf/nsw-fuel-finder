import { Fuel, MapPin } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-nsw-blue text-white shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
            <Fuel className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">NSW Fuel Finder</h1>
            <p className="text-xs text-blue-200">Live prices from 3,200+ stations</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-blue-200">
          <MapPin className="h-4 w-4" />
          <span>New South Wales</span>
        </div>
      </div>
    </header>
  );
}
