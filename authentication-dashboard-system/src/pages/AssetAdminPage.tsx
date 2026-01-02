// src/pages/AssetAdminPage.tsx
import { useState, useCallback } from 'react';
import {
  Image,
  AlertCircle,
  Building2,
  User,
  Film,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { Asset, AssetCategory, TABS, TabConfig } from '../services/assetApi';
import { AssetGrid } from '../components/assets/AssetGrid';
import { AssetPreviewModal } from '../components/assets/AssetPreviewModal';
import { GenerateModal } from '../components/assets/GenerateModal';
import { QueueStatus } from '../components/assets/QueueStatus';
import { AssetManager } from '../components/assets/AssetManager';
import { AvatarAssets } from '../components/assets/AvatarAssets';
import { SceneTemplates } from '../components/assets/SceneTemplates';

// Management tabs (separate from asset category tabs)
const MANAGEMENT_TABS = [
  { key: 'asset-manager', label: 'Asset Manager', icon: Building2 },
  { key: 'avatar-preview', label: 'Avatar Preview', icon: User },
  { key: 'scene-templates', label: 'Scene Templates', icon: Film },
] as const;

export default function AssetAdminPage() {
  const { user } = useAuth();

  // Access control
  const isMasterAdmin = user?.role === 'master_admin';

  // State
  const [activeTab, setActiveTab] = useState<string>('buildings');
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateCategory, setGenerateCategory] = useState<AssetCategory | undefined>();
  const [generateParent, setGenerateParent] = useState<{ id: string; asset_key: string } | undefined>();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Get current tab config
  const currentTab = TABS.find(t => t.key === activeTab) || TABS[0];

  // Trigger refresh after actions
  const handleRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Open generate modal for a specific category
  const openGenerateModal = (category?: AssetCategory, parent?: { id: string; asset_key: string }) => {
    setGenerateCategory(category);
    setGenerateParent(parent);
    setShowGenerateModal(true);
  };

  // Handle generating sprite from approved reference
  const handleGenerateSprite = (asset: Asset) => {
    // Determine the sprite category based on the reference category
    let spriteCategory: AssetCategory | undefined;
    if (asset.category === 'building_ref') spriteCategory = 'building_sprite';
    else if (asset.category === 'character_ref') spriteCategory = 'npc';
    else if (asset.category === 'vehicle_ref') spriteCategory = 'npc';
    else if (asset.category === 'effect_ref') spriteCategory = 'effect';
    else if (asset.category === 'terrain_ref') spriteCategory = 'terrain';

    if (spriteCategory) {
      openGenerateModal(spriteCategory, { id: asset.id, asset_key: asset.asset_key });
    }
  };

  // Render grid section based on tab config
  const renderGridSection = (tab: TabConfig) => {
    const sections = [];

    // Reference section (if applicable)
    if (tab.refCategory) {
      sections.push(
        <AssetGrid
          key={`${tab.key}-ref`}
          category={tab.refCategory}
          title="Reference Sheets"
          onPreview={setPreviewAsset}
          onGenerate={() => openGenerateModal(tab.refCategory)}
          onGenerateSprite={handleGenerateSprite}
          showGenerateSprite={true}
          refreshTrigger={refreshTrigger}
        />
      );
    }

    // Sprite section (if applicable and different from ref category's sprite handling)
    if (tab.spriteCategory && tab.key !== 'avatars') {
      sections.push(
        <AssetGrid
          key={`${tab.key}-sprite`}
          category={tab.spriteCategory}
          title="Sprites"
          onPreview={setPreviewAsset}
          onGenerate={() => openGenerateModal(tab.spriteCategory)}
          refreshTrigger={refreshTrigger}
        />
      );
    }

    // Standalone section
    if (tab.standaloneCategory) {
      sections.push(
        <AssetGrid
          key={`${tab.key}-standalone`}
          category={tab.standaloneCategory}
          title={tab.label}
          onPreview={setPreviewAsset}
          onGenerate={() => openGenerateModal(tab.standaloneCategory)}
          refreshTrigger={refreshTrigger}
        />
      );
    }

    // Special handling for avatars tab
    if (tab.key === 'avatars') {
      sections.push(
        <AssetGrid
          key="avatars-sprites"
          category="avatar"
          title="Avatar Sprites"
          onPreview={setPreviewAsset}
          onGenerate={() => openGenerateModal('avatar')}
          refreshTrigger={refreshTrigger}
        />
      );
    }

    return sections;
  };

  // Access denied
  if (!isMasterAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">Access Denied</h2>
          <p className="text-red-700 dark:text-red-300 mt-2">
            Only master administrators can access the asset management system.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Image className="w-8 h-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Asset Management
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Generate, review, and publish game assets
              </p>
            </div>
          </div>
          <QueueStatus onQueueChange={handleRefresh} />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-1 overflow-x-auto">
          {/* Asset Category Tabs */}
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors',
                activeTab === tab.key
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}

          {/* Separator */}
          <div className="border-l border-gray-300 dark:border-gray-600 mx-2 my-2" />

          {/* Management Tabs */}
          {MANAGEMENT_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={clsx(
                  'py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors flex items-center gap-1.5',
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Management Tabs Content */}
        {activeTab === 'asset-manager' && <AssetManager />}
        {activeTab === 'avatar-preview' && <AvatarAssets />}
        {activeTab === 'scene-templates' && <SceneTemplates />}

        {/* Asset Category Tabs Content */}
        {!MANAGEMENT_TABS.some(t => t.key === activeTab) && renderGridSection(currentTab)}
      </div>

      {/* Preview Modal */}
      {previewAsset && (
        <AssetPreviewModal
          asset={previewAsset}
          onClose={() => setPreviewAsset(null)}
          onUpdate={handleRefresh}
        />
      )}

      {/* Generate Modal */}
      {showGenerateModal && (
        <GenerateModal
          onClose={() => {
            setShowGenerateModal(false);
            setGenerateCategory(undefined);
            setGenerateParent(undefined);
          }}
          onSuccess={handleRefresh}
          initialCategory={generateCategory}
          parentAsset={generateParent}
        />
      )}
    </div>
  );
}
