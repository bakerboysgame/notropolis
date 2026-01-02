# Stage 07: Frontend Generate Modal

## Objective

Replace the simple GenerateModal with a multi-step wizard that includes:
- Category/asset selection with **parent reference selector for sprites**
- Prompt editing with template loading
- Reference image selection (uploads + approved assets)
- Gemini settings configuration (temperature, topK, topP)
- Sprite requirements tracking (which sprites are needed/complete)

## Dependencies

- **Requires:** [See: Stage 02] - Reference library API for image selection
- **Requires:** [See: Stage 03] - Prompt templates API for loading/saving
- **Requires:** [See: Stage 04] - Enhanced generate API for all parameters
- **Requires:** [See: Stage 05a] - Sprite requirements and status APIs

## Complexity

**High** - Multi-step wizard, prompt editor, image uploader, settings sliders, state management.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/assets/GenerateModal/index.tsx` | Main wizard container |
| `src/components/assets/GenerateModal/CategoryStep.tsx` | Step 1: Category/asset selection |
| `src/components/assets/GenerateModal/PromptEditorStep.tsx` | Step 2: Prompt editing |
| `src/components/assets/GenerateModal/ReferenceImagesStep.tsx` | Step 3: Reference selection |
| `src/components/assets/GenerateModal/SettingsStep.tsx` | Step 4: Gemini settings |
| `src/components/assets/GenerateModal/ReviewStep.tsx` | Step 5: Review and generate |
| `src/components/assets/ReferenceLibrary/index.tsx` | Reference library grid |
| `src/components/assets/ReferenceLibrary/UploadDropzone.tsx` | Image upload component |
| `src/components/assets/ReferenceLibrary/ReferenceImageCard.tsx` | Reference image card |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/assets/GenerateModal.tsx` | Replace with import from new folder |
| `src/pages/AssetAdminPage.tsx` | Update modal integration |

---

## Implementation Details

### Component Structure

```
GenerateModal/
├── index.tsx              # Main container, step management
├── CategoryStep.tsx       # Category + asset key selection
├── PromptEditorStep.tsx   # Full prompt editor
├── ReferenceImagesStep.tsx # Reference picker + upload
├── SettingsStep.tsx       # Generation settings sliders
├── ReviewStep.tsx         # Summary + generate button
└── types.ts               # Shared types

ReferenceLibrary/
├── index.tsx              # Grid of references
├── UploadDropzone.tsx     # Upload area
└── ReferenceImageCard.tsx # Card with select/preview
```

### Main Modal Component

