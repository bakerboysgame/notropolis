# Stage 08a: System Instructions UI

## Objective

Add System Instructions editing capability to the Prompt Editor, giving full control over what's sent as the Gemini system prompt vs user prompt.

## Dependencies

- **Requires:** [See: Stage 07] - PromptEditorStep component
- **Requires:** [See: Stage 03] - Prompt templates API (already supports systemInstructions)

## Complexity

**Low** - Add one textarea field to existing component, update types.

---

## Background

The Gemini API accepts two types of prompts:
- **System Instructions**: Sets the AI's behavior/persona (persistent context)
- **User Prompt**: The specific generation request

Currently:
- Backend: ✅ Supports `system_instructions` in prompt_templates table
- Backend: ✅ API accepts `systemInstructions` in PUT /prompts/:category/:assetKey
- Frontend: ❌ Only shows `basePrompt` and `styleGuide`, not `systemInstructions`

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/assets/GenerateModal/PromptEditorStep.tsx` | Add system instructions textarea |
| `src/services/assetApi.ts` | Ensure PromptTemplate type includes systemInstructions |

---

## Implementation Details

### Update PromptTemplate Type

```typescript
// src/services/assetApi.ts - Update PromptTemplate interface

export interface PromptTemplate {
  id: number;
  category: string;
  assetKey: string;
  templateName: string;
  basePrompt: string;
  styleGuide?: string;
  systemInstructions?: string;  // ADD THIS
  version: number;
  createdBy: string;
  createdAt: string;
  changeNotes?: string;
}
```

### Update PromptEditorStep

Add a collapsible "Advanced" section with the system instructions:

```tsx
// src/components/assets/GenerateModal/PromptEditorStep.tsx

// Add state for system instructions
const [systemInstructions, setSystemInstructions] = useState('');
const [showAdvanced, setShowAdvanced] = useState(false);

// Load from template
useEffect(() => {
  if (template) {
    setSystemInstructions(template.systemInstructions || '');
  }
}, [template]);

// Update save function to include systemInstructions
const handleSaveAsTemplate = async () => {
  await promptTemplateApi.update(category, assetKey, {
    basePrompt: prompt,
    styleGuide: template?.styleGuide,
    systemInstructions: systemInstructions || undefined,
    changeNotes: 'Updated from Generate Modal',
  });
};

// Add to JSX after the main prompt textarea:
<div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
  <button
    type="button"
    onClick={() => setShowAdvanced(!showAdvanced)}
    className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
  >
    <ChevronRight className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
    Advanced Settings
  </button>

  {showAdvanced && (
    <div className="mt-4 space-y-4">
      {/* System Instructions */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            System Instructions
          </label>
          <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
            Gemini system prompt
          </span>
        </div>
        <textarea
          value={systemInstructions}
          onChange={(e) => setSystemInstructions(e.target.value)}
          className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-mono resize-none"
          placeholder="Set the AI's behavior and persona. This is sent as the system prompt to Gemini..."
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          System instructions define how the AI should behave. The base prompt above is the specific generation request.
        </p>
      </div>

      {/* Style Guide (existing, move here) */}
      {template?.styleGuide && (
        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Style Guide
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {template.styleGuide}
          </p>
        </div>
      )}
    </div>
  )}
</div>
```

### Update Generate API Call

Ensure the generate function passes system instructions:

```tsx
// In GenerateModal/index.tsx handleGenerate()

const result = await assetApi.generate({
  category: formData.category,
  asset_key: formData.assetKey,
  // ... other params
  system_instructions: formData.systemInstructions || undefined,  // ADD
});
```

### Update FormData Type

```typescript
// src/components/assets/GenerateModal/types.ts

export interface GenerateFormData {
  category: AssetCategory | '';
  assetKey: string;
  variant?: number;
  prompt: string;
  customDetails: string;
  systemInstructions: string;  // ADD THIS
  referenceImages: Array<ReferenceImageSpec & { thumbnailUrl?: string; name?: string }>;
  generationSettings: GenerationSettings;
  parentAssetId?: number;
  spriteVariant?: string;
}
```

---

## Test Cases

### Test 1: View System Instructions
1. Open Generate modal
2. Select category: building_ref, asset: restaurant
3. Click "Advanced Settings"

**Expected:** System instructions textarea appears with any existing value

### Test 2: Edit System Instructions
1. Open Advanced Settings
2. Modify system instructions
3. Click "Save as Template"

**Expected:** Template saved with new system instructions

### Test 3: Verify API Receives System Instructions
1. Set custom system instructions
2. Generate an asset
3. Check the generated_assets table

**Expected:** Generation uses the custom system instructions

---

## Acceptance Checklist

- [ ] PromptTemplate type includes systemInstructions
- [ ] "Advanced Settings" collapsible section added
- [ ] System instructions textarea visible when expanded
- [ ] System instructions loaded from template
- [ ] "Save as Template" includes system instructions
- [ ] Help text explains system vs user prompt difference
- [ ] Generate API call includes system_instructions parameter

---

## Deployment

### Commands

```bash
cd authentication-dashboard-system
npm run build
npm run deploy
```

### Verification

1. Open Generate modal
2. Expand "Advanced Settings"
3. Verify system instructions field appears
4. Edit and save as template
5. Verify saved via API:

```python
python3 -c "
import urllib.request
import json

token = 'YOUR_TOKEN'
req = urllib.request.Request('https://api.notropolis.net/api/admin/assets/prompts/building_ref/restaurant')
req.add_header('Authorization', f'Bearer {token}')

with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read())
    template = data.get('template', {})
    print(f'System Instructions: {template.get(\"systemInstructions\", \"(none)\")[:100]}...')"
```

---

## Handoff Notes

### For Stage 09 (Integration Testing)
- Test that system instructions are actually sent to Gemini
- Verify different system instructions produce different outputs
- Test that empty system instructions use the default
