# Stage 05: Scene Illustrations (Layered Templates)

## Objective

Generate 8 layered scene templates for game events (arrest, court, prison, celebration, etc.) that support dynamic avatar compositing. Each scene consists of:
- **Background layer** - Scene without any character
- **Avatar slot** - Position/size definition where player's avatar is placed
- **Foreground layer** (optional) - Elements that appear in front of the avatar (prison bars, confetti, etc.)

## Dependencies

`[Requires: Stage 04 complete]` - Building and effect assets should be finalized for style consistency.
`[Requires: Stage 08 complete]` - Avatar assets for testing compositing.

## Complexity

**Medium** - Layered scenes with precise positioning for avatar compositing.

---

## Files to Create

| File | Purpose |
|------|---------|
| `scripts/generate-scene-templates.js` | Scene template generation script |

---

## Scene Template List

| # | Scene Key | Name | Usage | Has Foreground | Avatar Slot |
|---|-----------|------|-------|----------------|-------------|
| 1 | arrest | Being Arrested | When player gets caught | Yes (police hands) | Center, standing |
| 2 | court | Court Appearance | During trial | No | Center-left, seated |
| 3 | prison | Prison Cell | While serving time | Yes (bars overlay) | Center, seated on bunk |
| 4 | hero_out | Hero Celebration | When player "heroes out" | Yes (confetti) | Center, standing |
| 5 | bank_interior | Bank Interior | Bank transactions | No | Center-right, at counter |
| 6 | temple_interior | Temple Interior | Temple donations | No | Center, kneeling/praying |
| 7 | offshore | Offshore Paradise | Offshore banking | No | Center, relaxing pose |
| 8 | dirty_trick | Dirty Trick Attack | When attacking rival | Yes (shadows) | Center, sneaking pose |

---

## Scene Layer Architecture

Each scene template consists of:

```
┌─────────────────────────────────────────────────────┐
│                   FOREGROUND LAYER                   │  ← Optional: Bars, confetti, hands, etc.
│                  (transparent PNG)                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│     ┌─────────────────┐                              │
│     │                 │                              │
│     │   AVATAR SLOT   │  ← Player's avatar composited here
│     │   (x,y,w,h)     │
│     │                 │                              │
│     └─────────────────┘                              │
│                                                      │
├─────────────────────────────────────────────────────┤
│                  BACKGROUND LAYER                    │  ← Scene without character
│                    (full PNG)                        │
└─────────────────────────────────────────────────────┘
```

---

## Scene Specifications

- **Dimensions:** 1920×1080 (16:9 widescreen)
- **Background Format:** PNG (no transparency)
- **Foreground Format:** PNG with transparency
- **Avatar Slot:** JSON object `{x, y, width, height, rotation?}`
- **Style:** 90s CGI aesthetic with modern render quality
- **Country-Neutral:** No specific flags, currencies, or national identifiers

### Avatar Slot Guidelines

| Scene Type | Avatar Size | Position | Notes |
|------------|-------------|----------|-------|
| Standing | 400×600 | Center | Full body visible |
| Seated | 350×450 | Varies | Upper body focus |
| Kneeling | 350×500 | Center | Prayer pose |
| Relaxing | 500×400 | Center | Lounging pose |

---

## Database Schema

Scene templates are stored in `scene_templates` table (see [01-infrastructure.md](01-infrastructure.md)):