```tsx
// src/components/assets/GenerateModal/index.tsx

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import CategoryStep from './CategoryStep';
import PromptEditorStep from './PromptEditorStep';
import ReferenceImagesStep from './ReferenceImagesStep';
import SettingsStep from './SettingsStep';
import ReviewStep from './ReviewStep';
import { GenerateFormData, Step } from './types';
import { generate } from '../../../services/assetApi';

interface GenerateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerated: (assetId: number) => void;
    // Pre-fill for generating from reference
    initialCategory?: string;
    initialAssetKey?: string;
    parentAssetId?: number;
}

const STEPS: Step[] = [
    { id: 'category', title: 'Category', description: 'Select asset type' },
    { id: 'prompt', title: 'Prompt', description: 'Edit generation prompt' },
    { id: 'references', title: 'References', description: 'Add reference images' },
    { id: 'settings', title: 'Settings', description: 'Generation settings' },
    { id: 'review', title: 'Review', description: 'Review and generate' },
];

export default function GenerateModal({
    isOpen,
    onClose,
    onGenerated,
    initialCategory,
    initialAssetKey,
    parentAssetId,
}: GenerateModalProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);

    const [formData, setFormData] = useState<GenerateFormData>({
        category: initialCategory || '',
        assetKey: initialAssetKey || '',
        variant: undefined,
        prompt: '',
        customDetails: '',
        referenceImages: [],
        generationSettings: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
        },
    });

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            setCurrentStep(initialCategory ? 1 : 0); // Skip category if pre-filled
            setFormData(prev => ({
                ...prev,
                category: initialCategory || '',
                assetKey: initialAssetKey || '',
            }));
        }
    }, [isOpen, initialCategory, initialAssetKey]);

    const updateFormData = (updates: Partial<GenerateFormData>) => {
        setFormData(prev => ({ ...prev, ...updates }));
    };

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const result = await generate({
                category: formData.category,
                asset_key: formData.assetKey,
                variant: formData.variant,
                prompt: formData.prompt || undefined,
                custom_details: formData.customDetails || undefined,
                reference_images: formData.referenceImages.map(ref => ({
                    type: ref.type,
                    id: ref.id,
                })),
                generation_settings: formData.generationSettings,
            });

            if (result.success && result.assetId) {
                onGenerated(result.assetId);
                onClose();
            } else {
                alert(result.error || 'Generation failed');
            }
        } catch (error) {
            console.error('Generate error:', error);
            alert('Failed to start generation');
        } finally {
            setIsGenerating(false);
        }
    };

    const renderStep = () => {
        switch (STEPS[currentStep].id) {
            case 'category':
                return (
                    <CategoryStep
                        category={formData.category}
                        assetKey={formData.assetKey}
                        variant={formData.variant}
                        onChange={updateFormData}
                        locked={!!initialCategory}
                    />
                );
            case 'prompt':
                return (
                    <PromptEditorStep
                        category={formData.category}
                        assetKey={formData.assetKey}
                        prompt={formData.prompt}
                        customDetails={formData.customDetails}
                        onChange={updateFormData}
                    />
                );
            case 'references':
                return (
                    <ReferenceImagesStep
                        category={formData.category}
                        selectedReferences={formData.referenceImages}
                        parentAssetId={parentAssetId}
                        onChange={(refs) => updateFormData({ referenceImages: refs })}
                    />
                );
            case 'settings':
                return (
                    <SettingsStep
                        settings={formData.generationSettings}
                        onChange={(settings) => updateFormData({ generationSettings: settings })}
                    />
                );
            case 'review':
                return (
                    <ReviewStep
                        formData={formData}
                        parentAssetId={parentAssetId}
                    />
                );
        }
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="mx-auto max-w-4xl w-full bg-white rounded-xl shadow-xl">
                    {/* Header with steps */}
                    <div className="border-b px-6 py-4">
                        <Dialog.Title className="text-lg font-semibold">
                            Generate Asset
                        </Dialog.Title>

                        {/* Step indicators */}
                        <div className="flex mt-4 space-x-2">
                            {STEPS.map((step, index) => (
                                <div
                                    key={step.id}
                                    className={`flex-1 h-2 rounded-full ${
                                        index <= currentStep ? 'bg-blue-500' : 'bg-gray-200'
                                    }`}
                                />
                            ))}
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                            Step {currentStep + 1}: {STEPS[currentStep].description}
                        </div>
                    </div>

                    {/* Step content */}
                    <div className="p-6 min-h-[400px] max-h-[60vh] overflow-y-auto">
                        {renderStep()}
                    </div>

                    {/* Footer with navigation */}
                    <div className="border-t px-6 py-4 flex justify-between">
                        <button
                            onClick={currentStep === 0 ? onClose : handleBack}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800"
                        >
                            {currentStep === 0 ? 'Cancel' : 'Back'}
                        </button>

                        <div className="space-x-2">
                            {currentStep < STEPS.length - 1 ? (
                                <button
                                    onClick={handleNext}
                                    disabled={!formData.category || !formData.assetKey}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg
                                             hover:bg-blue-600 disabled:opacity-50"
                                >
                                    Next
                                </button>
                            ) : (
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                    className="px-4 py-2 bg-green-500 text-white rounded-lg
                                             hover:bg-green-600 disabled:opacity-50"
                                >
                                    {isGenerating ? 'Generating...' : 'Generate'}
                                </button>
                            )}
                        </div>
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
```

