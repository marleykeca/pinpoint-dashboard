/* Airtable-only app */
(function(){
  const cfg = window.PinpointConfig;
  const $ = s=>document.querySelector(s);
  const $$ = s=>Array.from(document.querySelectorAll(s));
  const views={creators:$('#creatorsView'),profile:$('#profileView'),report:$('#reportView')};
  const creatorsTableBody=$('#creatorsTable tbody');
  const creatorSearch=$('#creatorSearch');
  const requestSort=$('#requestSort');
  const profileFields=$('#profileFields');
  const requestsList=$('#requestsList');
  const requestHeader=$('#requestHeader');
  const reportsRight=$('#reportsRight');
  const actionsAside=$('#actionsAside');
  const envPill=$('#envPill');
  const brandLink=$('#brandLink');

  let state={creators:[],requests:[],reports:[],actions:[],currentCreator:null,currentRequest:null,currentReports:[],chart:null};

  function show(v){Object.values(views).forEach(x=>x.classList.add('hidden')); views[v].classList.remove('hidden');}
  function formatDate(d){if(!d) return ''; const dt=new Date(d); return isNaN(dt)?d:dt.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});}
  function el(t,a={},...c){const n=document.createElement(t); Object.entries(a).forEach(([k,v])=>k==='class'?n.className=v:k==='html'?n.innerHTML=v:n.setAttribute(k,v)); c.forEach(x=>n.append(x)); return n;}

  function normalizeId(val){
    if(val===undefined||val===null) return '';
    const s=String(val).trim(); if(s.startsWith('rec')) return s;
    const t=s.replace(/,/g,'').trim(); if(/^\d+(\.0+)?$/.test(t)) return String(parseInt(t,10));
    return t;
  }

  async function fetchApi(tableKey){
    const url = `/.netlify/functions/airtable?table=${tableKey}`;
    const r = await fetch(url);
    if(!r.ok) throw new Error('API error '+r.status);
    return await r.json();
  }

  async function loadAll(){
    const [creators,requests,reports,actions] = await Promise.all([
      fetchApi('creators'), fetchApi('requests'), fetchApi('reports'), fetchApi('actions')
    ]);
    state.creators=creators; state.requests=requests; state.reports=reports; state.actions=actions;
    renderCreators(); envPill.textContent='Mode: Airtable'; show('creators');
  }

  function extractValue(value, {forDisplay=false}={}){
    if(value===undefined||value===null) return forDisplay?'':value;
    if(Array.isArray(value)){
      if(!forDisplay) return value;
      return value.map(v=>extractValue(v,{forDisplay:true})).filter(v=>v!==undefined&&v!==null&&v!=='').join(', ');
    }
    if(typeof value==='object'){
      if('value' in value) return extractValue(value.value,{forDisplay});
      if(forDisplay){
        if('name' in value) return extractValue(value.name,{forDisplay:true});
        if('text' in value) return extractValue(value.text,{forDisplay:true});
        if('label' in value) return extractValue(value.label,{forDisplay:true});
        return '';
      }
      return value;
    }
    return value;
  }

  function field(row, key){
    const raw = row?.[key] ?? row?.[key?.toLowerCase?.()];
    if(raw===undefined||raw===null) return '';
    return raw;
  }

  function displayField(row, key){
    const raw = row?.[key] ?? row?.[key?.toLowerCase?.()];
    const val = extractValue(raw,{forDisplay:true});
    if(val===undefined||val===null) return '';
    return String(val);
  }

  function deriveKeyAndLabel(rawValue, preferredLabel=''){
    const normalize=(value)=>{
      if(value===undefined||value===null) return '';
      if(Array.isArray(value)){
        return value.map(normalize).join('|');
      }
      if(typeof value==='object'){
        try{
          return Object.keys(value)
            .sort()
            .map(k=>`${k}:${normalize(value[k])}`)
            .join('|');
        }catch(_err){
          return '';
        }
      }
      return String(value);
    };

    const normalizedKey=normalize(rawValue);
    const key=normalizedKey || (preferredLabel || '');
    const label=preferredLabel || normalizedKey || '—';
    return {key,label};
  }

  function keyFields(){ const f=cfg.fields; return {
    creatorId:f.creator.id, first:f.creator.first,last:f.creator.last,artist:f.creator.artist,email:f.creator.email,
    reqId:f.request.id, reqCreatorLink:f.request.creatorId, reqDate:f.request.date, reqTitle:f.request.title, reqStage:f.request.stage,
    reqTrackUrl:f.request.trackUrl, reqTrackFile:f.request.trackFile,
    repId:f.report.id, repReqLink:f.report.requestId, repCategory:f.report.category, repCalibre:f.report.calibre,
    repRaw:f.report.raw, repStr:f.report.strengths, repOpp:f.report.opportunities, repActual:f.report.actual, repPotential:f.report.potential,
    actId:f.action.id, actRepLink:f.action.reportId, actAnchor:f.action.anchor, actDetails:f.action.details, actCategory:f.action.category
  };}

  function getLinkedIds(value){
    // Airtable returns linked-record fields as arrays of record IDs
    if(Array.isArray(value)) return value.map(normalizeId);
    if(value===undefined||value===null||value==='') return [];
    // Sometimes Airtable returns a single string (rare); coerce to array
    return [normalizeId(value)];
  }

  function renderCreators(){
    const F=keyFields();
    const counts = state.requests.reduce((acc,r)=>{
      getLinkedIds(field(r,F.reqCreatorLink)).forEach(id=>{ acc[id]=(acc[id]||0)+1; });
      return acc;
    }, {});

    creatorsTableBody.innerHTML='';
    state.creators.forEach(c=>{
      const creatorRecId = normalizeId(c.id);
      const count = counts[creatorRecId] || 0;
      const tr=el('tr',{},
        el('td',{}, displayField(c,F.first)),
        el('td',{}, displayField(c,F.last)),
        el('td',{}, displayField(c,F.artist)),
        el('td',{}, displayField(c,F.email)),
        el('td',{class:'num'}, String(count))
      );
      tr.addEventListener('click', ()=> openProfile(c));
      creatorsTableBody.appendChild(tr);
    });

    creatorSearch.addEventListener('input', ()=>{
      const q = creatorSearch.value.toLowerCase().trim();
      $$('#creatorsTable tbody tr').forEach(tr=>{
        tr.style.display = Array.from(tr.cells).some(td=> td.textContent.toLowerCase().includes(q)) ? '' : 'none';
      });
    });
  }

  function openProfile(creator){
    state.currentCreator=creator; const F=keyFields();
    const creatorRecId = normalizeId(creator.id);
    profileFields.innerHTML = Object.entries(creator).map(([k,v])=>`<div><strong>${k}</strong><br><span class="muted">${Array.isArray(v)?v.join(', '): (v||'—')}</span></div>`).join('');
    const reqs = state.requests.filter(r=> getLinkedIds(field(r,F.reqCreatorLink)).includes(creatorRecId) );
    renderRequests(reqs);
    $('#backToCreators').onclick=()=>show('creators'); show('profile');
  }

  function renderRequests(reqs){
    const F=keyFields(); const mode=requestSort.value||'newest';
    reqs.sort((a,b)=>{const da=new Date(field(a,F.reqDate)).getTime(); const db=new Date(field(b,F.reqDate)).getTime(); return mode==='newest'?(db-da):(da-db);});
    requestsList.innerHTML='';
    reqs.forEach(r=>{
      const card=el('div',{class:'req'},
        el('div',{}, el('div',{class:'meta'}, formatDate(field(r,F.reqDate))), el('div',{}, `${displayField(r,F.reqTitle)} — ${displayField(r,F.reqStage)}`)),
        el('div',{class:'meta'}, displayField(state.currentCreator,F.artist))
      );
      card.addEventListener('click', ()=> openRequest(r));
      requestsList.append(card);
    });
    requestSort.onchange=()=>renderRequests(reqs);
  }

  function openRequest(request){
    state.currentRequest=request; const F=keyFields();
    const trackUrlRaw=field(request,F.reqTrackUrl);
    const trackUrl=(()=>{
      const normalizeUrlValue=(val)=>{
        if(!val) return '';
        if(typeof val==='string') return val.trim();
        if(typeof val==='object'){
          if(val.url) return String(val.url).trim();
          if(val.value) return String(val.value).trim();
          if(val.text) return String(val.text).trim();
        }
        return String(val).trim();
      };

      if(!trackUrlRaw) return '';
      if(Array.isArray(trackUrlRaw)){
        for(const item of trackUrlRaw){
          const normalized=normalizeUrlValue(item);
          if(normalized) return normalized;
        }
        return '';
      }
      return normalizeUrlValue(trackUrlRaw);
    })();

    const trackFileRaw=field(request,F.reqTrackFile);
    const trackFiles=Array.isArray(trackFileRaw)?trackFileRaw.filter(Boolean):(trackFileRaw?[trackFileRaw]:[]);

    const trackFileNodes=trackFiles.map(file=>{
      const candidate=file?.url || file?.value || (typeof file==='string'?file:'');
      const url=candidate?String(candidate).trim():'';
      if(!url) return null;
      const audio=el('audio',{controls:'',preload:'none'});
      audio.src=url;
      if(file?.filename) audio.title=file.filename;
      return audio;
    }).filter(Boolean);

    const headerSpec=[
      {label:'Submitted', text: formatDate(field(request,F.reqDate))},
      {label:'Artist', text: displayField(state.currentCreator,F.artist)},
      {label:'Track title', text: displayField(request,F.reqTitle)},
      {label:'Track stage', text: displayField(request,F.reqStage)},
      {label:'Email', text: displayField(state.currentCreator,F.email)},
      {label:'Track URL', nodes: trackUrl? [el('a',{href:trackUrl,target:'_blank',rel:'noopener noreferrer'}, trackUrl)]:[]},
      {label:'Track file', nodes: trackFileNodes}
    ];

    requestHeader.innerHTML='';
    headerSpec.forEach(spec=>{
      const valueEl=el('div',{class:'value'});
      if(spec.nodes){
        if(spec.nodes.length){
          spec.nodes.forEach(node=>valueEl.append(node));
        }else{
          valueEl.textContent='—';
        }
      }else{
        valueEl.textContent=spec.text || '—';
      }
      requestHeader.append(
        el('div',{class:'field'},
          el('div',{class:'label'},spec.label),
          valueEl
        )
      );
    });

    const reqRecId = normalizeId(request.id) || getLinkedIds(field(request,F.reqId))[0];
    const reports = state.reports.filter(rep=> getLinkedIds(field(rep,F.repReqLink)).includes(reqRecId) );
    state.currentReports=reports;
    renderChart(reports); renderReportCards(reports);
    $('#backToProfile').onclick=()=>show('profile'); show('report');
  }

  function renderChart(reports){
    const F=keyFields();
    const catMeta=reports.map(rep=>{
      const catRaw=field(rep,F.repCategory);
      const catLabel=displayField(rep,F.repCategory);
      return deriveKeyAndLabel(catRaw, catLabel);
    });
    const labels=catMeta.map(c=>c.label);
    const actual=reports.map(r=>Number(field(r,F.repActual))||0);
    const potential=reports.map(r=>Number(field(r,F.repPotential))||0);
    if(state.chart) state.chart.destroy();
    state.chart=new Chart($('#scoresChart'),{type:'bar',data:{labels,datasets:[{label:'Actual',data:actual,borderWidth:1},{label:'Potential',data:potential,borderWidth:1}]},options:{responsive:true,indexAxis:'y',scales:{x:{suggestedMin:0,suggestedMax:5,ticks:{stepSize:0.5}}},plugins:{legend:{display:true,position:'top'}},onClick:(evt,els)=>{if(els&&els.length){const idx=els[0].index; const cat=catMeta[idx]?.key ?? ''; focusReportByCategory(cat);}}}});
  }

  function renderReportCards(reports){
    const F=keyFields(); reportsRight.innerHTML='';
    reports.forEach(rep=>{
      const catRaw=field(rep,F.repCategory);
      const catLabel=displayField(rep,F.repCategory);
      const {key:catKey,label:tagText}=deriveKeyAndLabel(catRaw, catLabel);
      const card=el('div',{class:'report-card','data-cat':catKey},
        el('div',{class:'tag'},tagText),
        el('div',{},`Calibre<br>${displayField(rep,F.repCalibre)||'—'}`),
        el('div',{},`Raw feedback${displayField(rep,F.repRaw)||'—'}`),
        el('div',{},`Strengths${displayField(rep,F.repStr)||'—'}`),
        el('div',{},`Opportunities${displayField(rep,F.repOpp)||'—'}`),
        el('div',{class:'actions-row',id:`actions-${field(rep,F.repId)}`})
      );
      card.addEventListener('click',()=>focusReportByCategory(catKey));
      reportsRight.append(card);
      // Buttons from Actions
      const actions = state.actions.filter(a=> getLinkedIds(field(a,F.actRepLink)).includes(normalizeId(rep.id)) );
      const row=card.querySelector('.actions-row');
      if(!actions.length) row.append(el('span',{class:'meta'},'No actions'));
      actions.forEach(a=>{
        const btn=el('button',{class:'btn'}, displayField(a,F.actAnchor)||'Action');
        btn.addEventListener('click',(ev)=>{ev.stopPropagation(); openActionsAside(a.id, rep.id);});
        row.append(btn);
      });
    });
  }

  function focusReportByCategory(category){
    $$('.report-card').forEach(c=>{const on=c.getAttribute('data-cat')===category; c.classList.toggle('active',on); c.style.display=on?'':'none';});
  }

  function openActionsAside(selectedActionId, reportId){
    const F=keyFields();
    const reqRecId = normalizeId(state.currentRequest.id);
    const reportsForReq = state.reports.filter(rep=> getLinkedIds(field(rep,F.repReqLink)).includes(reqRecId) );
    const reportIds = new Set(reportsForReq.map(r=> normalizeId(r.id)));
    const actions = state.actions.filter(a=> getLinkedIds(field(a,F.actRepLink)).some(id=> reportIds.has(id)) );

    const list=$('#actionsList'); list.innerHTML='';
    actions.forEach(a=>{
      const isSelected = normalizeId(a.id)===normalizeId(selectedActionId);
      const card=el('div',{class:'action-card '+(isSelected?'':'collapsed')},
        el('div',{class:'header'},
          el('div',{}, el('div',{class:'category'}, ''+ (displayField(a,F.actCategory)||'')), el('div',{class:'anchor'}, displayField(a,F.actAnchor)||'Action') ),
          el('button',{class:'btn'}, isSelected?'Collapse':'Expand')
        ),
        el('div',{class:'body'}, displayField(a,F.actDetails)||'')
      );
      const toggle=card.querySelector('button');
      toggle.addEventListener('click',()=>{card.classList.toggle('collapsed'); toggle.textContent=card.classList.contains('collapsed')?'Expand':'Collapse';});
      list.append(card);
    });
    actionsAside.classList.add('open');
  }

  $('#closeAside').onclick=()=>actionsAside.classList.remove('open');
  brandLink.onclick=()=>{show('creators'); actionsAside.classList.remove('open');};

  loadAll().catch(e=>{console.error(e); alert('Failed to load from Airtable. Check token/base on server.');});
})();
