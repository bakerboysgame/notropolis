# Stage 08: Frontend Preview Modal

## Objective

Update AssetPreviewModal to add prompt editing capability, show reference images used, display generation settings, and implement enhanced regenerate flow.

## Dependencies

- **Requires:** [See: Stage 06] - Regenerate API with overrides
- **Requires:** [See: Stage 07] - Shared components (PromptEditor, ReferencesPicker, Settings)

## Complexity

**Medium** - Extend existing modal, reuse components from Stage 07, add regenerate modal.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/assets/AssetPreviewModal.tsx` | Add editing sections, regenerate modal |

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/assets/RegenerateModal.tsx` | Modal for regenerate with overrides |

---

## Implementation Details

### Updated AssetPreviewModal

The existing modal has:
- Image preview
- Metadata display
- Prompt display (read-only)
- Approve/Reject/Regenerate buttons

**Adding:**
- Editable prompt section (toggle)
- Reference images display
- Generation settings display
- Enhanced regenerate (opens RegenerateModal)

```tsx
// src/components/assets/AssetPreviewModal.tsx (updated sections)

import { useState, useEffect } from 'react';
import RegenerateModal from './RegenerateModal';
import { getAssetReferenceLinks, AssetReferenceLink } from '../../services/assetApi';

interface AssetPreviewModalProps {
    asset: Asset | null;
    isOpen: boolean;
    onClose: () => void;
    onApprove: (id: number) => void;
    onReject: (id: number, reason: string) => void;
    onRegenerate: (newAssetId: number) => void;
}

export default function AssetPreviewModal({
    asset,
    isOpen,
    onClose,
    onApprove,
    onReject,
    onRegenerate,
}: AssetPreviewModalProps) {
    const [activeTab, setActiveTab] = useState<'details' | 'history' | 'references'>('details');
    const [isPromptEditing, setIsPromptEditing] = useState(false);
    const [editedPrompt, setEditedPrompt] = useState('');
    const [showRegenerateModal, setShowRegenerateModal] = useState(false);
    const [referenceLinks, setReferenceLinks] = useState<AssetReferenceLink[]>([]);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isRejecting, setIsRejecting] = useState(false);

    useEffect(() => {
        if (asset) {
            setEditedPrompt(asset.current_prompt || '');
            loadReferenceLinks();
        }
    }, [asset?.id]);

    const loadReferenceLinks = async () => {
        if (!asset) return;
        try {
            const links = await getAssetReferenceLinks(asset.id);
            setReferenceLinks(links);
        } catch (error) {
            console.error('Failed to load reference links:', error);
        }
    };

    const handleRegenerate = () => {
        setShowRegenerateModal(true);
    };

    const handleRegenerateComplete = (newAssetId: number) => {
        setShowRegenerateModal(false);
        onRegenerate(newAssetId);
    };

    const generationSettings = asset?.generation_settings
        ? JSON.parse(asset.generation_settings)
        : null;

    if (!asset) return null;

    return (
        <>
            <Dialog open={isOpen} onClose={onClose} className="relative z-50">
                {/* ... backdrop ... */}

                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="mx-auto max-w-6xl w-full bg-white rounded-xl shadow-xl max-h-[90vh] overflow-hidden">
                        <div className="flex h-full">
                            {/* Left side: Image preview */}
                            <div className="w-1/2 bg-gray-100 flex items-center justify-center p-4">
                                {asset.status === 'generating' ? (
                                    <div className="text-center">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
                                        <p className="mt-4 text-gray-600">Generating...</p>
                                    </div>
                                ) : asset.r2_key_private ? (
                                    <img
                                        src={`/api/admin/assets/preview/${asset.id}`}
                                        alt={asset.asset_key}
                                        className="max-w-full max-h-full object-contain"
                                    />
                                ) : (
                                    <p className="text-gray-400">No preview available</p>
                                )}
                            </div>

                            {/* Right side: Details */}
                            <div className="w-1/2 flex flex-col">
                                {/* Header */}
                                <div className="border-b px-6 py-4">
                                    <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
                                        {asset.asset_key}
                                        <StatusBadge status={asset.status} />
                                        {asset.is_active && (
                                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                                                Active
                                            </span>
                                        )}
                                        {asset.auto_created && (
                                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                                                Auto-created
                                            </span>
                                        )}
                                    </Dialog.Title>
                                    <p className="text-sm text-gray-500">
                                        {asset.category} • Variant {asset.variant}
                                    </p>
                                </div>

                                {/* Tabs */}
                                <div className="flex border-b px-6">
                                    <button
                                        onClick={() => setActiveTab('details')}
                                        className={`py-2 px-4 ${activeTab === 'details' ? 'border-b-2 border-blue-500' : ''}`}
                                    >
                                        Details
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('references')}
                                        className={`py-2 px-4 ${activeTab === 'references' ? 'border-b-2 border-blue-500' : ''}`}
                                    >
                                        References ({referenceLinks.length})
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('history')}
                                        className={`py-2 px-4 ${activeTab === 'history' ? 'border-b-2 border-blue-500' : ''}`}
                                    >
                                        History
                                    </button>
                                </div>

                                {/* Tab content */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    {activeTab === 'details' && (
                                        <DetailsTab
                                            asset={asset}
                                            generationSettings={generationSettings}
                                            isPromptEditing={isPromptEditing}
                                            editedPrompt={editedPrompt}
                                            onTogglePromptEdit={() => setIsPromptEditing(!isPromptEditing)}
                                            onPromptChange={setEditedPrompt}
                                        />
                                    )}

                                    {activeTab === 'references' && (
                                        <ReferencesTab
                                            referenceLinks={referenceLinks}
                                            parentAssetId={asset.parent_asset_id}
                                        />
                                    )}

                                    {activeTab === 'history' && (
                                        <HistoryTab assetId={asset.id} />
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="border-t px-6 py-4 space-y-3">
                                    {/* Rejection input */}
                                    {isRejecting && (
                                        <div className="space-y-2">
                                            <textarea
                                                value={rejectionReason}
                                                onChange={(e) => setRejectionReason(e.target.value)}
                                                placeholder="Enter rejection reason..."
                                                className="w-full border rounded-lg px-3 py-2 text-sm"
                                                rows={2}
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => setIsRejecting(false)}
                                                    className="px-3 py-1 text-sm text-gray-600"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        onReject(asset.id, rejectionReason);
                                                        setIsRejecting(false);
                                                    }}
                                                    disabled={!rejectionReason.trim()}
                                                    className="px-3 py-1 text-sm bg-red-500 text-white rounded disabled:opacity-50"
                                                >
                                                    Confirm Reject
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action buttons */}
                                    <div className="flex justify-between">
                                        <button
                                            onClick={onClose}
                                            className="px-4 py-2 text-gray-600"
                                        >
                                            Close
                                        </button>

                                        <div className="flex gap-2">
                                            {/* Regenerate - always available for non-pending */}
                                            {asset.status !== 'pending' && asset.status !== 'generating' && (
                                                <button
                                                    onClick={handleRegenerate}
                                                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                                >
                                                    Regenerate
                                                </button>
                                            )}

                                            {/* Reject - for review status */}
                                            {asset.status === 'review' && !isRejecting && (
                                                <button
                                                    onClick={() => setIsRejecting(true)}
                                                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                                                >
                                                    Reject
                                                </button>
                                            )}

                                            {/* Approve - for review status */}
                                            {asset.status === 'review' && (
                                                <button
                                                    onClick={() => onApprove(asset.id)}
                                                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                                                >
                                                    Approve
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Dialog.Panel>
                </div>
            </Dialog>

            {/* Regenerate Modal */}
            <RegenerateModal
                isOpen={showRegenerateModal}
                asset={asset}
                currentPrompt={editedPrompt}
                currentReferences={referenceLinks}
                currentSettings={generationSettings}
                onClose={() => setShowRegenerateModal(false)}
                onRegenerate={handleRegenerateComplete}
            />
        </>
    );
}
```

