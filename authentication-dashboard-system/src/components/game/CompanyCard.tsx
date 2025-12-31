import { GameCompany } from '../../types/game';

interface CompanyCardProps {
  company: GameCompany;
  onSelect: () => void;
  isActive?: boolean;
}

export function CompanyCard({ company, onSelect, isActive }: CompanyCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`bg-neutral-800 rounded-lg p-6 cursor-pointer hover:bg-neutral-700 transition border-2 ${
        isActive ? 'border-primary-500' : 'border-transparent'
      }`}
    >
      <h3 className="text-xl font-bold text-white mb-2">{company.name}</h3>

      {company.current_map_id ? (
        <>
          <div className="flex items-center gap-2 text-sm text-neutral-400 mb-4">
            <span className="capitalize">{company.location_type}</span>
            <span>•</span>
            <span>Level {company.level}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-neutral-500">Cash</p>
              <p className="text-green-400 font-mono">${company.cash.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-neutral-500">Offshore</p>
              <p className="text-blue-400 font-mono">${company.offshore.toLocaleString()}</p>
            </div>
          </div>

          {company.is_in_prison && (
            <div className="mt-4 p-2 bg-red-900/50 rounded text-red-400 text-sm flex items-center gap-2">
              <span>In Prison</span>
              <span>-</span>
              <span>Fine: ${company.prison_fine.toLocaleString()}</span>
            </div>
          )}
        </>
      ) : (
        <p className="text-neutral-500">No location - Click to join a town</p>
      )}
    </div>
  );
}
