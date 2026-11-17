# Malee vs Tipco Price & Promo Dashboard (Mockup v2): setup, update and delete guide

This guide is for people who don't write code. You need a free GitHub account and a web browser (a Google account too if you want to use Google Sheets). Expect about 20 minutes the first time.

> **MOCKUP DATA.** Most of the data in this version is simulated so you can see how the finished product looks. Price history from 18 Oct to 16 Nov 2026, the promo runs in that period and the target price bands are **MOCKUP**. Only the 17 Nov 2026 rows marked `REAL` come from live retailer pages (Lotus's and Big C), and each has a source link. The site shows a yellow **MOCKUP DATA** banner and badges wherever mockup values appear. Replace the mockup rows with real data before anyone uses the numbers to make decisions (Part F).

## What's in the folder

| File / folder | What it is |
|---|---|
| `index.html` | The dashboard page (5 tabs: This week, Promo Patterns, Price Index, Promotions Log, Learning Cases) |
| `config.js` | Settings: data source, Google Sheet links, refresh frequency, alert thresholds. **This is the only file you normally edit.** |
| `assets/style.css`, `assets/app.js` | Page design and logic. Don't edit these. |
| `data/skus.csv` | The 3 product pairs (Malee vs Tipco, 1 L) |
| `data/listings.csv` | Each product's page at each retailer (Lotus's, Big C) |
| `data/prices.csv` | One row per day × product × retailer: regular price, shelf price, promo type, `is_mockup`, `data_status` (REAL/MOCKUP), source link |
| `data/targets.csv` | **MOCKUP** target price position per pair, for example "parity +/-3% vs Tipco". Marketing replaces these. |
| `data/promotions.csv` | Real retailer promos seen on 17 Nov 2026, plus campaigns and launches |
| `data/cases.csv` | Learning cases, each with a "Test Malee could run next month" |
| `screenshots/` | Preview images of each tab. You can delete these or leave them out of the upload. |

All links inside the site are **relative** (`assets/...`, `data/...`), so the site works at any address, including a GitHub Pages subpath such as `https://YOUR-NAME.github.io/test-v1/`.

**Important:** if you double-click `index.html`, the page says it cannot load data. That's normal, because browsers block a page opened from your disk from reading other files. It works on GitHub Pages, or see "Preview on your own computer" below.

---

## Part A: Publish on GitHub Pages (address ending in /test-v1/)

> Free GitHub Pages sites are **public**: anyone who has the address can open them. Keep only public or mockup data on the site, never confidential sales or margin numbers.

1. Go to https://github.com and sign in.
2. Click **+ → New repository**. Name it **`test-v1`**, the name becomes the subpath. Choose **Public**, tick **Add a README file**, and click **Create repository**.
3. On your computer, unzip `malee-tipco-dashboard.zip`.
4. In the repository, click **Add file → Upload files**. Drag in **the contents** of the unzipped folder: `index.html`, `config.js`, `GUIDE.md`, and the `assets` and `data` folders (`screenshots` is optional). Drag the contents, not the folder itself. Click **Commit changes**.
5. Check that `index.html` is at the top level of the repository, not inside a subfolder.
6. Open **Settings → Pages**. Under **Build and deployment**, set Source = **Deploy from a branch**, Branch = **main**, folder = **/ (root)**, and click **Save**.
7. Wait 1–2 minutes and refresh. GitHub shows the address, for example `https://YOUR-NAME.github.io/test-v1/`. Open it and you should see the yellow MOCKUP DATA banner and the "This week" tab.

## Part B: Delete the repository (and the site) when you're done

Deleting the repository also takes the GitHub Pages site offline. **This can't be undone**, so download anything you want to keep first (**Code → Download ZIP**).

1. Open the repository on GitHub, for example `https://github.com/YOUR-NAME/test-v1`.
2. Click **Settings**, the tab with the gear icon at the top of the repository.
3. Scroll to the bottom to the red **Danger Zone**.
4. Click **Delete this repository**.
5. Follow the prompts. GitHub asks you to confirm, then to type the repository name (for example `YOUR-NAME/test-v1`), and may ask for your password or 2FA code.
6. Click the final **Delete this repository** button. The site address stops working within a few minutes.

If you only want to take the site offline but keep the files: **Settings → Pages → Unpublish site**. Or make the repository private under **Settings → Danger Zone → Change visibility**. On a free plan, that also turns off Pages.

## Part C (optional): Keep the data in a Google Sheet

1. Create a blank Google Sheet. Make 6 tabs named exactly `skus`, `listings`, `prices`, `targets`, `promotions` and `cases`.
2. In each tab, use **File → Import → Upload** with the matching CSV from `data/`. Choose **Replace current sheet** and comma separator, and **untick "Convert text to numbers, dates, and formulas"** so dates stay as `2026-11-17`.
3. **File → Share → Publish to web**: pick a tab and **Comma-separated values (.csv)**, click Publish, and copy the link. Repeat for all 6 tabs, which gives you 6 links.
   - Publishing makes the sheet readable by anyone who has the link. Don't put confidential numbers in it.
