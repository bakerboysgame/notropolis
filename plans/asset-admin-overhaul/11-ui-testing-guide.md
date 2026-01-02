# Stage 11: UI Testing Guide

## Objective

Manual testing of the complete Asset Admin system through the UI at `https://boss.notropolis.net/admin/assets`. This guide walks through all features built in Stages 1-10.

## Prerequisites

- Access to `https://boss.notropolis.net` with master_admin credentials
- At least one approved building sprite exists (for Asset Manager testing)

---

## Test 1: Reference Library

**Location:** Asset Generation tab → "Reference Library" button (top right)

### 1.1 Open Reference Library
1. Navigate to `/admin/assets`
2. Click "Reference Library" button in the header
3. **Expected:** Modal opens showing reference image grid

### 1.2 Upload a Reference Image
1. In the Reference Library modal, click "Upload" or drag an image
2. Select any image file (PNG, JPG, WebP)
3. **Expected:**
   - Upload progress indicator shows
   - Image appears in the grid after upload
   - Image has delete button on hover

### 1.3 Delete a Reference Image
1. Hover over an uploaded reference image
2. Click the delete/trash icon
3. Confirm deletion
4. **Expected:** Image removed from grid

---

## Test 2: Generate Asset (Full Wizard)

**Location:** Asset Generation tab → "Generate Asset" button

### 2.1 Open Generate Modal
1. Click "Generate Asset" button
2. **Expected:** Multi-step wizard opens at Category step

### 2.2 Step 1: Select Category
1. Select "Building Reference" from the category dropdown
2. Select a building type (e.g., "burger_bar")
3. Click "Next"
4. **Expected:** Moves to Prompt Editor step

### 2.3 Step 2: Edit Prompt
1. **Expected:** Prompt textarea shows the base prompt for the selected type
2. Edit the prompt text (add a word or change a description)
3. Expand "Advanced Settings" accordion
4. **Expected:**
   - System Instructions textarea visible
   - Can edit system instructions
5. Click "Next"
6. **Expected:** Moves to Reference Images step

### 2.4 Step 3: Select Reference Images
1. **Expected:** Shows reference library grid
2. Click to select one or more reference images
3. Selected images show checkmark overlay
4. Click "Next"
5. **Expected:** Moves to Settings step

### 2.5 Step 4: Configure Gemini Settings
1. **Expected:** Shows sliders for:
   - Temperature (0-2)
   - Top K (1-100)
   - Top P (0-1)
2. Adjust each slider
3. Values update in real-time
4. Click "Next"
5. **Expected:** Moves to Review step

### 2.6 Step 5: Review and Generate
1. **Expected:** Shows summary of all selections:
   - Category and asset type
   - Prompt preview (truncated)
   - Selected references count
   - Gemini settings
2. Click "Generate"
3. **Expected:**
   - Loading indicator shows
   - Modal closes on success
   - Toast notification: "Asset generation started"
   - New asset appears in Queue with "pending" status

---

## Test 3: Queue Status

**Location:** Asset Generation tab → Queue Status panel

### 3.1 View Queue
1. **Expected:** Queue panel shows:
   - Pending assets (yellow)
   - Processing assets (blue spinner)
   - Completed assets (green)
   - Failed assets (red)

### 3.2 Wait for Processing
1. Watch a pending asset
2. **Expected:** Status changes from "pending" → "processing" → "ready_for_review"

---

## Test 4: Preview and Approve Asset

**Location:** Asset Generation tab → Click on an asset card

### 4.1 Open Preview Modal
1. Click on an asset with "Ready for Review" status
2. **Expected:** Preview modal opens showing:
   - Generated image
   - Asset details (category, type, variant)
   - Prompt used
   - Gemini settings used
   - Reference images used (if any)

### 4.2 View Generation Details
1. In preview modal, expand "Generation Details"
2. **Expected:** Shows:
   - Temperature, TopK, TopP values
   - System instructions (if used)
   - Prompt text

### 4.3 Approve Asset
1. Click "Approve" button
2. **Expected:**
   - Toast: "Asset approved"
   - Status changes to "approved"
   - For sprites: Background removal + processing starts

### 4.4 Reject Asset
1. Open a different "Ready for Review" asset
2. Click "Reject" button
3. **Expected:**
   - Toast: "Asset rejected"
   - Status changes to "rejected"

---

## Test 5: Regenerate Asset

**Location:** Preview Modal → "Regenerate" button

### 5.1 Open Regenerate Modal
1. Open preview for an approved or rejected asset
2. Click "Regenerate" button
3. **Expected:** Regenerate modal opens with:
   - Pre-filled prompt from original
   - Pre-filled settings from original
   - Option to modify before regenerating

### 5.2 Modify and Regenerate
1. Edit the prompt slightly
2. Adjust a Gemini setting
3. Click "Regenerate"
4. **Expected:**
   - Toast: "Regeneration started"
   - New asset created with incremented variant number
   - Original asset preserved (not overwritten)

---

## Test 6: Asset Manager - Buildings Tab

**Location:** Asset Manager tab → Buildings

### 6.1 View Building Configurations
1. Click "Asset Manager" tab
2. **Expected:** Buildings tab is active by default
3. **Expected:** List shows all building types with:
   - Current sprite preview (or "?" if none)
   - Name
   - Cost and Profit values
   - Status badge (PUBLISHED/DRAFT/NO SPRITE)

### 6.2 Edit Building Prices
1. Click "Pricing" button on any building
2. **Expected:** Edit form expands showing:
   - Cost field with "Use default" checkbox
   - Profit field with "Use default" checkbox
