# Pinpoint — Airtable (IDs-first)
- Uses Airtable via Netlify Function
- Prefers **table IDs** (tbl...) set in env; names also work
- Optional `AIRTABLE_DEFAULT_VIEW` or per-call `?view=viw...`

Test locally:
  npm i -g netlify-cli
  netlify dev
Then visit: /.netlify/functions/airtable?table=requests
