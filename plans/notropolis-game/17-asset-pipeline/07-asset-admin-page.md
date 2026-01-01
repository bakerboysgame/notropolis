# Stage 07: Asset Admin Page

## Objective

Build a comprehensive admin interface for the **staged asset generation workflow**:

1. **Generate** reference sheets/assets
2. **Review** and either **Approve** or **Reject with feedback**
3. If rejected, feedback is incorporated into prompt → **Regenerate**
4. Once approved, **Generate sprites** from approved references
5. Same review cycle for sprites

## Key Features

- **Staged Workflow**: Reference sheets must be approved before sprites can be generated
- **Feedback Loop**: Rejection notes update the prompt for smarter regeneration
- **Prompt History**: See how the prompt evolved through rejections
- **Parent-Child Links**: Sprites show their source reference sheet
- **Audit Log**: Track all asset actions for debugging and accountability
- **Building Manager**: Configure which sprites are live in-game, set prices

## Dependencies

`[Requires: Stages 01-06 complete]` - Database schema and assets should exist.

## Complexity

**High** - Full CRUD interface with staged workflow, feedback loop, and approval system.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add route for asset admin |
| `src/components/Sidebar.tsx` | Add "Assets" menu item for admin |

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/AssetAdminPage.tsx` | Main admin page |
| `src/components/assets/AssetGrid.tsx` | Grid display of assets |
| `src/components/assets/AssetCard.tsx` | Individual asset card |
| `src/components/assets/AssetPreviewModal.tsx` | Large preview with actions |
| `src/components/assets/GenerateModal.tsx` | New generation dialog |
| `src/components/assets/OverlayPreview.tsx` | Test effect on building |
| `src/components/assets/QueueStatus.tsx` | Generation queue display |
| `src/services/assetApi.ts` | API client for asset operations |

---

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    STAGED ASSET WORKFLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STAGE 1: Reference Sheets                                       │
│  ─────────────────────────                                       │
│                                                                  │
│  [Generate Ref] → [Review] ─┬─→ [✓ Approve] → Ready for Sprites │
│                             │                                    │
│                             └─→ [✗ Reject + Notes]               │
│                                       ↓                          │
│                                 Prompt Updated                   │
│                                       ↓                          │
│                              [🔄 Regenerate]                     │
│                                       ↓                          │
│                                 [Review] ───→ ...                │
│                                                                  │
│  STAGE 2: Sprites (requires approved ref)                        │
│  ────────────────────────────────────────                        │
│                                                                  │
│  [Generate from Ref] → [Review] ─┬─→ [✓ Approve]                │
│         ↑                        │       ↓                       │
│    Uses approved ref             │   [Remove BG]                 │
│                                  │       ↓                       │
│                                  │   [Publish to R2]             │
│                                  │                               │
│                                  └─→ [✗ Reject + Notes] → ...   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Asset Management                                    [Queue: 2] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  WORKFLOW TABS:                                                  │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐       │
│  │ 📋 References  │ │ 🎮 Sprites     │ │ 🖼️ Other       │       │
│  │ (Stage 1)      │ │ (Stage 2)      │ │ (Standalone)   │       │
│  └────────────────┘ └────────────────┘ └────────────────┘       │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  [Buildings ▼] [Status ▼] [Search...        ]  [+ Generate]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Restaurant Reference                              [v3]       ││
│  │ ┌────────────┐                                               ││
│  │ │            │  Status: ✓ APPROVED                          ││
│  │ │   [img]    │  Rejections: 2                                ││
│  │ │            │  Prompt v3 (feedback incorporated)            ││
│  │ └────────────┘                                               ││
│  │                                                              ││
│  │ [👁 Preview] [📜 History] [🎮 Generate Sprite]               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Casino Reference                                  [v1]       ││
│  │ ┌────────────┐                                               ││
│  │ │            │  Status: 🔄 REVIEW                            ││
│  │ │   [img]    │  Rejections: 0                                ││
│  │ │            │  Prompt v1 (original)                         ││
│  │ └────────────┘                                               ││
│  │                                                              ││
│  │ [👁 Preview] [✓ Approve] [✗ Reject]                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Motel Reference                                   [v2]       ││
│  │ ┌────────────┐                                               ││
│  │ │            │  Status: ❌ REJECTED                          ││
│  │ │   [img]    │  Rejections: 1                                ││
│  │ │            │  Prompt v2 (feedback incorporated)            ││
│  │ └────────────┘                                               ││
│  │                                                              ││
│  │ [👁 Preview] [📜 History] [🔄 Regenerate] [↩ Reset Prompt]   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### API Client: `src/services/assetApi.ts`

```typescript
import { apiHelpers } from './api'; // Import existing auth helper

const API_BASE = '/api/admin/assets';

// Helper to get auth token from existing auth system
const getToken = () => apiHelpers.getToken();

export interface Asset {
    id: number;
    category: string;
    asset_key: string;
    variant: number;

    // Prompt management
    base_prompt: string;
    current_prompt: string;
    prompt_version: number;

    // Storage
    r2_key_private: string | null;
    r2_key_public: string | null;
    r2_url: string | null;

    // Status
    status: 'pending' | 'generating' | 'review' | 'approved' | 'rejected';
    background_removed: boolean;
    rejection_count: number;

    // Parent relationship
    parent_asset_id: number | null;

    // Timestamps
    approved_at: string | null;
    approved_by: string | null;
    created_at: string;
    updated_at: string;
    error_message: string | null;
}

export interface Rejection {
    id: number;
    asset_id: number;
    rejected_by: string;
    rejection_reason: string;
    prompt_at_rejection: string;
    prompt_version: number;
    created_at: string;
}

export interface QueueItem {
    id: number;
    asset_id: number;
    category: string;
    asset_key: string;
    status: string;
    attempts: number;
}

export const assetApi = {
    // List assets by category
    async list(category: string): Promise<Asset[]> {
        const res = await fetch(`${API_BASE}/list/${category}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        return data.assets;
    },

    // Get queue status
    async getQueue(): Promise<QueueItem[]> {
        const res = await fetch(`${API_BASE}/queue`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        return data.queue;
    },

    // Generate new asset
    async generate(category: string, assetKey: string, prompt: string, variant = 1): Promise<any> {
        const res = await fetch(`${API_BASE}/generate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ category, asset_key: assetKey, prompt, variant })
        });
        return res.json();
    },

    // Remove background
    async removeBackground(assetId: number): Promise<any> {
        const res = await fetch(`${API_BASE}/remove-background/${assetId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        return res.json();
    },

    // Approve asset
    async approve(assetId: number): Promise<any> {
        const res = await fetch(`${API_BASE}/approve/${assetId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        return res.json();
    },

    // Reject asset WITH feedback (updates prompt for next generation)
    async reject(assetId: number, reason: string, incorporateFeedback = true): Promise<any> {
        const res = await fetch(`${API_BASE}/reject/${assetId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason, incorporate_feedback: incorporateFeedback })
        });
        return res.json();
    },

    // Regenerate with updated prompt (uses feedback from rejections)
    async regenerate(assetId: number): Promise<any> {
        const res = await fetch(`${API_BASE}/regenerate/${assetId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        return res.json();
    },

    // Get rejection history for an asset
    async getRejections(assetId: number): Promise<Rejection[]> {
        const res = await fetch(`${API_BASE}/rejections/${assetId}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        return data.rejections;
    },

    // Generate sprite FROM an approved reference sheet
    async generateFromRef(refId: number, spritePrompt: string, variant = 1): Promise<any> {
        const res = await fetch(`${API_BASE}/generate-from-ref/${refId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sprite_prompt: spritePrompt, variant })
        });
        return res.json();
    },

    // Get approved refs ready for sprite generation
    async getApprovedRefs(): Promise<Asset[]> {
        const res = await fetch(`${API_BASE}/approved-refs`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        return data.refs;
    },

    // Reset prompt to base (remove all feedback)
    async resetPrompt(assetId: number): Promise<any> {
        const res = await fetch(`${API_BASE}/reset-prompt/${assetId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        return res.json();
    },

    // Batch generate
    async batchGenerate(assets: Array<{category: string, asset_key: string, prompt: string, variant?: number}>): Promise<any> {
        const res = await fetch(`${API_BASE}/batch-generate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ assets })
        });
        return res.json();
    }
};
```

### Main Page: `src/pages/AssetAdminPage.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { assetApi, Asset } from '../services/assetApi';
import AssetGrid from '../components/assets/AssetGrid';
import AssetPreviewModal from '../components/assets/AssetPreviewModal';
import GenerateModal from '../components/assets/GenerateModal';
import QueueStatus from '../components/assets/QueueStatus';

