// ============================================================
//  Dashboard settings - the only file you normally need to edit
// ============================================================
window.DASHBOARD_CONFIG = {
  // Where the data comes from:
  //   'local'  = read the CSV files in the data/ folder (relative path, works under any GitHub Pages subpath)
  //   'sheets' = read the published Google Sheet CSV links below
  DATA_SOURCE: 'local',

  // "Publish to web -> CSV" link of each Google Sheet tab (only used when DATA_SOURCE = 'sheets')
  SHEET_CSV_URLS: {
    skus:       'PASTE_PUBLISHED_CSV_URL_FOR_skus_TAB',
    listings:   'PASTE_PUBLISHED_CSV_URL_FOR_listings_TAB',
    prices:     'PASTE_PUBLISHED_CSV_URL_FOR_prices_TAB',
    targets:    'PASTE_PUBLISHED_CSV_URL_FOR_targets_TAB',
    promotions: 'PASTE_PUBLISHED_CSV_URL_FOR_promotions_TAB',
    cases:      'PASTE_PUBLISHED_CSV_URL_FOR_cases_TAB'
  },

  // How often the team updates prices: 'daily' | 'weekly' | 'monthly'
  // Controls the "next update due" badge and how long browsers may cache data.
  REFRESH: 'weekly',

  BASE_BRAND: 'Malee',          // our brand
  COMPETITOR_BRAND: 'Tipco',    // index base: Malee price index with Tipco = 100
  RETAILERS: ["Lotus's", 'Big C'],
  PRIMARY_RETAILER: "Lotus's",  // used first for the 3 action cards

  WEEK_DAYS: 7,                 // "this week" window for alerts and action cards
  GAP_ALERT_PCT: 5,             // alert when Malee vs Tipco gap is bigger than this (%)
  PRICE_MOVE_ALERT_PCT: 3,      // alert when a shelf price moves by at least this (%)

  TITLE: 'Malee vs Tipco - Price & Promo Dashboard (Mockup v2)',
  TIMEZONE_LABEL: 'Bangkok time (UTC+7)'
};
