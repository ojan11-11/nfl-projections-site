"use strict";

const STAT_COLUMNS = {
  QB: [["attempts","Pass att"],["completions","Comp"],["passing_yards","Pass yds"],["passing_tds","Pass TD"],["interceptions","INT"],["rushing_yards","Rush yds"],["rushing_tds","Rush TD"]],
  RB: [["carries","Carries"],["rushing_yards","Rush yds"],["rushing_tds","Rush TD"],["targets","Targets"],["receptions","Rec"],["receiving_yards","Rec yds"],["receiving_tds","Rec TD"]],
  WR: [["targets","Targets"],["receptions","Rec"],["receiving_yards","Rec yds"],["receiving_tds","Rec TD"]],
  TE: [["targets","Targets"],["receptions","Rec"],["receiving_yards","Rec yds"],["receiving_tds","Rec TD"]],
  K: [["fg_attempts","FG att"],["fg_made","FG made"],["pat_made","XP made"]]
};
const POSITION_LABEL = {QB:"Quarterback",RB:"Running back",WR:"Wide receiver",TE:"Tight end",K:"Kicker"};
const BASE_MODELS = ["v9","v10","v10_fg"];
const MODELS = [...BASE_MODELS,"v10_weather"];
const WEATHER_TYPE = "experimental_weather_shadow_not_validated";
const YARDAGE = new Set(["passing_yards","rushing_yards","receiving_yards"]);
const state = {games: [], forecastIds: new Set(), selected: null, game: null, weather: null, weatherLoading: false,
  weatherError: "", stadiums: null, position: "QB", model: "v9", loadToken: 0};
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
    const ready=state.forecastIds.has(game.game_id);
    const past=Date.now()>=new Date(game.kickoff_at).getTime();
    const label=ready?"Verified forecast":past?"No pregame forecast":"Awaiting projections";
    const option=node("option","",game.matchup+"  ·  "+localTime(game.kickoff_at)+"  ·  "+label);
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
  const players=(state.model==="v10_weather"?(state.weather?.players||[]):
                 (state.game.models?.[state.model]||[]))
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
    const detail=state.model==="v10_weather" && !state.weather ?
      (state.weatherLoading?"Checking archived weather simulation…":
      "No verified pre-kickoff V10+Weather forecast is available for this matchup.") :
      "No "+POSITION_LABEL[state.position].toLowerCase()+" projections are included in this verified snapshot.";
    const td=node("td","",detail);
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
function roofLabel(type) {
  return ({open_air:"Open-air stadium",fixed_roof:"Fixed roof / indoor or skylight",
    retractable:"Retractable roof — game-day position unverified",
    outdoors:"Roof open / field exposed",open:"Retractable roof confirmed open",
    closed:"Roof confirmed closed",dome:"Fixed roof / covered field"})[type]||
    "Roof status unverified";
}
function renderWeather() {
  const report=state.game;
  if(!report)return;
  const isResearch=state.model==="v10_weather";
  const use=$("game-weather-usage"),data=$("weather-conditions"),message=$("weather-availability");
  const roof=$("game-roof-context");
  reset(data);
  data.hidden=true;
  message.hidden=true;
  const ref=state.stadiums?.teams?.[report.home];
  roof.textContent=ref ?
    "Usual "+report.home+" home stadium: "+ref.name+" · "+roofLabel(ref.roof_type)+
    ". Reference only: the actual game venue and roof position are not inferred." :
    "Home stadium roof reference unavailable; no stadium/roof assumptions are inferred.";
  if(!isResearch) {
    use.textContent="No stadium weather was applied by "+(
      state.model==="v9"?"V9":state.model==="v10"?"V10":"V10+FG")+
      " to this game’s simulation.";
    if(state.weather) {
      message.hidden=false;
      message.textContent="A separately archived pregame weather forecast exists for V10+Weather. Select V10+Weather to see the exact conditions and the weather-adjusted projections.";
    }
    return;
  }
  use.textContent="The conditions below are the frozen stadium forecast used by this experimental model — not measured game-day weather.";
  if(!state.weather) {
    message.hidden=false;
    message.textContent=state.weatherLoading?"Checking for a verified pre-kickoff weather report…":
      (state.weatherError||"No weather-adjusted simulation was published for this matchup. No figures are substituted.");
    return;
  }
  const weather=state.weather.weather;
  roof.textContent="Verified venue for this archived V10+Weather run: "+weather.stadium+
    " · "+roofLabel(weather.roof)+
    ". Fixed/retractable roof status is treated separately from outside weather.";
  data.hidden=false;
  const fields=[
    ["Wind",weather.wind_mph.toFixed(1)+" mph"],
    ["Gusts",weather.wind_gust_mph.toFixed(1)+" mph"],
    ["Temperature",weather.temperature_f.toFixed(1)+"°F"],
    ["Precipitation",weather.precipitation_in_hr.toFixed(2)+" in/hr"],
    ["Roof / field",roofLabel(weather.roof)],
    ["Source",weather.forecast_source],
    ["Captured",localTime(state.weather.weather_captured_at)],
    ["Model completed",localTime(state.weather.generated_at)],
    ["Applied scenario flags",weather.research_features.length?weather.research_features.map(x=>x.replaceAll("_"," ")).join(", "):"None (zero weather adjustment)"]
  ];
  for(const [label,val] of fields){
    const item=node("div","weather-cell"),name=node("span","weather-cell-label",label),
      value=node("strong","weather-cell-value",val);
    item.append(name,value);data.append(item);
  }
}

