import { FUEL_TYPES, type FuelType } from '../api/fuel';

interface FuelTypeFilterProps {
  selected: FuelType;
  onChange: (fuelType: FuelType) => void;
}

export default function FuelTypeFilter({ selected, onChange }: FuelTypeFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {FUEL_TYPES.map((fuel) => (
        <button
          key={fuel.value}
          onClick={() => onChange(fuel.value)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
            selected === fuel.value
              ? 'text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          style={
            selected === fuel.value
              ? { backgroundColor: fuel.color }
              : undefined
          }
        >
          {fuel.label}
        </button>
      ))}
    </div>
  );
}
