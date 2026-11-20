# Game Day sheet

The Game Day page on bgquick.com is a static page. RSVPs and food sign-ups are saved in a Google Sheet that belongs to you. A short script in that sheet is the only backend. You do not need Cloudflare, a server, or a token.

The page does not show a street address. Before someone RSVPs it says “Location shared after you RSVP”. After they RSVP on their own phone or computer it says “CRPC”.

Anyone with the page can see family names and how many adults and kids are coming. The page has no phone or email fields, and the script rejects those if someone tries to send them.

## 1. Make the spreadsheet

1. Open [Google Sheets](https://sheets.google.com) while you are signed in to the Google account that should own the RSVPs.
2. Create a blank spreadsheet.
3. Name it `BGQuick Game Day`.
4. Leave the grid empty. The script adds two tabs, `RSVPs` and `Food`, the first time someone uses the page. You can ignore or delete the original `Sheet1` tab. Do not rename `RSVPs` or `Food`, and do not edit the header row the script writes.

Keep this spreadsheet private. Do not turn on link sharing. People RSVP through the website, not by opening the spreadsheet.

## 2. Add the script

1. In the spreadsheet, choose **Extensions → Apps Script**.
2. If the editor shows a sample function, select all of that text and delete it.
3. Open `apps-script/gameday.gs` from the bgquick.com project and copy the whole file.
4. Paste it into the Apps Script editor.
5. Click the save icon (or Ctrl+S / Command+S). The project name can stay as “Untitled project” or you can name it `BGQuick Game Day`.

## 3. Deploy the web app

1. Click **Deploy → New deployment**.
2. Next to “Select type”, click the gear and choose **Web app**.
3. Description: `Game Day`.
4. **Execute as:** Me (your Google account).
5. **Who has access:** Anyone.
   Choose **Anyone**, not “Anyone with a Google account”. If people have to sign in, the website cannot save an RSVP.
6. Click **Deploy**.
7. Google asks you to authorize the script. Choose your account, then **Allow**. If you see “Google hasn’t verified this app”, choose **Advanced**, then the link that says continue to the script. The script only reads and writes this spreadsheet.
8. Copy the **Web app URL**. It ends in `/exec`. The URL that ends in `/dev` is the wrong one.

That `/exec` URL is not a secret. It is fine that it is visible in the website’s data file. It does not let people open the spreadsheet.

## 4. Check the deployment

Paste the `/exec` URL into a browser and add `?event=2026-11-21` on the end. You should see text like:

`{"ok":true,"eventId":"2026-11-21","rsvps":[],"food":[]}`

If you see a Google sign-in page, the access was not set to **Anyone**. Deploy a new version (step 6) and set **Who has access** to **Anyone**.

## 5. Turn RSVPs on

The website reads the URL from `data/game-days.json`. Until `endpoint` is filled in, the page says “RSVPs aren't open yet.”

1. Open `data/game-days.json`.
2. Replace the empty endpoint with your URL, including the quotes:

   `"endpoint": "https://script.google.com/macros/s/PASTE_THE_LONG_ID/exec"`

3. Save the file and publish it to the `main` branch of the website (GitHub Pages serves that branch).

Reload the Game Day page. The RSVP form should replace “RSVPs aren't open yet.”

## 6. When you change the script later

1. Edit the script in Apps Script and save.
2. Click **Deploy → Manage deployments**.
3. Click the pencil on the Game Day deployment.
4. Under Version, choose **New version**.
5. Click **Deploy**.

The `/exec` URL stays the same. You do not need to change `data/game-days.json` again.

## Dates, time, and food quantities

Those live in `data/game-days.json`, not in the spreadsheet.

- `dates` is the list of Saturdays. It is usually the 4th Saturday. Change a date when that Saturday is a bad fit. Add 2027 dates the same way: `id` and `date` are both `YYYY-MM-DD`.
- `timeLabel` is the hours. Game Day is 3:00–9:00 PM.
- Food suggestions grow with the RSVPs. Each child counts as `kidWeight` of an adult (`0.5` is half). A Maybe counts as `maybeWeight` (`0.5`). The suggestion is the headcount divided by that item’s `every`, times `amount`, rounded up. Drinks use `every: 1` and `amount: 2`, so the page can say “about 2 per person, so ~30 cans”. Snacks use `every: 15` and `amount: 4`, so 15 people means “4 bags for 15 people”.
- To preview which date the page would pick, open the Game Day page with `?on=YYYY-MM-DD` on the end.

The script stores at most 40 updates per date every 10 minutes, so a stuck button cannot fill the sheet. A family can change their own RSVP from the same phone or computer. That device keeps a private edit key in its browser. The public list never includes that key.
