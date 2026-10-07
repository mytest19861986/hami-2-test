# Hami homepage reference redesign — verification report

## Status

LOCAL/TEST implementation is updated. Production, merge, production data, real payment, and real SMS were not used. The implementation and refreshed screenshots are on the task branch only. Owner visual acceptance remains outstanding. The owner’s typography addendum has been applied by using the local Vazirmatn variable font as the shared Persian UI family across the homepage and authentication screens, with a mobile typography refinement for card, benefit, process, and footer text. The verified local preview currently runs at `http://localhost:3000/`.

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
- After the typography refinement, `npm run lint --workspace @hamayat/web`, `npm run typecheck --workspace @hamayat/web`, `npm run test --workspace @hamayat/web` (69/69), and `npm run build --workspace @hamayat/web` all passed. Build retains the existing Next ESLint plugin configuration warning.
- `git diff --check` — PASS.
- Secret-pattern scan of changed text/source artifacts — no high-confidence credential/private-key/database URL matches.
- Fresh viewport captures: desktop 1440×900, mobile 390×844, mobile horizontal provider cards, drawer, search states, how-it-works, footer, and login-error states. Files are alongside this report; captures were refreshed after the typography refinement and 83/83 harness pass.
- Browser visual check after rebuilding: at 390×844 the viewport and document widths both measured 390px; computed body/home font was `Vazirmatn, Tahoma, sans-serif`, variable font was loaded, and the refreshed homepage heading is about 24.6px/31.9px. At desktop, the screenshot confirmed the same Vazirmatn family and visual hierarchy. Mobile login error was rendered with local-only synthetic test values and the expected Persian authentication error; no external service or real account was used.
- Local preview: `http://localhost:3000/` (local only; verified HTTP response from the current build).

## TYPOGRAPHY MATCH REVIEW

- Desktop typography: PASS — Vazirmatn variable font loaded; homepage H1 is 37.6px/900 at 1440px with 1.3 line-height, matching the reference’s bold Persian headline hierarchy. Body, menu, and card labels use the same family with restrained weights.
- Mobile typography: PASS — same font family at 390×844 with no horizontal overflow; homepage H1 scales to about 24.6px/900. Benefit/category/provider/process/footer microcopy was increased for legibility while preserving the compact reference hierarchy.
- Buttons: PASS — shared font inheritance; 800-weight homepage CTA labels (12.6px desktop, 10.9px mobile primary CTA) retain the reference’s strong compact treatment.
- Search/filter controls: PASS — tabs, fields, selectors, and orange submit CTA use Vazirmatn; mobile tab labels are 10.4px and input text is 12.2px.
- Cards: PASS — category/provider titles remain bold (mobile provider title 13.1px/900) with distinct, lighter supporting text (about 10px); desktop and mobile screenshots checked.
- Footer: PASS — Vazirmatn remains consistent; compact mobile headings and links are 11.7px/10.6px after refinement, with small-print footer text at 9.6px.
- Login error state: PASS — mobile error view captured at 390×844; text and inputs use shared shell typography, with an assertive inline error.
- Source font/licensing: Vazirmatn is used under OFL 1.1; source and license: https://github.com/rastikerdar/vazirmatn.

## Review results

- Qwen's frontend/accessibility review identified focus-trap coverage, contrast, RTL card ordering, duplicate search naming, mobile tap-target/category density, and auth-gated route clarity. Direct code issues were corrected; authenticated links still redirect to login and were not bypassed. On the refreshed review, Qwen explicitly reported it could not access/render the supplied public screenshot URLs; therefore it did not provide screenshot-grounded visual critique.
- Gemini's earlier screenshot-based reviews returned **NEAR-IDENTICAL** on a previous capture set, before this typography addendum. The refreshed request included reference and current-build raw screenshot URLs, but Gemini explicitly reported it could not render/fetch those images in that call. Its resulting speculative typography/layout observations are not accepted as verified findings. Both reviewers' image-access limitation means the mandatory current-image Gemini critique and refreshed Qwen visual/accessibility verification remain outstanding; Owner visual acceptance remains outstanding.

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