3. Uncheck "Use default" for Cost
4. Enter a custom cost value (e.g., 5000)
5. Click "Save"
6. **Expected:**
   - Toast: "Prices updated"
   - Building shows "(override)" next to cost

### 6.3 Revert to Default Price
1. Click "Pricing" on the same building
2. Check "Use default" for Cost
3. Click "Save"
4. **Expected:** "(override)" removed, shows default value

### 6.4 Select Active Sprite
1. Find a building with available sprites
2. Click "Choose from X sprites" link
3. **Expected:** Sprite selector panel expands
4. Click a different sprite
5. **Expected:**
   - Toast: "Sprite updated"
   - Preview updates to new sprite

### 6.5 Publish Building
1. Find a building with DRAFT status (has sprite, not published)
2. Click "Publish" button
3. **Expected:**
   - Toast: "Building published"
   - Status changes to "PUBLISHED"

### 6.6 Unpublish Building
1. Find a PUBLISHED building
2. Click "Unpublish" button
3. **Expected:**
   - Toast: "Building unpublished"
   - Status changes to "DRAFT"

---

## Test 7: Asset Manager - Other Tabs

**Location:** Asset Manager tab → NPCs/Effects/Terrain tabs

### 7.1 View Empty Categories
1. Click "NPCs" tab
2. **Expected:** Empty state message: "No npcs configurations found. Generate and approve npcs sprites first..."
3. Repeat for "Effects" and "Terrain" tabs

### 7.2 Base Ground Tab
1. Click "Base Ground" tab
2. **Expected:**
   - Info box explaining base ground concept
   - Grid of available base ground textures (or empty state)
3. If textures exist:
   - Active texture has green border + "ACTIVE" badge
   - Click a different texture
   - **Expected:** That texture becomes active

---

## Test 8: Prompt Templates

**Location:** Prompt editing during generation

### 8.1 View Default Template
1. Start a new generation (Generate Asset button)
2. Select a category and type
3. Go to Prompt Editor step
4. **Expected:** Shows the default template for that asset type

### 8.2 Save Modified Template
1. Edit the prompt
2. Check "Save as new template" checkbox (if available)
3. Complete generation
4. **Expected:** Next time you generate same type, modified prompt is the default

---

## Test 9: End-to-End Flow

Complete workflow from generation to game-ready asset.

### 9.1 Generate a Building Reference
1. Generate Asset → Building Reference → Select type
2. Edit prompt, add references, adjust settings
3. Generate → Wait for processing
4. Approve the result

### 9.2 Generate Building Sprite
1. Generate Asset → Building Sprite → Same type
2. Select the approved reference as parent
3. Generate → Wait for processing
4. Approve the sprite
5. **Expected:** Background removal starts automatically

### 9.3 Configure in Asset Manager
1. Go to Asset Manager → Buildings
2. Find the building type
3. Select the new sprite as active
4. Edit price if desired
5. Publish

### 9.4 Verify Published
1. Check status shows "PUBLISHED"
2. **Expected:** Asset is now available for game consumption

---

## Test 10: Error Handling

### 10.1 Cancel Generation Mid-Process
1. Start a generation
2. Click Cancel before it completes
3. **Expected:** Modal closes, no orphaned records

### 10.2 Network Error Recovery
1. Disconnect network briefly
2. Try an action (e.g., approve)
3. **Expected:** Error toast shows
4. Reconnect and retry
5. **Expected:** Action succeeds

### 10.3 Invalid Reference Image
1. Try to upload a non-image file
2. **Expected:** Error message, upload rejected

---

## Checklist

| Test | Status | Notes |
|------|--------|-------|
| 1.1 Open Reference Library | ☐ | |
| 1.2 Upload Reference Image | ☐ | |
| 1.3 Delete Reference Image | ☐ | |
| 2.1 Open Generate Modal | ☐ | |
| 2.2 Select Category | ☐ | |
| 2.3 Edit Prompt | ☐ | |
| 2.4 Select References | ☐ | |
| 2.5 Configure Settings | ☐ | |
| 2.6 Review and Generate | ☐ | |
| 3.1 View Queue | ☐ | |
| 3.2 Wait for Processing | ☐ | |
| 4.1 Open Preview Modal | ☐ | |
| 4.2 View Generation Details | ☐ | |
| 4.3 Approve Asset | ☐ | |
| 4.4 Reject Asset | ☐ | |
| 5.1 Open Regenerate Modal | ☐ | |
| 5.2 Modify and Regenerate | ☐ | |
| 6.1 View Building Configurations | ☐ | |
| 6.2 Edit Building Prices | ☐ | |
| 6.3 Revert to Default Price | ☐ | |
| 6.4 Select Active Sprite | ☐ | |
| 6.5 Publish Building | ☐ | |
| 6.6 Unpublish Building | ☐ | |
| 7.1 View Empty Categories | ☐ | |
| 7.2 Base Ground Tab | ☐ | |
| 8.1 View Default Template | ☐ | |
| 8.2 Save Modified Template | ☐ | |
| 9.1 Generate Building Reference | ☐ | |
| 9.2 Generate Building Sprite | ☐ | |
| 9.3 Configure in Asset Manager | ☐ | |
| 9.4 Verify Published | ☐ | |
| 10.1 Cancel Mid-Process | ☐ | |
| 10.2 Network Error Recovery | ☐ | |
| 10.3 Invalid Reference Image | ☐ | |

---

## Issues Found

Document any issues discovered during testing:

| Test | Issue | Severity | Fixed? |
|------|-------|----------|--------|
| | | | |

---

## Sign-off

- **Tested By:**
- **Date:**
- **Result:** ☐ PASS / ☐ FAIL
- **Notes:**
