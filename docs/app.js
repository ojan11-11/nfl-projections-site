"use strict";

const STAT_COLUMNS = {
  QB: [["attempts","Pass att"],["completions","Comp"],["passing_yards","Pass yds"],["passing_tds","Pass TD"],["interceptions","INT"],["rushing_yards","Rush yds"],["rushing_tds","Rush TD"]],
  RB: [["carries","Carries"],["rushing_yards","Rush yds"],["rushing_tds","Rush TD"],["targets","Targets"],["receptions","Rec"],["receiving_yards","Rec yds"],["receiving_tds","Rec TD"]],
  WR: [["targets","Targets"],["receptions","Rec"],["receiving_yards","Rec yds"],["receiving_tds","Rec TD"]],
  TE: [["targets","Targets"],["receptions","Rec"],["receiving_yards","Rec yds"],["receiving_tds","Rec TD"]],
  K: [["fg_attempts","FG att"],["fg_made","FG made"],["pat_made","XP made"]]
};
const POSITION_LABEL = {QB:"Quarterback",RB:"Running back",WR:"Wide receiver",TE:"Tight end",K:"Kicker"};
const MODELS = ["v9","v10","v10_fg"];
const YARDAGE = new Set(["passing_yards","rushing_yards","receiving_yards"]);
const state = {games: [], game: null, position: "QB", model: "v9"};
const $ = id => document.getElementById(id);

