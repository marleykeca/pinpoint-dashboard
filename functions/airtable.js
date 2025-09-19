// Airtable proxy (IDs-first, optional view)
export async function handler(event, context) {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE;
  if (!token || !baseId){
    return { statusCode: 500, body: JSON.stringify({error:'Airtable env vars not set'}) };
  }
  // Allow either names or IDs via env; IDs recommended
  const tableEnv = {
    creators: process.env.AIRTABLE_CREATORS_TABLE || 'creator',
    requests: process.env.AIRTABLE_REQUESTS_TABLE || 'request',
    reports:  process.env.AIRTABLE_REPORTS_TABLE  || 'report',
    actions:  process.env.AIRTABLE_ACTIONS_TABLE  || 'action',
  };
  const qs = event.queryStringParameters || {};
  const tableKey = qs.table || 'creators';
  const tableNameOrId = tableEnv[tableKey] || tableKey;

  const viewParam = qs.view || process.env.AIRTABLE_DEFAULT_VIEW || '';
  const encodedView = viewParam ? `&view=${encodeURIComponent(viewParam)}` : '';

  const urlBase = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableNameOrId)}?pageSize=100${encodedView}`;
  try{
    let url = urlBase; const all = [];
    while (url){
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok){ const text = await res.text(); return { statusCode: res.status, body: text }; }
      const j = await res.json(); j.records.forEach(r=> all.push(Object.assign({id:r.id}, r.fields)));
      url = j.offset ? `${urlBase}&offset=${j.offset}` : null;
    }
    return { statusCode: 200, body: JSON.stringify(all) };
  }catch(err){
    return { statusCode: 500, body: JSON.stringify({error: err.message}) };
  }
}