### Details Tab Component

```tsx
// DetailsTab within AssetPreviewModal

function DetailsTab({
    asset,
    generationSettings,
    isPromptEditing,
    editedPrompt,
    onTogglePromptEdit,
    onPromptChange,
}: {
    asset: Asset;
    generationSettings: any;
    isPromptEditing: boolean;
    editedPrompt: string;
    onTogglePromptEdit: () => void;
    onPromptChange: (prompt: string) => void;
}) {
    return (
        <div className="space-y-4">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <span className="text-gray-500">Category:</span>
                    <span className="ml-2">{asset.category}</span>
                </div>
                <div>
                    <span className="text-gray-500">Created:</span>
                    <span className="ml-2">{new Date(asset.created_at).toLocaleDateString()}</span>
                </div>
                {asset.approved_at && (
                    <div>
                        <span className="text-gray-500">Approved:</span>
                        <span className="ml-2">{new Date(asset.approved_at).toLocaleDateString()}</span>
                    </div>
                )}
                {asset.parent_asset_id && (
                    <div>
                        <span className="text-gray-500">Parent Ref:</span>
                        <span className="ml-2 text-purple-600">#{asset.parent_asset_id}</span>
                    </div>
                )}
            </div>

            {/* Generation Settings */}
            {generationSettings && (
                <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Generation Settings</p>
                    <div className="flex gap-4 text-sm text-gray-600">
                        <span>Temperature: {generationSettings.temperature}</span>
                        <span>Top K: {generationSettings.topK}</span>
                        <span>Top P: {generationSettings.topP}</span>
                    </div>
                </div>
            )}

            {/* Error message */}
            {asset.error_message && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-700">Error</p>
                    <p className="text-sm text-red-600">{asset.error_message}</p>
                </div>
            )}

            {/* Rejection reason */}
            {asset.status === 'rejected' && asset.rejection_reason && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-orange-700">Rejection Reason</p>
                    <p className="text-sm text-orange-600">{asset.rejection_reason}</p>
                </div>
            )}

            {/* Prompt */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-medium text-gray-700">Generation Prompt</p>
                    <button
                        onClick={onTogglePromptEdit}
                        className="text-sm text-blue-500 hover:text-blue-600"
                    >
                        {isPromptEditing ? 'Done' : 'Edit'}
                    </button>
                </div>

                {isPromptEditing ? (
                    <textarea
                        value={editedPrompt}
                        onChange={(e) => onPromptChange(e.target.value)}
                        className="w-full h-48 border rounded-lg px-3 py-2 font-mono text-xs"
                    />
                ) : (
                    <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                        <pre className="text-xs whitespace-pre-wrap font-mono text-gray-600">
                            {asset.current_prompt}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
```

