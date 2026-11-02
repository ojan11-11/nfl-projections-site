"use strict";
const LABEL={open_air:"Open-air",fixed_roof:"Fixed roof / covered",retractable:"Retractable roof"};
const POLICY={open_air:"Use dated pregame outdoor forecast",
              fixed_roof:"Outdoor weather impact set to zero in current research",
              retractable:"Require verified open/closed position; otherwise exclude"};
const $=id=>document.getElementById(id);
let entries=[];
const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=String(text);return e;};
function render(){
 const filter=$("roof-filter").value;
 const rows=entries.filter(x=>filter==="all"||filter===x.roof_type);
 const body=$("roof-table");body.replaceChildren();
 for(const team of rows){
  const tr=document.createElement("tr");
  for(const value of [team.team,team.name,LABEL[team.roof_type],POLICY[team.roof_type]]){
   tr.append(node("td",value));
  }
  body.append(tr);
 }
 $("roof-count").textContent=rows.length+" TEAM"+(rows.length!==1?"S":"");
}
async function load(){
 try {
  const resp=await fetch("./data/stadiums.json",{cache:"no-store"});
  if(!resp.ok)throw Error("Stadium roof reference temporarily unavailable");
  const d=await resp.json();
  if(d.schema_version!==1||d.season!==2026||Object.keys(d.teams||{}).length!==32)throw Error("Stadium registry schema incorrect");
  entries=Object.entries(d.teams).map(([team,value])=>({team,...value}));
  entries.sort((a,b)=>a.team.localeCompare(b.team));
  if(entries.some(x=>!LABEL[x.roof_type]))throw Error("Unknown roof type");
  render();
 }catch(e){$("roof-error").hidden=false;$("roof-error").textContent=e.message;}
}
$("roof-filter").addEventListener("change",render);
load();
