import { useState } from 'react';
import { AlertCircle, DollarSign } from 'lucide-react';
import { api, apiHelpers } from '../../services/api';

interface PrisonStatusProps {
  isInPrison: boolean;
  prisonFine: number;
  companyCash: number;
  activeCompanyId: string;
  onPaidFine: () => void;
}

export function PrisonStatus({
  isInPrison,
  prisonFine,
  companyCash,
  activeCompanyId,
  onPaidFine,
}: PrisonStatusProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAffordFine = companyCash >= prisonFine;

  const handlePayFine = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/game/attacks/pay-fine', {
        company_id: activeCompanyId,
      });

      if (response.data.success) {
        onPaidFine();
      } else {
        setError('Failed to pay fine');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  };

  if (!isInPrison) return null;

  return (
    <div className="bg-red-900/30 border-2 border-red-700 rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between gap-4">
        {/* Prison Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <h3 className="text-xl font-bold text-red-400">YOU ARE IN PRISON</h3>
          </div>
          <p className="text-gray-300 mb-3">
            You were caught during a dirty tricks attack. All game actions are blocked until you pay
            your fine.
          </p>

          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-gray-800 rounded">
              <p className="text-xs text-gray-500 mb-1">Fine Amount</p>
              <p className="text-2xl text-red-400 font-mono font-bold flex items-center gap-1">
                <DollarSign className="w-6 h-6" />
                {prisonFine.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-gray-800 rounded">
              <p className="text-xs text-gray-500 mb-1">Your Cash</p>
              <p
                className={`text-2xl font-mono font-bold flex items-center gap-1 ${
                  canAffordFine ? 'text-green-400' : 'text-red-400'
                }`}
              >
                <DollarSign className="w-6 h-6" />
                {companyCash.toLocaleString()}
              </p>
            </div>
          </div>

          {!canAffordFine && (
            <p className="text-sm text-yellow-400 font-bold">
              ⚠️ Insufficient funds! Wait for tick income or sell properties to raise cash.
            </p>
          )}
        </div>

        {/* Pay Fine Button */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handlePayFine}
            disabled={!canAffordFine || loading}
            className={`px-6 py-3 rounded font-bold transition-colors whitespace-nowrap ${
              canAffordFine && !loading
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'Paying...' : `Pay Fine: $${prisonFine.toLocaleString()}`}
          </button>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