### References Tab Component

```tsx
// ReferencesTab within AssetPreviewModal

function ReferencesTab({
    referenceLinks,
    parentAssetId,
}: {
    referenceLinks: AssetReferenceLink[];
    parentAssetId?: number;
}) {
    return (
        <div className="space-y-4">
            {parentAssetId && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-purple-700">Parent Reference</p>
                    <p className="text-sm text-purple-600">
                        Generated from reference sheet #{parentAssetId}
                    </p>
                </div>
            )}

            {referenceLinks.length === 0 ? (
                <p className="text-gray-500 text-sm">No additional reference images used.</p>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                    {referenceLinks.map((link) => (
                        <div
                            key={link.id}
                            className="border rounded-lg p-3 flex items-center gap-3"
                        >
                            {link.thumbnailUrl && (
                                <img
                                    src={link.thumbnailUrl}
                                    alt={link.name}
                                    className="w-16 h-16 object-cover rounded"
                                />
                            )}
                            <div>
                                <p className="text-sm font-medium">{link.name}</p>
                                <p className="text-xs text-gray-500">
                                    {link.link_type === 'library' ? 'Library' : 'Approved Asset'}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
```

### Regenerate Modal

```tsx
// src/components/assets/RegenerateModal.tsx

import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { regenerate, GenerationSettings, ReferenceImageSpec } from '../../services/assetApi';
import PromptEditorStep from './GenerateModal/PromptEditorStep';
import ReferenceImagesStep from './GenerateModal/ReferenceImagesStep';
import SettingsStep from './GenerateModal/SettingsStep';

interface RegenerateModalProps {
    isOpen: boolean;
    asset: Asset;
    currentPrompt: string;
    currentReferences: any[];
    currentSettings: GenerationSettings | null;
    onClose: () => void;
    onRegenerate: (newAssetId: number) => void;
}

export default function RegenerateModal({
    isOpen,
    asset,
    currentPrompt,
    currentReferences,
    currentSettings,
    onClose,
    onRegenerate,
}: RegenerateModalProps) {
    const [activeSection, setActiveSection] = useState<'prompt' | 'references' | 'settings'>('prompt');
    const [prompt, setPrompt] = useState(currentPrompt);
    const [customDetails, setCustomDetails] = useState('');
    const [references, setReferences] = useState<ReferenceImageSpec[]>(
        currentReferences.map(r => ({
            type: r.link_type,
            id: r.reference_image_id || r.approved_asset_id,
            name: r.name,
        }))
    );
    const [settings, setSettings] = useState<GenerationSettings>(
        currentSettings || { temperature: 0.7, topK: 40, topP: 0.95 }
    );
    const [isRegenerating, setIsRegenerating] = useState(false);

    const handleRegenerate = async () => {
        setIsRegenerating(true);
        try {
            const result = await regenerate(asset.id, {
                prompt: prompt !== currentPrompt ? prompt : undefined,
                custom_details: customDetails || undefined,
                reference_images: references.length > 0 ? references : undefined,
                generation_settings: settings,
                preserve_old: true,
            });

            if (result.success && result.newAssetId) {
                onRegenerate(result.newAssetId);
            } else {
                alert(result.error || 'Regeneration failed');
            }
        } catch (error) {
            console.error('Regenerate error:', error);
            alert('Failed to regenerate');
        } finally {
            setIsRegenerating(false);
        }
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-[60]">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="mx-auto max-w-3xl w-full bg-white rounded-xl shadow-xl">
                    <div className="border-b px-6 py-4">
                        <Dialog.Title className="text-lg font-semibold">
                            Regenerate: {asset.asset_key} v{asset.variant}
                        </Dialog.Title>
                        <p className="text-sm text-gray-500">
                            Creates a new version (v{asset.variant + 1}). Current version will be preserved.
                        </p>
                    </div>

                    {/* Section tabs */}
                    <div className="flex border-b px-6">
                        <button
                            onClick={() => setActiveSection('prompt')}
                            className={`py-2 px-4 ${activeSection === 'prompt' ? 'border-b-2 border-blue-500' : ''}`}
                        >
                            Prompt
                        </button>
                        <button
                            onClick={() => setActiveSection('references')}
                            className={`py-2 px-4 ${activeSection === 'references' ? 'border-b-2 border-blue-500' : ''}`}
                        >
                            References
                        </button>
                        <button
                            onClick={() => setActiveSection('settings')}
                            className={`py-2 px-4 ${activeSection === 'settings' ? 'border-b-2 border-blue-500' : ''}`}
                        >
                            Settings
                        </button>
                    </div>

                    {/* Section content */}
                    <div className="p-6 min-h-[300px] max-h-[50vh] overflow-y-auto">
                        {activeSection === 'prompt' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Prompt
                                    </label>
                                    <textarea
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        className="w-full h-48 border rounded-lg px-3 py-2 font-mono text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Additional Details
                                    </label>
                                    <textarea
                                        value={customDetails}
                                        onChange={(e) => setCustomDetails(e.target.value)}
                                        className="w-full h-24 border rounded-lg px-3 py-2"
                                        placeholder="Add specific requirements for this regeneration..."
                                    />
                                </div>
                            </div>
                        )}

                        {activeSection === 'references' && (
                            <ReferenceImagesStep
                                category={asset.category}
                                selectedReferences={references}
                                parentAssetId={asset.parent_asset_id}
                                onChange={setReferences}
                            />
                        )}

                        {activeSection === 'settings' && (
                            <SettingsStep
                                settings={settings}
                                onChange={setSettings}
                            />
                        )}
                    </div>

                    {/* Actions */}
                    <div className="border-t px-6 py-4 flex justify-between">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleRegenerate}
                            disabled={isRegenerating}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                        >
                            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                        </button>
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
```

