"use strict";
const $=id=>document.getElementById(id);
const POS=["QB","RB","WR","TE","K"];
const M=["v9","v10","v10_fg","v10_weather"];
const COL={
 QB:[["attempts","Pass att"],["completions","Comp"],["passing_yards","Pass yds"],["passing_tds","Pass TD"],["interceptions","INT"],["rushing_yards","Rush yds"],["rushing_tds","Rush TD"]],
 RB:[["carries","Carries"],["rushing_yards","Rush yds"],["rushing_tds","Rush TD"],["targets","Targets"],["receptions","Rec"],["receiving_yards","Rec yds"],["receiving_tds","Rec TD"]],
 WR:[["targets","Targets"],["receptions","Rec"],["receiving_yards","Rec yds"],["receiving_tds","Rec TD"]],
 TE:[["targets","Targets"],["receptions","Rec"],["receiving_yards","Rec yds"],["receiving_tds","Rec TD"]],
 K:[["fg_attempts","FG att"],["fg_made","FG made"],["pat_made","XP made"]]
};
const YARDS=new Set(["passing_yards","rushing_yards","receiving_yards"]);
const S={index:[],selected:null,isProspective:false,originalWeather:null,game:null,model:"v9",position:"QB",stadiums:null,weather:null,weatherLoading:false,weatherError:"",weatherModel:null,weatherModelLoading:false,weatherModelError:"",stormV2:null,gameRequestId:0};
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const clear=n=>n.replaceChildren();
const time=str=>new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(new Date(str));
function showError(msg){$("archive-notice").hidden=!msg;$("archive-notice").textContent=msg||"";}
function renderWeather(){
 if(!S.game)return;
 const status=$("history-weather-status");
 const container=$("history-weather-values");
 const roofNote=$("history-weather-roof-scenario");
 const source=$("history-weather-source");
 container.replaceChildren();container.hidden=true;
 roofNote.textContent="";
 source.textContent="";
 if(S.isProspective){
  const archived=S.originalWeather;
  if(!archived){
   status.hidden=false;
   status.textContent="This is a genuine, frozen pre-kickoff forecast. V9, V10 and V10+FG did not use weather; a separately validated V10+Weather snapshot is not available here.";
   return;
  }
  const wx=archived.weather;
  status.hidden=true;container.hidden=false;
  const fields=[
   ["Air temperature",Number(wx.temperature_f).toFixed(1)+"°F"],
   ["Wind",Number(wx.wind_mph).toFixed(1)+" mph"],
   ["Wind gusts",Number(wx.wind_gust_mph).toFixed(1)+" mph"],
   ["Precipitation",Number(wx.precipitation_in_hr).toFixed(2)+" in/hr"],
   ["Venue",wx.stadium],
   ["Roof",wx.roof],
   ["Weather forecast captured",time(archived.weather_captured_at)]
  ];
  for(const [key,value] of fields){
   const cell=el("div");cell.className="weather-cell";
   const label=el("span",key);label.className="weather-cell-label";
   const data=el("strong",value);data.className="weather-cell-value";
   cell.append(label,data);container.append(cell);
  }
  roofNote.textContent="Archived pre-kickoff venue and roof evidence used by experimental V10+Weather only.";
  source.textContent="Source: "+wx.forecast_source+". V10+Weather is experimental and not validated for betting accuracy.";
  return;
 }
 if(!S.weather){
  status.hidden=false;
  status.textContent=S.weatherLoading?"Checking for the archived model forecast available one hour before kickoff…":
   (S.weatherError||"No eligible archived as-of forecast found. No actual weather has been substituted.");
  return;
 }
 const d=S.weather, f=d.forecast, r=d.roof_scenario;
 status.hidden=true;container.hidden=false;
 const entries=[
  ["Air temperature",f.temperature_f.toFixed(1)+"°F"],
  ["Wind",f.wind_mph.toFixed(1)+" mph"],
  ["Wind gusts",f.gust_mph.toFixed(1)+" mph"],
  ["Rain",f.rain_in_per_hour.toFixed(2)+" in/hr"],
  ["Snowfall",f.snowfall_cm_per_hour.toFixed(2)+" cm/hr"],
  ["Total precipitation",f.precipitation_in_per_hour.toFixed(2)+" in/hr"],
  ["Venue",d.venue.name],
  ["Forecast valid for",time(f.forecast_valid_at)],
  ["As-of cutoff",time(d.as_of_at)],
  ["Model run initialized",time(d.model_run_initialized_at)],
  ["Assumed publicly available by",time(d.conservative_assumed_available_at)],
  ["Weather model",d.forecast_model]
 ];
 for(const [key,value] of entries){
  const cell=el("div");cell.className="weather-cell";
  const label=el("span",key);label.className="weather-cell-label";
  const valueEl=el("strong",value);valueEl.className="weather-cell-value";
  cell.append(label,valueEl);container.append(cell);
 }
 const scenario=r.assumed_state==="closed"?"ASSUMED ROOF CLOSED":
  r.assumed_state==="fixed_roof"?"FIXED ROOF / WEATHER SHELTERED":
  r.assumed_state==="open_air"?"OPEN-AIR / WEATHER EXPOSED":
  r.assumed_state==="fixed_canopy_open_sides"?"COVERED BUT OPEN-SIDED":
  "ROOF POSITION UNVERIFIED";
 roofNote.textContent="Roof scenario: "+scenario+". "+r.reason+
  ". Impact classification: "+r.direct_outdoor_weather_adjustment.replaceAll("_"," ")+
  ". Retractable positions are model assumptions, NOT independently confirmed.";
 source.textContent="Source: "+d.source+". The model run was initialized "+time(d.model_run_initialized_at)+
  " and assumed available by "+time(d.conservative_assumed_available_at)+
  " using a conservative 7-hour processing allowance. Its actual original release time is unverified; "+
  "archived run retrieved after the game. This forecast did NOT influence V9, V10 or V10+FG historical projections.";
}