4. In GitHub, open `config.js` and click the pencil (Edit). Set `DATA_SOURCE: 'sheets'` and paste each link in place of the matching `PASTE_...` text, keeping the quote marks. Then **Commit changes**.

## Part D: Settings in `config.js`

| Setting | Meaning |
|---|---|
| `REFRESH` | `'daily'`, `'weekly'` or `'monthly'`. Sets the "Next update due" badge (it turns amber when overdue) and how often browsers fetch fresh data. |
| `PRIMARY_RETAILER` | Retailer used first for the 3 action cards (`"Lotus's"`). |
| `WEEK_DAYS` | Length of "this week" for alerts and cards (7). |
| `GAP_ALERT_PCT` | Alert when Malee vs Tipco gap is bigger than this % (5). |
| `PRICE_MOVE_ALERT_PCT` | Alert when a shelf price moves by at least this % (3). |

## Part E: How the dashboard decides things

- **Price per 100 ml** = shelf price ÷ size (ml) × 100. Buy 3 pay 2 is entered as the effective unit price (regular × 2/3).
- **Malee index** = Malee price per 100 ml ÷ Tipco price per 100 ml × 100. Tipco = 100, so below 100 means Malee is cheaper.
- **Action cards**: for each pair, the latest day where both products were captured at the primary retailer (or the other retailer if that has no data). The index is compared with the target band from `targets.csv`. Cards are sorted by how far outside the band the pair is: **ACT** = more than 5 points outside, **REVIEW** = outside, **OK** = inside. The recommended price is the Malee shelf price range that puts the index back inside the band.
- **Alerts** (last 7 days): new Tipco promo, gap > 5%, outside target band, shelf price move of 3% or more, and days with data not captured.
- **Promo patterns**: days on promo % = promo days ÷ captured days. Avg depth = average % off regular. A promo run = consecutive promo days; not-captured days in between do not break a run (duration counts captured days only).

## Part F: Replace mockup data with real data

1. **Targets:** in `targets.csv`, enter the real target price position from Marketing. `malee_gap_min_pct` and `malee_gap_max_pct` are Malee vs Tipco in %, for example -3 and 3 for parity +/-3%. Then set `is_mockup` = `FALSE` and `data_status` = `REAL`.
2. **Prices:** delete the mockup rows in `prices.csv` (filter `is_mockup` = `TRUE`) once you have a few weeks of real checks. Until then, keep them so the charts have history.
3. **Each price check** (one row per date × sku × retailer):
   - `date` `YYYY-MM-DD`, `sku_id` (from `skus`), `retailer` exactly `Lotus's` or `Big C`
   - `captured`: `TRUE`, or `FALSE` if you couldn't find the product (leave the prices empty and set `promo_type` = `not_captured`)
   - `regular_price_thb` and `shelf_price_thb` (the price you'd pay today, the same as regular if there's no promo)
   - `promo_type`: `none`, `discount` or `buy3pay2`. `promo_label` is free text. `promo_end_date` only if shown. Big C shows the Thai year: `03/12/69` = `2026-12-03`.
   - `is_mockup` = `FALSE`, `data_status` = `REAL`, `source_url` = the page you checked
4. When no mockup rows are left, you can remove the yellow banner by deleting the `<div class="mock-banner" ...>` line in `index.html`.

### Rules that keep the dashboard working
- Don't rename files, tabs or column headers.
- Use dot decimals (`8.5`), with no currency signs or commas in number columns. Dates must be `YYYY-MM-DD`.
- Brand names must be exactly `Malee` or `Tipco`. A new pair needs 2 rows in `skus` with the same `pair_id`, plus a row in `targets`.
- In `cases.source_urls`, separate several links with `|`.

## Troubleshooting

| What you see | What to do |
|---|---|
| "Could not load data" on GitHub Pages | Check that the `data` folder was uploaded next to `index.html`. If you use Sheets, check the 6 links in `config.js`. |
| Page loads without styling under /test-v1/ | `assets/` wasn't uploaded, or `index.html` is inside a subfolder. Move it to the top level. |
| Old numbers still showing | Wait 5 minutes, then hard-refresh (Ctrl+Shift+R, or Cmd+Shift+R on a Mac). |
| A pair is missing from a chart | Its `sku_id` doesn't exactly match `skus`, or `retailer` isn't exactly `Lotus's` or `Big C`. |
| Preview on your own computer | In the unzipped folder's **parent** folder, run `python3 -m http.server 8000`, then open `http://localhost:8000/malee-tipco-dashboard/` (this also tests the subpath). |
