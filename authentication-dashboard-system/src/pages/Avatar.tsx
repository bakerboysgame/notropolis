import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { useActiveCompany } from '../contexts/CompanyContext';
import { useAvatarItems, useUpdateAvatar } from '../hooks/useAvatar';
import { AvatarPreview } from '../components/avatar/AvatarPreview';

const AVATAR_CATEGORIES = [
  { id: 'base', name: 'Base', required: true },
  { id: 'skin', name: 'Skin Tone', required: true },
  { id: 'hair', name: 'Hair', required: false },
  { id: 'outfit', name: 'Outfit', required: true },
  { id: 'headwear', name: 'Headwear', required: false },
  { id: 'accessory', name: 'Accessory', required: false },
  { id: 'background', name: 'Background', required: false },
];

const RARITY_COLORS = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

// R2 public URL for avatar assets
const R2_PUBLIC_URL = 'https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev';

export function Avatar() {
  const { activeCompany } = useActiveCompany();
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useAvatarItems(activeCompany?.id);
  const { mutate: updateAvatar, isPending } = useUpdateAvatar();
  const [selectedCategory, setSelectedCategory] = useState('base');

  if (!activeCompany) {
    return <Navigate to="/companies" replace />;
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const categoryItems = data.items.filter((i: any) => i.category === selectedCategory);
  const currentCategory = AVATAR_CATEGORIES.find((c) => c.id === selectedCategory);

  const handleSelectItem = async (itemId: string | null) => {
    updateAvatar(
      { companyId: activeCompany.id, category: selectedCategory, itemId },
      { onSuccess: () => refetch() }
    );
  };

  const formatUnlockRequirement = (req: any) => {
    if (!req) return '';
    if (req.type === 'hero_count') {
      return `Hero ${req.count.toLocaleString()} times to unlock`;
    }
    return 'Complete special requirements to unlock';
  };

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
          <h1 className="text-2xl font-bold text-white">Avatar Customization</h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Preview */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-4 sticky top-4">
              <AvatarPreview companyId={activeCompany.id} size={250} />
              <p className="text-center text-gray-400 mt-4">{activeCompany.name}</p>
            </div>
          </div>

          {/* Customization */}
          <div className="lg:col-span-2">
            {/* Category tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {AVATAR_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Items grid */}
            <div className="grid grid-cols-4 gap-4">
              {/* None option for optional categories */}
              {!currentCategory?.required && (
                <div
                  onClick={() => handleSelectItem(null)}
                  className={`aspect-square bg-gray-800 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-700 border-2 transition-colors ${
                    !data.selection[`${selectedCategory}_id` as keyof typeof data.selection]
                      ? 'border-blue-500'
                      : 'border-transparent'
                  }`}
                >
                  <span className="text-gray-500">None</span>
                </div>
              )}

              {categoryItems.map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => item.isUnlocked && !isPending && handleSelectItem(item.id)}
                  className={`aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer relative border-2 transition-all ${
                    data.selection[`${selectedCategory}_id` as keyof typeof data.selection] === item.id
                      ? 'border-blue-500'
                      : 'border-transparent'
                  } ${
                    !item.isUnlocked
                      ? 'opacity-60 cursor-not-allowed'
                      : 'hover:bg-gray-700'
                  }`}
                  title={item.isUnlocked ? item.name : formatUnlockRequirement(item.unlockRequirement)}
                >
                  <img
                    src={`${R2_PUBLIC_URL}/${item.r2_key}`}
                    alt={item.name}
                    className="w-full h-full object-contain"
                  />

                  {/* Rarity indicator */}
                  <div
                    className="absolute top-1 right-1 w-3 h-3 rounded-full border border-white/30"
                    style={{ backgroundColor: RARITY_COLORS[item.rarity as keyof typeof RARITY_COLORS] }}
                  />

                  {/* Lock overlay */}
                  {!item.isUnlocked && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-2">
                      <Lock className="w-6 h-6 text-gray-400 mb-1" />
                      <p className="text-xs text-gray-400 text-center">
                        {item.unlockRequirement?.type === 'hero_count'
                          ? `Hero ${item.unlockRequirement.count.toLocaleString()}x`
                          : 'Locked'}
                      </p>
                    </div>
                  )}

                  {/* Name tooltip */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1 text-xs text-center text-white truncate">
                    {item.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Avatar;
