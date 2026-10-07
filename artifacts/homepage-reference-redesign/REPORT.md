# Hami homepage reference redesign — verification report

## Status

LOCAL/TEST implementation is updated. Production, merge, production data, real payment, and real SMS were not used. The implementation and refreshed screenshots are on the task branch only. Owner visual acceptance remains outstanding. The owner’s typography addendum has been applied by using the local Vazirmatn variable font as the shared Persian UI family across the homepage and authentication screens. The preview currently runs at `http://localhost:3127/`.

## Changes applied after independent review

- Fixed the mobile drawer focus trap to include enabled links, buttons, inputs, selects, textareas, and explicit tab stops; removed duplicate naming from the search input while preserving its associated visible-to-assistive label.
- Improved provider metadata text contrast and replaced the provider card's `direction:ltr` layout workaround with explicit RTL grid areas while preserving image-left/text-right presentation.
- Increased mobile search tab hit areas to 44px and changed mobile categories to the reference's three-column, icon-above-label composition.
- Matched the reference's floating search panel, card badge placement, and header CTA spacing/radius more closely. The provider badge remains the factual, neutral `نمونه نمایشی`; it does not claim a contract, active intake, or a discount.
- Replaced the unsupported heading claim “popular contracted providers” with the neutral “doctors and centers”; added functional, accessible previous/next sample-provider controls matching the reference's carousel affordances.
- Bundled Vazirmatn variable WOFF2 with its OFL 1.1 license and applied it to the global page text, controls and shared authentication shell; fixed the prior global Tahoma override that made only the homepage/auth shell use Vazirmatn while generic page text fell back to Tahoma.
- Rebuilt the local preview after detecting a stale Next.js process on port 3012 returning unstyled markup. The healthy preview is now served on port 3127 and its HTML/CSS assets respond successfully.

## Verification evidence

- `npm run lint --workspace @hamayat/web` — PASS.
- `npm run test --workspace @hamayat/web` — PASS, 69/69.
- `npm run typecheck --workspace @hamayat/web` — PASS.
- `npm run build --workspace @hamayat/web` — PASS. Next.js emitted its existing warning that the Next ESLint plugin is not detected; compilation and build completed.
- Browser interaction harness — **83/83 PASS**, zero application console/runtime errors. It validates navigation/footer links, search tabs, default and typed autocomplete, keyboard selection, filters, search loading/results/no-results, category actions, provider links and carousel paging, mobile horizontal swipe-row behavior, login error state, 390px overflow, and mobile drawer focus/keyboard/close behavior. The test harness deliberately lengthens the 650ms demo search timer during capture so the loading state is observable; production behavior remains unchanged.
- `git diff --check` — PASS.
- Secret-pattern scan of changed text/source artifacts — no high-confidence credential/private-key/database URL matches.
- Fresh viewport captures: desktop 1440×900, mobile 390×844, mobile horizontal provider cards, drawer, search states, how-it-works, footer, and login-error states. Files are alongside this report; captures were refreshed in the latest completed harness run.
- Browser visual check after rebuilding: at 390×844 the viewport and document widths both measured 390px; computed body/home font was `Vazirmatn, Tahoma, sans-serif`, variable font was loaded, and the heading measured 23.2px/29.696px. At desktop, the screenshot confirmed the same Vazirmatn family and visual hierarchy. Mobile login error was rendered with local-only synthetic test values and the expected Persian authentication error; no external service or real account was used.
- Local preview: `http://localhost:3130/` (local only). Ports 3012 and 3127 were bound by stale/unresponsive browser processes; the verified preview is served on 3130.

## TYPOGRAPHY MATCH REVIEW

- Desktop typography: PASS — Vazirmatn variable font loaded; heading hierarchy and dark/teal weight contrast visibly align with the reference’s Persian UI feel.
- Mobile typography: PASS — same font family at 390×844 with no horizontal overflow; heading is 23.2px with 29.696px line-height.
- Buttons: PASS — shared font inheritance applied; orange primary CTA and teal secondary action were visually checked on desktop/mobile.
- Search/filter controls: PASS — tabs, fields, selectors, and orange submit CTA inherit the same family; mobile labels remain legible in the 390px capture.
- Cards: PASS — category and provider card titles/subtitles use shared family; desktop view checked.
- Footer: PASS — current viewport screenshot and DOM computed styles confirm Vazirmatn in headings, links, and supporting copy; observed headings at 12.32px/weight 900 and links at 11.04px/weight 400 in the compact footer design.
- Login error state: PASS — mobile error view captured at 390×844; text and inputs use shared shell typography, with an assertive inline error.
- Source font/licensing: Vazirmatn is used under OFL 1.1; source and license: https://github.com/rastikerdar/vazirmatn.

## Review results

- Qwen's full frontend/accessibility review identified focus-trap coverage, contrast, RTL card ordering, duplicate search naming, mobile tap-target/category density, and auth-gated route clarity. The direct code issues were corrected; the auth-gated links still redirect to login and were not bypassed. Qwen noted its screenshot-image download was unavailable, so its visual assessment was limited to source/checklist evidence.
- Gemini's prior screenshot-based reviews returned **NEAR-IDENTICAL** on an earlier capture set and identified P3 polish subsequently applied. Those verdicts predate the strict typography addendum and the latest horizontal mobile carousel/how-it-works changes; a refreshed Gemini critique of the current screenshots is still required before visual closure. Qwen's earlier source/accessibility findings were applied; a refreshed review of this exact current build is also pending. Owner visual acceptance remains outstanding.

## DEVIATIONS_FROM_REFERENCE

1. **Hero image/background:** the reference's photographic treatment and exact card/MRI composition are represented with a local illustrative demo card, not a recovered standalone background photo. The supplied reference is a flattened composite and no separate verified hero photograph was provided.
2. **Provider identities and financial claims:** actual names/contract status, discount percentages, prices/savings, ratings/stars, and provider counts are not presented as real. Provider content is visibly labeled as demo; discount and rating fields say that verified information is unavailable. This intentionally differs from the reference's promotional numbers to avoid fabricating medical/financial claims.
3. **Trust and accreditation content:** exact network counts, insurance-like claims, accreditation marks, company registration details, and contact details visible in the reference were not reproduced without verified source data; neutral benefit copy is used instead.
4. **Mobile device frame:** the reference is a composite with a phone mockup. The deliverable is the responsive webpage at 390×844, not an additional decorative phone frame around the app.
5. **Authenticated destinations:** `/providers`, `/plans`, and `/support` are gated by the existing application and redirect to login. The public home page does not bypass authentication or invent alternate authenticated data.
6. **Visual approximation still needs sign-off:** while the section order, RTL composition, search, cards, categories, and CTA/footer structure follow the reference, remaining illustration, verified-data, typography, and exact spacing differences mean the build must not be described as pixel-identical. The latest screenshots require Commander/Owner visual review.
7. **Provider-card content:** card composition and mobile horizontal scrolling now follow the reference more closely, but real provider identities, contractual status, prices, ratings, discount percentages, and network counts remain omitted because no verified source data was supplied. Neutral demo labels preserve truthfulness.
8. **Mobile presentation details:** app is shown directly at 390×844 rather than inside the reference's decorative phone frame; micro-spacing, some section heights, and the illustrated card artwork are not pixel-identical and require Owner visual sign-off.
9. **Provider carousel controls:** horizontal swipe/scroll is supported on mobile and previous/next buttons remain accessible. The reference's exact arrow placement and scroll animation are approximated rather than pixel-identically reproduced.
