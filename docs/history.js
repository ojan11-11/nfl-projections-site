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
const S={index:[],game:null,model:"v9",position:"QB"};
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const clear=n=>n.replaceChildren();
const time=str=>new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(new Date(str));
function showError(msg){$("archive-notice").hidden=!msg;$("archive-notice").textContent=msg||"";}
function render(){
 $("history-empty").hidden=!!S.game;
 $("history-forecast").hidden=!S.game;
 if(!S.game)return;
 const d=S.game;
 $("history-week").textContent="WEEK "+d.week+" • RECONSTRUCTED AFTER KICKOFF";
 $("history-title").textContent=d.away+" @ "+d.home;
 $("history-meta").textContent="Kickoff: "+time(d.kickoff_at)+"  •  Replayed: "+time(d.replayed_at)+"  •  "+d.draws_per_model.toLocaleString()+" draws/model  •  Historical injury archive: "+d.official_inactive_evidence.replace(/_/g," ");
 for(const tab of document.querySelectorAll("[data-position]")){const ok=tab.dataset.position===S.position;tab.classList.toggle("active",ok);tab.setAttribute("aria-selected",ok?"true":"false");tab.tabIndex=ok?0:-1;}
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
 S.game=d;render();
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
init();
