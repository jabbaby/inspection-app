# Decision log

Format: `YYYY-MM-DD | decision | why | changed in SPEC section`

2026-10-01 | iPad-first PWA, offline capable | patchy site internet, no App Store process for POC | 3, 10, 11
2026-10-01 | Local-only storage, inspection file moves data between iPad and desktop | simplest POC, sync later | 9
2026-10-01 | Lettered items can be instruction or observation | engineer's workflow | 5
2026-10-01 | Drawings keep native size in the PDF pack | legibility, fidelity | 7
2026-10-01 | Northrop branding hard-coded in one module | POC only | 4a
2026-10-01 | Memo ref auto-numbered per job (SIM-001) and shown with item inspected | engineer request | 7a
2026-10-01 | Re-inspections out of scope for POC | keep slice 1 tight | 15
2026-10-01 | Calculators are a separate app area, never part of memo or PDF pack | engineer request | 3, 8, 12
2026-10-01 | Observations move off the memo into a draggable text box on each drawing page (hidden if none); new ObservationBox record | keep observations from being read as conditions | 5, 7, 8, 15
2026-10-01 | Snippet gets a 'heading' kind; observations box heading defaults to "Noted for information:" | heading must stay user-editable | 8
2026-10-01 | Four starter body messages (generally in accordance except items; in accordance; not in accordance + re-inspection; not in accordance + photo confirmation), engineer picks one | engineer request | 4
2026-10-01 | Conditions lead-in is one line "Ok to proceed subject to the following:" for any body message; "Ok to proceed." alone when no instruction items | match sample memo | 4
2026-10-01 | CLAUDE.md memo-content rule updated to match the observations change (edited by Cowork; review) | keep CLAUDE.md consistent with SPEC | n/a
2026-10-01 | POC hosted on GitHub Pages from David's personal GitHub account; local git with GitHub remote | free HTTPS hosting, no company host yet; site is public but holds no user data | 15
2026-10-01 | Synthetic data only until IT approves hosting; revisit before real project material or wider sharing | public link, personal account | 15
2026-10-01 | Figtree self-hosted under SIL OFL | free licence, works offline | 15
2026-10-01 | Hash routing (/#/settings) instead of path routing | GitHub Pages has no SPA fallback; every route is served by the one precached index.html | n/a
2026-10-01 | Automated offline test runs in Chromium at iPad viewport; other e2e tests in WebKit | Playwright's WebKit cannot reload offline through a service worker; real iPad offline check stays in the manual test plan | n/a
2026-10-01 | Memo reference shown on its own line under Job name, same style as Job name | sample has no reference field; keeps the header block together | 4, 15
2026-10-01 | Memo body text is plain (sample italics were placeholder highlighting); bold/italic only for engineer name and disclaimer | engineer decision | 15
2026-10-01 | Static Figtree TTFs (official repo, OFL) committed for PDF embedding; memo sidebar drawn as vector, wordmark and footer icon embedded as PNG from the sample | pdf-lib needs TTF; vector keeps the sidebar crisp and small | 15
