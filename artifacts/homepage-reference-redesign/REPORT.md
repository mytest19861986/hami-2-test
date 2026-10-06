# Hami homepage reference redesign — verification report

## Status

LOCAL/TEST implementation is updated. Production, merge, production data, real payment, and real SMS were not used. The implementation and refreshed screenshots are on the task branch only. Final Gemini re-review of the latest screenshots and Owner visual acceptance remain pending.

## Changes applied after independent review

- Fixed the mobile drawer focus trap to include enabled links, buttons, inputs, selects, textareas, and explicit tab stops; removed duplicate naming from the search input while preserving its associated visible-to-assistive label.
- Improved provider metadata text contrast and replaced the provider card's `direction:ltr` layout workaround with explicit RTL grid areas while preserving image-left/text-right presentation.
- Increased mobile search tab hit areas to 44px and changed mobile categories to the reference's three-column, icon-above-label composition.
- Matched the reference's floating search panel, card badge placement, and header CTA spacing/radius more closely. The provider badge remains the factual, neutral `نمونه نمایشی`; it does not claim a contract, active intake, or a discount.

## Verification evidence

- `npm run lint --workspace @hamayat/web` — PASS.
- `npm run test --workspace @hamayat/web` — PASS, 68/68.
- `npm run typecheck --workspace @hamayat/web` — PASS.
- `npm run build --workspace @hamayat/web` — PASS. Next.js emitted its existing warning that the Next ESLint plugin is not detected; compilation and build completed.
- Browser interaction harness — PASS, 72/72, no unexpected application console/runtime errors; includes homepage navigation and footer links, all search tabs and states, filters, each category action, provider links, login-error state, 390px overflow, and mobile drawer focus/keyboard/close behavior.
- `git diff --check` — PASS.
- Secret-pattern scan of changed text/source artifacts — no high-confidence credential/private-key/database URL matches.
- Fresh viewport captures: desktop 1440×900, mobile 390×844, drawer and search/login states. Files are alongside this report.
- Local preview: `http://localhost:3012/` (local only).

## Review results

- Qwen's full frontend/accessibility review identified focus-trap coverage, contrast, RTL card ordering, duplicate search naming, mobile tap-target/category density, and auth-gated route clarity. The direct code issues were corrected; the auth-gated links still redirect to login and were not bypassed. Qwen noted its screenshot-image download was unavailable, so its visual assessment was limited to source/checklist evidence.
- Gemini's complete screenshot-based second pass returned **CLOSE BUT NOT NEAR-IDENTICAL**. It called out search-panel overlap/shadow, provider-card badge treatment, header button spacing, mobile category tile proportions, and drawer spacing. The latest build addresses these with a moderated `-42px` desktop overlap (rather than `-48px`, which encroached on the hero CTA), softened shadow, neutral demo badge, wider/rounder header controls, denser vertical mobile category tiles, and increased drawer link padding. A new Gemini review of these refreshed captures is still required before visual sign-off.

## DEVIATIONS_FROM_REFERENCE

1. **Hero image/background:** the reference's photographic treatment and exact card/MRI composition are represented with a local illustrative demo card, not a recovered standalone background photo. The supplied reference is a flattened composite and no separate verified hero photograph was provided.
2. **Provider identities and financial claims:** actual names/contract status, discount percentages, prices/savings, ratings/stars, and provider counts are not presented as real. Provider content is visibly labeled as demo; discount and rating fields say that verified information is unavailable. This intentionally differs from the reference's promotional numbers to avoid fabricating medical/financial claims.
3. **Trust and accreditation content:** exact network counts, insurance-like claims, accreditation marks, company registration details, and contact details visible in the reference were not reproduced without verified source data; neutral benefit copy is used instead.
4. **Mobile device frame:** the reference is a composite with a phone mockup. The deliverable is the responsive webpage at 390×844, not an additional decorative phone frame around the app.
5. **Authenticated destinations:** `/providers`, `/plans`, and `/support` are gated by the existing application and redirect to login. The public home page does not bypass authentication or invent alternate authenticated data.
6. **Visual approximation still needs sign-off:** while the section order, RTL composition, search, cards, categories, and CTA/footer structure follow the reference, remaining illustration, verified-data, typography, and exact spacing differences mean the build must not be described as pixel-identical. The latest screenshots require Commander/Owner visual review.