const CATEGORIES = [
    // Reference sheets (generate first, approve, then make sprites)
    { id: 'building_ref', name: 'Building Refs', icon: '🏢', isRef: true },
    { id: 'character_ref', name: 'Character Refs', icon: '🧑', isRef: true },
    { id: 'vehicle_ref', name: 'Vehicle Refs', icon: '🚗', isRef: true },
    { id: 'effect_ref', name: 'Effect Refs', icon: '💥', isRef: true },

    // Sprites (generated from approved refs)
    { id: 'building_sprite', name: 'Building Sprites', icon: '🏠', parentRef: 'building_ref' },
    { id: 'npc', name: 'NPC Sprites', icon: '🚶', parentRef: 'character_ref' },
    { id: 'effect', name: 'Effect Overlays', icon: '✨', parentRef: 'effect_ref' },
    { id: 'avatar', name: 'Avatar Layers', icon: '👤', parentRef: 'character_ref' },

    // Standalone (no ref needed)
    { id: 'terrain', name: 'Terrain Tiles', icon: '🌿' },
    { id: 'scene', name: 'Scenes', icon: '🖼️' },
    { id: 'ui', name: 'UI Elements', icon: '🎯' },
    { id: 'overlay', name: 'Overlays', icon: '🔲' },
];

export default function AssetAdminPage() {
    const [category, setCategory] = useState('building_ref');
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [showGenerate, setShowGenerate] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadAssets();
    }, [category]);

    const loadAssets = async () => {
        setLoading(true);
        try {
            const data = await assetApi.list(category);
            setAssets(data);
        } catch (error) {
            console.error('Failed to load assets:', error);
        }
        setLoading(false);
    };

    const filteredAssets = assets.filter(asset => {
        if (statusFilter !== 'all' && asset.status !== statusFilter) return false;
        if (searchQuery && !asset.asset_key.includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    const handleApprove = async (asset: Asset) => {
        await assetApi.approve(asset.id);
        loadAssets();
        setSelectedAsset(null);
    };

    const handleReject = async (asset: Asset, reason: string) => {
        await assetApi.reject(asset.id, reason);
        loadAssets();
        setSelectedAsset(null);
    };

    const handleRemoveBackground = async (asset: Asset) => {
        await assetApi.removeBackground(asset.id);
        loadAssets();
    };

    const handleRegenerate = async (asset: Asset) => {
        await assetApi.generate(asset.category, asset.asset_key, asset.prompt, asset.variant);
        loadAssets();
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Asset Management</h1>
                <QueueStatus />
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 mb-4">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        className={`px-4 py-2 rounded-lg ${
                            category === cat.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                    >
                        {cat.icon} {cat.name}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-4">
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border rounded-lg"
                >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="generating">Generating</option>
                    <option value="review">Ready for Review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                </select>

                <input
                    type="text"
                    placeholder="Search by key..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="px-3 py-2 border rounded-lg flex-1"
                />

                <button
                    onClick={() => setShowGenerate(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                    + Generate New
                </button>
            </div>

            {/* Asset Grid */}
            {loading ? (
                <div className="text-center py-12">Loading...</div>
            ) : (
                <AssetGrid
                    assets={filteredAssets}
                    onSelect={setSelectedAsset}
                    category={category}
                />
            )}

            {/* Preview Modal */}
            {selectedAsset && (
                <AssetPreviewModal
                    asset={selectedAsset}
                    onClose={() => setSelectedAsset(null)}
                    onApprove={() => handleApprove(selectedAsset)}
                    onReject={(reason) => handleReject(selectedAsset, reason)}
                    onRemoveBackground={() => handleRemoveBackground(selectedAsset)}
                    onRegenerate={() => handleRegenerate(selectedAsset)}
                />
            )}

            {/* Generate Modal */}
            {showGenerate && (
                <GenerateModal
                    category={category}
                    onClose={() => setShowGenerate(false)}
                    onGenerated={loadAssets}
                />
            )}
        </div>
    );
}
```

### Asset Grid: `src/components/assets/AssetGrid.tsx`

```tsx
import React from 'react';
import { Asset } from '../../services/assetApi';
import AssetCard from './AssetCard';

interface Props {
    assets: Asset[];
    onSelect: (asset: Asset) => void;
    category: string;
}

export default function AssetGrid({ assets, onSelect, category }: Props) {
    // Group by asset_key
    const grouped = assets.reduce((acc, asset) => {
        if (!acc[asset.asset_key]) acc[asset.asset_key] = [];
        acc[asset.asset_key].push(asset);
        return acc;
    }, {} as Record<string, Asset[]>);

    if (Object.keys(grouped).length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                No assets in this category yet.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {Object.entries(grouped).map(([key, variants]) => (
                <div key={key} className="border rounded-lg p-4">
                    <h3 className="font-bold mb-3 capitalize">
                        {key.replace(/_/g, ' ')}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {variants.map(asset => (
                            <AssetCard
                                key={asset.id}
                                asset={asset}
                                onClick={() => onSelect(asset)}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
```

### Asset Card: `src/components/assets/AssetCard.tsx`

```tsx
import React from 'react';
import { Asset } from '../../services/assetApi';

interface Props {
    asset: Asset;
    onClick: () => void;
}

const STATUS_ICONS: Record<string, string> = {
    pending: '⏳',
    generating: '🔄',
    review: '👁',
    approved: '✓',
    rejected: '❌'
};

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    generating: 'bg-blue-100 text-blue-800',
    review: 'bg-purple-100 text-purple-800',
    approved: 'bg-green-200 text-green-900',
    rejected: 'bg-red-100 text-red-800'
};

export default function AssetCard({ asset, onClick }: Props) {
    return (
        <div
            onClick={onClick}
            className="border rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
        >
            {/* Thumbnail */}
            <div className="h-32 bg-gray-100 flex items-center justify-center">
                {asset.r2_url ? (
                    <img
                        src={asset.r2_url}
                        alt={asset.asset_key}
                        className="max-h-full max-w-full object-contain"
                    />
                ) : (
                    <span className="text-4xl">🖼️</span>
                )}
            </div>

            {/* Info */}
            <div className="p-2">
                <div className="text-sm font-medium truncate">
                    v{asset.variant}
                </div>
                <div className={`text-xs px-2 py-1 rounded-full inline-block ${STATUS_COLORS[asset.status]}`}>
                    {STATUS_ICONS[asset.status]} {asset.status}
                </div>
                {asset.background_removed && (
                    <span className="text-xs ml-1">🔲</span>
                )}
            </div>
        </div>
    );
}
```

### Preview Modal: `src/components/assets/AssetPreviewModal.tsx`

This modal includes:
- **Image preview** with zoom
- **Prompt history** showing base prompt and incorporated feedback
- **Rejection feedback form** with helpful hints
- **Regenerate** button that uses updated prompt
- **History tab** showing all previous rejections

```tsx
import React, { useState, useEffect } from 'react';
import { Asset, Rejection, assetApi } from '../../services/assetApi';

interface Props {
    asset: Asset;
    onClose: () => void;
    onApprove: () => void;
    onReject: (reason: string, incorporateFeedback: boolean) => void;
    onRemoveBackground: () => void;
    onRegenerate: () => void;
    onResetPrompt: () => void;
    onGenerateSprite?: () => void; // Only for approved refs
}

export default function AssetPreviewModal({
    asset,
    onClose,
    onApprove,
    onReject,
    onRemoveBackground,
    onRegenerate,
    onResetPrompt,
    onGenerateSprite
}: Props) {
    const [rejectReason, setRejectReason] = useState('');
    const [incorporateFeedback, setIncorporateFeedback] = useState(true);
    const [showReject, setShowReject] = useState(false);
    const [activeTab, setActiveTab] = useState<'preview' | 'prompt' | 'history'>('preview');
    const [rejections, setRejections] = useState<Rejection[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Load rejection history when history tab is opened
    useEffect(() => {
        if (activeTab === 'history' && rejections.length === 0) {
            loadHistory();
        }
    }, [activeTab]);

    const loadHistory = async () => {
        setLoadingHistory(true);
        const history = await assetApi.getRejections(asset.id);
        setRejections(history);
        setLoadingHistory(false);
    };

    const isRef = asset.category.endsWith('_ref');
    const canGenerateSprite = isRef && asset.status === 'approved';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-auto">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold capitalize">
                            {asset.asset_key.replace(/_/g, ' ')}
                        </h2>
                        <div className="text-sm text-gray-500">
                            v{asset.variant} • Prompt v{asset.prompt_version} •
                            {asset.rejection_count > 0 && ` ${asset.rejection_count} rejection(s)`}
                        </div>
                    </div>
                    <button onClick={onClose} className="text-2xl">×</button>
                </div>

                {/* Tabs */}
                <div className="border-b flex">
                    <button
                        onClick={() => setActiveTab('preview')}
                        className={`px-4 py-2 ${activeTab === 'preview' ? 'border-b-2 border-blue-600 font-medium' : ''}`}
                    >
                        Preview
                    </button>
                    <button
                        onClick={() => setActiveTab('prompt')}
                        className={`px-4 py-2 ${activeTab === 'prompt' ? 'border-b-2 border-blue-600 font-medium' : ''}`}
                    >
                        Prompt {asset.prompt_version > 1 && `(v${asset.prompt_version})`}
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 ${activeTab === 'history' ? 'border-b-2 border-blue-600 font-medium' : ''}`}
                    >
                        History {asset.rejection_count > 0 && `(${asset.rejection_count})`}
                    </button>
                </div>

                {/* Tab Content */}
                <div className="p-4">
                    {activeTab === 'preview' && (
                        <div className="bg-gray-100 flex items-center justify-center min-h-[400px] rounded">
                            {asset.r2_url ? (
                                <img
                                    src={asset.r2_url}
                                    alt={asset.asset_key}
                                    className="max-w-full max-h-[500px] object-contain"
                                    style={{ imageRendering: 'pixelated' }}
                                />
                            ) : (
                                <span className="text-gray-400">No image yet</span>
                            )}
                        </div>
                    )}

                    {activeTab === 'prompt' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-medium mb-2">Current Prompt (v{asset.prompt_version})</h3>
                                <pre className="p-3 bg-gray-100 rounded text-sm overflow-auto max-h-60 whitespace-pre-wrap">
                                    {asset.current_prompt}
                                </pre>
                            </div>
                            {asset.prompt_version > 1 && (
                                <div>
                                    <h3 className="font-medium mb-2">Original Base Prompt</h3>
                                    <pre className="p-3 bg-blue-50 rounded text-sm overflow-auto max-h-40 whitespace-pre-wrap">
                                        {asset.base_prompt}
                                    </pre>
                                    <button
                                        onClick={onResetPrompt}
                                        className="mt-2 text-sm text-blue-600 hover:underline"
                                    >
                                        ↩ Reset to base prompt (remove all feedback)
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div>
                            {loadingHistory ? (
                                <div className="text-center py-8">Loading history...</div>
                            ) : rejections.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    No rejections yet. Asset was approved on first attempt.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {rejections.map((rej, idx) => (
                                        <div key={rej.id} className="border rounded p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-medium">
                                                    Rejection #{rejections.length - idx}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {new Date(rej.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="bg-red-50 p-3 rounded mb-3">
                                                <strong>Feedback:</strong> {rej.rejection_reason}
                                            </div>
                                            <details className="text-sm">
                                                <summary className="cursor-pointer text-gray-600">
                                                    Prompt v{rej.prompt_version} at rejection
                                                </summary>
                                                <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-32 whitespace-pre-wrap">
                                                    {rej.prompt_at_rejection}
                                                </pre>
                                            </details>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Status Bar */}
                <div className="p-4 border-t bg-gray-50">
                    <div className="flex items-center gap-4 mb-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            asset.status === 'approved' ? 'bg-green-100 text-green-800' :
                            asset.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            asset.status === 'review' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                        }`}>
                            {asset.status.toUpperCase()}
                        </span>
                        {asset.background_removed && (
                            <span className="text-sm">✓ Background removed</span>
                        )}
                        {asset.parent_asset_id && (
                            <span className="text-sm text-blue-600">
                                📋 From ref #{asset.parent_asset_id}
                            </span>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                        {(asset.status === 'review' || asset.status === 'completed') && (
                            <>
                                <button
                                    onClick={onApprove}
                                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                    ✓ Approve
                                </button>
                                <button
                                    onClick={() => setShowReject(!showReject)}
                                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                    ✗ Reject with Feedback
                                </button>
                            </>
                        )}

                        {asset.status === 'rejected' && (
                            <button
                                onClick={onRegenerate}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                🔄 Regenerate (with feedback)
                            </button>
                        )}

                        {canGenerateSprite && onGenerateSprite && (
                            <button
                                onClick={onGenerateSprite}
                                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                            >
                                🎮 Generate Sprite from This Ref
                            </button>
                        )}

                        {!asset.background_removed && asset.r2_url && asset.status === 'approved' && (
                            <button
                                onClick={onRemoveBackground}
                                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                            >
                                🔲 Remove Background
                            </button>
                        )}
                    </div>

                    {/* Rejection Form */}
                    {showReject && (
                        <div className="mt-4 p-4 bg-red-50 rounded">
                            <h3 className="font-medium mb-2">Rejection Feedback</h3>
                            <p className="text-sm text-gray-600 mb-3">
                                Describe what's wrong. This feedback will be added to the prompt
                                for the next generation attempt.
                            </p>
                            <textarea
                                placeholder="e.g., 'The building looks too modern, needs more 90s CGI chunky style. Door should be on the left side, not center.'"
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                className="w-full p-3 border rounded h-24"
                            />
                            <div className="mt-2 flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="incorporate"
                                    checked={incorporateFeedback}
                                    onChange={e => setIncorporateFeedback(e.target.checked)}
                                />
                                <label htmlFor="incorporate" className="text-sm">
                                    Incorporate feedback into prompt for next generation
                                </label>
                            </div>
                            <button
                                onClick={() => {
                                    if (rejectReason.trim()) {
                                        onReject(rejectReason, incorporateFeedback);
                                    }
                                }}
                                disabled={!rejectReason.trim()}
                                className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
```

---

## Sidebar Integration

Add to `src/components/Sidebar.tsx`:

```tsx
// 1. Add to imports at top of file:
import { Image } from 'lucide-react'

// 2. In the master_admin section (around line 183), add:
items.push({ name: 'Assets', href: '/admin/assets', icon: Image, pageKey: 'admin_assets', requiresMasterAdmin: true })
```

Add to `src/App.tsx`:

```tsx
// 1. Add import at top:
import AssetAdminPage from './pages/AssetAdminPage';

// 2. Add route after other admin routes (after /admin/moderation, around line 313):
<Route path="/admin/assets" element={
  <ProtectedRoute>
    <ProtectedPageRoute pageKey="admin_assets">
      <Layout>
        <AssetAdminPage />
      </Layout>
    </ProtectedPageRoute>
  </ProtectedRoute>
} />
```

---

## Test Cases

### 1. Page Load
- Navigate to `/admin/assets`
- Should show category tabs and empty state or existing assets

### 2. Category Switching
- Click each category tab
- Should load assets for that category

### 3. Asset Preview
- Click an asset card
- Modal should open with full preview and actions

### 4. Approve/Reject
- In preview modal, click Approve
- Asset status should update to "approved"

### 5. Background Removal
- Click "Remove Background" on a sprite
- Should process and show transparent version

### 6. Regenerate
- Click "Regenerate" on any asset
- Should create new generation (may take time)

---

## Acceptance Checklist

- [ ] Asset admin page accessible at `/admin/assets`
- [ ] Admin-only route protection working
- [ ] Category tabs switch between asset types
- [ ] Asset grid displays all assets with thumbnails
- [ ] Status filter works correctly
- [ ] Search filter works correctly
- [ ] Preview modal shows full asset details
- [ ] Approve button updates status
- [ ] Reject button with reason works
- [ ] Remove background triggers API
- [ ] Regenerate triggers new generation
- [ ] Queue status displays pending generations
- [ ] Generate new modal works
- [ ] Mobile-responsive layout

---

## Deployment

```bash
# 1. Build and deploy frontend
cd authentication-dashboard-system
npm run build
# Deploy built assets

# 2. Test admin page
# Navigate to /admin/assets as admin user

# 3. Verify all functionality
```

---

## Building Manager Tab

A dedicated tab for managing which sprites are live in the game and configuring building prices.

### Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Asset Management                                    [Queue: 2] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TABS:                                                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────┐ │
│  │ 📋 Assets    │ │ 🏢 Buildings │ │ 📜 Audit Log │ │ 🔧 ...  │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────┘ │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  BUILDING MANAGER                                                │
│  Configure which sprites are live in-game                        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Market Stall                                                ││
│  │  ┌────────┐  Sprite: [v1 ▼] (3 available)                   ││
│  │  │        │  Cost: $1,000 → [Override: $____]                ││
│  │  │ [img]  │  Profit: $100 → [Override: $____]                ││
│  │  │        │                                                  ││
│  │  └────────┘  Status: 🟢 PUBLISHED                            ││
│  │                                                              ││
│  │  [📋 View Sprites] [💾 Save Changes] [🚫 Unpublish]          ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Restaurant                                                  ││
│  │  ┌────────┐  Sprite: [Select...] (0 available)              ││
│  │  │        │  Cost: $40,000                                   ││
│  │  │  [?]   │  Profit: $4,000                                  ││
│  │  │        │  Level Required: 3 | License: Yes                ││
│  │  └────────┘                                                  ││
│  │              Status: ⚪ NO SPRITE                             ││
│  │                                                              ││
│  │  [🎮 Generate Sprite First]                                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### API Client Extensions: `src/services/assetApi.ts`

```typescript
// Add to existing assetApi object

export interface BuildingConfig {
    building_type_id: string;
    building_name: string;
    default_cost: number;
    default_profit: number;
    level_required: number;
    requires_license: number;
    config_id: number | null;
    active_sprite_id: number | null;
    cost_override: number | null;
    base_profit_override: number | null;
    effective_cost: number;
    effective_profit: number;
    is_published: boolean;
    published_at: string | null;
    sprite_url: string | null;
    sprite_status: string | null;
    available_sprites: number;
}

export interface AuditLogEntry {
    id: number;
    action: string;
    asset_id: number | null;
    actor: string;
    details: string; // JSON
    created_at: string;
    asset_key?: string;
    category?: string;
}

export const buildingManagerApi = {
    // List all building types with configs
    async listBuildings(): Promise<BuildingConfig[]> {
        const res = await fetch(`${API_BASE}/buildings`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        return data.buildings;
    },

    // Get available sprites for a building type
    async getSprites(buildingType: string): Promise<Asset[]> {
        const res = await fetch(`${API_BASE}/buildings/${buildingType}/sprites`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        return data.sprites;
    },

    // Update building config
    async updateConfig(
        buildingType: string,
        config: {
            active_sprite_id?: number;
            cost_override?: number | null;
            base_profit_override?: number | null;
        }
    ): Promise<any> {
        const res = await fetch(`${API_BASE}/buildings/${buildingType}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        return res.json();
    },

    // Publish config to game
    async publish(buildingType: string): Promise<any> {
        const res = await fetch(`${API_BASE}/buildings/${buildingType}/publish`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        return res.json();
    },

    // Unpublish (revert to draft)
    async unpublish(buildingType: string): Promise<any> {
        const res = await fetch(`${API_BASE}/buildings/${buildingType}/unpublish`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        return res.json();
    }
};

export const auditApi = {
    // Get recent audit log
    async getRecent(limit = 50): Promise<AuditLogEntry[]> {
        const res = await fetch(`${API_BASE}/audit?limit=${limit}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        return data.logs;
    },

    // Get audit log for specific asset
    async getForAsset(assetId: number): Promise<AuditLogEntry[]> {
        const res = await fetch(`${API_BASE}/audit/${assetId}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        return data.logs;
    }
};
```

### Building Manager Component: `src/components/assets/BuildingManager.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { BuildingConfig, buildingManagerApi, Asset } from '../../services/assetApi';

export default function BuildingManager() {
    const [buildings, setBuildings] = useState<BuildingConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
    const [sprites, setSprites] = useState<Asset[]>([]);
    const [saving, setSaving] = useState<string | null>(null);

    useEffect(() => {
        loadBuildings();
    }, []);

    const loadBuildings = async () => {
        setLoading(true);
        const data = await buildingManagerApi.listBuildings();
        setBuildings(data);
        setLoading(false);
    };

    const loadSprites = async (buildingType: string) => {
        setSelectedBuilding(buildingType);
        const data = await buildingManagerApi.getSprites(buildingType);
        setSprites(data);
    };

    const handleSpriteChange = async (buildingType: string, spriteId: number) => {
        setSaving(buildingType);
        await buildingManagerApi.updateConfig(buildingType, { active_sprite_id: spriteId });
        await loadBuildings();
        setSaving(null);
    };

    const handlePublish = async (buildingType: string) => {
        setSaving(buildingType);
        await buildingManagerApi.publish(buildingType);
        await loadBuildings();
        setSaving(null);
    };

    const handleUnpublish = async (buildingType: string) => {
        setSaving(buildingType);
        await buildingManagerApi.unpublish(buildingType);
        await loadBuildings();
        setSaving(null);
    };

    if (loading) {
        return <div className="text-center py-12">Loading buildings...</div>;
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold">Building Manager</h2>
            <p className="text-gray-600">Configure which sprites are live in the game.</p>

            {buildings.map(building => (
                <div key={building.building_type_id} className="border rounded-lg p-4">
                    <div className="flex gap-4">
                        {/* Sprite Preview */}
                        <div className="w-24 h-24 bg-gray-100 rounded flex items-center justify-center">
                            {building.sprite_url ? (
                                <img
                                    src={building.sprite_url}
                                    alt={building.building_name}
                                    className="max-w-full max-h-full object-contain"
                                />
                            ) : (
                                <span className="text-gray-400 text-2xl">?</span>
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1">
                            <h3 className="font-bold">{building.building_name}</h3>
                            <div className="text-sm text-gray-600">
                                Level {building.level_required}
                                {building.requires_license ? ' • License Required' : ''}
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span className="text-gray-500">Cost:</span>{' '}
                                    ${building.effective_cost.toLocaleString()}
                                    {building.cost_override && (
                                        <span className="text-blue-600 ml-1">(override)</span>
                                    )}
                                </div>
                                <div>
                                    <span className="text-gray-500">Profit:</span>{' '}
                                    ${building.effective_profit.toLocaleString()}
                                    {building.base_profit_override && (
                                        <span className="text-blue-600 ml-1">(override)</span>
                                    )}
                                </div>
                            </div>

                            {/* Sprite Selector */}
                            <div className="mt-2">
                                <span className="text-sm text-gray-500">Sprite:</span>
                                {building.available_sprites > 0 ? (
                                    <button
                                        onClick={() => loadSprites(building.building_type_id)}
                                        className="ml-2 text-sm text-blue-600 hover:underline"
                                    >
                                        {building.active_sprite_id
                                            ? `Selected (${building.available_sprites} available)`
                                            : `Choose from ${building.available_sprites} sprites`
                                        }
                                    </button>
                                ) : (
                                    <span className="ml-2 text-sm text-gray-400">
                                        No approved sprites yet
                                    </span>
                                )}
                            </div>

                            {/* Status */}
                            <div className="mt-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    building.is_published
                                        ? 'bg-green-100 text-green-800'
                                        : building.active_sprite_id
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {building.is_published
                                        ? '🟢 PUBLISHED'
                                        : building.active_sprite_id
                                            ? '🟡 DRAFT'
                                            : '⚪ NO SPRITE'
                                    }
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                            {building.active_sprite_id && !building.is_published && (
                                <button
                                    onClick={() => handlePublish(building.building_type_id)}
                                    disabled={saving === building.building_type_id}
                                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                                >
                                    Publish
                                </button>
                            )}
                            {building.is_published && (
                                <button
                                    onClick={() => handleUnpublish(building.building_type_id)}
                                    disabled={saving === building.building_type_id}
                                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                                >
                                    Unpublish
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Sprite Selection Modal (inline) */}
                    {selectedBuilding === building.building_type_id && sprites.length > 0 && (
                        <div className="mt-4 p-3 bg-gray-50 rounded">
                            <h4 className="font-medium mb-2">Select Sprite</h4>
                            <div className="flex gap-2 flex-wrap">
                                {sprites.map(sprite => (
                                    <button
                                        key={sprite.id}
                                        onClick={() => {
                                            handleSpriteChange(building.building_type_id, sprite.id);
                                            setSelectedBuilding(null);
                                        }}
                                        className={`p-2 border rounded ${
                                            sprite.id === building.active_sprite_id
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-400'
                                        }`}
                                    >
                                        <img
                                            src={sprite.r2_url || ''}
                                            alt={`v${sprite.variant}`}
                                            className="w-16 h-16 object-contain"
                                        />
                                        <div className="text-xs text-center">v{sprite.variant}</div>
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setSelectedBuilding(null)}
                                className="mt-2 text-sm text-gray-500 hover:underline"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
```

### Audit Log Component: `src/components/assets/AuditLog.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { AuditLogEntry, auditApi } from '../../services/assetApi';

const ACTION_LABELS: Record<string, string> = {
    generate: '🎨 Generate',
    approve: '✅ Approve',
    reject: '❌ Reject',
    regenerate: '🔄 Regenerate',
    remove_bg: '🔲 Remove BG',
    publish: '📤 Publish',
    reset_prompt: '↩ Reset Prompt',
    update_building_config: '⚙️ Update Config',
    publish_building: '🏢 Publish Building',
    unpublish_building: '🚫 Unpublish Building'
};

export default function AuditLog() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        setLoading(true);
        const data = await auditApi.getRecent(100);
        setLogs(data);
        setLoading(false);
    };

    if (loading) {
        return <div className="text-center py-12">Loading audit log...</div>;
    }

    return (
        <div>
            <h2 className="text-xl font-bold mb-4">Audit Log</h2>

            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="text-left p-2">Time</th>
                        <th className="text-left p-2">Action</th>
                        <th className="text-left p-2">Asset</th>
                        <th className="text-left p-2">Actor</th>
                        <th className="text-left p-2">Details</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map(log => (
                        <tr key={log.id} className="border-b hover:bg-gray-50">
                            <td className="p-2 text-sm text-gray-500">
                                {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="p-2">
                                {ACTION_LABELS[log.action] || log.action}
                            </td>
                            <td className="p-2">
                                {log.asset_key ? (
                                    <span className="text-blue-600">
                                        {log.category}/{log.asset_key}
                                    </span>
                                ) : (
                                    <span className="text-gray-400">—</span>
                                )}
                            </td>
                            <td className="p-2 text-sm">{log.actor}</td>
                            <td className="p-2 text-sm text-gray-600">
                                {log.details !== '{}' && (
                                    <details>
                                        <summary className="cursor-pointer">View</summary>
                                        <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto">
                                            {JSON.stringify(JSON.parse(log.details), null, 2)}
                                        </pre>
                                    </details>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
```

---

## Avatar Assets Tab

A dedicated tab for generating and managing avatar layer assets (base bodies, hair, outfits, headwear, accessories, backgrounds).

### Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Asset Management                                    [Queue: 2] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TABS:                                                           │
│  ┌───────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌─────────┐ │
│  │Assets │ │Buildings │ │ Avatars  │ │  Scenes   │ │Audit Log│ │
│  └───────┘ └──────────┘ └──────────┘ └───────────┘ └─────────┘ │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  AVATAR ASSETS                                                   │
│  Generate and manage avatar layer components                     │
│                                                                  │
│  Category: [Base Body ▼] [Hair ▼] [Outfit ▼] [Headwear ▼] ...   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Base Body - Male                                    [v1]    ││
│  │  ┌────────────┐                                              ││
│  │  │            │  Status: ✓ APPROVED                         ││
│  │  │   [img]    │  512×512 PNG                                 ││
│  │  │  (layers)  │  Layer: base_body                            ││
│  │  └────────────┘  BG Removed: ✓                               ││
│  │                                                              ││
│  │  [👁 Preview] [📜 History] [🔄 Regenerate]                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Outfit - Business Suit                              [v2]    ││
│  │  ┌────────────┐                                              ││
│  │  │            │  Status: 🔄 REVIEW                           ││
│  │  │   [img]    │  512×512 PNG                                 ││
│  │  │            │  Layer: outfit                               ││
│  │  └────────────┘  Rejections: 1                               ││
│  │                                                              ││
│  │  [👁 Preview] [✓ Approve] [✗ Reject]                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  COMPOSITE PREVIEW (drag layers)                                 │
│  ┌────────────────────────────────────────────────────┐         │
│  │  ┌─────────┐                                       │         │
│  │  │ Avatar  │  Layers:                              │         │
│  │  │ Preview │  [✓] Background: gradient_sunset      │         │
│  │  │         │  [✓] Base: male                       │         │
│  │  │ (512px) │  [✓] Outfit: business_suit            │         │
│  │  │         │  [✓] Hair: slick_back                 │         │
│  │  │         │  [ ] Headwear: none                   │         │
│  │  └─────────┘  [✓] Accessory: cigar                 │         │
│  │                                                    │         │
│  │  [Export PNG] [Test in Scene]                      │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Avatar Categories

| Category | Asset Key Pattern | Count | Notes |
|----------|-------------------|-------|-------|
| base_body | `avatar_body_{male/female}` | 2 | No clothes, neutral pose |
| hair | `avatar_hair_{style}` | 6 | Transparent, positioned for head |
| outfit | `avatar_outfit_{type}` | 8 | Full body clothing |
| headwear | `avatar_headwear_{type}` | 6 | Hats, glasses, etc. |
| accessory | `avatar_accessory_{type}` | 6 | Cigar, jewelry, etc. |
| avatar_bg | `avatar_bg_{type}` | 4 | Scene backgrounds |

### API Client Extensions: `src/services/assetApi.ts`

```typescript
// Add to existing assetApi object

export interface AvatarAsset extends Asset {
    layer_type: 'base_body' | 'hair' | 'outfit' | 'headwear' | 'accessory' | 'avatar_bg';
    layer_order: number;
}

export interface AvatarComposite {
    company_id: string;
    context: string;
    r2_url: string;
    avatar_hash: string;
    created_at: string;
}

export const avatarAssetApi = {
    // List avatar assets by layer type
    async listByLayer(layerType: string): Promise<AvatarAsset[]> {
        const res = await fetch(`${API_BASE}/avatar/layers/${layerType}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        return data.assets;
    },

    // Generate new avatar asset
    async generate(layerType: string, assetKey: string, prompt: string): Promise<any> {
        const res = await fetch(`${API_BASE}/avatar/generate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ layer_type: layerType, asset_key: assetKey, prompt })
        });
        return res.json();
    },

    // Get all approved assets for composite preview
    async getApprovedLayers(): Promise<Record<string, AvatarAsset[]>> {
        const res = await fetch(`${API_BASE}/avatar/approved`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        return data.layers;
    },

    // Upload composed avatar (from admin preview)
    async uploadComposite(companyId: string, imageData: string, context = 'main'): Promise<any> {
        const res = await fetch(`${API_BASE}/avatar/composite/${companyId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image_data: imageData, context })
        });
        return res.json();
    },

    // Batch generate all avatar assets from prompts
    async batchGenerate(assets: Array<{layer_type: string, asset_key: string, prompt: string}>): Promise<any> {
        const res = await fetch(`${API_BASE}/avatar/batch-generate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ assets })
        });
        return res.json();
    }
};
```

### Avatar Assets Component: `src/components/assets/AvatarAssets.tsx`

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { AvatarAsset, avatarAssetApi } from '../../services/assetApi';

const LAYER_TYPES = [
    { id: 'base_body', name: 'Base Body', order: 1 },
    { id: 'hair', name: 'Hair', order: 4 },
    { id: 'outfit', name: 'Outfit', order: 3 },
    { id: 'headwear', name: 'Headwear', order: 5 },
    { id: 'accessory', name: 'Accessory', order: 6 },
    { id: 'avatar_bg', name: 'Background', order: 0 }
];

export default function AvatarAssets() {
    const [layerType, setLayerType] = useState('base_body');
    const [assets, setAssets] = useState<AvatarAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAsset, setSelectedAsset] = useState<AvatarAsset | null>(null);

    // Composite preview state
    const [previewLayers, setPreviewLayers] = useState<Record<string, AvatarAsset | null>>({});
    const [approvedLayers, setApprovedLayers] = useState<Record<string, AvatarAsset[]>>({});
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        loadAssets();
        loadApprovedLayers();
    }, [layerType]);

    const loadAssets = async () => {
        setLoading(true);
        const data = await avatarAssetApi.listByLayer(layerType);
        setAssets(data);
        setLoading(false);
    };

    const loadApprovedLayers = async () => {
        const data = await avatarAssetApi.getApprovedLayers();
        setApprovedLayers(data);
    };

    // Render composite preview to canvas
    useEffect(() => {
        renderComposite();
    }, [previewLayers]);

    const renderComposite = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, 512, 512);

        // Sort layers by order and draw
        const sortedLayers = LAYER_TYPES
            .filter(lt => previewLayers[lt.id])
            .sort((a, b) => a.order - b.order);

        for (const layer of sortedLayers) {
            const asset = previewLayers[layer.id];
            if (asset?.r2_url) {
                const img = await loadImage(asset.r2_url);
                ctx.drawImage(img, 0, 0, 512, 512);
            }
        }
    };

    const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    };

    const exportComposite = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'avatar_composite.png';
        link.href = dataUrl;
        link.click();
    };

    return (
        <div className="grid grid-cols-3 gap-6">
            {/* Left: Asset List */}
            <div className="col-span-2">
                <h2 className="text-xl font-bold mb-4">Avatar Assets</h2>

                {/* Layer Type Tabs */}
                <div className="flex gap-2 mb-4 flex-wrap">
                    {LAYER_TYPES.map(lt => (
                        <button
                            key={lt.id}
                            onClick={() => setLayerType(lt.id)}
                            className={`px-3 py-1 rounded ${
                                layerType === lt.id
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-200 hover:bg-gray-300'
                            }`}
                        >
                            {lt.name}
                        </button>
                    ))}
                </div>

                {/* Asset Grid */}
                {loading ? (
                    <div className="text-center py-12">Loading...</div>
                ) : assets.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        No {layerType} assets yet.
                        <button className="block mx-auto mt-4 px-4 py-2 bg-green-600 text-white rounded">
                            + Generate {layerType} Assets
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-4">
                        {assets.map(asset => (
                            <div
                                key={asset.id}
                                onClick={() => setSelectedAsset(asset)}
                                className="border rounded-lg overflow-hidden cursor-pointer hover:shadow-lg"
                            >
                                <div className="h-32 bg-gray-100 flex items-center justify-center">
                                    {asset.r2_url ? (
                                        <img
                                            src={asset.r2_url}
                                            alt={asset.asset_key}
                                            className="max-h-full max-w-full object-contain"
                                        />
                                    ) : (
                                        <span className="text-4xl">👤</span>
                                    )}
                                </div>
                                <div className="p-2">
                                    <div className="text-sm font-medium truncate">
                                        {asset.asset_key.replace('avatar_', '')}
                                    </div>
                                    <div className="flex gap-2">
                                        <span className={`text-xs px-2 py-1 rounded ${
                                            asset.status === 'approved' ? 'bg-green-100 text-green-800' :
                                            asset.status === 'review' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-gray-100'
                                        }`}>
                                            {asset.status}
                                        </span>
                                        {asset.background_removed && (
                                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                                Transparent
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Right: Composite Preview */}
            <div className="col-span-1">
                <h3 className="font-bold mb-4">Composite Preview</h3>

                <div className="bg-gray-100 rounded-lg p-4">
                    <canvas
                        ref={canvasRef}
                        width={512}
                        height={512}
                        className="w-full aspect-square bg-white rounded border"
                    />
                </div>

                {/* Layer Selectors */}
                <div className="mt-4 space-y-2">
                    {LAYER_TYPES.map(lt => (
                        <div key={lt.id} className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={!!previewLayers[lt.id]}
                                onChange={e => {
                                    if (!e.target.checked) {
                                        setPreviewLayers(p => ({ ...p, [lt.id]: null }));
                                    }
                                }}
                            />
                            <select
                                value={previewLayers[lt.id]?.id || ''}
                                onChange={e => {
                                    const asset = approvedLayers[lt.id]?.find(a => a.id === parseInt(e.target.value));
                                    setPreviewLayers(p => ({ ...p, [lt.id]: asset || null }));
                                }}
                                className="flex-1 text-sm border rounded px-2 py-1"
                            >
                                <option value="">None</option>
                                {approvedLayers[lt.id]?.map(asset => (
                                    <option key={asset.id} value={asset.id}>
                                        {asset.asset_key.replace('avatar_', '')}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>

                <div className="mt-4 flex gap-2">
                    <button
                        onClick={exportComposite}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm"
                    >
                        Export PNG
                    </button>
                    <button className="flex-1 px-3 py-2 bg-purple-600 text-white rounded text-sm">
                        Test in Scene
                    </button>
                </div>
            </div>
        </div>
    );
}
```

---

## Scene Templates Tab

A dedicated tab for managing scene templates with avatar slot configuration and compositing preview.

### Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Asset Management                                    [Queue: 2] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TABS:                                                           │
│  ┌───────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌─────────┐ │
│  │Assets │ │Buildings │ │ Avatars  │ │  Scenes   │ │Audit Log│ │
│  └───────┘ └──────────┘ └──────────┘ └───────────┘ └─────────┘ │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SCENE TEMPLATES                                                 │
│  Configure layered scene backgrounds with avatar slots           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Arrest Scene                                                ││
│  │  ┌──────────────────────────────────────────────────────┐   ││
│  │  │                                                      │   ││
│  │  │  [Background Layer]                                  │   ││
│  │  │         ┌─────────┐                                  │   ││
│  │  │         │ Avatar  │  ← Drag to position              │   ││
│  │  │         │  Slot   │                                  │   ││
│  │  │         │(300x400)│                                  │   ││
│  │  │         └─────────┘                                  │   ││
│  │  │                     [Foreground Overlay]             │   ││
│  │  │                                                      │   ││
│  │  └──────────────────────────────────────────────────────┘   ││
│  │                                                              ││
│  │  Avatar Slot: X: [480] Y: [200] W: [300] H: [400]           ││
│  │                                                              ││
│  │  Background: scene_arrest_bg.webp     [🔄 Regenerate]        ││
│  │  Foreground: scene_arrest_fg.webp     [🔄 Regenerate]        ││
│  │                                                              ││
│  │  [Preview with Avatar ▼] [💾 Save Config] [📤 Publish]       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Prison Cell Scene                                           ││
│  │  ...                                                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Scene Template Types

| Scene ID | Name | Has Foreground | Avatar Slot Purpose |
|----------|------|----------------|---------------------|
| arrest | Arrest Scene | Yes (police arms) | Player being arrested |
| prison | Prison Cell | Yes (bars) | Player in jail |
| hero | Hero Celebration | Yes (confetti) | Achievement/level up |
| dirty_trick | Dirty Trick | Yes (shadow overlay) | Performing trick |
| bank_lobby | Bank Lobby | No | Bank transactions |
| casino_floor | Casino Floor | No | Gambling scenes |
| courthouse | Courthouse | No | Legal proceedings |
| street | City Street | No | General outdoor |

### API Client Extensions: `src/services/assetApi.ts`

```typescript
export interface SceneTemplate {
    id: string;
    name: string;
    description: string;
    background_r2_key: string;
    background_url: string;
    foreground_r2_key: string | null;
    foreground_url: string | null;
    avatar_slot: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    width: number;
    height: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ComposedScene {
    scene_template_id: string;
    company_id: string;
    r2_url: string;
    avatar_hash: string;
    template_hash: string;
}

export const sceneTemplateApi = {
    // List all scene templates
    async list(): Promise<SceneTemplate[]> {
        const res = await fetch(`${API_BASE}/scenes/templates`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        return data.templates;
    },

    // Get single template
    async get(sceneId: string): Promise<SceneTemplate> {
        const res = await fetch(`${API_BASE}/scenes/templates/${sceneId}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        return data.template;
    },

    // Update avatar slot position
    async updateSlot(sceneId: string, slot: { x: number; y: number; width: number; height: number }): Promise<any> {
        const res = await fetch(`${API_BASE}/scenes/templates/${sceneId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ avatar_slot: slot })
        });
        return res.json();
    },

    // Generate background for scene
    async generateBackground(sceneId: string, prompt: string): Promise<any> {
        const res = await fetch(`${API_BASE}/scenes/templates/${sceneId}/generate-bg`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
        });
        return res.json();
    },

    // Generate foreground for scene
    async generateForeground(sceneId: string, prompt: string): Promise<any> {
        const res = await fetch(`${API_BASE}/scenes/templates/${sceneId}/generate-fg`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
        });
        return res.json();
    },

    // Preview composite with specific avatar
    async previewComposite(sceneId: string, companyId: string): Promise<string> {
        const res = await fetch(`${API_BASE}/scenes/compose/${sceneId}/${companyId}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        return data.composite_url;
    },

    // Cache composed scene
    async cacheComposite(sceneId: string, companyId: string, imageData: string): Promise<any> {
        const res = await fetch(`${API_BASE}/scenes/compose/${sceneId}/${companyId}/cache`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image_data: imageData })
        });
        return res.json();
    },

    // Publish template (make active in game)
    async publish(sceneId: string): Promise<any> {
        const res = await fetch(`${API_BASE}/scenes/templates/${sceneId}/publish`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        return res.json();
    }
};
```

### Scene Templates Component: `src/components/assets/SceneTemplates.tsx`

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { SceneTemplate, sceneTemplateApi, avatarAssetApi } from '../../services/assetApi';

export default function SceneTemplates() {
    const [templates, setTemplates] = useState<SceneTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState<SceneTemplate | null>(null);
    const [editingSlot, setEditingSlot] = useState<{x: number, y: number, width: number, height: number} | null>(null);
    const [testCompanyId, setTestCompanyId] = useState('');
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        const data = await sceneTemplateApi.list();
        setTemplates(data);
        setLoading(false);
    };

    const handleSelectTemplate = (template: SceneTemplate) => {
        setSelectedTemplate(template);
        setEditingSlot(template.avatar_slot);
    };

    const handleSlotChange = (field: string, value: number) => {
        if (!editingSlot) return;
        setEditingSlot({ ...editingSlot, [field]: value });
    };

    const handleSaveSlot = async () => {
        if (!selectedTemplate || !editingSlot) return;
        await sceneTemplateApi.updateSlot(selectedTemplate.id, editingSlot);
        await loadTemplates();
    };

    const renderPreview = async () => {
        if (!selectedTemplate || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background
        if (selectedTemplate.background_url) {
            const bg = await loadImage(selectedTemplate.background_url);
            ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
        }

        // Draw avatar slot placeholder
        const slot = editingSlot || selectedTemplate.avatar_slot;
        const scaleX = canvas.width / selectedTemplate.width;
        const scaleY = canvas.height / selectedTemplate.height;

        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
            slot.x * scaleX,
            slot.y * scaleY,
            slot.width * scaleX,
            slot.height * scaleY
        );
        ctx.setLineDash([]);

        // Draw "Avatar" label
        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.fillRect(
            slot.x * scaleX,
            slot.y * scaleY,
            slot.width * scaleX,
            slot.height * scaleY
        );
        ctx.fillStyle = '#00ff00';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
            'Avatar Slot',
            (slot.x + slot.width / 2) * scaleX,
            (slot.y + slot.height / 2) * scaleY
        );

        // Draw foreground
        if (selectedTemplate.foreground_url) {
            const fg = await loadImage(selectedTemplate.foreground_url);
            ctx.drawImage(fg, 0, 0, canvas.width, canvas.height);
        }
    };

    const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    };

    useEffect(() => {
        renderPreview();
    }, [selectedTemplate, editingSlot]);

    const handleTestWithAvatar = async () => {
        if (!selectedTemplate || !testCompanyId) return;
        const url = await sceneTemplateApi.previewComposite(selectedTemplate.id, testCompanyId);
        window.open(url, '_blank');
    };

    if (loading) {
        return <div className="text-center py-12">Loading scene templates...</div>;
    }

    return (
        <div className="grid grid-cols-2 gap-6">
            {/* Left: Template List */}
            <div>
                <h2 className="text-xl font-bold mb-4">Scene Templates</h2>
                <p className="text-gray-600 mb-4">
                    Configure layered scene backgrounds with avatar placement slots.
                </p>

                <div className="space-y-4">
                    {templates.map(template => (
                        <div
                            key={template.id}
                            onClick={() => handleSelectTemplate(template)}
                            className={`border rounded-lg p-4 cursor-pointer ${
                                selectedTemplate?.id === template.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'hover:border-gray-400'
                            }`}
                        >
                            <div className="flex gap-4">
                                {/* Thumbnail */}
                                <div className="w-32 h-20 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                                    {template.background_url && (
                                        <img
                                            src={template.background_url}
                                            alt={template.name}
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1">
                                    <h3 className="font-bold">{template.name}</h3>
                                    <p className="text-sm text-gray-600">{template.description}</p>
                                    <div className="mt-1 flex gap-2">
                                        <span className={`text-xs px-2 py-1 rounded ${
                                            template.is_active
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {template.is_active ? '🟢 Active' : '⚪ Draft'}
                                        </span>
                                        {template.foreground_r2_key && (
                                            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">
                                                Has Foreground
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Preview & Configuration */}
            <div>
                {selectedTemplate ? (
                    <>
                        <h3 className="font-bold mb-4">
                            {selectedTemplate.name} - Configuration
                        </h3>

                        {/* Preview Canvas */}
                        <div className="bg-gray-100 rounded-lg p-4">
                            <canvas
                                ref={canvasRef}
                                width={640}
                                height={360}
                                className="w-full aspect-video bg-black rounded"
                            />
                        </div>

                        {/* Avatar Slot Controls */}
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                            <h4 className="font-medium mb-3">Avatar Slot Position</h4>
                            <div className="grid grid-cols-4 gap-3">
                                <div>
                                    <label className="text-xs text-gray-500">X</label>
                                    <input
                                        type="number"
                                        value={editingSlot?.x || 0}
                                        onChange={e => handleSlotChange('x', parseInt(e.target.value))}
                                        className="w-full border rounded px-2 py-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Y</label>
                                    <input
                                        type="number"
                                        value={editingSlot?.y || 0}
                                        onChange={e => handleSlotChange('y', parseInt(e.target.value))}
                                        className="w-full border rounded px-2 py-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Width</label>
                                    <input
                                        type="number"
                                        value={editingSlot?.width || 0}
                                        onChange={e => handleSlotChange('width', parseInt(e.target.value))}
                                        className="w-full border rounded px-2 py-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Height</label>
                                    <input
                                        type="number"
                                        value={editingSlot?.height || 0}
                                        onChange={e => handleSlotChange('height', parseInt(e.target.value))}
                                        className="w-full border rounded px-2 py-1"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleSaveSlot}
                                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded text-sm"
                            >
                                Save Slot Position
                            </button>
                        </div>

                        {/* Layer Management */}
                        <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                <span>Background Layer</span>
                                <button className="text-sm text-blue-600 hover:underline">
                                    🔄 Regenerate
                                </button>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                <span>
                                    Foreground Layer
                                    {!selectedTemplate.foreground_r2_key && (
                                        <span className="text-gray-400 ml-2">(none)</span>
                                    )}
                                </span>
                                <button className="text-sm text-blue-600 hover:underline">
                                    {selectedTemplate.foreground_r2_key ? '🔄 Regenerate' : '+ Generate'}
                                </button>
                            </div>
                        </div>

                        {/* Test with Avatar */}
                        <div className="mt-4 p-4 bg-purple-50 rounded-lg">
                            <h4 className="font-medium mb-2">Test with Avatar</h4>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Company ID..."
                                    value={testCompanyId}
                                    onChange={e => setTestCompanyId(e.target.value)}
                                    className="flex-1 border rounded px-3 py-2"
                                />
                                <button
                                    onClick={handleTestWithAvatar}
                                    disabled={!testCompanyId}
                                    className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
                                >
                                    Preview
                                </button>
                            </div>
                        </div>

                        {/* Publish Button */}
                        <div className="mt-4">
                            <button
                                onClick={() => sceneTemplateApi.publish(selectedTemplate.id)}
                                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                                📤 Publish to Game
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-12 text-gray-500">
                        Select a scene template to configure
                    </div>
                )}
            </div>
        </div>
    );
}
```

---

## Updated Main Page with All Tabs

Update `src/pages/AssetAdminPage.tsx` to include all tabs:

```tsx
import React, { useState } from 'react';
import AssetGrid from '../components/assets/AssetGrid';
import BuildingManager from '../components/assets/BuildingManager';
import AvatarAssets from '../components/assets/AvatarAssets';
import SceneTemplates from '../components/assets/SceneTemplates';
import AuditLog from '../components/assets/AuditLog';
import QueueStatus from '../components/assets/QueueStatus';

type TabId = 'assets' | 'buildings' | 'avatars' | 'scenes' | 'audit';

const TABS: Array<{ id: TabId; name: string; icon: string }> = [
    { id: 'assets', name: 'Assets', icon: '📋' },
    { id: 'buildings', name: 'Buildings', icon: '🏢' },
    { id: 'avatars', name: 'Avatars', icon: '👤' },
    { id: 'scenes', name: 'Scenes', icon: '🎬' },
    { id: 'audit', name: 'Audit Log', icon: '📜' }
];

export default function AssetAdminPage() {
    const [activeTab, setActiveTab] = useState<TabId>('assets');

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Asset Management</h1>
                <QueueStatus />
            </div>

            {/* Main Tabs */}
            <div className="flex gap-2 mb-6 border-b pb-2">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-t-lg ${
                            activeTab === tab.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                    >
                        {tab.icon} {tab.name}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'assets' && <AssetGridWithFilters />}
            {activeTab === 'buildings' && <BuildingManager />}
            {activeTab === 'avatars' && <AvatarAssets />}
            {activeTab === 'scenes' && <SceneTemplates />}
            {activeTab === 'audit' && <AuditLog />}
        </div>
    );
}

// Original asset grid with category switching
function AssetGridWithFilters() {
    // ... existing AssetAdminPage asset grid code
    // (keep the existing CATEGORIES, filters, etc.)
}
```

---

## Updated Acceptance Checklist

### Asset Management
- [ ] Asset admin page accessible at `/admin/assets`
- [ ] Category tabs switch between asset types
- [ ] Staged workflow: refs → approval → sprites
- [ ] Rejection feedback incorporated into prompts
- [ ] History tab shows all rejections

### Building Manager
- [ ] Building Manager tab shows all 10 building types
- [ ] Sprite selector shows approved sprites for each building
- [ ] Cost/profit overrides can be set
- [ ] Publish/Unpublish buttons work correctly
- [ ] Published status reflects in game

### Avatar Assets
- [ ] Avatar Assets tab accessible with layer type subtabs
- [ ] Can generate assets for each layer type (body, hair, outfit, headwear, accessory, background)
- [ ] Composite preview renders layered avatar correctly
- [ ] Layer ordering respects z-index (bg → body → outfit → hair → headwear → accessory)
- [ ] Export PNG button saves composite to file
- [ ] Background removal works for all avatar layers
- [ ] Approved assets appear in layer selector dropdowns
- [ ] "Test in Scene" button opens scene template preview

### Scene Templates
- [ ] Scene Templates tab lists all 8 scene templates
- [ ] Background and foreground layers display correctly
- [ ] Avatar slot preview shows green dashed rectangle
- [ ] Avatar slot position (X, Y, Width, Height) can be edited
- [ ] Save Slot Position persists changes to database
- [ ] Regenerate buttons work for background/foreground
- [ ] Test with Avatar shows composite with specified company's avatar
- [ ] Publish button activates template in game
- [ ] Foreground layers properly overlay avatar slot

### Audit Log
- [ ] Audit Log tab shows recent actions
- [ ] All asset actions are logged (generate, approve, reject, etc.)
- [ ] Building config changes are logged
- [ ] Avatar and scene actions logged
- [ ] Details expandable for each entry

---

## Files to Create (Updated)

| File | Purpose |
|------|---------|
| `src/pages/AssetAdminPage.tsx` | Main admin page with all tabs |
| `src/components/assets/AssetGrid.tsx` | Grid display of assets |
| `src/components/assets/AssetCard.tsx` | Individual asset card |
| `src/components/assets/AssetPreviewModal.tsx` | Large preview with actions |
| `src/components/assets/GenerateModal.tsx` | New generation dialog |
| `src/components/assets/OverlayPreview.tsx` | Test effect on building |
| `src/components/assets/QueueStatus.tsx` | Generation queue display |
| `src/components/assets/BuildingManager.tsx` | Building sprite management |
| `src/components/assets/AuditLog.tsx` | Action history display |
| `src/components/assets/AvatarAssets.tsx` | Avatar layer management |
| `src/components/assets/SceneTemplates.tsx` | Scene template configuration |
| `src/services/assetApi.ts` | API client for all asset operations |

---

## Handoff Notes

**Complete Pipeline:**
The asset generation pipeline is now fully operational:
1. **Stage 01:** Infrastructure ✓
2. **Stage 02:** Building reference sheets ✓
3. **Stage 03:** Building sprites ✓
4. **Stage 04:** Dirty trick assets ✓
5. **Stage 05:** Scene illustrations (layered templates) ✓
6. **Stage 06:** Terrain, UI & NPC assets ✓
7. **Stage 07:** Asset admin page ✓
8. **Stage 08:** Avatar assets ✓

**Key Features:**
- **Avatar Assets Tab:** Generate and manage 34 avatar layer components (2 bodies, 6 hair, 8 outfits, 6 headwear, 6 accessories, 4 backgrounds)
- **Composite Preview:** Real-time canvas rendering of layered avatar
- **Scene Templates Tab:** Configure 8 scene templates with avatar slot positioning
- **Layered Compositing:** Background → Avatar → Foreground for dynamic scenes
- **Test Integration:** Preview avatars in scene contexts directly from admin

**Integration Points:**
- Avatar composites cached when user saves customization (see Stage 15)
- Scene composites generated on-demand or cached for frequent scenes
- All assets stored in R2 with WebP format for game use
