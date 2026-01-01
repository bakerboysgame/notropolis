import { useState } from 'react';
import { X, DollarSign, Send, ArrowRight } from 'lucide-react';
import { api, apiHelpers } from '../../services/api';

interface CompanyInfo {
  id: string;
  name: string;
  cash: number;
  location_type: string | null;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  fromCompany: CompanyInfo;
  toCompany: CompanyInfo & { max_receive_amount: number };
  maxAmount: number;
}

export function TransferModal({
  isOpen,
  onClose,
  onSuccess,
  fromCompany,
  toCompany,
  maxAmount,
}: TransferModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericAmount = parseInt(amount, 10) || 0;
  const isValidAmount = numericAmount > 0 && numericAmount <= maxAmount;

  const handleTransfer = async () => {
    if (!isValidAmount) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/game/bank/transfer', {
        company_id: fromCompany.id,
        from_company_id: fromCompany.id,
        to_company_id: toCompany.id,
        amount: numericAmount,
      });

      if (response.data.success) {
        onSuccess();
        onClose();
      } else {
        setError(response.data.error || 'Transfer failed');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAmount = (pct: number) => {
    const quickAmount = Math.floor(maxAmount * pct);
    setAmount(quickAmount.toString());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-400" />
            Transfer Cash
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Transfer Direction */}
        <div className="flex items-center justify-center gap-4 mb-6 p-4 bg-gray-700 rounded-lg">
          <div className="text-center">
            <p className="text-gray-400 text-xs mb-1">From</p>
            <p className="font-bold text-white">{fromCompany.name}</p>
            <p className="text-green-400 text-sm font-mono">
              ${fromCompany.cash.toLocaleString()}
            </p>
          </div>
          <ArrowRight className="w-6 h-6 text-blue-400" />
          <div className="text-center">
            <p className="text-gray-400 text-xs mb-1">To</p>
            <p className="font-bold text-white">{toCompany.name}</p>
            <p className="text-gray-400 text-xs capitalize">
              {toCompany.location_type || 'Lobby'}
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 rounded border border-red-700">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Amount Input */}
        <div className="mb-4">
          <label className="block text-gray-400 mb-2">Transfer Amount</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={1}
              max={maxAmount}
              placeholder="0"
              className="w-full pl-10 pr-4 py-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none font-mono text-lg"
              disabled={loading}
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Maximum: ${maxAmount.toLocaleString()}
          </p>
        </div>

        {/* Quick Amount Buttons */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => handleQuickAmount(0.25)}
            className="flex-1 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm"
            disabled={loading}
          >
            25%
          </button>
          <button
            onClick={() => handleQuickAmount(0.5)}
            className="flex-1 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm"
            disabled={loading}
          >
            50%
          </button>
          <button
            onClick={() => handleQuickAmount(0.75)}
            className="flex-1 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm"
            disabled={loading}
          >
            75%
          </button>
          <button
            onClick={() => handleQuickAmount(1)}
            className="flex-1 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm"
            disabled={loading}
          >
            Max
          </button>
        </div>

        {/* Preview */}
        {numericAmount > 0 && (
          <div className="p-4 bg-gray-700 rounded-lg mb-6">
            <p className="text-gray-400 text-sm mb-2">After Transfer:</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{fromCompany.name}:</span>
              <span className="text-red-400 font-mono">
                ${(fromCompany.cash - numericAmount).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-400">{toCompany.name}:</span>
              <span className="text-green-400 font-mono">
                +${numericAmount.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={!isValidAmount || loading}
            className="flex-1 py-3 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send ${numericAmount.toLocaleString()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
