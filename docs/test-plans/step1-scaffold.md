# Manual test plan: Step 1 – scaffold, offline shell, storage

Device: iPad [model], iPadOS [version], Safari, installed to home screen: yes/no
Build/commit: 
Tester / date: 

## Preconditions
- App deployed to the POC link (HTTPS).
- Website data for the link cleared in Settings > Safari > Advanced > Website Data.

## Steps and expected results
| # | Step | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 1 | Open the link in Safari | App loads; nav shows Inspections and Settings only | | |
| 2 | Share > Add to Home Screen | Correct name and icon on the home screen | | |
| 3 | Open from the home screen | Opens full screen (no Safari bars); red/cream theme; Figtree font | | |
| 4 | Inspections screen | "No inspections yet" and the version/commit are shown | | |
| 5 | Settings screen | Storage used/quota shown; persistent storage status shown; "Back up now" visible (disabled) | | |
| 6 | Close the app fully, reopen | Persistent status and storage figures still shown (not reset) | | |
| 7 | Check the snippet count (Settings, or ask Claude Code where it's shown) | 8 starter snippets: 4 body, 2 condition, 2 heading (matches snippets.md) | | |

## Offline check
Airplane mode on, then force-quit and reopen from the home screen: app loads, the offline indicator shows, and both screens work. Turn airplane mode off: the indicator returns to online.

## Issues found
-