```sql
INSERT INTO scene_templates (id, name, description, background_r2_key, foreground_r2_key, avatar_slot, width, height) VALUES
('arrest', 'Being Arrested', 'Player being arrested by police', 'scenes/templates/arrest_bg.png', 'scenes/templates/arrest_fg.png', '{"x": 760, "y": 240, "width": 400, "height": 600}', 1920, 1080),
('court', 'Court Appearance', 'Courtroom trial scene', 'scenes/templates/court_bg.png', NULL, '{"x": 500, "y": 350, "width": 350, "height": 450}', 1920, 1080),
('prison', 'Prison Cell', 'Behind bars in prison cell', 'scenes/templates/prison_bg.png', 'scenes/templates/prison_fg.png', '{"x": 760, "y": 300, "width": 400, "height": 550}', 1920, 1080),
('hero_out', 'Hero Celebration', 'Victory celebration scene', 'scenes/templates/hero_out_bg.png', 'scenes/templates/hero_out_fg.png', '{"x": 760, "y": 240, "width": 400, "height": 600}', 1920, 1080),
('bank_interior', 'Bank Interior', 'Grand bank lobby', 'scenes/templates/bank_bg.png', NULL, '{"x": 900, "y": 280, "width": 380, "height": 560}', 1920, 1080),
('temple_interior', 'Temple Interior', 'Peaceful temple', 'scenes/templates/temple_bg.png', NULL, '{"x": 760, "y": 330, "width": 400, "height": 500}', 1920, 1080),
('offshore', 'Offshore Paradise', 'Tropical tax haven', 'scenes/templates/offshore_bg.png', NULL, '{"x": 710, "y": 340, "width": 500, "height": 400}', 1920, 1080),
('dirty_trick', 'Dirty Trick Attack', 'Sabotage scene', 'scenes/templates/dirty_trick_bg.png', 'scenes/templates/dirty_trick_fg.png', '{"x": 760, "y": 280, "width": 400, "height": 560}', 1920, 1080);
```

---

## Implementation Details

### Layered Template Generation Strategy

For each scene, we generate TWO images:
1. **Background** - The scene environment WITHOUT any character
2. **Foreground** (if needed) - Overlay elements like bars, confetti, hands

The player's avatar is composited between these layers at runtime.

### Scene Template Prompts

```javascript
const sceneTemplates = [
    {
        key: 'arrest',
        name: 'Being Arrested',
        background_prompt: `Create a BACKGROUND ONLY scene for avatar compositing: BEING ARRESTED.

Format: 16:9 widescreen (1920x1080), full PNG

The scene: Outside a building at night, arrest environment
- NO CHARACTER in the center - leave space for avatar to be composited
- Two police officers on either side, reaching toward center (hands will overlap avatar)
- Blue and red police lights reflecting on wet ground
- Cop car visible in background
- Dramatic nighttime lighting

IMPORTANT: The CENTER of the image (approximately 760,240 to 1160,840) must be
relatively clear for avatar placement. Police can frame this area but not occupy it.

Style: 90s CGI aesthetic, dramatic police lighting. Country-neutral uniforms.`,
        foreground_prompt: `Create a FOREGROUND OVERLAY for avatar compositing: ARREST HANDS.

Format: 16:9 widescreen (1920x1080), PNG with transparency

Elements to include:
- Two pairs of police hands/arms reaching in from sides
- Hands positioned to look like they're grabbing/holding someone
- Everything else TRANSPARENT

The hands should be positioned to frame a character at approximately 760,240 (width 400, height 600).
Style: 90s CGI aesthetic. Country-neutral.`,
        avatar_slot: { x: 760, y: 240, width: 400, height: 600 }
    },
    {
        key: 'court',
        name: 'Court Appearance',
        background_prompt: `Create a BACKGROUND ONLY scene for avatar compositing: COURTROOM.

Format: 16:9 widescreen (1920x1080), full PNG

The scene: Formal courtroom interior
- NO DEFENDANT - leave defendant's table area clear for avatar
- Judge's bench elevated in background (judge silhouette or back of head)
- Wooden courtroom furniture, rich wood paneling
- Scales of justice visible
- Prosecutor's table on right (with figure)
- Gallery seats in background

Leave area around (500, 350) clear with approximately 350x450 pixel space for avatar.

Style: 90s CGI aesthetic. Serious, imposing atmosphere. Country-neutral courtroom.`,
        foreground_prompt: null,
        avatar_slot: { x: 500, y: 350, width: 350, height: 450 }
    },
    {
        key: 'prison',
        name: 'Prison Cell',
        background_prompt: `Create a BACKGROUND ONLY scene for avatar compositing: PRISON CELL.

Format: 16:9 widescreen (1920x1080), full PNG

The scene: Prison cell interior from INSIDE looking at the bars
- NO PRISONER - leave bunk area clear for avatar
- Basic prison bunk bed on one side
- Concrete/brick walls
- Small sink, toilet
- Harsh institutional lighting
- Window with bars letting in dim light