function render() {
  const report=state.game;
  $("empty-state").hidden=!!report;
  $("forecast").hidden=!report;
  const selected=state.selected;
  const past=selected && Date.now()>=new Date(selected.kickoff_at).getTime();
  $("status-chip").textContent=report?"VERIFIED PREGAME FORECAST":
    selected?(past?"NO VERIFIED PREGAME FORECAST":"UPCOMING · FORECAST PENDING"):
    "NO SCHEDULED GAMES AVAILABLE";
  if(!report) {
    $("empty-heading").textContent=selected?
      (past?"No verified pregame forecast was published.":"Pregame forecast not yet available."):
      "No upcoming NFL games available.";
    $("empty-detail").textContent=selected?
      selected.matchup+" · Kickoff "+localTime(selected.kickoff_at)+". "+
      (past?"This game has no validated pre-kickoff forecast; results will never be backfilled.":
      "The game was discovered automatically. Player projections appear only after valid models finish and publish before kickoff."):
      "The schedule updates automatically from an NFL scoreboard feed. Verified archived projections remain available here.";
    return;
  }
  $("matchup-title").textContent=report.away+"  @  "+report.home;
  $("match-meta").textContent="Kickoff: "+localTime(report.kickoff_at)+"   ·   Data frozen: "+localTime(report.cutoff_at)+"   ·   "+Number(report.draws_per_model||10000).toLocaleString()+" simulations per model";
  const isPast=Date.now()>=new Date(report.kickoff_at).getTime();
  $("matchup-overline").textContent=isPast?"HISTORICAL PRE-KICKOFF SNAPSHOT":"UPCOMING GAME";
  $("capture-label").textContent=isPast?"ARCHIVED PRE-KICKOFF":"FROZEN PRE-KICKOFF";
  $("research-banner").hidden=state.model==="v9";
  $("research-banner-title").textContent=state.model==="v10_weather" ?
    "V10+Weather — unvalidated experimental model" : "Experimental model";
  $("research-banner-message").textContent=state.model==="v10_weather" ?
    "Wind, gust, precipitation and temperature adjustments are provisional research assumptions. Weather results are displayed only when simulated and frozen before kickoff." :
    "For research comparison only. V9 is the baseline; this model has not been promoted for production scoring.";
  for(const tab of document.querySelectorAll("[data-position]")){
    const selected=tab.dataset.position===state.position;
    tab.classList.toggle("active",selected);
    tab.setAttribute("aria-selected",selected?"true":"false");
    tab.tabIndex=selected?0:-1;
  }
  const score=state.model==="v10_weather"?state.weather?.score_projection:
    report.score_projections?.[state.model];
  const validScore=score && Number.isFinite(score.away_score_mean)
    && Number.isFinite(score.home_score_mean)
    && Number.isFinite(score.home_win_probability);
  $("live-score-panel").hidden=!validScore;
  if(validScore){
    $("live-away-name").textContent=report.away;
    $("live-home-name").textContent=report.home;
    $("live-away-score").textContent=score.away_score_mean.toFixed(1);
    $("live-home-score").textContent=score.home_score_mean.toFixed(1);
    $("live-score-model").textContent=state.model==="v9"?"V9 BASELINE":state.model==="v10"?"V10 RESEARCH":state.model==="v10_fg"?"V10+FG RESEARCH":"V10+WEATHER EXPERIMENTAL";
    $("live-win-prob").textContent=report.home+" win probability: "+(score.home_win_probability*100).toFixed(1)+"%";
  }
  renderPlayers();
  renderWeather();
}
async function loadGame(id) {
  const choice=state.games.find(g=>g.game_id===id);
  if(!choice)return;
  const current=++state.loadToken;
  state.selected=choice;
  if(!state.forecastIds.has(id)) {
    state.game=null;state.weather=null;state.weatherLoading=false;state.weatherError="";
    render();
    return;
  }
  const endpoint="./data/games/"+encodeURIComponent(id)+".json";
  const response=await fetch(endpoint,{cache:"no-store"});
  if(!response.ok)throw Error("Could not fetch the frozen projection file.");
  const doc=await response.json();
  if(doc.game_id!==id || !doc.models || !BASE_MODELS.every(m=>Array.isArray(doc.models[m])))
    throw Error("The projection file did not pass basic schema checks.");
  if(!doc.cutoff_at||!doc.kickoff_at||new Date(doc.cutoff_at)>=new Date(doc.kickoff_at))
    throw Error("This forecast has an invalid pregame cutoff.");
  if(current!==state.loadToken)return;
  state.game=doc;
  state.weather=null;
  state.weatherError="";
  state.weatherLoading=true;
  render();
  try {
    const wx=await fetch("./data/weather/"+encodeURIComponent(id)+".json",{cache:"no-store"});
    if(current!==state.loadToken)return;
    if(wx.status===404){state.weatherError="No verified pre-kickoff weather model was published for this game.";}
    else if(!wx.ok){state.weatherError="Weather research feed is temporarily unavailable.";}
    else {
      const candidate=await wx.json();
      if(candidate.game_id!==id || candidate.type!==WEATHER_TYPE ||
         candidate.cutoff_at!==doc.cutoff_at || candidate.kickoff_at!==doc.kickoff_at ||
         candidate.draws_per_model!==10000 || !Array.isArray(candidate.players) ||
         !candidate.score_projection ||
         new Date(candidate.generated_at)>=new Date(doc.kickoff_at) ||
         new Date(candidate.weather_captured_at)>new Date(doc.cutoff_at)){
        state.weatherError="Weather model rejected: report does not match this frozen matchup.";
      }else state.weather=candidate;
    }
  }catch(e){if(current!==state.loadToken)return;state.weatherError="Weather research file could not be loaded.";}
  if(current===state.loadToken){state.weatherLoading=false;render();}
}
async function loadStadiums() {
  try {
    const response=await fetch("./data/stadiums.json",{cache:"no-store"});
    if(!response.ok)return;
    const data=await response.json();
    if(data.schema_version===1 && data.season===2026 && data.teams)
      state.stadiums=data;
  }catch(e){/* Roof reference is optional, never guessed. */}
  renderWeather();
}

