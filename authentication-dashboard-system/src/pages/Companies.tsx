import { useNavigate } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import { useCompanies } from '../hooks/useCompanies';
import { useActiveCompany } from '../contexts/CompanyContext';
import { CompanyCard } from '../components/game/CompanyCard';

export function Companies() {
  const navigate = useNavigate();
  const { companies, maxCompanies, isLoading, error } = useCompanies();
  const { activeCompany, setActiveCompany } = useActiveCompany();

  const canCreateMore = companies.length < maxCompanies;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          <span className="ml-4 text-neutral-400">Loading your companies...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-primary-500" />
          <h1 className="text-2xl font-bold text-white">Your Companies</h1>
        </div>
        {canCreateMore && companies.length > 0 && (
          <button
            onClick={() => navigate('/companies/new')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Plus className="w-5 h-5" />
            New Company
          </button>
        )}
      </div>

      {companies.length === 0 ? (
        <div className="text-center py-16 bg-neutral-800/50 rounded-lg">
          <Building2 className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
          <p className="text-neutral-400 mb-6 text-lg">You don't have any companies yet.</p>
          <button
            onClick={() => navigate('/companies/new')}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-lg font-medium"
          >
            Create Your First Company
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {companies.map(company => (
              <CompanyCard
                key={company.id}
                company={company}
                isActive={activeCompany?.id === company.id}
                onSelect={() => {
                  setActiveCompany(company);
                  navigate(`/companies/${company.id}`);
                }}
              />
            ))}

            {canCreateMore && (
              <div
                onClick={() => navigate('/companies/new')}
                className="border-2 border-dashed border-neutral-600 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-neutral-400 transition min-h-[200px]"
              >
                <Plus className="w-10 h-10 text-neutral-500 mb-2" />
                <span className="text-neutral-400">Add Company</span>
              </div>
            )}
          </div>

          <p className="text-sm text-neutral-500 mt-6">
            {companies.length}/{maxCompanies} company slots used
          </p>
        </>
      )}
    </div>
  );
}

export default Companies;