Leave center area around (760, 300) clear with 400x550 pixel space for seated avatar on bunk.

Style: 90s CGI aesthetic. Cold, oppressive atmosphere. Country-neutral.`,
        foreground_prompt: `Create a FOREGROUND OVERLAY for avatar compositing: PRISON BARS.

Format: 16:9 widescreen (1920x1080), PNG with transparency

Elements to include:
- Vertical prison bars across the frame
- Bars should have some depth/shadow
- Everything else TRANSPARENT

The bars should create a "looking through bars at prisoner" effect.
Leave enough visibility in center for avatar to be seen clearly.

Style: 90s CGI aesthetic. Dark metal bars.`,
        avatar_slot: { x: 760, y: 300, width: 400, height: 550 }
    },
    {
        key: 'hero_out',
        name: 'Hero Celebration',
        background_prompt: `Create a BACKGROUND ONLY scene for avatar compositing: VICTORY CELEBRATION.

Format: 16:9 widescreen (1920x1080), full PNG

The scene: Luxury celebration environment
- NO MAIN CHARACTER - leave center clear for avatar
- Yacht deck OR mansion terrace OR tropical beach
- Champagne bottles, glasses on surfaces
- Other celebrating people in background (blurred/distant)
- Sunny, bright, golden lighting
- Aspirational luxury setting

Leave center area around (760, 240) clear with 400x600 pixel space for standing avatar.

Style: 90s CGI aesthetic. Bright, warm, celebratory. "You made it" feeling.`,
        foreground_prompt: `Create a FOREGROUND OVERLAY for avatar compositing: CONFETTI.

Format: 16:9 widescreen (1920x1080), PNG with transparency

Elements to include:
- Colorful confetti and streamers falling
- Some confetti pieces larger in foreground (depth effect)
- Everything else TRANSPARENT

Confetti should be scattered across frame, especially top and sides.
Don't obscure center too much - avatar should be clearly visible.

Style: 90s CGI aesthetic. Festive, celebratory.`,
        avatar_slot: { x: 760, y: 240, width: 400, height: 600 }
    },
    {
        key: 'bank_interior',
        name: 'Bank Interior',
        background_prompt: `Create a BACKGROUND ONLY scene for avatar compositing: BANK LOBBY.

Format: 16:9 widescreen (1920x1080), full PNG

The scene: Grand bank interior
- NO CUSTOMER at counter - leave space for avatar
- Marble floors and columns, high ceilings
- Teller windows with brass fixtures
- Massive vault door visible in background
- Bank teller behind counter (right side)
- Rich, wealthy institutional atmosphere

Leave area around (900, 280) clear with 380x560 pixel space for avatar at counter.

Style: 90s CGI aesthetic. Rich marble and brass. Trustworthy, wealthy.`,
        foreground_prompt: null,
        avatar_slot: { x: 900, y: 280, width: 380, height: 560 }
    },
    {
        key: 'temple_interior',
        name: 'Temple Interior',
        background_prompt: `Create a BACKGROUND ONLY scene for avatar compositing: TEMPLE INTERIOR.

Format: 16:9 widescreen (1920x1080), full PNG

The scene: Peaceful temple interior
- NO WORSHIPPER - leave prayer area clear for avatar
- Ornate but serene space
- Soft light from windows or candles
- Altar or shrine area in background
- Incense smoke wisps
- Wooden beams, decorative elements

Leave center area around (760, 330) clear with 400x500 pixel space for kneeling/praying avatar.

Style: 90s CGI aesthetic. Warm, spiritual lighting. Religion-neutral.`,
        foreground_prompt: null,
        avatar_slot: { x: 760, y: 330, width: 400, height: 500 }
    },
    {
        key: 'offshore',
        name: 'Offshore Paradise',
        background_prompt: `Create a BACKGROUND ONLY scene for avatar compositing: OFFSHORE PARADISE.

Format: 16:9 widescreen (1920x1080), full PNG

