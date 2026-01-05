import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Trophy, MapPin, DollarSign, Send, Loader2, Book, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { useActiveCompany } from '../contexts/CompanyContext';
import { formatHeroAmount, getLocationDisplayName } from '../utils/heroRequirements';

interface CelebrationData {
  mapId: string;
  mapName: string;
  locationType: 'town' | 'city' | 'capital';
  offshoreAmount: number;
  heroPath: 'netWorth' | 'cash' | 'land';
  unlocks: 'city' | 'capital' | null;
  heroedAt: string;
}

interface AvailableMap {
  id: string;
  name: string;
  location_type: 'town' | 'city' | 'capital';
  unlocked: boolean;
  starting_cash: number;
  active_companies: number;
}

interface HeroMessage {
  id: string;
  company_name: string;
  boss_name: string;
  map_name: string;
  location_type: string;
  message: string;
  offshore_amount: number;
  hero_path: string;
  created_at: string;
}

export function HeroCelebration() {
  const navigate = useNavigate();
  const { companyId } = useParams<{ companyId: string }>();
  const { refreshCompany } = useActiveCompany();
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [companyName, setCompanyName] = useState<string>('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'message' | 'townHall' | 'location'>('message');
  const [availableMaps, setAvailableMaps] = useState<AvailableMap[]>([]);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [heroMessages, setHeroMessages] = useState<HeroMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  useEffect(() => {
    const fetchCelebrationStatus = async () => {
      if (!companyId) {
        navigate('/companies');
        return;
      }

      try {
        setIsLoading(true);
        const response = await api.get(`/api/game/hero/celebration-status?company_id=${companyId}`);
        const data = response.data;

        if (!data.hasPendingCelebration) {
          // No celebration pending, redirect to companies
          navigate('/companies');
          return;
        }

        setCelebration(data.celebration);
        setCompanyName(data.companyName || '');
      } catch (err) {
        console.error('Failed to fetch celebration status:', err);
        setError('Failed to load celebration data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCelebrationStatus();
  }, [companyId, navigate]);

  const fetchAvailableLocations = async () => {
    try {
      setIsLoadingMaps(true);
      const response = await api.get(`/api/game/hero/available-locations?company_id=${companyId}`);
      setAvailableMaps(response.data.maps || []);
    } catch (err) {
      console.error('Failed to fetch locations:', err);
      setError('Failed to load available locations');
    } finally {
      setIsLoadingMaps(false);
    }
  };

  const fetchHeroMessages = async (mapId: string) => {
    try {
      setIsLoadingMessages(true);
      const response = await api.get(`/api/game/hero/messages?map_id=${mapId}`);
      setHeroMessages(response.data.messages || []);
    } catch (err) {
      console.error('Failed to fetch hero messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSubmitMessage = async () => {
    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await api.post('/api/game/hero/leave-message', { message: message.trim(), company_id: companyId });

      // Move to town hall book view
      setStep('townHall');
      if (celebration?.mapId) {
        await fetchHeroMessages(celebration.mapId);
      }
      await refreshCompany();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save message';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueToLocations = async () => {
    setStep('location');
    await fetchAvailableLocations();
  };

  const handleJoinLocation = async (mapId: string) => {
    try {
      setIsJoining(true);
      setError(null);

      await api.post('/api/game/hero/join-location', { map_id: mapId, company_id: companyId });

      await refreshCompany();
      navigate(`/map/${mapId}`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join location';
      setError(errorMessage);
    } finally {
      setIsJoining(false);
    }
  };

  const getPathDescription = (path: string) => {
    switch (path) {
      case 'netWorth':
        return 'Net Worth';
      case 'cash':
        return 'Cash Reserve';
      case 'land':
        return 'Land Ownership';
      default:
        return path;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto" />
          <p className="mt-4 text-neutral-400">Loading celebration...</p>
        </div>
      </div>
    );
  }

  if (!celebration) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900">
        <div className="text-center">
          <p className="text-neutral-400">No celebration found</p>
          <button
            onClick={() => navigate('/companies')}
            className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Go to Companies
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-900 via-neutral-800 to-neutral-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {step === 'message' ? (
          <>
            {/* Celebration Header */}
            <div className="text-center mb-8">
              <div className="relative inline-block">
                {/* Placeholder for celebration image */}
                <div className="w-64 h-64 mx-auto bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 rounded-full flex items-center justify-center border-4 border-yellow-500/30 mb-6">
                  <Trophy className="w-32 h-32 text-yellow-500" />
                </div>
                {/* Confetti/sparkle effects could go here */}
              </div>

              <h1 className="text-4xl font-bold text-white mb-2">
                Congratulations{companyName ? `, ${companyName}` : ''}!
              </h1>
              <p className="text-xl text-yellow-500 font-medium mb-4">
                You've Hero'd Out of {celebration.mapName}!
              </p>
            </div>

            {/* Stats Summary */}
            <div className="bg-neutral-800/50 rounded-xl p-6 mb-8 border border-neutral-700">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-neutral-700/30 rounded-lg">
                  <MapPin className="w-6 h-6 text-primary-400 mx-auto mb-2" />
                  <p className="text-sm text-neutral-400">Location</p>
                  <p className="text-lg font-bold text-white">
                    {getLocationDisplayName(celebration.locationType)}
                  </p>
                </div>
                <div className="text-center p-4 bg-neutral-700/30 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-neutral-400">Offshore Total</p>
                  <p className="text-lg font-bold text-green-400">
                    {formatHeroAmount(celebration.offshoreAmount)}
                  </p>
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-neutral-400">
                  Hero Path: <span className="text-primary-400 font-medium">{getPathDescription(celebration.heroPath)}</span>
                </p>
                {celebration.unlocks && (
                  <p className="text-sm text-yellow-400 mt-1">
                    Unlocked: {getLocationDisplayName(celebration.unlocks)}!
                  </p>
                )}
              </div>
            </div>

            {/* Town Hall Message */}
            <div className="bg-neutral-800/50 rounded-xl p-6 border border-neutral-700">
              <h2 className="text-xl font-bold text-white mb-2">
                Leave Your Mark in the Town Hall
              </h2>
              <p className="text-neutral-400 mb-4">
                Write a message that will be forever preserved in {celebration.mapName}'s Hall of Heroes.
              </p>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share your wisdom, taunt your rivals, or celebrate your victory..."
                className="w-full h-32 px-4 py-3 bg-neutral-700 border border-neutral-600 rounded-lg text-white placeholder-neutral-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                maxLength={500}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-neutral-500">
                  {message.length}/500 characters
                </span>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmitMessage}
                disabled={isSubmitting || !message.trim()}
                className="w-full mt-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Save Message & Choose New Location
                  </>
                )}
              </button>
            </div>
          </>
        ) : step === 'townHall' ? (
          <>
            {/* Town Hall Book */}
            <div className="text-center mb-8">
              <Book className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-white mb-2">
                {celebration?.mapName} Hall of Heroes
              </h1>
              <p className="text-neutral-400">
                Your message has been immortalized. Here are all the legends who conquered this land.
              </p>
            </div>

            {isLoadingMessages ? (
              <div className="text-center py-12">
                <Loader2 className="w-10 h-10 animate-spin text-primary-500 mx-auto" />
                <p className="mt-4 text-neutral-400">Loading messages...</p>
              </div>
            ) : (
              <div className="space-y-4 mb-8">
                {heroMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="bg-neutral-800/50 rounded-xl p-5 border border-neutral-700"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-white">{msg.boss_name}</h3>
                        <p className="text-sm text-neutral-400">{msg.company_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-bold">{formatHeroAmount(msg.offshore_amount)}</p>
                        <p className="text-xs text-neutral-500">
                          {new Date(msg.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <p className="text-neutral-300 italic">"{msg.message}"</p>
                  </div>
                ))}
                {heroMessages.length === 0 && (
                  <div className="text-center py-8 text-neutral-500">
                    You're the first to leave a mark here!
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleContinueToLocations}
              className="w-full py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-5 h-5" />
              Choose Your Next Destination
            </button>
          </>
        ) : (
          <>
            {/* Location Selection */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">
                Choose Your Next Destination
              </h1>
              <p className="text-neutral-400">
                Select a new location to continue your empire.
              </p>
            </div>

            {isLoadingMaps ? (
              <div className="text-center py-12">
                <Loader2 className="w-10 h-10 animate-spin text-primary-500 mx-auto" />
                <p className="mt-4 text-neutral-400">Loading locations...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {availableMaps.map((map) => (
                  <div
                    key={map.id}
                    className={`p-6 rounded-xl border transition ${
                      map.unlocked
                        ? 'bg-neutral-800/50 border-neutral-700 hover:border-primary-500 cursor-pointer'
                        : 'bg-neutral-800/20 border-neutral-800 opacity-50 cursor-not-allowed'
                    }`}
                    onClick={() => map.unlocked && !isJoining && handleJoinLocation(map.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-white">{map.name}</h3>
                        <p className="text-neutral-400">
                          {getLocationDisplayName(map.location_type)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-neutral-400">Starting Cash</p>
                        <p className="text-lg font-bold text-green-400">
                          {formatHeroAmount(map.starting_cash)}
                        </p>
                      </div>
                    </div>
                    {!map.unlocked && (
                      <p className="mt-2 text-sm text-yellow-500">
                        Hero out of a {map.location_type === 'city' ? 'Town' : 'City'} to unlock
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="mt-6 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {isJoining && (
              <div className="mt-6 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto" />
                <p className="mt-2 text-neutral-400">Joining location...</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default HeroCelebration;