---

## Test Cases

### Test 1: View Generation Settings
1. Open preview for an asset with generation_settings

**Expected:** Settings displayed in Details tab

### Test 2: View Reference Images
1. Open preview for an asset with reference links
2. Click References tab

**Expected:** Reference images shown with thumbnails

### Test 3: Edit Prompt
1. Open preview
2. Click "Edit" on prompt section
3. Modify prompt

**Expected:** Textarea appears, editable

### Test 4: Open Regenerate Modal
1. Open preview for a review/completed asset
2. Click "Regenerate"

**Expected:** RegenerateModal opens with pre-filled values

### Test 5: Regenerate with Overrides
1. Open RegenerateModal
2. Modify prompt
3. Add additional details
4. Adjust temperature
5. Click Regenerate

**Expected:** New version created, modal closes, list refreshes

### Test 6: Auto-created Badge
1. Open preview for an auto-created sprite

**Expected:** "Auto-created" badge visible

---

## Acceptance Checklist

- [ ] Preview shows generation settings
- [ ] References tab shows all reference images used
- [ ] Parent reference link displayed for sprites
- [ ] Prompt is editable (toggle)
- [ ] Regenerate button opens RegenerateModal
- [ ] RegenerateModal pre-fills current values
- [ ] Can modify prompt in RegenerateModal
- [ ] Can add/remove references in RegenerateModal
- [ ] Can adjust settings in RegenerateModal
- [ ] Regenerate creates new version
- [ ] Modal closes and triggers refresh on success
- [ ] Auto-created badge shows for auto-created sprites

---

## Deployment

### Commands

```bash
cd authentication-dashboard-system
npm run build
npm run deploy
```

### Verification

1. Open any asset preview
2. Verify settings visible
3. Click References tab
4. Click Regenerate, verify modal opens
5. Complete regeneration, verify new version created

---

## Handoff Notes

### For Stage 09 (Integration Testing)
- Test full flow: generate → approve → auto-sprite → regenerate
- Verify settings are passed correctly through all stages
- Test reference images are included in Gemini calls