function renderStormRisk(){
 const panel=$("history-v2-storm-panel");
 if(!panel)return;
 const report=S.stormV2;
 panel.hidden=!report;
 if(!report)return;
 const risk=$("history-v2-risk"),models=$("history-v2-models"),notes=$("history-v2-notes");
 risk.textContent="Archived game-window storm signal: "+report.risk_level.toUpperCase()+
  " · "+report.models_compared+" independent original model runs compared · "+
  report.trigger_labels.map(x=>x.replaceAll("_"," ")).join(", ")+
  ". This is not a calibrated chance of rain.";
 models.replaceChildren();
 for(const item of report.models){
  const card=el("div");card.className="weather-cell";
  const lines=[
   ["Original forecast model",item.model],
   ["Precipitation / 4-hour game",item.precip_4h_in.toFixed(3)+" in"],
   ["Rain / 4-hour game",item.rain_4h_in.toFixed(3)+" in"],
   ["Peak hourly precipitation",item.precip_peak_in_per_hour.toFixed(3)+" in"],
   ["Thunderstorm code",item.thunderstorm_weather_code?"Forecast indicated possible thunderstorm":"Not indicated"],
   ["Peak CAPE",Math.round(item.cape_peak_jkg)+" J/kg"],
   ["Max gust",item.gust_peak_mph.toFixed(1)+" mph"],
   ["Original model initialized",time(item.run_initialized_at)]
  ];
  for(const [key,value] of lines){
   const label=el("span",key);label.className="weather-cell-label";
   const val=el("strong",value);val.className="weather-cell-value";
   card.append(label,val);
  }
  models.append(card);
 }
 notes.textContent=report.unavailable_model+". "+report.note;
}