The scene: Tropical tax haven
- NO PERSON on beach - leave lounging area clear
- Palm trees, crystal blue water, white sand
- Small elegant bank building among palms
- Beach chair or lounger (avatar will be placed on/near it)
- Briefcase with money hints nearby
- Paradise meets finance

Leave center area around (710, 340) clear with 500x400 pixel space for relaxing avatar.

Style: 90s CGI aesthetic. Bright tropical. Secretive luxury.`,
        foreground_prompt: null,
        avatar_slot: { x: 710, y: 340, width: 500, height: 400 }
    },
    {
        key: 'dirty_trick',
        name: 'Dirty Trick Attack',
        background_prompt: `Create a BACKGROUND ONLY scene for avatar compositing: SABOTAGE.

Format: 16:9 widescreen (1920x1080), full PNG

The scene: Nighttime sabotage environment
- NO SABOTEUR - leave sneaking area clear
- Building exterior at night (target of sabotage)
- Spray paint can, lighter, or tools visible on ground
- Moonlight, streetlamp creating dramatic shadows
- Corporate building in background
- Suspenseful atmosphere

Leave center area around (760, 280) clear with 400x560 pixel space for sneaking avatar.

Style: 90s CGI aesthetic. Dramatic noir lighting. Suspenseful.`,
        foreground_prompt: `Create a FOREGROUND OVERLAY for avatar compositing: SHADOWS.

Format: 16:9 widescreen (1920x1080), PNG with transparency

Elements to include:
- Dramatic shadow patterns from unseen objects
- Noir-style diagonal shadow lines
- Subtle fog/mist at bottom
- Everything else TRANSPARENT

Creates depth and suspense. Don't obscure center heavily.

Style: 90s CGI aesthetic. Film noir shadows.`,
        avatar_slot: { x: 760, y: 280, width: 400, height: 560 }
    }
];
```

### Generation Script

```javascript
#!/usr/bin/env node

const WORKER_URL = 'https://your-worker.dev';
const AUTH_TOKEN = 'your-admin-token';

// sceneTemplates array defined above...

async function generateAsset(category, assetKey, prompt, variant) {
    const response = await fetch(`${WORKER_URL}/api/admin/assets/generate`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ category, asset_key: assetKey, prompt, variant })
    });
    return response.json();
}

async function registerSceneTemplate(scene) {
    const response = await fetch(`${WORKER_URL}/api/admin/assets/scenes/templates/${scene.key}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: scene.name,
            description: `${scene.name} scene template`,
            background_r2_key: `scenes/templates/${scene.key}_bg.png`,
            foreground_r2_key: scene.foreground_prompt ? `scenes/templates/${scene.key}_fg.png` : null,
            avatar_slot: scene.avatar_slot,
            width: 1920,
            height: 1080
        })
    });
    return response.json();
}