### Category Step (with Parent Reference Selector)

When a user selects a **sprite category** (building_sprite, terrain, npc, etc.), the UI should:
1. Show a "Parent Reference" dropdown with approved references of the matching type
2. Auto-suggest the matching reference if one exists
3. Show sprite requirements for the selected reference

```tsx
// src/components/assets/GenerateModal/CategoryStep.tsx

import { useState, useEffect } from 'react';
import { ASSET_CATEGORIES, ASSET_KEYS, getSpriteStatus, listApprovedAssets } from '../../../services/assetApi';

interface CategoryStepProps {
    category: string;
    assetKey: string;
    variant?: number;
    parentAssetId?: number;
    spriteVariant?: string;
    onChange: (updates: {
        category?: string;
        assetKey?: string;
        variant?: number;
        parentAssetId?: number;
        spriteVariant?: string;
    }) => void;
    locked?: boolean;
}

// Map sprite categories to their parent reference categories
const SPRITE_TO_REF_CATEGORY: Record<string, string> = {
    'building_sprite': 'building_ref',
    'terrain': 'terrain_ref',
    'npc': 'character_ref',
    'vehicle': 'vehicle_ref',
    'effect': 'effect_ref',
};

export default function CategoryStep({
    category,
    assetKey,
    variant,
    parentAssetId,
    spriteVariant,
    onChange,
    locked,
}: CategoryStepProps) {
    const [approvedRefs, setApprovedRefs] = useState<any[]>([]);
    const [spriteStatus, setSpriteStatus] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    const assetKeys = category ? ASSET_KEYS[category] || [] : [];
    const isSprite = !!SPRITE_TO_REF_CATEGORY[category];
    const refCategory = SPRITE_TO_REF_CATEGORY[category];

    // Load approved references when sprite category is selected
    useEffect(() => {
        if (isSprite && refCategory) {
            loadApprovedRefs();
        }
    }, [category, refCategory]);

    // Load sprite status when parent is selected
    useEffect(() => {
        if (parentAssetId) {
            loadSpriteStatus();
        }
    }, [parentAssetId]);

    const loadApprovedRefs = async () => {
        setIsLoading(true);
        try {
            const refs = await listApprovedAssets(refCategory);
            setApprovedRefs(refs);
        } catch (error) {
            console.error('Failed to load refs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadSpriteStatus = async () => {
        try {
            const status = await getSpriteStatus(parentAssetId!);
            setSpriteStatus(status);
        } catch (error) {
            console.error('Failed to load sprite status:', error);
        }
    };

    const handleParentChange = (refId: number) => {
        const selectedRef = approvedRefs.find(r => r.id === refId);
        onChange({
            parentAssetId: refId,
            assetKey: selectedRef?.asset_key || assetKey,
        });
    };

    return (
        <div className="space-y-6">
            {/* Category Selection */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                </label>
                <select
                    value={category}
                    onChange={(e) => onChange({
                        category: e.target.value,
                        assetKey: '',
                        parentAssetId: undefined,
                        spriteVariant: undefined,
                    })}
                    disabled={locked}
                    className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-100"
                >
                    <option value="">Select category...</option>
                    <optgroup label="Reference Sheets">
                        <option value="building_ref">Building Reference Sheet</option>
                        <option value="character_ref">Character Reference Sheet</option>
                        <option value="vehicle_ref">Vehicle Reference Sheet</option>
                        <option value="effect_ref">Effect Reference Sheet</option>
                        <option value="terrain_ref">Terrain Reference Sheet</option>
                    </optgroup>
                    <optgroup label="Sprites (require parent ref)">
                        <option value="building_sprite">Building Sprite</option>
                        <option value="npc">NPC Sprite</option>
                        <option value="effect">Effect Sprite</option>
                        <option value="terrain">Terrain Tile</option>
                        <option value="vehicle">Vehicle Sprite</option>
                    </optgroup>
                    <optgroup label="Standalone">
                        <option value="background">Background</option>
                        <option value="scene">Scene</option>
                        <option value="ui">UI Element</option>
                    </optgroup>
                </select>
                {locked && (
                    <p className="text-sm text-blue-600 mt-1">
                        Category locked - generating sprite from reference
                    </p>
                )}
            </div>

            {/* Parent Reference Selector (for sprites only) */}
            {isSprite && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-purple-800 mb-2">
                        Parent Reference (Required for sprites)
                    </label>
                    {isLoading ? (
                        <div className="text-sm text-purple-600">Loading approved references...</div>
                    ) : approvedRefs.length === 0 ? (
                        <div className="text-sm text-red-600">
                            No approved {refCategory?.replace('_', ' ')}s found.
                            Create and approve a reference first.
                        </div>
                    ) : (
                        <select
                            value={parentAssetId || ''}
                            onChange={(e) => handleParentChange(parseInt(e.target.value))}
                            className="w-full border border-purple-300 rounded-lg px-3 py-2 bg-white"
                        >
                            <option value="">Select parent reference...</option>
                            {approvedRefs.map((ref) => (
                                <option key={ref.id} value={ref.id}>
                                    {ref.asset_key} (v{ref.variant}) - approved {new Date(ref.approved_at).toLocaleDateString()}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            )}

            {/* Sprite Variant Selector (when parent is selected) */}
            {isSprite && parentAssetId && spriteStatus && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sprite Variant
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {spriteStatus.sprites?.map((sprite: any) => (
                            <button
                                key={sprite.variant}
                                onClick={() => onChange({
                                    spriteVariant: sprite.variant,
                                    assetKey: sprite.spriteAssetKey,
                                })}
                                disabled={sprite.status === 'approved' && sprite.pipelineStatus === 'completed'}
                                className={`p-3 border rounded-lg text-left ${
                                    spriteVariant === sprite.variant
                                        ? 'border-blue-500 bg-blue-50'
                                        : sprite.status === 'approved'
                                        ? 'border-green-300 bg-green-50 opacity-50'
                                        : 'border-gray-200 hover:border-gray-400'
                                }`}
                            >
                                <div className="font-medium">{sprite.displayName}</div>
                                <div className="text-xs text-gray-500">
                                    {sprite.status === null && 'Not started'}
                                    {sprite.status === 'generating' && '⏳ Generating...'}
                                    {sprite.status === 'review' && '👁 Ready for review'}
                                    {sprite.status === 'approved' && '✅ Complete'}
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                        Progress: {spriteStatus.summary?.completed}/{spriteStatus.summary?.total} sprites complete
                    </div>
                </div>
            )}

            {/* Asset Key (for non-sprites or manual entry) */}
            {!isSprite && category && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Asset Type
                    </label>
                    {assetKeys.length > 0 ? (
                        <select
                            value={assetKey}
                            onChange={(e) => onChange({ assetKey: e.target.value })}
                            disabled={locked}
                            className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-100"
                        >
                            <option value="">Select type...</option>
                            {assetKeys.map((key) => (
                                <option key={key} value={key}>
                                    {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="text"
                            value={assetKey}
                            onChange={(e) => onChange({ assetKey: e.target.value })}
                            placeholder="Enter asset key..."
                            className="w-full border rounded-lg px-3 py-2"
                        />
                    )}
                </div>
            )}

            {/* Variant Number */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Variant Number
                    <span className="text-gray-400 font-normal"> (optional)</span>
                </label>
                <input
                    type="number"
                    value={variant || ''}
                    onChange={(e) => onChange({ variant: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="Auto-increment if empty"
                    min={1}
                    className="w-full border rounded-lg px-3 py-2"
                />
                <p className="text-sm text-gray-500 mt-1">
                    Leave empty to use the next available variant number
                </p>
            </div>
        </div>
    );
}
```

