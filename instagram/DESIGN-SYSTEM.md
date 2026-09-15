# zafi Instagram Design System

## Brand

zafi is a personal finance app for Guatemala and Latin America. Positioned as "the financial advisor that 95% of Latin Americans could never afford" — NOT a spending tracker. Tone: approachable, direct, trustworthy; never corporate or bank-like.

### Wordmark

The word "zafi" in Outfit ExtraBold (weight 800), ALWAYS lowercase.
- The letter "i" is always Electric Blue `#2563EB` on light backgrounds, or Pale Blue `#60A5FA` on dark backgrounds.
- Never capitalize. Never change the "i" color outside the blue family.

## Palette

| Token         | Hex       | Usage                              |
|---------------|-----------|-------------------------------------|
| Navy          | `#1E3A5F` | Primary, default background         |
| Navy Deep     | `#142B47` | Gradient depth                      |
| Electric Blue | `#2563EB` | Accent, buttons, emphasis           |
| Pale Blue     | `#60A5FA` | Accent on dark backgrounds          |
| White         | `#FFFFFF` | Text on dark                        |
| Green         | `#10B981` | Health Score only (good)            |
| Amber         | `#F59E0B` | Health Score only (warning)         |
| Red           | `#EF4444` | Health Score only (critical)        |

## Typography (Google Fonts only)

| Face              | Weight    | Usage                             |
|-------------------|-----------|-------------------------------------|
| Outfit            | ExtraBold (800) | Large numbers, figures, wordmark |
| DM Serif Display  | Regular   | Headlines, hook phrases            |
| DM Sans           | 400, 500  | Body, UI, labels                   |

## Visual Rules

- Dark navy aesthetic: solid navy background or subtle gradient toward `#142B47`. No noisy textures.
- Generous whitespace. One message per slide. Clear hierarchy: big hook up top, supporting text below.
- Currency in quetzales: `Q1,250`. Never use `$`.
- No stock photos, no generic people, no money/piggy-bank icons. Use phone mockups with real app screens or typographic compositions.
- Default format: 1080 x 1350 px (4:5 vertical feed). Carousels use the same format per slide.
- Every post: wordmark "zafi" small in bottom-left corner, "@usezafi" in bottom-right. DM Sans, white at 60% opacity.
- Safe zone: 80 px margin on all sides. No text touching edges.
- All text in Guatemalan Spanish, tuteo, minimal anglicisms.

## CSS Tokens (container-query-relative)

```css
/* At 1080px canvas width */
--safe-zone-x: 7.41%;   /* 80 / 1080 */
--safe-zone-y: 5.93%;   /* 80 / 1350 */
--wordmark-size: 2.6cqw; /* ~28px at 1080 */
--handle-size: 1.5cqw;   /* ~16px at 1080 */
```

## Template

Base template: `zafi-base-template.html`
