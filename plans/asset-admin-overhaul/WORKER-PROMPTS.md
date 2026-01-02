# Asset Admin Overhaul - Worker Prompts

## How to Use These Prompts

Copy the appropriate prompt section and paste it to start a new Claude Code session for that stage.

---

## NEW STAGE PROMPT (Template)

Copy and modify the stage number as you progress.

```
You are a technical project manager. Your task has two parts, with a GATE between them.

---

## CONFIGURATION

**Master Plan Path:** `/Users/riki/notropolis/plans/asset-admin-overhaul/00-master-plan.md`
**Stage Document:** `/Users/riki/notropolis/plans/asset-admin-overhaul/01-database-schema.md`
**Stage Number:** 1

---

## Part 1: Review the Specification

Read both the Master Plan and the Stage Document.

Review for:
- Completeness - Are requirements clear? Any gaps that would block a developer?
- Technical accuracy - Do code snippets look correct? Are file paths accurate?
- Stage dependencies - Have prerequisite stages been completed?
- Test coverage - Do checklists cover acceptance criteria and edge cases?

### If you find issues:

**Fixable issues** (typos, minor code errors, missing details you can infer):
→ Fix them directly in the spec file and note what you changed.

**Blocking issues** (ambiguous requirements, missing context, decisions needed):
→ STOP and list your questions. Do NOT proceed to Part 2.

---

## 🚫 GATE: Do not proceed until the spec is accurate and complete.

---

## Part 2: Implement the Stage

Only proceed here once the specification has no outstanding issues.

### Implementation Requirements:

**1. Reference Files** ⚠️ REQUIRED
- Check `docs/REFERENCE-test-tokens/CLAUDE.md` for JWT tokens and database access commands
- Use existing valid tokens when testing - DO NOT generate new tokens unless expired

**2. Implementation**
- Follow the Stage Document exactly
- Create/modify only the files specified
- Do NOT implement future stages

**3. Verification** ⚠️ REQUIRED
- Run all test cases from the Stage Document
- Use the Python method for API testing (see CLAUDE.md)
- Verify database changes with wrangler d1 commands

**4. Deployment** ⚠️ REQUIRED
- For migrations: `npx wrangler d1 execute notropolis-db --remote --file=migrations/XXXX.sql`
- For worker: `cd authentication-dashboard-system && npm run deploy`
- Verify deployment succeeded

**5. Mark Complete**
When finished, update the Master Plan:
- Add ✅ next to the stage in the Stage Index
- Note any issues encountered or deviations from spec

### Completion Checklist

- [ ] Spec reviewed and any issues fixed
- [ ] Code changes made per spec
- [ ] All test cases pass
- [ ] Deployed to production
- [ ] Deployment verified
- [ ] Master Plan updated with ✅

Ref 
Cloudflare api details (stored as worker secrets) for querying d1 and worker are:
CLOUDFLARE_API_TOKEN RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_ CLOUDFLARE_ACCOUNT_ID 329dc0e016dd5cd512d6566d64d8aa0c
```

---

## CHECKING COMPLETED WORK PROMPT

```
You are a technical project manager reviewing completed work.

---

## CONFIGURATION

**Master Plan Path:** `/Users/riki/notropolis/plans/asset-admin-overhaul/00-master-plan.md`
**Just Completed:** Stage X (update this number)

---

## Part 1: Review the Completed Stage

Verify the stage was implemented correctly:

### Code Review
- Were the correct files modified?
- Does the implementation match the spec?
- Any obvious bugs, edge cases missed, or code quality issues?

### Deployment Verification
- Was the worker/migration deployed?
- Can you verify it's live? (Check logs, hit an endpoint, etc.)

### Test Coverage
- Were the acceptance criteria in the checklist met?
- Run specific verification commands from the stage document

### Reference Files
- Check `docs/REFERENCE-test-tokens/CLAUDE.md` for JWT tokens
- Use Python method for API testing (DO NOT use shell variable substitution)

### If you find issues:

**Fixable issues** (minor bugs, missing error handling you can add):
→ Fix them, redeploy if needed, and note what you changed.

**Blocking issues** (broken functionality, spec deviation, failed deployment):
→ STOP and tell me what's wrong. Do NOT proceed to the next stage.

---

## 🚫 GATE: Do not proceed until the completed stage fully works.

---

## Part 2: Update Progress

Mark the completed stage as done in the Master Plan:
- Add ✅ next to the stage in the Stage Index table
- Note any issues or deviations

---

## Part 3: Create Next Stage Worker Prompt

Generate the prompt for the next stage using this format:

1. **Task Overview** - Which file(s) and function(s) to modify, reference to spec sections
2. **Scope Boundaries** - What they SHOULD do vs should NOT do
3. **Reference Files** - Point to `docs/REFERENCE-test-tokens/CLAUDE.md` for tokens and DB access
4. **Verification Steps** - Specific test commands using Python method
5. **Deployment** - Exact commands, verification steps
6. **Completion Checklist** - Code, tests, deploy, verify

Output the worker prompt in a code block for easy copying.

If there is no next stage, confirm the project is complete and summarize what was built.
```

---

## Stage-Specific Quick Reference