### Prompt Editor Step

```tsx
// src/components/assets/GenerateModal/PromptEditorStep.tsx

import { useState, useEffect } from 'react';
import { promptTemplateApi, PromptTemplate } from '../../../services/assetApi';

interface PromptEditorStepProps {
    category: string;
    assetKey: string;
    prompt: string;
    customDetails: string;
    onChange: (updates: { prompt?: string; customDetails?: string }) => void;
}

export default function PromptEditorStep({
    category,
    assetKey,
    prompt,
    customDetails,
    onChange,
}: PromptEditorStepProps) {
    const [template, setTemplate] = useState<PromptTemplate | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Load template when category/assetKey changes
    useEffect(() => {
        if (category && assetKey) {
            loadTemplate();
        }
    }, [category, assetKey]);

    const loadTemplate = async () => {
        setIsLoading(true);
        try {
            const tmpl = await promptTemplateApi.get(category, assetKey);
            setTemplate(tmpl);
            // Set prompt if not already set
            if (!prompt) {
                onChange({ prompt: tmpl.basePrompt });
            }
        } catch (error) {
            console.error('Failed to load template:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetToDefault = () => {
        if (template) {
            onChange({ prompt: template.basePrompt });
        }
    };

    const handleSaveAsTemplate = async () => {
        if (!prompt) return;
        setIsSaving(true);
        try {
            await promptTemplateApi.update(category, assetKey, {
                basePrompt: prompt,
                styleGuide: template?.styleGuide,
                changeNotes: 'Updated from Generate Modal',
            });
            alert('Template saved!');
            loadTemplate(); // Reload to get new version
        } catch (error) {
            console.error('Failed to save template:', error);
            alert('Failed to save template');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700">
                    Generation Prompt
                </label>
                <div className="space-x-2">
                    <button
                        onClick={handleResetToDefault}
                        className="text-sm text-blue-500 hover:text-blue-600"
                    >
                        Reset to Default
                    </button>
                    <button
                        onClick={handleSaveAsTemplate}
                        disabled={isSaving}
                        className="text-sm text-green-500 hover:text-green-600"
                    >
                        {isSaving ? 'Saving...' : 'Save as Template'}
                    </button>
                </div>
            </div>

            <textarea
                value={prompt}
                onChange={(e) => onChange({ prompt: e.target.value })}
                className="w-full h-64 border rounded-lg px-3 py-2 font-mono text-sm"
                placeholder="Enter the generation prompt..."
            />

            {template?.styleGuide && (
                <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-1">Style Guide:</p>
                    <p className="text-sm text-gray-600">{template.styleGuide}</p>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Details
                    <span className="text-gray-400 font-normal"> (optional)</span>
                </label>
                <textarea
                    value={customDetails}
                    onChange={(e) => onChange({ customDetails: e.target.value })}
                    className="w-full h-24 border rounded-lg px-3 py-2"
                    placeholder="Add any specific requirements or notes..."
                />
            </div>
        </div>
    );
}
```

