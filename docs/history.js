"use strict";
const $=id=>document.getElementById(id);
const POS=["QB","RB","WR","TE","K"];
const M=["v9","v10","v10_fg"];
const COL={
 QB:[["attempts","Pass att"],["completions","Comp"],["passing_yards","Pass yds"],["passing_tds","Pass TD"],["interceptions","INT"],["rushing_yards","Rush yds"],["rushing_tds","Rush TD"]],
 RB:[["carries","Carries"],["rushing_yards","Rush yds"],["rushing_tds","Rush TD"],["targets","Targets"],["receptions","Rec"],["receiving_yards","Rec yds"],["receiving_tds","Rec TD"]],
 WR:[["targets","Targets"],["receptions","Rec"],["receiving_yards","Rec yds"],["receiving_tds","Rec TD"]],
 TE:[["targets","Targets"],["receptions","Rec"],["receiving_yards","Rec yds"],["receiving_tds","Rec TD"]],
 K:[["fg_attempts","FG att"],["fg_made","FG made"],["pat_made","XP made"]]
};
const YARDS=new Set(["passing_yards","rushing_yards","receiving_yards"]);
const S={index:[],game:null,model:"v9",position:"QB",stadiums:null,weather:null,weatherLoading:false,weatherError:"",gameRequestId:0};
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

function render(){
 $("history-empty").hidden=!!S.game;
 $("history-forecast").hidden=!S.game;
 if(!S.game)return;
 const d=S.game;
 $("history-week").textContent="WEEK "+d.week+" • RECONSTRUCTED AFTER KICKOFF";
 $("history-title").textContent=d.away+" @ "+d.home;
 $("history-meta").textContent="Kickoff: "+time(d.kickoff_at)+"  •  Replayed: "+time(d.replayed_at)+"  •  "+d.draws_per_model.toLocaleString()+" draws/model  •  Historical injury archive: "+d.official_inactive_evidence.replace(/_/g," ");
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
 const score=d.score_projections?.[S.model];
 const validScore=score && Number.isFinite(score.away_score_mean)
   && Number.isFinite(score.home_score_mean)
   && Number.isFinite(score.home_win_probability);
 $("history-score-panel").hidden=!validScore;
 if(validScore){
  $("history-away-name").textContent=d.away;
  $("history-home-name").textContent=d.home;
  $("history-away-score").textContent=score.away_score_mean.toFixed(1);
  $("history-home-score").textContent=score.home_score_mean.toFixed(1);
  $("history-score-model").textContent=S.model==="v9"?"V9 BASELINE":S.model==="v10"?"V10 RESEARCH":"V10+FG RESEARCH";
  $("history-win-prob").textContent=d.home+" win probability: "+(score.home_win_probability*100).toFixed(1)+"% · Reconstructed after kickoff";
 }
 renderWeather();
 const set=(d.models[S.model]||[]).filter(p=>p.position===S.position);
 $("history-count").textContent=set.length+" players";
 $("history-position").textContent=({QB:"Quarterback",RB:"Running back",WR:"Wide receiver",TE:"Tight end",K:"Kicker"})[S.position]+" projections";
 const head=$("history-head"),body=$("history-body");clear(head);clear(body);
 const row=el("tr");
 for(const h of ["PLAYER","TEAM",...COL[S.position].map(x=>x[1])]){const th=el("th",h);th.scope="col";row.append(th);}head.append(row);
 const importance=p=>{const s=p.stats||{};const n=k=>Number(s[k]?.mean||0);return S.position==="QB"?n("attempts"):S.position==="RB"?n("carries")+n("targets"):S.position==="K"?n("fg_attempts"):n("targets");};
 set.sort((a,b)=> (a.team===d.away?0:1)-(b.team===d.away?0:1)||importance(b)-importance(a)||a.player.localeCompare(b.player));
 if(!set.length){const tr=el("tr"),td=el("td","No projections for this position in the archived simulation.");td.colSpan=COL[S.position].length+2;tr.append(td);body.append(tr);return;}
 for(const p of set){const tr=el("tr"),player=el("td",p.player+(p.identity_status==="unconfirmed"?" (unconfirmed)":"")),team=el("td",p.team);player.className="player-name";team.className="team-label";tr.append(player,team);
 for(const [key] of COL[S.position]){const v=p.stats[key],td=el("td");if(v&&Number.isFinite(Number(v.mean))){td.append(el("span",Number(v.mean).toFixed(1)));if(YARDS.has(key)) {const rr=el("span"," ("+Math.round(v.p10)+"–"+Math.round(v.p90)+")");rr.className="range";td.append(rr);}}else{td.textContent="—";}tr.append(td);}body.append(tr);}
}
async function load(id){
 const r=await fetch("./data/historical/"+encodeURIComponent(id)+".json",{cache:"no-store"});
 if(!r.ok)throw Error("Historical report unavailable");
 const d=await r.json();
 if(d.type!=="retrospective_pregame_style"||d.original_pregame_snapshot_verified!==false||!M.every(m=>Array.isArray(d.models?.[m])))throw Error("Unexpected research archive record");
 const token=++S.gameRequestId;
 S.game=d;S.weather=null;S.weatherLoading=true;S.weatherError="";render();
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
async function init(){
 try{
  const r=await fetch("./data/historical/index.json",{cache:"no-store"});
  if(!r.ok)throw Error("History index has not been published");
  const d=await r.json();
  if(d.type!=="retrospective_pregame_style_not_prospective"||!Array.isArray(d.games))throw Error("Invalid historical index");
  S.index=d.games;
  const select=$("history-game");clear(select);
  for(const g of S.index){const opt=el("option","Week "+g.week+" | "+g.matchup+" | "+time(g.kickoff_at));opt.value=g.game_id;select.append(opt);}
  $("archive-status").textContent=String(d.complete_replays)+" OF "+String(d.requested_games)+" REPLAYS";
  if(!S.index.length){S.game=null;render();return;}
  await load(S.index[0].game_id);
 }catch(e){showError(e.message);S.game=null;render();}
}
$("history-game").addEventListener("change",async e=>{try{showError("");await load(e.target.value);}catch(err){showError(err.message);}});
$("history-model").addEventListener("change",e=>{if(M.includes(e.target.value)){S.model=e.target.value;render();}});
for(const tab of document.querySelectorAll("[data-position]"))tab.addEventListener("click",()=>{S.position=tab.dataset.position;render();});
loadStadiumRoofs();
init();
