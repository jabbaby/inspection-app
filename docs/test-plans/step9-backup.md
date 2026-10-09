# Manual test plan: Step 9 – Inspection file and backups

Device: iPad [model], iPadOS [version]; and a desktop browser
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file).

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it).
- Use an inspection with drawings, pins (one with a copy and an arrow), photos (some taken with the camera), a memo with a signature.

## Back up one inspection
1. **Backup card.** Pre-inspection shows a **Backup** card: "Not backed up yet".
2. **Originals switch.** With camera photos, the card offers **Include full-size camera photos** with the extra size. Leave it off.
3. **Back up now.** Tap it: the file name (`job_item_date.inspection`) and size appear. Tap **Share…**, choose **Save to Files** and save it in iCloud Drive (or On My iPad).
4. **Status.** The card now says "Backed up" with the time. Add a pin, come back: "Changed since last backup".
5. **Dashboard.** An inspection that's not backed up (or changed since) shows in Needs attention as "Not backed up" / "Changed since last backup"; tapping it opens its Pre-inspection.

## Import
6. **File picker.** Inspections page, **Import inspection…**: Files opens and the `.inspection` file can be chosen (not greyed out). If it is greyed out, tell me (we'd switch to .zip).
7. **Already here.** Choose the file you just saved: a summary shows (project "already here", drawings, pins, photos, memo) with "This inspection is already on this device", and **Cancel / Keep both / Replace**.
8. **Keep both.** Tap **Keep both**: a second copy opens on Pre-inspection. Check its drawings, pins (with the copy and arrow), photos, memo and signature all came across. Delete this copy afterwards (swipe left on the Inspections list).
9. **Replace.** Change something on the original (e.g. a pin's text), then import the file again and tap **Replace**: the change is gone (the file's copy is back).
10. **Fresh device.** Delete the inspection, then import the file: **Import** brings it all back, already marked "Backed up".
11. **SIM numbers.** After importing, create a memo for a new inspection in the same job: it gets the next SIM number (not one already used).
12. **Wrong file.** Choose a photo or PDF instead: "This isn't an inspection file."

## Back up all
13. **Settings.** Settings › Storage and backup: **Back up all (N inspections)** prepares one file per inspection, then **Share N files…**: Save to Files into a folder. Every inspection then counts as backed up.

## Desktop
14. **Move to desktop.** Open the app on a desktop browser (https://nhardhat.github.io/inspection-app/), **Import inspection…** the file from iCloud Drive: it opens with drawings, pins and the memo. **Export PDF** works there too.
15. **Back to the iPad.** On the desktop, edit something, **Back up now** (it downloads), get the file to the iPad (iCloud Drive) and import it with **Replace**.

## Offline
16. With Airplane mode on, Back up now and Import still work.