### Reference Images Step

```tsx
// src/components/assets/GenerateModal/ReferenceImagesStep.tsx

import { useState, useEffect } from 'react';
import { referenceLibraryApi, ReferenceImage, ReferenceImageSpec } from '../../../services/assetApi';
import ReferenceLibrary from '../ReferenceLibrary';
import UploadDropzone from '../ReferenceLibrary/UploadDropzone';

interface ReferenceImagesStepProps {
    category: string;
    selectedReferences: Array<ReferenceImageSpec & { thumbnailUrl?: string; name?: string }>;
    parentAssetId?: number;
    onChange: (refs: Array<ReferenceImageSpec & { thumbnailUrl?: string; name?: string }>) => void;
}

export default function ReferenceImagesStep({
    category,
    selectedReferences,
    parentAssetId,
    onChange,
}: ReferenceImagesStepProps) {
    const [activeTab, setActiveTab] = useState<'library' | 'approved' | 'upload'>('library');
    const [libraryImages, setLibraryImages] = useState<ReferenceImage[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadLibraryImages();
    }, []);

    const loadLibraryImages = async () => {
        setIsLoading(true);
        try {
            const images = await referenceLibraryApi.list();
            setLibraryImages(images);
        } catch (error) {
            console.error('Failed to load library:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleReference = (ref: ReferenceImageSpec & { thumbnailUrl?: string; name?: string }) => {
        const exists = selectedReferences.some(
            r => r.type === ref.type && r.id === ref.id
        );

        if (exists) {
            onChange(selectedReferences.filter(
                r => !(r.type === ref.type && r.id === ref.id)
            ));
        } else {
            onChange([...selectedReferences, ref]);
        }
    };

    const handleUploadComplete = (image: ReferenceImage) => {
        setLibraryImages(prev => [image, ...prev]);
        handleToggleReference({
            type: 'library',
            id: image.id,
            thumbnailUrl: image.thumbnailUrl,
            name: image.name,
        });
    };

    return (
        <div className="space-y-4">
            {/* Parent reference indicator */}
            {parentAssetId && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-sm text-purple-700">
                        <span className="font-medium">Parent Reference:</span> The approved reference sheet
                        will be automatically included as the primary reference.
                    </p>
                </div>
            )}

            {/* Selected references */}
            {selectedReferences.length > 0 && (
                <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                        Selected References ({selectedReferences.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {selectedReferences.map((ref, index) => (
                            <div
                                key={`${ref.type}-${ref.id}`}
                                className="flex items-center bg-blue-50 rounded-lg px-3 py-1"
                            >
                                <span className="text-sm">{ref.name || `${ref.type} #${ref.id}`}</span>
                                <button
                                    onClick={() => handleToggleReference(ref)}
                                    className="ml-2 text-red-500 hover:text-red-600"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex border-b">
                <button
                    onClick={() => setActiveTab('library')}
                    className={`px-4 py-2 ${activeTab === 'library' ? 'border-b-2 border-blue-500' : ''}`}
                >
                    Library
                </button>
                <button
                    onClick={() => setActiveTab('approved')}
                    className={`px-4 py-2 ${activeTab === 'approved' ? 'border-b-2 border-blue-500' : ''}`}
                >
                    Approved Assets
                </button>
                <button
                    onClick={() => setActiveTab('upload')}
                    className={`px-4 py-2 ${activeTab === 'upload' ? 'border-b-2 border-blue-500' : ''}`}
                >
                    Upload New
                </button>
            </div>

            {/* Tab content */}
            <div className="min-h-[200px]">
                {activeTab === 'library' && (
                    <ReferenceLibrary
                        images={libraryImages}
                        selectedIds={selectedReferences
                            .filter(r => r.type === 'library')
                            .map(r => r.id)}
                        onToggle={(image) => handleToggleReference({
                            type: 'library',
                            id: image.id,
                            thumbnailUrl: image.thumbnailUrl,
                            name: image.name,
                        })}
                        isLoading={isLoading}
                    />
                )}

                {activeTab === 'approved' && (
                    <ApprovedAssetsPicker
                        category={category}
                        selectedIds={selectedReferences
                            .filter(r => r.type === 'approved_asset')
                            .map(r => r.id)}
                        onToggle={(asset) => handleToggleReference({
                            type: 'approved_asset',
                            id: asset.id,
                            thumbnailUrl: asset.thumbnailUrl,
                            name: `${asset.category}/${asset.assetKey}`,
                        })}
                    />
                )}

                {activeTab === 'upload' && (
                    <UploadDropzone onUploadComplete={handleUploadComplete} />
                )}
            </div>
        </div>
    );
}
```

### Settings Step

```tsx
// src/components/assets/GenerateModal/SettingsStep.tsx

