import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, MapPin, AlertCircle } from 'lucide-react';
import { useCompanies } from '../hooks/useCompanies';
import { useActiveCompany } from '../contexts/CompanyContext';
import { LocationPicker } from '../components/game/LocationPicker';

type Step = 'name' | 'location';

export function CompanyCreate() {
  const navigate = useNavigate();
  const { createCompany, joinLocation, error: apiError } = useCompanies();
  const { setActiveCompany } = useActiveCompany();

  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [selectedMap, setSelectedMap] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a company name');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create the company
      const company = await createCompany(name.trim());
      if (!company) {
        setError(apiError || 'Failed to create company');
        setIsSubmitting(false);
        return;
      }

      // If a map was selected, join it
      if (selectedMap) {
        const updatedCompany = await joinLocation(company.id, selectedMap);
        if (updatedCompany) {
          setActiveCompany(updatedCompany);
          navigate(`/companies/${updatedCompany.id}`);
          return;
        }
      }

      // No map selected, just go to the company page
      setActiveCompany(company);
      navigate(`/companies/${company.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create company');
      setIsSubmitting(false);
    }
  };

  if (step === 'name') {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate('/companies')}
          className="flex items-center gap-2 text-neutral-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Companies
        </button>

        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="w-8 h-8 text-primary-500" />
            <h1 className="text-2xl font-bold text-white">Create Company</h1>
          </div>

          <div className="bg-neutral-800 rounded-lg p-6">
            <label className="block text-white mb-2 font-medium">
              Company Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Enter a name for your company"
              className="w-full p-3 rounded-lg bg-neutral-700 text-white border border-neutral-600 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              maxLength={30}
              autoFocus
            />
            <p className="text-sm text-neutral-500 mt-2">
              {name.length}/30 characters
            </p>

            <p className="text-sm text-neutral-400 mt-4 flex items-start gap-2">
              <span className="text-primary-400 mt-0.5">*</span>
              Your company identity is anonymous. Other players cannot see who owns it.
            </p>

            {error && (
              <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={() => setStep('location')}
              disabled={!name.trim()}
              className="w-full mt-6 py-3 bg-primary-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-700 transition"
            >
              Next: Choose Location
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Location selection step
  return (
    <div className="p-6">
      <button
        onClick={() => setStep('name')}
        className="flex items-center gap-2 text-neutral-400 hover:text-white mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        Back
      </button>

      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <MapPin className="w-8 h-8 text-primary-500" />
          <h1 className="text-2xl font-bold text-white">Choose Starting Location</h1>
        </div>
        <p className="text-neutral-400 mb-6">
          Select a town to begin your journey. You can move to cities and capitals later as you grow.
        </p>

        <div className="bg-neutral-800 rounded-lg p-6 mb-6">
          <LocationPicker
            locationType="town"
            selectedMap={selectedMap}
            onSelect={setSelectedMap}
          />
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={() => setStep('name')}
            className="px-6 py-3 bg-neutral-700 text-white rounded-lg hover:bg-neutral-600 transition"
          >
            Back
          </button>
          <button
            onClick={handleCreate}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700 transition flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Creating...
              </>
            ) : selectedMap ? (
              'Create Company & Start'
            ) : (
              'Create Company (Choose Location Later)'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CompanyCreate;
