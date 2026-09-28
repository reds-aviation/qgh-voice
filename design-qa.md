# ATC Training Suite landing design QA

- Source visual truth: `C:/Users/pc/.codex/generated_images/01a0dd77-8c3a-76a0-89fc-47a34a499b54/exec-c2e89bbf-1bf7-4598-8777-b6ffe4de76b4.png` (selected first/light mockup, 1486 × 1059 px).
- Implementation: GitHub Pages build at `http://127.0.0.1:8767/` from `apps/web/dist/index.html`.
- Browser-rendered screenshot evidence: Codex browser captures of tab 23 at 1486 × 1059 CSS px, plus combined comparison captures of tabs 24 and 25. The browser tool provides these captures inline rather than as persistent screenshot files. Local side-by-side fixtures: `apps/web/dist/landing-qa-compare.html` (full view) and `apps/web/dist/landing-qa-cards.html` (QGH card at 1:1), both using `apps/web/dist/landing-qa-reference.png` as the source image. These three fixture files are ignored build artifacts and are not deployed.
- Viewport and normalization: source 1486 × 1059 px; implementation 1486 × 1059 CSS px at device pixel ratio 1. No density scaling for the original full-view review. The full side-by-side view scales both to 743 × 530, and the focused QGH card view shows both at 1:1.
- State: desktop suite landing with no hover, dialog, or exercise in progress. A separate 390 × 844 CSS px mobile capture checked responsive layout.

## Findings and comparison history

1. Initial mobile capture exposed joined words where desktop line breaks were hidden (`decisionsthat`, `practice,plus`). Added spaces before the breaks, rebuilt, and captured the 390 px page again. The heading and subtitle now wrap as readable words; no horizontal overflow remains.
2. Navigation review found that the installed app could bypass the new suite landing and first-time visitors would not register its offline shell. The Pages-only manifest now names ATC Training Suite and starts at `index.html`. A small landing registration script registers the existing service worker without starting the QGH pilot voice download. The rebuilt root shows the manifest and script, and the browser console has no errors.
3. Focused full-view and QGH-card comparisons show matching hierarchy, card placement, type scale, two QGH branches, beta badges, and pale airspace art. The generated airspace art omits the mockup's tiny aircraft data labels; this is acceptable P3 decoration, not an exercise readout.

## Required fidelity surfaces

- Typography: bundled Plex Sans and Plex Mono closely reproduce the selected hierarchy and labels. No clipped desktop text; mobile headings wrap cleanly.
- Spacing/layout: header, hero, section transition, cards, and footer match the reference proportions at 1486 × 1059. The two QGH links remain separately clickable; the cards stack at mobile width.
- Colors/tokens: warm white, navy, steel blue, teal, and restrained saffron/green accents match the selected light direction.
- Images: original generated hero, QGH towers, procedural radar, and two icons are sharp and contain no baked-in text or official insignia. All image requests completed in the browser.
- Copy/content: suite title, training link, creator details, QGH branches, beta labels, and procedural areas match the approved flow. No Reds identity appears on the new landing.

## Primary interactions checked

- QGH Individual opens the existing Single/Tactical selector; its Suite Home link returns to the landing.
- QGH Instructor-led opens the instructor/controller selector and its Suite Home link returns.
- Procedural opens the procedural training entry.
- Browser console showed no errors on these pages.
- Existing QGH, instructor-led, and procedural automated checks passed: 508 + 172 + 1.

final result: passed
