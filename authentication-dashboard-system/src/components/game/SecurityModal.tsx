import { useState, useEffect } from 'react';
import { X, Shield } from 'lucide-react';
import { api, apiHelpers } from '../../services/api';
import { useActiveCompany } from '../../contexts/CompanyContext';

// Security cost calculations (mirror backend logic)
const SECURITY_OPTIONS = {
  cameras: {
    id: 'cameras',
    name: 'Security Cameras',
    icon: '📷',
    costMultiplier: 0.10,
    minCost: 500,
    catchBonus: 0.10,
    description: 'Record evidence of attackers. +10% catch rate.',
  },
  guard_dogs: {
    id: 'guard_dogs',
    name: 'Guard Dogs',
    icon: '🐕',
    costMultiplier: 0.15,
    minCost: 750,
    catchBonus: 0.15,
    description: 'Dogs patrol the perimeter. +15% catch rate.',
  },
  security_guards: {
    id: 'security_guards',
    name: 'Security Guards',
    icon: '👮',
    costMultiplier: 0.25,
    minCost: 1500,
    catchBonus: 0.25,
    description: '24/7 human security. +25% catch rate.',
  },
  sprinklers: {
    id: 'sprinklers',
    name: 'Fire Sprinklers',
    icon: '💦',
    costMultiplier: 0.20,
    minCost: 1000,
    catchBonus: 0,
    description: 'Automatic fire suppression. Prevents fire spread.',
  },
} as const;

type SecurityType = keyof typeof SECURITY_OPTIONS;

const calculateSecurityCost = (option: typeof SECURITY_OPTIONS[SecurityType], buildingCost: number) =>
  Math.max(option.minCost, Math.round(buildingCost * option.costMultiplier));

const calculateMonthlyCost = (purchaseCost: number) =>
  Math.round(purchaseCost * 0.10);

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  building: {
    id: string;
    name: string;
    cost: number;
  };
  security: {
    has_cameras?: boolean;
    has_guard_dogs?: boolean;
    has_security_guards?: boolean;
    has_sprinklers?: boolean;
    monthly_cost?: number;
  } | null;
}

export function SecurityModal({
  isOpen,
  onClose,
  onSuccess,
  building,
  security,
}: SecurityModalProps) {
  const { activeCompany, refreshCompany } = useActiveCompany();
  const [loading, setLoading] = useState<SecurityType | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset error when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  const hasType = (type: SecurityType): boolean => {
    if (!security) return false;
    const map: Record<SecurityType, boolean | undefined> = {
      cameras: security.has_cameras,
      guard_dogs: security.has_guard_dogs,
      security_guards: security.has_security_guards,
      sprinklers: security.has_sprinklers,
    };
    return Boolean(map[type]);
  };

  const handlePurchase = async (type: SecurityType) => {
    if (!activeCompany) return;

    setLoading(type);
    setError(null);

    try {
      const response = await api.post('/api/game/security/purchase', {
        company_id: activeCompany.id,
        building_id: building.id,
        security_type: type,
      });

      if (response.data.success) {
        await refreshCompany();
        onSuccess();
      } else {
        setError(response.data.error || 'Purchase failed');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(null);
    }
  };

  const handleRemove = async (type: SecurityType) => {
    if (!activeCompany) return;

    setLoading(type);
    setError(null);

    try {
      const response = await api.post('/api/game/security/remove', {
        company_id: activeCompany.id,
        building_id: building.id,
        security_type: type,
      });

      if (response.data.success) {
        await refreshCompany();
        onSuccess();
      } else {
        setError(response.data.error || 'Remove failed');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(null);
    }
  };

  if (!isOpen || !activeCompany) return null;

  const buildingCost = building.cost || 10000; // fallback

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg border border-gray-700 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-400" />
              Building Security
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {building.name} (${buildingCost.toLocaleString()} value)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            disabled={loading !== null}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 rounded border border-red-700">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Security Options */}
        <div className="space-y-3">
          {(Object.keys(SECURITY_OPTIONS) as SecurityType[]).map((type) => {
            const option = SECURITY_OPTIONS[type];
            const purchaseCost = calculateSecurityCost(option, buildingCost);
            const monthlyCost = calculateMonthlyCost(purchaseCost);
            const owned = hasType(type);
            const canAfford = activeCompany.cash >= purchaseCost;
            const isLoading = loading === type;

            return (
              <div
                key={type}
                className={`p-4 rounded-lg ${
                  owned ? 'bg-green-900/30 border border-green-600' : 'bg-gray-700'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-bold text-white">
                      {option.icon} {option.name}
                      {owned && (
                        <span className="ml-2 text-green-400 text-sm">(Installed)</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-400">{option.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Monthly: ${monthlyCost.toLocaleString()} (~${Math.round(monthlyCost / 144)}/tick)
                    </p>
                  </div>
                  <div className="text-right ml-3">
                    {owned ? (
                      <button
                        onClick={() => handleRemove(type)}
                        disabled={isLoading}
                        className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {isLoading ? 'Removing...' : 'Remove'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePurchase(type)}
                        disabled={!canAfford || isLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-500 transition-colors text-sm font-medium"
                      >
                        {isLoading ? 'Buying...' : `$${purchaseCost.toLocaleString()}`}
                      </button>
                    )}
                    {!owned && !canAfford && (
                      <p className="text-xs text-red-400 mt-1">Insufficient funds</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total Monthly Cost */}
        {security && security.monthly_cost && security.monthly_cost > 0 && (
          <div className="mt-4 p-3 bg-gray-900 rounded">
            <p className="text-gray-400 text-sm">Total Monthly Cost</p>
            <p className="text-xl text-yellow-400 font-bold">
              ${security.monthly_cost.toLocaleString()}/month
            </p>
            <p className="text-xs text-gray-500">
              (~${Math.round(security.monthly_cost / 144)}/tick)
            </p>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading !== null}
          className="w-full mt-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors disabled:opacity-50"
        >
          Close
        </button>
      </div>
    </div>
  );
}
