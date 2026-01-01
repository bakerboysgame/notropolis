import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Landmark, ArrowRightLeft, Send, Download, AlertCircle } from 'lucide-react';
import { useActiveCompany } from '../contexts/CompanyContext';
import { api, apiHelpers } from '../services/api';
import { TransferModal } from '../components/game/TransferModal';
import { TransferHistory } from '../components/game/TransferHistory';

interface CompanyTransferInfo {
  id: string;
  name: string;
  cash: number;
  offshore: number;
  location_type: string | null;
  current_map_id: string | null;
  is_in_prison: boolean;
  sends_today: number;
  sends_remaining: number;
  receives_today: number;
  receives_remaining: number;
  max_receive_amount: number;
}

interface BankStatus {
  company: {
    id: string;
    name: string;
    cash: number;
    offshore: number;
    location_type: string | null;
    is_in_prison: boolean;
  };
  limits: {
    sends_today: number;
    sends_remaining: number;
    receives_today: number;
    receives_remaining: number;
    max_send_amount: number;
  };
  other_companies: CompanyTransferInfo[];
}

export function Bank(): JSX.Element {
  const { activeCompany, setActiveCompany } = useActiveCompany();
  const navigate = useNavigate();
  const [status, setStatus] = useState<BankStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<CompanyTransferInfo | null>(null);

  const fetchStatus = async () => {
    if (!activeCompany) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/api/game/bank/status', {
        params: { company_id: activeCompany.id },
      });

      if (response.data.success) {
        setStatus(response.data);
      } else {
        setError('Failed to load bank status');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [activeCompany]);

  const handleTransferClick = (recipient: CompanyTransferInfo) => {
    setSelectedRecipient(recipient);
    setShowTransferModal(true);
  };

  const handleTransferSuccess = async () => {
    // Refresh status after successful transfer
    await fetchStatus();

    // Update active company context with new cash balance
    if (activeCompany && status) {
      const response = await api.get(`/api/game/companies/${activeCompany.id}`);
      if (response.data.success && response.data.company) {
        setActiveCompany(response.data.company);
      }
    }
  };

  // Redirect if no active company
  if (!activeCompany) {
    return <Navigate to="/companies" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(`/companies/${activeCompany.id}`)}
            className="flex items-center gap-2 text-neutral-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to {activeCompany.name}
          </button>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Landmark className="w-8 h-8 text-blue-400" />
            Bank Transfers
          </h1>
          <p className="text-gray-400">
            Transfer cash between your companies (3 sends/receives per day per company)
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading bank status...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-900/30 rounded-lg border border-red-700 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Prison Warning */}
        {status?.company.is_in_prison && (
          <div className="p-4 bg-red-900/30 rounded-lg border border-red-700 mb-6 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-bold">Cannot Send Transfers</p>
              <p className="text-red-300 text-sm">
                Your company is in prison. You can still receive transfers, but cannot send until you pay your fine.
              </p>
            </div>
          </div>
        )}

        {/* Current Company Status */}
        {!loading && status && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-blue-400" />
              {status.company.name} - Transfer Status
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Available Cash</p>
                <p className="text-2xl font-bold text-green-400 font-mono">
                  ${status.company.cash.toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm flex items-center gap-1">
                  <Send className="w-4 h-4" /> Sends Today
                </p>
                <p className="text-2xl font-bold text-white">
                  {status.limits.sends_today}/3
                </p>
                <p className="text-xs text-gray-500">
                  {status.limits.sends_remaining} remaining
                </p>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm flex items-center gap-1">
                  <Download className="w-4 h-4" /> Receives Today
                </p>
                <p className="text-2xl font-bold text-white">
                  {status.limits.receives_today}/3
                </p>
                <p className="text-xs text-gray-500">
                  {status.limits.receives_remaining} remaining
                </p>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Location</p>
                <p className="text-xl font-bold text-white capitalize">
                  {status.company.location_type || 'Lobby'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Other Companies */}
        {!loading && status && status.other_companies.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
            <h2 className="text-lg font-bold text-white mb-4">Your Other Companies</h2>
            <div className="space-y-3">
              {status.other_companies.map((company) => (
                <div
                  key={company.id}
                  className="bg-gray-700 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-white">{company.name}</p>
                      {company.is_in_prison && (
                        <span className="px-2 py-0.5 bg-red-900/50 text-red-400 text-xs rounded">
                          In Prison
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span className="text-green-400 font-mono">
                        ${company.cash.toLocaleString()}
                      </span>
                      <span className="text-gray-400 capitalize">
                        {company.location_type || 'Lobby'}
                      </span>
                      <span className="text-gray-500">
                        Max transfer: ${company.max_receive_amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500 mt-1">
                      <span>Sends: {company.sends_today}/3</span>
                      <span>Receives: {company.receives_today}/3</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTransferClick(company)}
                      disabled={
                        status.company.is_in_prison ||
                        status.limits.sends_remaining <= 0 ||
                        company.receives_remaining <= 0 ||
                        status.company.cash <= 0
                      }
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Send
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Other Companies */}
        {!loading && status && status.other_companies.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700 text-center">
            <Landmark className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">No other companies to transfer to</p>
            <p className="text-gray-500 text-sm">
              Create another company to transfer funds between them.
            </p>
          </div>
        )}

        {/* Transfer History */}
        {!loading && activeCompany && (
          <TransferHistory companyId={activeCompany.id} />
        )}

        {/* Transfer Modal */}
        {showTransferModal && selectedRecipient && status && (
          <TransferModal
            isOpen={showTransferModal}
            onClose={() => {
              setShowTransferModal(false);
              setSelectedRecipient(null);
            }}
            onSuccess={handleTransferSuccess}
            fromCompany={status.company}
            toCompany={selectedRecipient}
            maxAmount={Math.min(status.company.cash, selectedRecipient.max_receive_amount)}
          />
        )}
      </div>
    </div>
  );
}

export default Bank;