### Stage 1: Database Schema
```
Stage Document: 01-database-schema.md
Files to Create: migrations/0026_asset_generation_overhaul.sql
Deploy: npx wrangler d1 execute notropolis-db --remote --file=migrations/0026_asset_generation_overhaul.sql
Verify: Check tables exist with PRAGMA commands
```

### Stage 2: Reference Library Backend
```
Stage Document: 02-reference-library-backend.md
Files to Modify: worker/src/routes/admin/assets.js, src/services/assetApi.ts
Deploy: cd authentication-dashboard-system && npm run deploy
Verify: Test upload/list/delete endpoints with Python + token
```

### Stage 3: Prompt Templates Backend
```
Stage Document: 03-prompt-templates-backend.md
Files to Create: migrations/0027_seed_prompt_templates.sql
Files to Modify: worker/src/routes/admin/assets.js, src/services/assetApi.ts
Deploy: Run migration, then deploy worker
Verify: Test GET/PUT prompt template endpoints
```

### Stage 4: Enhanced Generate Endpoint
```
Stage Document: 04-enhanced-generate-endpoint.md
Files to Modify: worker/src/routes/admin/assets.js, src/services/assetApi.ts
Deploy: npm run deploy
Verify: Generate with custom prompt, references, and settings
```

### Stage 5: Auto-Sprite Creation
```
Stage Document: 05-auto-sprite-creation.md
Files to Modify: worker/src/routes/admin/assets.js
Deploy: npm run deploy
Verify: Approve building_ref, check building_sprite created
```

### Stage 6: Regenerate Flow
```
Stage Document: 06-regenerate-flow.md
Files to Modify: worker/src/routes/admin/assets.js, src/services/assetApi.ts
Deploy: npm run deploy
Verify: Regenerate creates new version, old preserved
```

### Stage 7: Frontend Generate Modal
```
Stage Document: 07-frontend-generate-modal.md
Files to Create: src/components/assets/GenerateModal/*.tsx, src/components/assets/ReferenceLibrary/*.tsx
Files to Modify: src/components/assets/GenerateModal.tsx
Deploy: npm run build && npm run deploy
Verify: Open Generate modal, step through wizard
```

### Stage 8: Frontend Preview Modal
```
Stage Document: 08-frontend-preview-modal.md
Files to Create: src/components/assets/RegenerateModal.tsx
Files to Modify: src/components/assets/AssetPreviewModal.tsx
Deploy: npm run build && npm run deploy
Verify: Open preview, test regenerate flow
```

### Stage 8a: System Instructions UI
```
Stage Document: 08a-system-instructions-ui.md
Files to Modify: src/components/assets/GenerateModal/PromptEditorStep.tsx, src/components/assets/GenerateModal/types.ts, src/services/assetApi.ts
Deploy: npm run build && npm run deploy
Verify:
  - Open Generate modal, expand "Advanced Settings"
  - Verify System Instructions textarea appears
  - Edit and save as template
  - Verify systemInstructions saved via API
```

### Stage 9: Integration Testing
```
Stage Document: 09-integration-testing.md
No new files - testing and verification only
Run all E2E test scenarios
Sign off on completion
```

### Stage 10: Asset Manager
```
Stage Document: 10-asset-manager.md
Files to Create: migrations/0028_create_asset_configurations.sql, src/components/assets/AssetManager.tsx
Files to Modify: worker/src/routes/admin/assets.js, src/services/assetApi.ts, src/pages/AssetAdminPage.tsx
Files to Rename: BuildingManager.tsx → integrate into AssetManager.tsx
Deploy: Run migration, then npm run build && npm run deploy
Verify:
  - Buildings tab with price editing
  - NPCs/Effects/Terrain tabs
  - Publish/unpublish for all types
```

---

## Verification Commands Reference

### Database Access
```bash
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler d1 execute notropolis-database --remote --command "YOUR_SQL"
```

### API Testing (Python - ALWAYS use this method)
```python
python3 -c "
import urllib.request
import json

token = 'YOUR_TOKEN_FROM_CLAUDE_MD'
req = urllib.request.Request('https://api.notropolis.net/api/admin/assets/YOUR_ENDPOINT')
req.add_header('Authorization', f'Bearer {token}')

try:
    with urllib.request.urlopen(req) as resp:
        print(json.dumps(json.loads(resp.read()), indent=2))
except urllib.error.HTTPError as e:
    print(f'HTTP Error {e.code}: {e.read().decode()}')"
```

### POST Request (Python)
```python
python3 -c "
import urllib.request
import json

token = 'YOUR_TOKEN'
data = json.dumps({'key': 'value'}).encode()

req = urllib.request.Request(
    'https://api.notropolis.net/api/admin/assets/generate',
    data=data,
    method='POST'
)
req.add_header('Authorization', f'Bearer {token}')
req.add_header('Content-Type', 'application/json')

try:
    with urllib.request.urlopen(req) as resp:
        print(json.dumps(json.loads(resp.read()), indent=2))
except urllib.error.HTTPError as e:
    print(f'HTTP Error {e.code}: {e.read().decode()}')"
```

Cloudflare api details (stored as worker secrets) for querying d1 and worker are:
CLOUDFLARE_API_TOKEN RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_ CLOUDFLARE_ACCOUNT_ID 329dc0e016dd5cd512d6566d64d8aa0c