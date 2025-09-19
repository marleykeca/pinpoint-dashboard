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

  function field(row, key){ return row[key] ?? row[key?.toLowerCase?.()] ?? ''; }

  function keyFields(){ const f=cfg.fields; return {
    creatorId:f.creator.id, first:f.creator.first,last:f.creator.last,artist:f.creator.artist,email:f.creator.email,
    reqId:f.request.id, reqCreatorLink:f.request.creatorId, reqDate:f.request.date, reqTitle:f.request.title, reqStage:f.request.stage,
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
        el('td',{}, field(c,F.first)),
        el('td',{}, field(c,F.last)),
        el('td',{}, field(c,F.artist)),
        el('td',{}, field(c,F.email)),
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
        el('div',{}, el('div',{class:'meta'}, formatDate(field(r,F.reqDate))), el('div',{}, `${field(r,F.reqTitle)} — ${field(r,F.reqStage)}`)),
        el('div',{class:'meta'}, field(state.currentCreator,F.artist))
      );
      card.addEventListener('click', ()=> openRequest(r));
      requestsList.append(card);
    });
    requestSort.onchange=()=>renderRequests(reqs);
  }

  function openRequest(request){
    state.currentRequest=request; const F=keyFields();
    const headerSpec=[
      {label:'Submitted', value: formatDate(field(request,F.reqDate))},
      {label:'Artist', value: field(state.currentCreator,F.artist)},
      {label:'Track title', value: field(request,F.reqTitle)},
      {label:'Track stage', value: field(request,F.reqStage)},
      {label:'Email', value: field(state.currentCreator,F.email)},
    ];
    requestHeader.innerHTML=headerSpec.map(h=>`<div class="field"><div class="label">${h.label}</div><div class="value">${h.value||'—'}</div></div>`).join('');

    const reqRecId = normalizeId(request.id) || getLinkedIds(field(request,F.reqId))[0];
    const reports = state.reports.filter(rep=> getLinkedIds(field(rep,F.repReqLink)).includes(reqRecId) );
    state.currentReports=reports;
    renderChart(reports); renderReportCards(reports);
    $('#backToProfile').onclick=()=>show('profile'); show('report');
  }

  function renderChart(reports){
    const F=keyFields();
    const labels=reports.map(r=>field(r,F.repCategory));
    const actual=reports.map(r=>Number(field(r,F.repActual))||0);
    const potential=reports.map(r=>Number(field(r,F.repPotential))||0);
    if(state.chart) state.chart.destroy();
    state.chart=new Chart($('#scoresChart'),{type:'bar',data:{labels,datasets:[{label:'Actual',data:actual,borderWidth:1},{label:'Potential',data:potential,borderWidth:1}]},options:{responsive:true,indexAxis:'y',scales:{x:{suggestedMin:0,suggestedMax:5,ticks:{stepSize:0.5}}},plugins:{legend:{display:true,position:'top'}},onClick:(evt,els)=>{if(els&&els.length){const cat=labels[els[0].index]; focusReportByCategory(cat);}}}});
  }

  function renderReportCards(reports){
    const F=keyFields(); reportsRight.innerHTML='';
    reports.forEach(rep=>{
      const cat=field(rep,F.repCategory);
      const card=el('div',{class:'report-card','data-cat':cat},
        el('div',{class:'tag'},cat),
        el('div',{},`Calibre<br>${field(rep,F.repCalibre)||'—'}`),
        el('div',{},`Raw feedback${field(rep,F.repRaw)||'—'}`),
        el('div',{},`Strengths${field(rep,F.repStr)||'—'}`),
        el('div',{},`Opportunities${field(rep,F.repOpp)||'—'}`),
        el('div',{class:'actions-row',id:`actions-${field(rep,F.repId)}`})
      );
      card.addEventListener('click',()=>focusReportByCategory(cat));
      reportsRight.append(card);
      // Buttons from Actions
      const actions = state.actions.filter(a=> getLinkedIds(field(a,F.actRepLink)).includes(normalizeId(rep.id)) );
      const row=card.querySelector('.actions-row');
      if(!actions.length) row.append(el('span',{class:'meta'},'No actions'));
      actions.forEach(a=>{
        const btn=el('button',{class:'btn'}, field(a,F.actAnchor)||'Action');
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
          el('div',{}, el('div',{class:'category'}, ''+ (field(a,F.actCategory)||'')), el('div',{class:'anchor'}, field(a,F.actAnchor)||'Action') ),
          el('button',{class:'btn'}, isSelected?'Collapse':'Expand')
        ),
        el('div',{class:'body'}, field(a,F.actDetails)||'')
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