async function refresh() {
  $("status-chip").textContent="CHECKING NFL GAMES";
  setMessage("");
  const errors=[];
  let archived=[],scheduled=[];
  try {
    const response=await fetch("./data/index.json",{cache:"no-store"});
    if(!response.ok)throw Error("verified forecast index unavailable");
    const list=await response.json();
    if(list.version!==1||!Array.isArray(list.games))throw Error("invalid forecast index");
    archived=list.games.filter(g=>/^\d{4}_\d{2}_[A-Z]{2,4}_[A-Z]{2,4}$/.test(g.game_id));
  }catch(err){errors.push("Verified forecast archive unavailable: "+err.message);}
  try {
    const response=await fetch("./data/schedule.json",{cache:"no-store"});
    if(!response.ok)throw Error("automatic schedule feed not yet published");
    const list=await response.json();
    if(list.version!==1||!Array.isArray(list.games)||!Number.isFinite(Date.parse(list.refreshed_at)))
      throw Error("invalid NFL schedule feed");
    scheduled=list.games.filter(g=>/^\d{4}_\d{2}_[A-Z]{2,4}_[A-Z]{2,4}$/.test(g.game_id) &&
      g.matchup===g.away+" @ "+g.home && Number.isFinite(Date.parse(g.kickoff_at)));
    if(Date.now()-Date.parse(list.refreshed_at)>36*60*60*1000)
      errors.push("Schedule verification is over 36 hours old; kickoff times may have changed.");
  }catch(err){errors.push("Automatic schedule unavailable: "+err.message);}
  state.forecastIds=new Set(archived.map(g=>g.game_id));
  const merged=new Map();
  for(const game of scheduled)merged.set(game.game_id,game);
  for(const game of archived)merged.set(game.game_id,game);
  const now=Date.now();
  state.games=[...merged.values()].sort((a,b)=>{
    const at=Date.parse(a.kickoff_at),bt=Date.parse(b.kickoff_at);
    const af=at>now,bf=bt>now;
    if(af!==bf)return af?-1:1;
    return af?at-bt:bt-at;
  });
  renderGameList();
  setMessage(errors.join(" "));
  if(!state.games.length){
    state.selected=null;state.game=null;state.weather=null;render();
    return;
  }
  try{await loadGame(selectedGameId());}
  catch(err){state.game=null;setMessage("Forecast file not usable: "+err.message);render();}
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
  if(id&&id!==state.selected?.game_id){try{await loadGame(id);}catch(e){setMessage(e.message);}}
});
loadStadiums();
refresh();
setInterval(()=>{if(!document.hidden)refresh();},5*60*1000);