import { GenerationSettings } from '../../../services/assetApi';

interface SettingsStepProps {
    settings: GenerationSettings;
    onChange: (settings: GenerationSettings) => void;
}

const PRESETS = {
    creative: { temperature: 1.2, topK: 60, topP: 0.98, label: 'Creative' },
    balanced: { temperature: 0.7, topK: 40, topP: 0.95, label: 'Balanced' },
    precise: { temperature: 0.3, topK: 20, topP: 0.85, label: 'Precise' },
};

export default function SettingsStep({ settings, onChange }: SettingsStepProps) {
    const applyPreset = (preset: keyof typeof PRESETS) => {
        const { temperature, topK, topP } = PRESETS[preset];
        onChange({ ...settings, temperature, topK, topP });
    };

    return (
        <div className="space-y-6">
            <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Presets</p>
                <div className="flex gap-2">
                    {Object.entries(PRESETS).map(([key, preset]) => (
                        <button
                            key={key}
                            onClick={() => applyPreset(key as keyof typeof PRESETS)}
                            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Temperature */}
            <div>
                <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                        Temperature
                    </label>
                    <span className="text-sm text-gray-500">
                        {settings.temperature?.toFixed(2)}
                    </span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.temperature || 0.7}
                    onChange={(e) => onChange({ ...settings, temperature: parseFloat(e.target.value) })}
                    className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400">
                    <span>Precise (0)</span>
                    <span>Creative (2)</span>
                </div>
            </div>

            {/* Top K */}
            <div>
                <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                        Top K
                    </label>
                    <span className="text-sm text-gray-500">{settings.topK}</span>
                </div>
                <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={settings.topK || 40}
                    onChange={(e) => onChange({ ...settings, topK: parseInt(e.target.value) })}
                    className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400">
                    <span>Focused (1)</span>
                    <span>Diverse (100)</span>
                </div>
            </div>

            {/* Top P */}
            <div>
                <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                        Top P
                    </label>
                    <span className="text-sm text-gray-500">
                        {settings.topP?.toFixed(2)}
                    </span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.topP || 0.95}
                    onChange={(e) => onChange({ ...settings, topP: parseFloat(e.target.value) })}
                    className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400">
                    <span>Narrow (0)</span>
                    <span>Wide (1)</span>
                </div>
            </div>

            {/* Info box */}
            <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
                <p className="font-medium mb-2">About these settings:</p>
                <ul className="space-y-1 list-disc list-inside">
                    <li><strong>Temperature:</strong> Controls randomness. Higher = more creative but less consistent.</li>
                    <li><strong>Top K:</strong> Limits vocabulary choices. Lower = more focused output.</li>
                    <li><strong>Top P:</strong> Nucleus sampling. Lower = more deterministic.</li>
                </ul>
            </div>
        </div>
    );
}
```

### Review Step

```tsx
// src/components/assets/GenerateModal/ReviewStep.tsx

