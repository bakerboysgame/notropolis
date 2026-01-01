# Asset Pipeline Project Management Prompts

Use these prompts to start new stages or verify completed stages.

---

## Technical Context

Before using these prompts, understand the key architecture decisions:

### Two-Bucket Storage
- **Private Bucket** (`notropolis-assets-private`): High-res originals, reference sheets, raw sprites
- **Public Bucket** (`notropolis-game-assets`): Game-ready WebP assets at exact target sizes

### Image Generation: Nano Banana Pro
Using **Nano Banana Pro** (`gemini-3-pro-image-preview`) - Google's latest image generation model.
Uses `generateContent` API with `responseModalities: ["IMAGE", "TEXT"]`.

### Image Format Strategy
- **Reference sheets**: PNG at 3840×2160 (4K) → stored in private bucket (NO background removal)
- **Game sprites**: WebP with transparency at exact target size → stored in public bucket
- **Scene illustrations**: WebP at 1280×720 → stored in public bucket

### Background Removal
**All game sprites need Removal.ai** background removal — buildings, effects, NPCs, UI, overlays, terrain tiles.

**Exceptions (no removal needed):**
- Reference sheets (keep backgrounds for promo/reference)
- Scene illustrations (full backgrounds intended)

### Generation Philosophy
Generate at **exact target size** rather than downscaling. This keeps assets lightweight and avoids quality loss from resizing.

---

## NEW STAGE PROMPT

Copy and paste this prompt, replacing `XX` with the stage number (01, 02, etc.):

```
You are a technical project manager. Your task has two parts, with a GATE between them.

---

## CONFIGURATION

**Project:** Notropolis Game - Asset Generation Pipeline
**Master Plan:** `/Users/riki/notropolis/plans/notropolis-game/17-asset-pipeline/00-master-plan.md`
**Stage Spec:** `/Users/riki/notropolis/plans/notropolis-game/17-asset-pipeline/XX-stage-name.md`

---

## Part 1: Review the Specification

First, read the **Master Plan** to understand:
- Overall project context and 66-asset goal
- Two-bucket architecture (private for originals, public for game-ready)
- WebP format for game assets, PNG for reference sheets
- "Generate at target size" philosophy

Then read the **Stage Spec** and review it for:
- Completeness - Are requirements clear? Any gaps that would block a developer?
- Technical accuracy - Do code snippets look correct? Are file/line references accurate?
- Stage dependencies - Are prerequisites from earlier stages met?
- Test coverage - Do checklists cover acceptance criteria and edge cases?
- Format compliance - Are assets using correct format (WebP for game, PNG for refs)?

### If you find issues:

**Fixable issues** (typos, minor code errors, missing details you can infer):
→ Fix them directly in the spec file and note what you changed.

**Blocking issues** (ambiguous requirements, missing context, decisions needed):
→ STOP and list your questions. Do NOT proceed to Part 2.

---

## 🚫 GATE: Do not proceed until the spec is accurate and complete.

---

## Part 2: Create the Stage Worker Prompt

Only proceed here once the specification has no outstanding issues.

Write a clear prompt for a developer to implement this stage only.

### The prompt MUST include these sections:

**1. Task Overview**
- Which file(s) and function(s) to create or modify
- Reference to specific sections of the stage spec

**2. Scope Boundaries**
- What they SHOULD do
- What they should NOT do (future stages, out-of-scope changes)
- List any prerequisite stages that must be complete first

**3. Reference Files** ⚠️ REQUIRED
- Direct the worker to check `docs/REFERENCE-test-tokens/CLAUDE.md` for JWT tokens and test credentials
- If the stage involves authenticated endpoints, they MUST use tokens from this file for testing

**4. API Credentials & Storage**
These secrets are already configured in the worker:
- `GEMINI_API_KEY` - For Nano Banana Pro image generation via Google AI API (up to 3840×2160)
- `REMOVAL_AI_API_KEY` - For background removal on all game sprites (Removal.ai, use Rm-Token header)

R2 Buckets:
- **Private** (`notropolis-assets-private`): Reference sheets, raw sprites
- **Public** (`notropolis-game-assets`): Game-ready WebP assets

Cloudflare API details for D1/Worker queries:
- `CLOUDFLARE_API_TOKEN`: RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_
- `CLOUDFLARE_ACCOUNT_ID`: 329dc0e016dd5cd512d6566d64d8aa0c

**5. Asset Format Rules**
- Reference sheets: PNG, 2048×2048, private bucket `/refs/`
- Game sprites: WebP with alpha, exact target size, public bucket `/sprites/`
- Scenes: WebP, 1280×720, public bucket `/scenes/`

**6. Verification Steps** ⚠️ REQUIRED
- How to test their changes locally
- Specific curl commands or test cases using reference tokens where applicable
- Expected outputs
- Verify assets are in correct bucket with correct format

**7. Deployment** ⚠️ REQUIRED
- The exact deploy command(s) to run: `cd authentication-dashboard-system/worker && wrangler deploy`
- Confirmation that deployment is PART OF the task, not optional
- How to verify the deployment succeeded

**8. Completion Checklist**
- [ ] Code changes made
- [ ] Local tests pass
- [ ] Assets in correct format (WebP for game, PNG for refs)
- [ ] Assets in correct bucket (private for originals, public for game-ready)
- [ ] Deployed to environment
- [ ] Deployment verified

### Format
Output your worker prompt in a code block so it can be copied directly. Keep it brief—the spec documents contain the detail.
```