function localTime(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-US",{
    timeZone:"America/New_York",month:"short",day:"numeric",year:"numeric",
    hour:"numeric",minute:"2-digit",timeZoneName:"short"
  }).format(d);
}
function node(tag, className, value) {
  const el=document.createElement(tag);
  if(className) el.className=className;
  if(value !== undefined) el.textContent=String(value);
  return el;
}
function reset(el){while(el.firstChild)el.removeChild(el.firstChild);}
function selectedGameId() {
  const h=decodeURIComponent(location.hash.slice(1));
  return state.games.some(g=>g.game_id===h)?h:(state.games[0]||{}).game_id;
}
function setMessage(message) {
  const el=$("error-state");
  el.hidden=!message;
  el.textContent=message||"";
}
function renderGameList() {
  const select=$("game-select");
  reset(select);
  for(const game of state.games) {
    const option=node("option","",game.matchup+"  ·  "+localTime(game.kickoff_at));
    option.value=game.game_id;
    select.append(option);
  }
  select.disabled=!state.games.length;
  if(state.games.length) select.value=selectedGameId();
}
function formatMean(x) {
  const v=Number(x);
  return Number.isFinite(v)?v.toFixed(1):"—";
}
function valueCell(stat,v) {
  const cell=node("td");
  if (!v || !Number.isFinite(Number(v.mean))) {
    cell.textContent="—";
    return cell;
  }
  cell.append(node("span","",formatMean(v.mean)));
  if(YARDAGE.has(stat) && Number.isFinite(Number(v.p10)) && Number.isFinite(Number(v.p90))) {
    cell.append(node("span","range"," ("+Math.round(v.p10)+"–"+Math.round(v.p90)+")"));
  }
  return cell;
}
function playerImportance(p) {
  const s=p.stats||{}, num=n=>Number(s[n]?.mean)||0;
  return p.position==="QB"?num("attempts"):
    p.position==="RB"?num("carries")+num("targets"):
    p.position==="K"?num("fg_attempts"):num("targets");
}
function renderPlayers() {
  if(!state.game) return;
  const columns=STAT_COLUMNS[state.position];
  const players=(state.game.models?.[state.model]||[])
    .filter(p=>p.position===state.position)
    .sort((a,b)=>(a.team===state.game.away?0:1)-(b.team===state.game.away?0:1)
      ||playerImportance(b)-playerImportance(a)||a.player.localeCompare(b.player));
  $("table-title").textContent=POSITION_LABEL[state.position]+" projections";
  $("player-count").textContent=players.length+" players";
  const head=$("projection-head"),body=$("projection-body");
  reset(head);reset(body);
  const h=node("tr");
  for (const label of ["PLAYER","TEAM",...columns.map(v=>v[1])]) {
    const th=node("th","",label);
    th.scope="col";
    h.append(th);
  }
  head.append(h);
  if(!players.length){
    const tr=node("tr");
    const td=node("td","", "No "+POSITION_LABEL[state.position].toLowerCase()+" projections are included in this verified snapshot.");
    td.colSpan=columns.length+2;
    tr.append(td);body.append(tr);
    return;
  }
  for(const player of players) {
    const tr=node("tr");
    const unresolved=player.identity_status==="unconfirmed";
    tr.append(node("td","player-name",player.player+(unresolved?" (unconfirmed)":"")));
    tr.append(node("td","team-label",player.team));
    for(const [key] of columns)tr.append(valueCell(key,player.stats?.[key]));
    body.append(tr);
  }
}
function render() {
  const report=state.game;
  $("empty-state").hidden=!!report;
  $("forecast").hidden=!report;
  $("status-chip").textContent=report?"VERIFIED ARCHIVED FORECAST":"AWAITING VERIFIED FORECAST";
  if(!report)return;
  $("matchup-title").textContent=report.away+"  @  "+report.home;
  $("match-meta").textContent="Kickoff: "+localTime(report.kickoff_at)+"   ·   Data frozen: "+localTime(report.cutoff_at)+"   ·   "+Number(report.draws_per_model||10000).toLocaleString()+" simulations per model";
  const isPast=Date.now()>=new Date(report.kickoff_at).getTime();
  $("matchup-overline").textContent=isPast?"HISTORICAL PRE-KICKOFF SNAPSHOT":"UPCOMING GAME";
  $("capture-label").textContent=isPast?"ARCHIVED PRE-KICKOFF":"FROZEN PRE-KICKOFF";
  $("research-banner").hidden=state.model==="v9";
  for(const tab of document.querySelectorAll("[data-position]")){
    const selected=tab.dataset.position===state.position;
    tab.classList.toggle("active",selected);
    tab.setAttribute("aria-selected",selected?"true":"false");
    tab.tabIndex=selected?0:-1;
  }
  renderPlayers();
}
async function loadGame(id) {
  if(!id)return;
  const endpoint="./data/games/"+encodeURIComponent(id)+".json";
  const response=await fetch(endpoint,{cache:"no-store"});
  if(!response.ok)throw Error("Could not fetch the frozen projection file.");
  const doc=await response.json();
  if(doc.game_id!==id || !doc.models || !MODELS.every(m=>Array.isArray(doc.models[m])))
    throw Error("The projection file did not pass basic schema checks.");
  if(!doc.cutoff_at||!doc.kickoff_at||new Date(doc.cutoff_at)>=new Date(doc.kickoff_at))
    throw Error("This forecast has an invalid pregame cutoff.");
  state.game=doc;
  render();
}
async function refresh() {
  $("status-chip").textContent="CHECKING FORECASTS";
  setMessage("");
  try {
    const response=await fetch("./data/index.json",{cache:"no-store"});
    if(!response.ok)throw Error("Forecast feed is temporarily unavailable.");
    const list=await response.json();
    if(list.version!==1||!Array.isArray(list.games))throw Error("Unsupported forecast feed.");
    state.games=list.games.filter(g=>/^\d{4}_\d{2}_[A-Z]{2,4}_[A-Z]{2,4}$/.test(g.game_id));
    renderGameList();
    if(!state.games.length){state.game=null;render();return;}
    await loadGame(selectedGameId());
  }catch(err){
    setMessage("Unable to load reports: "+err.message+". You can try refreshing the page.");
    state.game=null;
    render();
  }
}
$("game-select").addEventListener("change",async evt=>{
  const id=evt.target.value;
  if(!state.games.some(g=>g.game_id===id))return;
  location.hash=encodeURIComponent(id);
  try{setMessage("");await loadGame(id);}catch(err){setMessage(err.message);}
});
$("model-select").addEventListener("change",evt=>{
  if(!MODELS.includes(evt.target.value))return;
  state.model=evt.target.value;
  render();
});
for(const tab of document.querySelectorAll("[data-position]")){
  tab.addEventListener("click",()=>{
    state.position=tab.dataset.position;
    render();
  });
}
$("refresh-button").addEventListener("click",refresh);
window.addEventListener("hashchange",async()=>{
  const id=selectedGameId();
  if(id&&id!==state.game?.game_id){try{await loadGame(id);}catch(e){setMessage(e.message);}}
});
refresh();
