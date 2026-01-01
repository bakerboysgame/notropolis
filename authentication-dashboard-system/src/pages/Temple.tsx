import { useEffect, useState, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, AlertCircle, Trophy } from 'lucide-react';
import { useActiveCompany } from '../contexts/CompanyContext';
import { api, apiHelpers } from '../services/api';

interface Donor {
  name: string;
  total_donated: number;
}

export function Temple(): JSX.Element {
  const { activeCompany, setActiveCompany } = useActiveCompany();
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [donating, setDonating] = useState(false);
  const [donateError, setDonateError] = useState<string | null>(null);
  const [donateSuccess, setDonateSuccess] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/api/game/temple/leaderboard');

      if (response.data.success) {
        setLeaderboard(response.data.data || []);
      } else {
        setError('Failed to load leaderboard');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleDonate = async () => {
    if (!amount || !activeCompany) return;

    const donationAmount = parseInt(amount);
    if (isNaN(donationAmount) || donationAmount <= 0) {
      setDonateError('Please enter a valid amount');
      return;
    }

    if (donationAmount > activeCompany.cash) {
      setDonateError('Insufficient funds');
      return;
    }

    setDonating(true);
    setDonateError(null);
    setDonateSuccess(false);

    try {
      const response = await api.post('/api/game/temple/donate', {
        company_id: activeCompany.id,
        amount: donationAmount,
      });

      if (response.data.success) {
        setAmount('');
        setDonateSuccess(true);
        await fetchLeaderboard();

        // Update active company with new cash balance
        const companyResponse = await api.get(`/api/game/companies/${activeCompany.id}`);
        if (companyResponse.data.success && companyResponse.data.company) {
          setActiveCompany(companyResponse.data.company);
        }

        // Clear success message after 3 seconds
        setTimeout(() => setDonateSuccess(false), 3000);
      } else {
        setDonateError(response.data.error || 'Failed to donate');
      }
    } catch (err) {
      setDonateError(apiHelpers.handleError(err));
    } finally {
      setDonating(false);
    }
  };

  // Redirect if no active company
  if (!activeCompany) {
    return <Navigate to="/companies" replace />;
  }

  const donationValue = parseInt(amount || '0');

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(`/companies/${activeCompany.id}`)}
            className="flex items-center gap-2 text-neutral-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to {activeCompany.name}
          </button>
        </div>

        {/* Temple Banner */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🛕</div>
          <h1 className="text-2xl font-bold text-white">Temple</h1>
          <p className="text-gray-400">Donate to show your generosity</p>
        </div>

        {/* Prison Warning */}
        {activeCompany.is_in_prison && (
          <div className="p-4 bg-red-900/30 rounded-lg border border-red-700 mb-6 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-bold">Cannot Donate</p>
              <p className="text-red-300 text-sm">
                Your company is in prison. You cannot donate until you pay your fine.
              </p>
            </div>
          </div>
        )}

        {/* Donation Form */}
        {!activeCompany.is_in_prison && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
            <div className="mb-4">
              <p className="text-gray-400 text-sm">Your Cash</p>
              <p className="text-2xl font-mono text-green-400">
                ${activeCompany.cash.toLocaleString()}
              </p>
            </div>

            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Donation amount"
              min="1"
              max={activeCompany.cash}
              className="w-full p-3 bg-gray-700 text-white rounded mb-4 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />

            {donateSuccess && (
              <div className="p-3 bg-green-900/30 rounded border border-green-700 mb-4">
                <p className="text-green-400 flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  Thank you for your donation!
                </p>
              </div>
            )}

            {donateError && (
              <p className="text-red-400 text-sm mb-4">{donateError}</p>
            )}

            <button
              onClick={handleDonate}
              disabled={donating || !amount || donationValue <= 0 || donationValue > activeCompany.cash}
              className="w-full py-3 bg-yellow-600 text-white font-bold rounded hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Heart className="w-5 h-5" />
              {donating ? 'Donating...' : `Donate $${donationValue.toLocaleString()}`}
            </button>
          </div>
        )}

        {/* Leaderboard */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Top Donors
          </h2>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-center py-4">{error}</p>
          )}

          {!loading && !error && (
            <div className="space-y-2">
              {leaderboard.map((donor, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-3 bg-gray-700/50 rounded"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl w-8 text-center">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </span>
                    <span className="text-white">{donor.name}</span>
                  </div>
                  <span className="text-yellow-400 font-mono">
                    ${donor.total_donated.toLocaleString()}
                  </span>
                </div>
              ))}

              {leaderboard.length === 0 && (
                <div className="text-center py-8">
                  <Heart className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500">No donations yet. Be the first!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Temple;