function render(){
 $("history-empty").hidden=!!S.game;
 $("history-forecast").hidden=!S.game;
 if(!S.game){
  const entry=S.selected;
  $("history-empty-heading").textContent=entry?
   "No verified pre-kickoff player forecast for this game.":
   "No completed games available yet.";
  $("history-empty-detail").textContent=entry?
   entry.matchup+" · "+time(entry.kickoff_at)+". The scoreboard confirms this game is final, but no original validated player forecast or audited retrospective replay has been published. No scores or projections will be invented.":
   "Games move here after the NFL scoreboard confirms final status.";
  return;
 }
 const d=S.game;
 $("history-week").textContent="WEEK "+d.week+(S.isProspective?
  " • ORIGINAL VERIFIED PRE-KICKOFF FORECAST":" • RECONSTRUCTED AFTER KICKOFF");
 $("history-title").textContent=d.away+" @ "+d.home;
 $("history-badge").textContent=S.isProspective?"FROZEN BEFORE KICKOFF":"RUN AFTER GAME";
 $("history-meta").textContent=S.isProspective?
  "Kickoff: "+time(d.kickoff_at)+"  •  Data frozen: "+time(d.cutoff_at)+"  •  "+
  d.draws_per_model.toLocaleString()+" draws/model  •  Original immutable pregame snapshot":
  "Kickoff: "+time(d.kickoff_at)+"  •  Replayed: "+time(d.replayed_at)+"  •  "+
  d.draws_per_model.toLocaleString()+" draws/model  •  Historical injury archive: "+d.official_inactive_evidence.replace(/_/g," ");
 const venue=S.stadiums?.teams?.[d.home];
 const label=venue ? ({
    open_air:"Open-air stadium",retractable:"Retractable roof — game-day position unverified",
    fixed_roof:"Fixed roof, dome, or skylight"
 }[venue.roof_type]||"Roof type unknown") : "";
 $("history-roof-reference").textContent=venue?
   "Usual "+d.home+" home venue: "+venue.name+" · "+label+
   ". Home stadium reference only, not a verified location/roof state for this historical replay." :
   "The game venue and roof condition were not verified for this historical replay.";
 for(const tab of document.querySelectorAll("[data-position]")){const ok=tab.dataset.position===S.position;tab.classList.toggle("active",ok);tab.setAttribute("aria-selected",ok?"true":"false");tab.tabIndex=ok?0:-1;}
 $("history-weather-model-banner").hidden=S.model!=="v10_weather" || S.isProspective;
 const score=S.model==="v10_weather"?S.weatherModel?.score_projection:d.score_projections?.[S.model];
 const validScore=score && Number.isFinite(score.away_score_mean)
   && Number.isFinite(score.home_score_mean)
   && Number.isFinite(score.home_win_probability);
 $("history-score-panel").hidden=!validScore;
 if(validScore){
  $("history-away-name").textContent=d.away;
  $("history-home-name").textContent=d.home;
  $("history-away-score").textContent=score.away_score_mean.toFixed(1);
  $("history-home-score").textContent=score.home_score_mean.toFixed(1);
  $("history-score-model").textContent=S.model==="v9"?"V9 BASELINE":S.model==="v10"?"V10 RESEARCH":S.model==="v10_fg"?"V10+FG RESEARCH":"V10+WEATHER RECONSTRUCTION";
  $("history-win-prob").textContent=d.home+" win probability: "+(score.home_win_probability*100).toFixed(1)+
   (S.isProspective?"% · Original pre-kickoff forecast":"% · Reconstructed after kickoff");
 }
 renderWeather();
 renderStormRisk();
 const set=(S.model==="v10_weather"?(S.weatherModel?.players||[]):(d.models[S.model]||[])).filter(p=>p.position===S.position);
 $("history-count").textContent=set.length+" players";
 $("history-position").textContent=({QB:"Quarterback",RB:"Running back",WR:"Wide receiver",TE:"Tight end",K:"Kicker"})[S.position]+" projections";
 const head=$("history-head"),body=$("history-body");clear(head);clear(body);
 const row=el("tr");
 for(const h of ["PLAYER","TEAM",...COL[S.position].map(x=>x[1])]){const th=el("th",h);th.scope="col";row.append(th);}head.append(row);
 const importance=p=>{const s=p.stats||{};const n=k=>Number(s[k]?.mean||0);return S.position==="QB"?n("attempts"):S.position==="RB"?n("carries")+n("targets"):S.position==="K"?n("fg_attempts"):n("targets");};
 set.sort((a,b)=> (a.team===d.away?0:1)-(b.team===d.away?0:1)||importance(b)-importance(a)||a.player.localeCompare(b.player));
 if(!set.length){const tr=el("tr"),td=el("td",S.model==="v10_weather"&&!S.weatherModel?(S.weatherModelLoading?"Checking the archived V10+Weather research simulation…":S.weatherModelError||"V10+Weather could not be reconstructed with verified archived inputs for this matchup."):"No projections for this position in the archived simulation.");td.colSpan=COL[S.position].length+2;tr.append(td);body.append(tr);return;}
 for(const p of set){const tr=el("tr"),player=el("td",p.player+(p.identity_status==="unconfirmed"?" (unconfirmed)":"")),team=el("td",p.team);player.className="player-name";team.className="team-label";tr.append(player,team);
 for(const [key] of COL[S.position]){const v=p.stats[key],td=el("td");if(v&&Number.isFinite(Number(v.mean))){td.append(el("span",Number(v.mean).toFixed(1)));if(YARDS.has(key)) {const rr=el("span"," ("+Math.round(v.p10)+"–"+Math.round(v.p90)+")");rr.className="range";td.append(rr);}}else{td.textContent="—";}tr.append(td);}body.append(tr);}
}
async function load(id){
 const entry=S.index.find(item=>item.game_id===id);
 if(!entry)throw Error("Historical matchup not indexed");
 const token=++S.gameRequestId;
 S.selected=entry;S.isProspective=entry.history_kind==="frozen";
 S.originalWeather=null;
 S.weather=null;S.weatherLoading=false;S.weatherError="";
 S.weatherModel=null;S.weatherModelLoading=false;S.weatherModelError="";
 S.stormV2=null;
 if(entry.history_kind==="missing"){
  S.game=null;render();return;
 }
 if(entry.history_kind==="frozen"){
  const r=await fetch("./data/games/"+encodeURIComponent(id)+".json",{cache:"no-store"});
  if(!r.ok)throw Error("Original verified pregame projection file unavailable");
  const frozen=await r.json();
  if(token!==S.gameRequestId)return;
  if(frozen.game_id!==id ||
     !["v9","v10","v10_fg"].every(model=>Array.isArray(frozen.models?.[model])) ||
     !Number.isFinite(Date.parse(frozen.cutoff_at)) ||
     !Number.isFinite(Date.parse(frozen.generated_at)) ||
     !(Date.parse(frozen.cutoff_at)<=Date.parse(frozen.generated_at) &&
       Date.parse(frozen.generated_at)<Date.parse(frozen.kickoff_at))) {
   throw Error("Original forecast failed frozen pre-kickoff validation");
  }
  S.game={...frozen,week:entry.week};
  S.weatherModelLoading=true;render();
  try{
   const weather=await fetch("./data/weather/"+encodeURIComponent(id)+".json",{cache:"no-store"});
   if(token!==S.gameRequestId)return;
   if(weather.ok){
    const doc=await weather.json();
    if(doc.game_id===id && doc.type==="experimental_weather_shadow_not_validated" &&
       doc.cutoff_at===frozen.cutoff_at && doc.kickoff_at===frozen.kickoff_at &&
       doc.draws_per_model===10000 && Array.isArray(doc.players) &&
       doc.score_projection && doc.weather &&
       Date.parse(doc.generated_at)<Date.parse(frozen.kickoff_at) &&
       Date.parse(doc.weather_captured_at)<=Date.parse(doc.cutoff_at)){
     S.weatherModel=doc;S.originalWeather=doc;
    }
   }
  }catch(e){/* No substitute forecasts. Original V10+Weather remains optional. */}
  if(token===S.gameRequestId){S.weatherModelLoading=false;render();}
  return;
 }
 const r=await fetch("./data/historical/"+encodeURIComponent(id)+".json",{cache:"no-store"});
 if(!r.ok)throw Error("Historical report unavailable");
 const d=await r.json();
 if(d.type!=="retrospective_pregame_style"||d.original_pregame_snapshot_verified!==false||!["v9","v10","v10_fg"].every(m=>Array.isArray(d.models?.[m])))throw Error("Unexpected research archive record");
 if(token!==S.gameRequestId)return;
 S.isProspective=false;
 S.game=d;S.weather=null;S.weatherLoading=true;S.weatherError="";S.weatherModel=null;S.weatherModelLoading=true;S.weatherModelError="";S.stormV2=null;render();
 try {
  const wx=await fetch("./data/historical_weather/"+encodeURIComponent(id)+".json",{cache:"no-store"});
  if(token!==S.gameRequestId)return;
  if(wx.status===404)S.weatherError="No eligible archived forecast available. The game venue, model run, or historic weather source may not have passed validation.";
  else if(!wx.ok)S.weatherError="Historical forecast archive is temporarily unavailable.";
  else {
   const data=await wx.json();
   if(data.game_id===id && data.type==="historical_asof_archived_model_forecast" &&
      data.original_replay_models_used_weather===false && data.model_run_publication_time_verified===false &&
      new Date(data.model_run_initialized_at)<new Date(data.as_of_at) &&
      new Date(data.as_of_at)<new Date(data.kickoff_at) && data.venue?.verified_matchup_venue===true){
      S.weather=data;
   }else S.weatherError="Archived forecast failed pregame provenance checks.";
  }
 }catch(e){if(token!==S.gameRequestId)return;S.weatherError="Could not load the archived forecast."}
 if(token===S.gameRequestId){S.weatherLoading=false;render();}
 try{
  const response=await fetch("./data/historical_weather_models/"+encodeURIComponent(id)+".json",{cache:"no-store"});
  if(token!==S.gameRequestId)return;
  if(response.status===404)S.weatherModelError="No V10+Weather reconstruction is available for this matchup. The roof could be unverified or the 10,000-draw run failed validation.";
  else if(!response.ok)S.weatherModelError="The archived V10+Weather research feed is temporarily unavailable.";
  else{
   const doc=await response.json();
   if(doc.type==="retrospective_v10_weather_replay_unvalidated" &&
      doc.game_id===id && doc.away===d.away && doc.home===d.home &&
      doc.forecast_issue_time_verified===false &&
      doc.historical_football_inputs_point_in_time_verified===false &&
      doc.draws_per_model===10000 && Array.isArray(doc.players) &&
      doc.players.length>1 && doc.score_projection &&
      doc.weather_asof_cutoff===S.weather?.as_of_at &&
      doc.original_forecast_run_initialized_at===S.weather?.model_run_initialized_at &&
      doc.disclaimer?.includes("RECONSTRUCTED AFTER THE GAME")){
     S.weatherModel=doc;
   }else S.weatherModelError="Weather simulation did not match this game's archived forecast or historical audit.";
  }
 }catch(e){if(token!==S.gameRequestId)return;S.weatherModelError="Unable to load experimental weather projections.";}
 if(token===S.gameRequestId){S.weatherModelLoading=false;render();}
 try{
  const resp=await fetch("./data/historical_weather_v2/"+encodeURIComponent(id)+".json",{cache:"no-store"});
  if(token!==S.gameRequestId)return;
  if(resp.ok){
   const alert=await resp.json();
   const cutoffOk=S.weather && new Date(alert.as_of_at).getTime()===
     new Date(S.weather.as_of_at).getTime();
   if(alert.type==="retrospective_pregame_multimodel_weather_diagnostic" &&
      alert.game_id===id && alert.weather_applied_to_current_historical_scores===false &&
      alert.original_publication_time_verified===false && alert.models_compared>=2 &&
      cutoffOk && Array.isArray(alert.models) && alert.models.length===alert.models_compared &&
      alert.models.every(m=>typeof m.source_sha256==="string" && m.source_sha256.length===64)){
    S.stormV2=alert;
   }
  }
 }catch(e){/* Optional v2 research unavailable; do not invent storm conditions */}
 if(token===S.gameRequestId)render();
}
async function loadStadiumRoofs() {
 try {
  const r=await fetch("./data/stadiums.json",{cache:"no-store"});
  if(!r.ok)return;
  const d=await r.json();
  if(d.schema_version===1&&d.season===2026&&d.teams)S.stadiums=d;
 }catch(e){/* Never infer or fabricate an unavailable roof. */}
 if(S.game)render();
}
async function readIndex(path, check){
 const response=await fetch(path,{cache:"no-store"});
 if(!response.ok)throw Error(path+" unavailable");
 const data=await response.json();
 if(!check(data))throw Error(path+" invalid");
 return data;
}
async function init(){
 try{
  const outcomes=await Promise.allSettled([
   readIndex("./data/historical/index.json",d=>
    d.type==="retrospective_pregame_style_not_prospective"&&Array.isArray(d.games)),
   readIndex("./data/schedule.json",d=>
    d.version===1&&Array.isArray(d.games)&&Number.isFinite(Date.parse(d.refreshed_at))),
   readIndex("./data/index.json",d=>d.version===1&&Array.isArray(d.games))
  ]);
  const warnings=[];
  for(const result of outcomes){if(result.status==="rejected")warnings.push(result.reason.message);}
  const historical=outcomes[0].status==="fulfilled"?outcomes[0].value.games:[];
  const schedule=outcomes[1].status==="fulfilled"?outcomes[1].value:null;
  const frozen=outcomes[2].status==="fulfilled"?outcomes[2].value.games:[];
  if(schedule && Date.now()-Date.parse(schedule.refreshed_at)>36*60*60*1000){
   warnings.push("Official-final checks are temporarily stale; recent games may not have moved yet.");
  }
  const genuine=new Map(frozen.map(g=>[g.game_id,g]));
  const indexed=new Map();
  for(const game of historical){
   if(/^\d{4}_\d{2}_[A-Z]{2,4}_[A-Z]{2,4}$/.test(game.game_id))
    indexed.set(game.game_id,{...game,history_kind:"replay"});
  }
  // Only the independently confirmed final state moves a game automatically.
  // Never turn an elapsed kickoff or an unverified report into a game result.
  for(const game of schedule?.games||[]){
   if(game.game_state!=="final")continue;
   if(!/^\d{4}_\d{2}_[A-Z]{2,4}_[A-Z]{2,4}$/.test(game.game_id))continue;
   const old=indexed.get(game.game_id);
   indexed.set(game.game_id,{
    ...game,history_kind:genuine.has(game.game_id)?"frozen":
      old?.history_kind==="replay"?"replay":"missing"
   });
  }
  S.index=[...indexed.values()].sort((a,b)=>
   Date.parse(b.kickoff_at)-Date.parse(a.kickoff_at)||a.game_id.localeCompare(b.game_id));
  const previous=S.selected?.game_id;
  const select=$("history-game");clear(select);
  for(const g of S.index){
   const kind=g.history_kind==="frozen"?"Verified pre-kickoff forecast":
    g.history_kind==="replay"?"Retrospective reconstruction":"No verified forecast";
   const opt=el("option","Week "+g.week+" | "+g.matchup+" | "+time(g.kickoff_at)+" | "+kind);
   opt.value=g.game_id;select.append(opt);
  }
  $("archive-status").textContent=
   S.index.length+" HISTORICAL GAMES · "+S.index.filter(g=>g.history_kind==="frozen").length+" ORIGINAL FORECASTS";
  showError(warnings.join(" "));
  if(!S.index.length){S.selected=null;S.game=null;render();return;}
  const chosen=S.index.find(g=>g.game_id===previous)||S.index[0];
  select.value=chosen.game_id;
  await load(chosen.game_id);
 }catch(e){showError("Historical games could not be loaded: "+e.message);S.game=null;render();}
}
$("history-game").addEventListener("change",async e=>{try{showError("");await load(e.target.value);}catch(err){showError(err.message);}});
$("history-model").addEventListener("change",e=>{if(M.includes(e.target.value)){S.model=e.target.value;render();}});
for(const tab of document.querySelectorAll("[data-position]"))tab.addEventListener("click",()=>{S.position=tab.dataset.position;render();});
loadStadiumRoofs();
init();
setInterval(()=>{if(!document.hidden)init();},5*60*1000);