import { GenerateFormData } from './types';

interface ReviewStepProps {
    formData: GenerateFormData;
    parentAssetId?: number;
}

export default function ReviewStep({ formData, parentAssetId }: ReviewStepProps) {
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">Review Generation</h3>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                    <span className="text-gray-600">Category:</span>
                    <span className="font-medium">{formData.category}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">Asset Key:</span>
                    <span className="font-medium">{formData.assetKey}</span>
                </div>
                {formData.variant && (
                    <div className="flex justify-between">
                        <span className="text-gray-600">Variant:</span>
                        <span className="font-medium">{formData.variant}</span>
                    </div>
                )}
                {parentAssetId && (
                    <div className="flex justify-between">
                        <span className="text-gray-600">Parent Reference:</span>
                        <span className="font-medium text-purple-600">#{parentAssetId}</span>
                    </div>
                )}
            </div>

            {/* Prompt preview */}
            <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Prompt Preview:</p>
                <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                        {formData.prompt?.slice(0, 500)}
                        {formData.prompt && formData.prompt.length > 500 && '...'}
                    </pre>
                </div>
            </div>

            {/* References */}
            {formData.referenceImages.length > 0 && (
                <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                        Reference Images ({formData.referenceImages.length}):
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {formData.referenceImages.map((ref, i) => (
                            <span key={i} className="px-2 py-1 bg-blue-50 rounded text-sm">
                                {ref.name || `${ref.type} #${ref.id}`}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Settings */}
            <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Generation Settings:</p>
                <div className="flex gap-4 text-sm">
                    <span>Temperature: {formData.generationSettings.temperature}</span>
                    <span>Top K: {formData.generationSettings.topK}</span>
                    <span>Top P: {formData.generationSettings.topP}</span>
                </div>
            </div>
        </div>
    );
}
```

---

## Test Cases

### Test 1: Complete Wizard Flow
1. Open Generate modal
2. Select category: building_ref
3. Select asset key: restaurant
4. Next to Prompt - verify template loaded
5. Edit prompt, Next
6. Select 2 reference images from library
7. Next to Settings - adjust temperature
8. Next to Review - verify summary
9. Click Generate

**Expected:** Generation starts, modal closes, asset appears in list

### Test 2: Pre-filled from Reference
1. Click "Generate Sprite" on an approved building_ref
2. Modal opens with category locked

**Expected:** Starts at Step 2 (Prompt), category/assetKey pre-filled

### Test 3: Save Prompt as Template
1. Edit prompt in Step 2
2. Click "Save as Template"

**Expected:** Template saved, version incremented

### Test 4: Upload Reference Image
1. Go to References step
2. Switch to Upload tab
3. Drop an image

**Expected:** Image uploaded, automatically selected

---

## Acceptance Checklist

### Wizard Navigation
- [ ] 5-step wizard navigation works
- [ ] Back/Next buttons function correctly
- [ ] Progress indicators update

### Category & Parent Reference Selection
- [ ] Category selection with dropdowns (refs, sprites, standalone)
- [ ] **Sprite categories show "Parent Reference" selector**
- [ ] **Parent ref dropdown populated with approved references only**
- [ ] **Sprite variant selector shows when parent is selected**
- [ ] **Sprite status (not started/generating/review/complete) displayed**
- [ ] **Progress indicator shows X/Y sprites complete**
- [ ] Asset key auto-populated from parent ref for sprites

### Prompt Editing
- [ ] Prompt loads from template on category/asset change
- [ ] Prompt is editable
- [ ] Reset to Default works
- [ ] Save as Template works

### Reference Images
- [ ] Reference library grid displays images
- [ ] Can select/deselect reference images
- [ ] Upload dropzone works
- [ ] Approved assets tab shows approved assets
- [ ] **Parent reference shown as "included" for sprites**

### Generation Settings
- [ ] Settings sliders work (temperature, topK, topP)
- [ ] Presets (Creative/Balanced/Precise) work
- [ ] **Settings saved with generation for reproducibility**

### Review & Generate
- [ ] Review shows all selected options
- [ ] **Review shows parent reference for sprites**
- [ ] Generate button calls API with all params
- [ ] **`parent_asset_id` and `sprite_variant` included in API call**
- [ ] Pre-fill mode for generating from reference

---

## Deployment

### Commands

```bash
cd authentication-dashboard-system
npm run build
npm run deploy
```

### Verification

1. Navigate to admin/assets
2. Click "Generate" button
3. Step through wizard
4. Verify generation starts

---

## Handoff Notes

### For Stage 08 (Frontend Preview Modal)
- Regenerate should open similar modal with pre-filled values
- Can reuse PromptEditorStep, ReferenceImagesStep, SettingsStep
- Consider extracting shared components
