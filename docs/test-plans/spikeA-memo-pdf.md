# Manual test plan: Spike A – memo PDF export

Device: iPad [model], iPadOS [version], Safari, installed to home screen: yes/no
Build/commit: 
Tester / date: 

## Preconditions
- Latest build deployed to the POC link; open the installed home-screen app.
- If the app shows "A new version is available", tap **Update now** first.
- Reference to compare against: `docs/reference/Northrop_sample_report.pdf` (Word's export of the sample memo).

## Steps and expected results
| # | Step | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 1 | Settings > Sample memo (Spike A) > **Generate sample memo** | Within a few seconds: Share PDF and Download PDF appear, with the filename `SY000001_SIM-001_Level-3-slab-reinforcement.pdf`, size and time | | Note the time shown |
| 2 | Tap **Share PDF** | iOS share sheet opens with the PDF | | |
| 3 | Share > Save to Files, then open it from the Files app | Opens as a one-page A4 PDF | | |
| 4 | Compare with the reference PDF | Red sidebar with rounded right corners, cream NORTHROP wordmark, "SITE INSTRUCTION MEMO", office block, cream table headings, checkboxes, footer N icon and strapline, page number 1 | | |
| 5 | Zoom in on the body text | Figtree font, sharp (not blurry); disclaimer is small grey italic with the first sentence bold | | |
| 6 | Check the header | "SIM-001 – Level 3 slab reinforcement" sits under Job name in the same bold style | | |
| 7 | Long-press to select text in the PDF | Text is selectable (real text, not an image) | | |
| 8 | Share > Mail (draft only, don't send) | PDF attaches with the filename above | | |
| 9 | Back in the app, tap **Download PDF** | Safari shows the PDF or offers to download/open it (record what happens) | | Fallback path |

## Offline check
Airplane mode on, force-quit and reopen from the home screen. Settings > Generate sample memo: the PDF is generated and Share PDF works (Save to Files). Turn airplane mode off.

## Issues found
-
