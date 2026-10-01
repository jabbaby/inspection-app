# Manual test plan: Step 4 – inspections, job details, My details

Device: iPad [model], iPadOS [version], Safari, installed to home screen: yes/no
Build/commit: 
Tester / date: 

## Preconditions
- Latest build deployed; open the installed home-screen app and tap **Update now** if offered.
- Synthetic details only (e.g. job "SY000001 Example Apartments", client "Example Builders").

## Steps and expected results
| # | Step | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 1 | Settings > My details: enter an inspector name and title, pick a default Sent via | "Saved" appears shortly after typing stops | | |
| 2 | Inspections > **New inspection** | Opens the inspection screen; title "No job number – Untitled job"; date is today; Inspector is your name; notice says job number and job name are needed | | |
| 3 | Fill in every job field using the on-screen keyboard | Keyboard capitalises sensibly (job number in capitals, names in words); no autocorrect surprises; "Saved" shows; title updates | | |
| 4 | Tap the Date field | iPad date picker opens; chosen date is kept | | |
| 5 | Type in a field, then immediately tap **‹ Inspections** | The list shows the change straight away | | |
| 6 | Type in a field, then immediately swipe up to go home (close the app) and reopen | The change is still there | | |
| 7 | Force-quit the app and reopen | All inspections and fields are still there | | |
| 8 | Create a second inspection | List shows both, most recently edited first, with company, date and "Edited …" | | |
| 9 | List: **Delete** on one, then **Cancel** | Nothing is deleted | | |
| 10 | **Delete** again and confirm | It disappears; the other remains | | |
| 11 | Open the remaining inspection > **Delete inspection** > confirm | Returns to the list, which is empty again | | |
| 12 | Rotate the iPad on the inspection screen | Form reflows (one or two columns); nothing lost | | |

## Offline check
Airplane mode on, force-quit and reopen. Create an inspection, fill in a few fields, force-quit, reopen: everything is saved. Turn airplane mode off.

## Issues found
-