---

## CHECKING / VERIFICATION PROMPT

Copy and paste this prompt after a stage is completed:

```
You are a technical project manager reviewing completed work.

---

## CONFIGURATION

**Project:** Notropolis Game - Asset Generation Pipeline
**Master Plan:** `/Users/riki/notropolis/plans/notropolis-game/17-asset-pipeline/00-master-plan.md`
**Stage Spec:** `/Users/riki/notropolis/plans/notropolis-game/17-asset-pipeline/XX-stage-name.md`
**Just Completed:** Stage XX

---

## Part 1: Review the Completed Stage

Read the **Stage Spec** to understand what was required, then verify it was implemented correctly:

### Code Review
- Were the correct files modified/created?
- Does the implementation match the spec?
- Any obvious bugs, edge cases missed, or code quality issues?

### Asset Format Verification
- Are reference sheets stored as PNG in the private bucket?
- Are game-ready assets stored as WebP in the public bucket?
- Are assets at correct target sizes (not over-sized)?

### Deployment Verification
- Was the worker deployed?
- Can you verify it's live? (Check logs, hit an endpoint, etc.)

Cloudflare API details for verification:
- `CLOUDFLARE_API_TOKEN`: RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_
- `CLOUDFLARE_ACCOUNT_ID`: 329dc0e016dd5cd512d6566d64d8aa0c

### Test Coverage
- Were the acceptance criteria in the checklist met?
- Are there things I should manually test/verify? List specific curl commands or steps.
- Verify at least one asset loads correctly from the public bucket URL.

### If you find issues:

**Fixable issues** (minor bugs, missing error handling you can add):
→ Fix them, redeploy if needed, and note what you changed.

**Blocking issues** (broken functionality, spec deviation, failed deployment, wrong asset format):
→ STOP and tell me what's wrong. Do NOT proceed to the next stage.

---

## 🚫 GATE: Do not proceed until the completed stage fully works.

---

## Part 2: Update Progress

Mark the completed stage as done in the **Master Plan** Stage Index table (add ✅ before the stage name).

---

## Part 3: Create the Next Stage Worker Prompt

Read the next stage spec file and generate the worker prompt using the same format:

1. Task Overview (files, functions, spec sections)
2. Scope Boundaries (do / don't do / prerequisites)
3. Reference Files — point to `docs/REFERENCE-test-tokens/CLAUDE.md` for JWT tokens and test credentials
4. API Credentials & Storage (GEMINI_API_KEY for Nano Banana Pro, REMOVAL_AI_API_KEY for all game sprites, two R2 buckets)
5. Asset Format Rules (WebP for game, PNG for refs, exact target sizes)
6. Verification Steps (with specific test commands)
7. Deployment (exact commands, verification)
8. Completion Checklist

Output the worker prompt in a code block.

If there is no next stage (all 7 stages complete), confirm the pipeline is complete and summarise:
- Total assets generated (target: 66)
- Storage structure in both buckets
- Admin page functionality
```

---

## Stage Index

| Stage | File | Description |
|-------|------|-------------|
| 01 | `01-infrastructure.md` | Database schema, API routes, secrets |
| 02 | `02-building-reference-sheets.md` | Generate 13 building refs (2048×2048 PNG) |
| 03 | `03-building-sprites.md` | Generate sprites + remove backgrounds (WebP) |
| 04 | `04-dirty-trick-assets.md` | 6 dirty trick + 6 status effect overlays |
| 05 | `05-scene-illustrations.md` | 8 scene images (1280×720 WebP) |
| 06 | `06-terrain-ui-assets.md` | 7 terrain, 2 overlays, 3 UI, 8 NPC sprites |
| 07 | `07-asset-admin-page.md` | Admin UI for asset management |

---

## Quick Reference

**Worker URL:** `https://notropolis-api.rikisenia.workers.dev`

**R2 Buckets:**
- Private (originals): `notropolis-assets-private`
- Public (game-ready): `https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev`

**Test Tokens:** See `docs/REFERENCE-test-tokens/CLAUDE.md`

**Deploy Command:**
```bash
cd authentication-dashboard-system/worker && wrangler deploy
```

**Check Secrets:**
```bash
curl -X GET "https://api.cloudflare.com/client/v4/accounts/329dc0e016dd5cd512d6566d64d8aa0c/workers/scripts/notropolis-api/secrets" \
  -H "Authorization: Bearer RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_"
```

---

## Asset Count Summary

| Category | Count | Format | Bucket |
|----------|-------|--------|--------|
| Reference sheets | 13 | PNG 2048×2048 | Private |
| Building sprites | 13 | WebP (transparent) | Public |
| Terrain tiles | 7 | WebP 64×32 | Public |
| Ownership overlays | 2 | WebP 64×32 | Public |
| Status effects | 6 | WebP | Public |
| Dirty trick effects | 6 | WebP (transparent) | Public |
| UI elements | 3 | WebP | Public |
| Scene illustrations | 8 | WebP 1280×720 | Public |
| NPC sprites | 8 | WebP | Public |
| **Total** | **66** | | |
