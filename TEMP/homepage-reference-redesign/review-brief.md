# Hami Card homepage — current-build review packet

This packet contains fresh screenshots captured from the current local/test build after applying the Owner's visual-reference and Persian typography requirements. No production environment, real user data, real SMS, or payment service was used. The login-error screenshot uses only synthetic test input.

## Gemini — visual critique

Review the attached screenshots against the Owner-provided Hami Card homepage reference. This is a design critique, not a QA pass/fail request. Assess visual similarity in section order and composition, Persian typography (family feel, weights, sizes, line height, density, hierarchy), desktop/mobile rhythm, hero, search/filter, trust strip, categories, provider cards, how-it-works, footer, and mobile drawer. Identify the highest-impact remaining visual gaps with concrete, screenshot-grounded recommendations. Do not invent verified provider, discount, price, rating, or trust claims.

## Qwen — frontend/accessibility review

Review the current shared homepage/auth implementation and the attached screenshots. Focus on whether the shared design-system approach is maintainable, responsive layout and horizontal mobile provider scrolling, RTL/keyboard behavior, semantic controls, accessible autocomplete/drawer interactions, typography inheritance, and whether the changes introduce layout or accessibility regressions. Return findings only; do not instruct execution, deployment, merge, schema/migration, or production actions.

## Current local evidence

- Desktop homepage: `after-desktop-1440x900.png`
- Mobile homepage: `after-mobile-390x844.png`
- Mobile provider carousel: `providers-mobile-390x844.png`
- Mobile drawer: `mobile-drawer-390x844.png`
- How-it-works section: `how-it-works-section.png`
- Footer section: `footer-section.png`
- Synthetic login error: `login-error-390x844.png`
- Interaction harness: 83/83 PASS, zero unexpected app console/runtime errors.
- Local preview: `http://localhost:3130/`

Please treat all review recommendations as advisory for the Project Owner/Codex to evaluate; do not treat them as authorization to perform external or production actions.
