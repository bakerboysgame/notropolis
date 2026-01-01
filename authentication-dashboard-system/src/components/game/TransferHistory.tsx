import { useEffect, useState } from 'react';
import { History, ArrowUpRight, ArrowDownLeft, Calendar } from 'lucide-react';
import { api, apiHelpers } from '../../services/api';

interface Transfer {
  id: number;
  from_company_id: string;
  to_company_id: string;
  amount: number;
  from_location_type: string | null;
  to_location_type: string | null;
  created_at: string;
  from_company_name: string;
  to_company_name: string;
}

interface TransferHistoryProps {
  companyId: string;
}

export function TransferHistory({ companyId }: TransferHistoryProps) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.get('/api/game/bank/history', {
          params: { company_id: companyId, limit: 50 },
        });

        if (response.data.success) {
          setTransfers(response.data.transfers);
        } else {
          setError('Failed to load transfer history');
        }
      } catch (err) {
        setError(apiHelpers.handleError(err));
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [companyId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-gray-400" />
          Transfer History
        </h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-gray-400" />
          Transfer History
        </h2>
        <div className="p-4 bg-red-900/30 rounded border border-red-700">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <History className="w-5 h-5 text-gray-400" />
        Transfer History
      </h2>

      {transfers.length === 0 ? (
        <div className="text-center py-8">
          <History className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No transfers yet</p>
          <p className="text-gray-500 text-sm mt-1">
            Your transfer history will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {transfers.map((transfer) => {
            const isSent = transfer.from_company_id === companyId;

            return (
              <div
                key={transfer.id}
                className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      isSent ? 'bg-red-900/30' : 'bg-green-900/30'
                    }`}
                  >
                    {isSent ? (
                      <ArrowUpRight className="w-4 h-4 text-red-400" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-white text-sm">
                      {isSent ? (
                        <>
                          <span className="text-gray-400">To </span>
                          <span className="font-medium">{transfer.to_company_name}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-gray-400">From </span>
                          <span className="font-medium">{transfer.from_company_name}</span>
                        </>
                      )}
                    </p>
                    <p className="text-gray-500 text-xs flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(transfer.created_at)}
                    </p>
                  </div>
                </div>
                <p
                  className={`font-mono font-bold ${
                    isSent ? 'text-red-400' : 'text-green-400'
                  }`}
                >
                  {isSent ? '-' : '+'}${transfer.amount.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