async function main() {
    console.log('Generating scene templates...\n');

    for (const scene of sceneTemplates) {
        console.log(`\n=== ${scene.name} ===`);

        // Generate background
        console.log('  Background...');
        const bgResult = await generateAsset('scene_background', `${scene.key}_bg`, scene.background_prompt, 1);
        console.log(`    ${bgResult.success ? '✓' : '✗'} ${bgResult.url || bgResult.error}`);
        await new Promise(r => setTimeout(r, 3000));

        // Generate foreground if needed
        if (scene.foreground_prompt) {
            console.log('  Foreground...');
            const fgResult = await generateAsset('scene_foreground', `${scene.key}_fg`, scene.foreground_prompt, 1);
            console.log(`    ${fgResult.success ? '✓' : '✗'} ${fgResult.url || fgResult.error}`);
            await new Promise(r => setTimeout(r, 3000));
        }

        // Register scene template in database
        console.log('  Registering template...');
        const regResult = await registerSceneTemplate(scene);
        console.log(`    ${regResult.success ? '✓' : '✗'} ${regResult.message || regResult.error}`);

        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n✓ Scene template generation complete!');
    console.log('Next steps:');
    console.log('1. Review backgrounds and foregrounds in admin panel');
    console.log('2. Adjust avatar_slot positions if needed');
    console.log('3. Test compositing with sample avatars');
}

main().catch(console.error);
```

---

## Review Criteria

For each scene template:
1. **Avatar Space:** Center area clear for avatar compositing
2. **Style Consistency:** 90s CGI aesthetic with modern render quality
3. **Atmosphere:** Matches the emotional tone (triumphant, tense, peaceful, etc.)
4. **Country-Neutral:** No specific national elements
5. **Aspect Ratio:** Proper 16:9 widescreen (1920x1080)
6. **Layer Quality:** Clean edges, proper transparency (for foregrounds)
7. **Compositing Test:** Avatar fits naturally in the scene

---

## Acceptance Checklist

### Backgrounds (8 total)
- [ ] arrest_bg.png - Police scene without center character
- [ ] court_bg.png - Courtroom without defendant
- [ ] prison_bg.png - Cell without prisoner
- [ ] hero_out_bg.png - Celebration without main character
- [ ] bank_interior_bg.png - Bank lobby without customer
- [ ] temple_interior_bg.png - Temple without worshipper
- [ ] offshore_bg.png - Beach without person
- [ ] dirty_trick_bg.png - Sabotage scene without saboteur

### Foregrounds (4 total)
- [ ] arrest_fg.png - Police hands reaching in (transparent)
- [ ] prison_fg.png - Prison bars overlay (transparent)
- [ ] hero_out_fg.png - Confetti/streamers (transparent)
- [ ] dirty_trick_fg.png - Shadows/fog (transparent)

### Database
- [ ] All 8 scene_templates records created
- [ ] Avatar slot positions tested and adjusted
- [ ] Background/foreground R2 keys correct

### Compositing Tests
- [ ] Test avatar composite in arrest scene
- [ ] Test avatar composite in prison scene (bars in front)
- [ ] Test avatar composite in hero_out scene (confetti in front)
- [ ] All scenes render correctly with various avatar configs

---

## Deployment

```bash
# 1. Generate scene templates
node scripts/generate-scene-templates.js

# 2. Review backgrounds and foregrounds in admin panel

# 3. Process foregrounds for proper transparency (Removal.ai if needed)

# 4. Test compositing with sample avatars

# 5. Adjust avatar_slot positions via API if needed:
curl -X PUT "https://worker.dev/api/admin/assets/scenes/templates/prison" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"avatar_slot": {"x": 780, "y": 310, "width": 380, "height": 540}}'

# 6. Verify scenes work in game UI
```

---

## Client-Side Compositing

The frontend composes scenes using HTML5 Canvas:

```typescript
// src/utils/sceneComposer.ts
export async function composeScene(
    sceneTemplate: SceneTemplate,
    avatarUrl: string
): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = sceneTemplate.width;
    canvas.height = sceneTemplate.height;
    const ctx = canvas.getContext('2d')!;

    // 1. Draw background
    const bgImg = await loadImage(sceneTemplate.background_url);
    ctx.drawImage(bgImg, 0, 0);

    // 2. Draw avatar in slot
    const avatarImg = await loadImage(avatarUrl);
    const slot = sceneTemplate.avatar_slot;
    ctx.drawImage(avatarImg, slot.x, slot.y, slot.width, slot.height);

    // 3. Draw foreground (if exists)
    if (sceneTemplate.foreground_url) {
        const fgImg = await loadImage(sceneTemplate.foreground_url);
        ctx.drawImage(fgImg, 0, 0);
    }

    return canvas.toDataURL('image/png');
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}
```

---

## Handoff Notes

**For Stage 06:**
- All assets now generated:
  - Building reference sheets
  - Building sprites (transparent)
  - Dirty trick overlays (transparent)
  - Scene templates (backgrounds + foregrounds)
- Admin page needs scene template management
- Preview functionality for testing avatar compositing

**For Avatar System:**
- Avatar composites are cached when user saves
- Scene compositing API returns layer info or cached URL
- Client handles compositing in Canvas

**Scene Usage:**
- Scenes displayed in modals/dialogs for game events
- API: `GET /api/admin/assets/scenes/compose/:sceneId/:companyId`
- Cache composed scenes via `POST .../cache` endpoint
- Cache auto-invalidates when avatar changes
