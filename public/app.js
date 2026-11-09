
(function(){
"use strict";
const $=id=>document.getElementById(id);
const page=$("page"),display=$("display"),startButton=$("start"),resetButton=$("reset"),modeButton=$("mode"),moreMenu=$("moreMenu");
const routeScreen=location.pathname.split("/").filter(Boolean)[0]||"timer";
const routeTitles={timer:"Cow Chalk Timer",more:"More",time:"Real Time",stopwatch:"Stopwatch",pirate:"Pirate Game"};
document.title=routeTitles[routeScreen]||"Cow Chalk Timer";
const embedded=window.self!==window.top;
function goRoute(screen){if(embedded){window.parent.location.href="/"+screen;return}location.href="/"+screen;}

const ICON_PLAY='<svg viewBox="0 0 50 50" aria-hidden="true"><polygon points="10,2 48,25 10,48" fill="#000"/></svg>';
const ICON_PAUSE='<svg viewBox="0 0 50 50" aria-hidden="true"><rect x="8" y="3" width="13" height="44" fill="#000"/><rect x="29" y="3" width="13" height="44" fill="#000"/></svg>';
const ICON_RESET='<svg viewBox="0 0 50 50" aria-hidden="true"><rect x="2" y="3" width="10" height="44" fill="#000"/><polygon points="48,3 48,47 16,25" fill="#000"/></svg>';
const ARROW='<svg viewBox="0 0 76 76" aria-hidden="true"><polygon points="38,2 74,72 2,72" fill="#050505" stroke="#050505" stroke-width="2" stroke-linejoin="round"/><polygon points="38,14 63,64 13,64" fill="url(#arrowGrad)"/></svg>';
if(resetButton)resetButton.innerHTML=ICON_RESET;
if(startButton)startButton.innerHTML=ICON_PLAY;

/* Tall slanted segments with pointed ends (like the real digits) */
const segmentPolys={
  a:"12,9 21,0 51,0 60,9 51,18 21,18",
  b:"63,12 72,21 72,68 63,77 54,68 54,21",
  c:"63,83 72,92 72,139 63,148 54,139 54,92",
  d:"12,151 21,142 51,142 60,151 51,160 21,160",
  e:"9,83 18,92 18,139 9,148 0,139 0,92",
  f:"9,12 18,21 18,68 9,77 0,68 0,21",
  g:"12,80 21,71 51,71 60,80 51,89 21,89"
};
const digitSegments={0:"abcdef",1:"bc",2:"abdeg",3:"abcdg",4:"bcfg",5:"acdfg",6:"acdefg",7:"abc",8:"abcdefg",9:"abcdfg"};
const digitSVG='<svg viewBox="-10 0 92 160" preserveAspectRatio="none" aria-hidden="true"><g transform="translate(9.8 0) skewX(-7)">'+
  Object.entries(segmentPolys).map(([k,p])=>'<polygon class="segment" data-segment="'+k+'" points="'+p+'"></polygon>').join("")+'</g></svg>';

/* Units: hours is one pair of digits with ONE pair of arrows; every other digit has its own. */
const units=[{first:0,count:2},{first:2,count:1},{first:3,count:1},{first:4,count:1},{first:5,count:1},{first:6,count:1},{first:7,count:1}];
const digits=[];
if(display)units.forEach(u=>{
  if([2,4,6].includes(u.first)){
    const sep=document.createElement("div");
    sep.className="separator"+(u.first===6?" decimal":"");
    sep.innerHTML=u.first===6?"<i></i>":"<i></i><i></i>";
    display.append(sep);
  }
  const unit=document.createElement("div");
  unit.className="unit"+(u.count===2?" wide":"");
  for(let k=0;k<u.count;k++){
    const d=document.createElement("div");d.className="digit";d.innerHTML=digitSVG;
    unit.append(d);digits[u.first+k]=d;
  }
  const up=document.createElement("button"),down=document.createElement("button");
  up.className="arrow up";down.className="arrow down";
  up.type=down.type="button";up.innerHTML=down.innerHTML=ARROW;
  up.setAttribute("aria-label","Increase");down.setAttribute("aria-label","Decrease");
  up.addEventListener("click",()=>adjust(u,1));down.addEventListener("click",()=>adjust(u,-1));
  unit.append(up,down);display.append(unit);
});

let values=[0,0,0,0,0,0,0,0],running=false,stopwatchMode=false,realTimeMode=false,remaining=0,elapsed=0,lastTick=0,timerId=0,clockId=0,audioContext=null,alarmAudio=null,alarmTimeout=0;

function render(){
  if(!display)return;
  digits.forEach((el,i)=>{const v=String(values[i]);el.querySelectorAll(".segment").forEach(s=>s.classList.toggle("on",digitSegments[v].includes(s.dataset.segment)))});
  display.setAttribute("aria-label",values.slice(0,2).join("")+" hours, "+values.slice(2,4).join("")+" minutes, "+values.slice(4,6).join("")+" seconds, "+values.slice(6,8).join("")+" hundredths");
}
function adjust(u,delta){
  if(running||stopwatchMode)return;
  if(u.count===2){let n=values[0]*10+values[1];n=(n+delta+100)%100;values[0]=Math.floor(n/10);values[1]=n%10}
  else values[u.first]=(values[u.first]+delta+10)%10;
  render();
}
function totalFromDigits(){return((values[0]*10+values[1])*3600+(values[2]*10+values[3])*60+(values[4]*10+values[5]))*1000+(values[6]*10+values[7])*10}
function setFromMilliseconds(ms){
  ms=Math.max(0,Math.min(359999990,Math.floor(ms)));
  const h=Math.floor(ms/3600000);ms%=3600000;
  const m=Math.floor(ms/60000);ms%=60000;
  const s=Math.floor(ms/1000);
  const c=Math.floor(ms%1000/10);
  values=(String(h).padStart(2,"0")+String(m).padStart(2,"0")+String(s).padStart(2,"0")+String(c).padStart(2,"0")).split("").map(Number);
  render();
}
function stopLoop(){running=false;clearInterval(timerId)}
function tick(){
  if(!running)return;
  const now=performance.now(),diff=now-lastTick;lastTick=now;
  if(stopwatchMode){elapsed+=diff;setFromMilliseconds(elapsed)}
  else{
    remaining-=diff;setFromMilliseconds(Math.max(0,remaining));
    if(remaining<=0){stopLoop();setRunningUI();ringAlarm()}
  }
}
function setRunningUI(){
  if(!startButton)return;
  startButton.innerHTML=running?ICON_PAUSE:ICON_PLAY;
  startButton.setAttribute("aria-label",running?"Pause":"Start");startButton.title=running?"Pause":"Start";
}
function startPause(){
  clearAlarm();
  if(running){stopLoop();setRunningUI();return}
  const total=totalFromDigits();
  if(stopwatchMode)elapsed=total;
  else{if(total<=0)return;remaining=total}
  running=true;lastTick=performance.now();setRunningUI();
  timerId=setInterval(tick,10);
}
function reset(){stopLoop();clearAlarm();remaining=0;elapsed=0;values=[0,0,0,0,0,0,0,0];setRunningUI();render()}
function toggleMode(){
  stopwatchMode=!stopwatchMode;
  realTimeMode=false;
  document.body.classList.remove("realtime-on");
  page.classList.toggle("stopwatch-on",stopwatchMode);
  modeButton.textContent="MORE";
  if(stopwatchMode&&showMoreButton.getAttribute("aria-expanded")==="true"){
    document.querySelectorAll(".sounds .opt").forEach((option,index)=>{if(index>=11)option.classList.add("hidden-sound")});
    showMoreButton.setAttribute("aria-expanded","false");
    showMoreButton.textContent="Show More";
  }
  reset();
}

/* ---------- sound ---------- */
function chosen(){return document.querySelector('input[name="alarm"]:checked').value}
function getAudio(){
  if(!audioContext)audioContext=new(window.AudioContext||window.webkitAudioContext)();
  if(audioContext.state==="suspended")audioContext.resume();
  return audioContext;
}
function fallbackMoo(){
  try{
    const ctx=getAudio(),t=ctx.currentTime,osc=ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    osc.type="sawtooth";osc.frequency.setValueAtTime(130,t);osc.frequency.exponentialRampToValueAtTime(80,t+1.2);
    filter.type="lowpass";filter.frequency.value=600;
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.2,t+.15);gain.gain.exponentialRampToValueAtTime(.0001,t+1.3);
    osc.connect(filter);filter.connect(gain);gain.connect(ctx.destination);osc.start(t);osc.stop(t+1.4);
  }catch(e){}
}
function ringAlarm(){
  clearAlarm();
  const choice=chosen();if(choice==="none")return;
  const audio=new Audio("https://raw.githubusercontent.com/MrMoo-213/cow-chalk/main/assets/sounds/"+choice);audio.loop=false;alarmAudio=audio;
  audio.play().catch(fallbackMoo);
  alarmTimeout=setTimeout(clearAlarm,15000);
}
function clearAlarm(){
  clearTimeout(alarmTimeout);
  if(alarmAudio){alarmAudio.pause();alarmAudio.currentTime=0;alarmAudio=null}
}
document.querySelectorAll('input[name="alarm"]').forEach(r=>r.addEventListener("change",()=>{
  clearAlarm();
  try{localStorage.setItem("cowChalkSound",r.value)}catch(e){}
}));
const showMoreButton=$("showMore");
if(showMoreButton)showMoreButton.addEventListener("click",()=>{
  const expanded=showMoreButton.getAttribute("aria-expanded")==="true";
  document.querySelectorAll(".sounds .opt").forEach((option,index)=>{if(index>=11)option.classList.toggle("hidden-sound",expanded)});
  showMoreButton.setAttribute("aria-expanded",String(!expanded));
  showMoreButton.textContent=expanded?"Show More":"Show Less";
});


if(startButton)startButton.addEventListener("click",startPause);
if(resetButton)resetButton.addEventListener("click",reset);
function showMenu(){goRoute("more")}
function hideMenu(){goRoute("timer")}
function showRealTime(){
  stopLoop();clearAlarm();realTimeMode=true;stopwatchMode=false;
  document.body.classList.add("realtime-on");page.classList.remove("stopwatch-on");
  modeButton.textContent="MORE";
  function updateClock(){
    const now=new Date();
    $("realDate").textContent=now.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
    const hours=String(now.getHours()).padStart(2,"0");
    const minutes=String(now.getMinutes()).padStart(2,"0");
    const seconds=String(now.getSeconds()).padStart(2,"0");
    const hundredths=String(Math.floor(now.getMilliseconds()/10)).padStart(2,"0");
    values=(hours+minutes+seconds+hundredths).split("").map(Number);
    render();
  }
  clearInterval(clockId);updateClock();clockId=setInterval(updateClock,10);
}
function selectOption(choice){
  if(choice==="pirate"){goRoute("pirate");return}
  if(choice==="realtime"){goRoute("time");return}
  if(choice==="stopwatch"){goRoute("stopwatch");return}
  goRoute("timer");
}
if(modeButton)modeButton.addEventListener("click",showMenu);
if(moreMenu){
  moreMenu.addEventListener("click",event=>{if(event.target===moreMenu)hideMenu();});
  moreMenu.querySelectorAll("[data-choice]").forEach(button=>button.addEventListener("click",()=>selectOption(button.dataset.choice)));
}
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&moreMenu&&!moreMenu.hidden)hideMenu();});

const pirateBoard=$("pirateBoard");
if(pirateBoard){
const piratePlayers=$("piratePlayers"),pirateTurn=$("pirateTurn"),pirateToast=$("pirateToast"),pirateBigPop=$("pirateBigPop");
let pirateNames=[],pirateMoves=[],pirateRedoMoves=[],pirateMarks={},pirateLastRemoved=null,piratePopTimer=0,piratePopFadeTimer=0,pirateSaves=[],activePirateSaveId=null,pirateEditingIndex=null;
const pirateLetters="ABCDEFG",pirateStorageKey="cowChalkPirateGame";
function pirateSnapshot(){return {names:[...pirateNames],moves:[...pirateMoves],redo:[...pirateRedoMoves],marks:{...pirateMarks},lastRemoved:pirateLastRemoved}}
function applyPirateSnapshot(data){
  pirateNames=Array.isArray(data.names)?data.names.filter(n=>typeof n==="string").slice(0,50):[];
  pirateMoves=Array.isArray(data.moves)?data.moves.slice(-5):[];
  pirateRedoMoves=Array.isArray(data.redo)?data.redo.slice(-5):[];
  pirateMarks=data.marks&&typeof data.marks==="object"?data.marks:{};
  pirateLastRemoved=typeof data.lastRemoved==="string"?data.lastRemoved:null;
}
function savePirateState(){
  if(!activePirateSaveId)return;
  try{
    const save=pirateSaves.find(item=>item.id===activePirateSaveId);
    if(!save)return;
    save.updatedAt=Date.now();save.state=pirateSnapshot();
    localStorage.setItem(pirateStorageKey,JSON.stringify({version:2,saves:pirateSaves,activeId:activePirateSaveId}));
  }catch(e){}
}
function loadPirateState(saveId){
  try{
    const data=JSON.parse(localStorage.getItem(pirateStorageKey)||"{}");
    if(Array.isArray(data.saves)){
      const cutoff=Date.now()-30*24*60*60*1000;
      pirateSaves=data.saves.filter(item=>{
        if(!item||typeof item.id!=="string"||!item.state)return false;
        const state=item.state,updated=item.updatedAt||item.createdAt||0;
        const blank=(!Array.isArray(state.names)||state.names.length===0)&&(!state.marks||Object.keys(state.marks).length===0);
        return updated>=cutoff&&!blank;
      }).sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0));
    }else if(Array.isArray(data.names)||data.marks){
      const now=Date.now(),id="save-"+now;
      const legacyState={names:data.names||[],moves:data.moves||[],redo:data.redo||[],marks:data.marks||{},lastRemoved:data.lastRemoved||null};
      const legacyBlank=legacyState.names.length===0&&Object.keys(legacyState.marks).length===0;
      pirateSaves=legacyBlank?[]:[{id,createdAt:now,updatedAt:now,state:legacyState}];
      localStorage.setItem(pirateStorageKey,JSON.stringify({version:2,saves:pirateSaves,activeId:null}));
    }else pirateSaves=[];
    localStorage.setItem(pirateStorageKey,JSON.stringify({version:2,saves:pirateSaves,activeId:data.activeId||null}));
    const selected=pirateSaves.find(item=>item.id===saveId);
    if(selected){activePirateSaveId=selected.id;applyPirateSnapshot(selected.state)}
    else{activePirateSaveId=null;applyPirateSnapshot({})}
  }catch(e){pirateSaves=[];activePirateSaveId=null;applyPirateSnapshot({})}
}
function createPirateSave(){
  const now=Date.now(),id="save-"+now+"-"+Math.random().toString(36).slice(2,7);
  const save={id,createdAt:now,updatedAt:now,state:pirateSnapshot()};
  pirateSaves.unshift(save);activePirateSaveId=id;
  try{localStorage.setItem(pirateStorageKey,JSON.stringify({version:2,saves:pirateSaves,activeId:activePirateSaveId}))}catch(e){}
}
function formatPirateSaveDate(timestamp){
  return new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(timestamp));
}
function renderPirateSaves(){
  const list=$("pirateSaveList");list.innerHTML="";
  const sorted=[...pirateSaves].sort((a,b)=>(b.updatedAt||b.createdAt)-(a.updatedAt||a.createdAt));
  if(!sorted.length){const empty=document.createElement("div");empty.className="pirate-save-empty";empty.textContent="No autosaves yet";list.append(empty);return}
  sorted.forEach((save,index)=>{
    const button=document.createElement("button");button.type="button";button.className="pirate-save-item";button.style.animationDelay=Math.min(index*.045,.4)+"s";
    const label=document.createElement("strong");label.textContent="Autosave: "+formatPirateSaveDate(save.updatedAt||save.createdAt);
    const detail=document.createElement("small");detail.textContent=(save.state.names||[]).length+" players · "+Object.keys(save.state.marks||{}).length+" squares";
    button.append(label,detail);button.addEventListener("click",()=>startPirateSave(save.id));list.append(button);
  });
}
let pirateIntroReadyTimer=0;
function setPirateIntroReady(delay=3900){clearTimeout(pirateIntroReadyTimer);$("pirateGame").classList.remove("pirate-intro-ready");pirateIntroReadyTimer=setTimeout(()=>$("pirateGame").classList.add("pirate-intro-ready"),delay)}
function showPirateIntro(quick=false){
  setPirateIntroReady(quick?450:3900);
  $("pirateGame").classList.add("pirate-intro-active");
  $("pirateGame").classList.remove("pirate-launching","pirate-returning");
  $("pirateSavePanel").hidden=true;$("pirateIntroActions").hidden=false;
  $("pirateIntroContent").classList.remove("pirate-load-view");
  renderPirateSaves();
}
function returnToPirateIntro(){
  if($("pirateGame").classList.contains("pirate-intro-active"))return;
  savePirateState();
  clearTimeout(piratePopTimer);clearTimeout(piratePopFadeTimer);
  pirateBigPop.hidden=true;pirateToast.hidden=true;
  $("pirateGame").classList.add("pirate-returning");
  setTimeout(()=>{
    $("pirateGame").classList.remove("pirate-returning");
    showPirateIntro(true);
    const animated=[$("pirateIntroContent").querySelector(".pirate-credits"),$("pirateIntroContent").querySelector(".pirate-intro-title"),$("pirateIntroContent").querySelector(".pirate-intro-subtitle"),$("pirateNewGame"),$("pirateLoadGame"),$("pirateIntroMore")];
    animated.forEach((element,index)=>{if(!element)return;element.style.animation="none";void element.offsetWidth;element.style.animation="";element.style.setProperty("animation-delay",["0s",".08s",".16s",".24s",".38s",".52s"][index],"important")});
  },680);
}
function startPirateSave(saveId){
  loadPirateState(saveId);
  $("pirateGame").classList.add("pirate-launching");
  $("pirateIntroActions").hidden=true;$("pirateSavePanel").hidden=true;
  setTimeout(()=>{
    $("pirateGame").classList.remove("pirate-intro-active","pirate-launching");
    renderPirate();if(pirateLastRemoved){$("pirateToastText").textContent=pirateLastRemoved+" was removed";pirateToast.hidden=false}
  },780);
}
function startNewPirateGame(){
  hidePirateToast();
  pirateNames=[];pirateMoves=[];pirateRedoMoves=[];pirateMarks={};pirateLastRemoved=null;
  clearTimeout(piratePopTimer);clearTimeout(piratePopFadeTimer);pirateBigPop.hidden=true;
  createPirateSave();startPirateSave(activePirateSaveId);
}
function openPirateSaveList(){
  $("pirateIntroActions").hidden=true;$("pirateSavePanel").hidden=false;
  $("pirateIntroContent").classList.add("pirate-load-view");renderPirateSaves();
}
function buildPirateBoard(){
  pirateBoard.innerHTML="";
  pirateBoard.append(document.createElement("div"));
  pirateLetters.split("").forEach(letter=>{const axis=document.createElement("div");axis.className="pirate-axis";axis.textContent=letter;pirateBoard.append(axis)});
  for(let row=1;row<=7;row++){
    const axis=document.createElement("div");axis.className="pirate-axis";axis.textContent=row;pirateBoard.append(axis);
    for(let col=0;col<7;col++){
      const coordinate=pirateLetters[col]+row,button=document.createElement("button");
      button.type="button";button.className="pirate-square";button.dataset.coordinate=coordinate;
      button.setAttribute("role","gridcell");button.setAttribute("aria-label",coordinate);
      button.addEventListener("click",()=>choosePirateSquare(coordinate));
      pirateBoard.append(button);
    }
  }
}
function updatePirateBoard(animateCoordinate=null){
  const latestCoordinate=pirateMoves.length?pirateMoves[pirateMoves.length-1].coordinate:null;
  pirateBoard.querySelectorAll(".pirate-square").forEach(button=>{
    const coordinate=button.dataset.coordinate,marked=!!pirateMarks[coordinate],wasMarked=button.classList.contains("marked");
    button.classList.toggle("marked",marked);button.classList.toggle("last-selected",coordinate===latestCoordinate);button.disabled=marked;
    button.setAttribute("aria-label",coordinate+(marked?", selected":""));
    if(marked&&!wasMarked){
      button.innerHTML='<svg class="pirate-cross" viewBox="0 0 100 100" aria-hidden="true"><path d="M13 13 L87 87 M87 13 L13 87"/></svg>';
      if(coordinate===animateCoordinate){button.classList.remove("just-marked");void button.offsetWidth;button.classList.add("just-marked")}
    }else if(!marked&&wasMarked){button.innerHTML="";button.classList.remove("just-marked")}
  });
}
function renderPirate(){
  updatePirateBoard();piratePlayers.innerHTML="";
  pirateNames.forEach((name,index)=>{
    const li=document.createElement("li");li.className="pirate-player";li.draggable=true;li.dataset.playerIndex=index;
    li.addEventListener("dragstart",event=>{if(event.target.closest("button")){event.preventDefault();return}event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",String(index));li.classList.add("dragging")});
    li.addEventListener("dragend",()=>li.classList.remove("dragging"));
    li.addEventListener("dragover",event=>{event.preventDefault();event.dataTransfer.dropEffect="move";li.classList.add("drag-over")});
    li.addEventListener("dragleave",()=>li.classList.remove("drag-over"));
    li.addEventListener("drop",event=>{event.preventDefault();li.classList.remove("drag-over");const from=Number(event.dataTransfer.getData("text/plain")),to=Number(li.dataset.playerIndex);if(!Number.isInteger(from)||from===to||from<0||from>=pirateNames.length)return;const moved=pirateNames.splice(from,1)[0];pirateNames.splice(to,0,moved);renderPirate();savePirateState()});
    const label=document.createElement("span");label.className="pirate-player-name";label.textContent=(index===0?"▶ ":"")+name;
    const actions=document.createElement("span");actions.className="pirate-player-actions";
    const edit=document.createElement("button");edit.type="button";edit.className="pirate-player-action";edit.setAttribute("aria-label","Edit "+name);edit.title="Edit name";edit.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5.5 4 4M4 20l4.2-.9L19 8.3a2.12 2.12 0 0 0-3-3L5.2 16.1 4 20Z"/></svg>';
    edit.addEventListener("click",()=>{pirateEditingIndex=index;const form=$("pirateAddForm");form.classList.add("open");$("pirateName").value=name;const submit=form.querySelector('[type="submit"]');if(submit)submit.textContent="Save";$("pirateName").focus()});
    const remove=document.createElement("button");remove.type="button";remove.className="pirate-player-action";remove.setAttribute("aria-label","Remove "+name);remove.title="Remove player";remove.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5"/></svg>';
    remove.addEventListener("click",()=>{pirateNames.splice(index,1);renderPirate();savePirateState()});
    actions.append(edit,remove);li.append(label,actions);piratePlayers.append(li);
  });
  pirateTurn.textContent=pirateNames.length?pirateNames[0]+" is choosing the next square":"";
  $("pirateUndo").classList.toggle("is-visible",pirateMoves.length>0);
  $("pirateRedo").classList.toggle("is-visible",pirateRedoMoves.length>0);
  $("pirateReset").classList.toggle("is-visible",pirateMoves.length>0||pirateNames.length>0);
}
function openPirateGame(quick=false){
  stopLoop();clearInterval(clockId);clearAlarm();
  document.body.classList.remove("realtime-on");document.body.classList.add("pirate-on");
  moreMenu.hidden=true;showPirateIntro(quick);
}
function closePirateGame(){goRoute("more")}
let pirateToastTimer=0;
function hidePirateToast(){clearTimeout(pirateToastTimer);pirateToast.classList.remove("fading");pirateToast.hidden=true;pirateLastRemoved=null;savePirateState()}
function showPirateToast(name){
  clearTimeout(pirateToastTimer);pirateToast.classList.remove("fading");
  $("pirateToastText").textContent=name+" was removed";
  pirateToast.hidden=false;pirateLastRemoved=name;savePirateState();
  pirateToastTimer=setTimeout(()=>{pirateToast.classList.add("fading");setTimeout(()=>{if(pirateToast.classList.contains("fading"))hidePirateToast()},450)},8550);
}
function showPiratePop(coordinate,duration=3000){
  clearTimeout(piratePopTimer);clearTimeout(piratePopFadeTimer);
  $("pirateBigCard").textContent=coordinate;
  pirateBigPop.hidden=false;pirateBigPop.classList.remove("fading");
  $("pirateBigCard").style.animation="none";void $("pirateBigCard").offsetWidth;$("pirateBigCard").style.animation="";
  piratePopTimer=setTimeout(()=>{pirateBigPop.classList.add("fading");piratePopFadeTimer=setTimeout(()=>{pirateBigPop.hidden=true;pirateBigPop.classList.remove("fading")},450)},duration+380);
}
function choosePirateSquare(coordinate){
  if(pirateMarks[coordinate])return;
  hidePirateToast();
  const before={marks:{...pirateMarks},players:[...pirateNames]},player=pirateNames.shift()||null;
  pirateMarks[coordinate]=true;
  pirateMoves.push({coordinate,player,before,after:{marks:{...pirateMarks},players:[...pirateNames]}});
  if(pirateMoves.length>5)pirateMoves.shift();
  pirateRedoMoves=[];
  updatePirateBoard(coordinate);renderPirate();
  if(player)showPirateToast(player);
  savePirateState();showPiratePop(coordinate);
}
function addPiratePlayer(name){
  name=name.trim().replace(/\s+/g," ").toLocaleLowerCase().replace(/(^|[\s'-])([a-z])/g,(match,prefix,letter)=>prefix+letter.toLocaleUpperCase());
  if(!name)return;
  if(pirateEditingIndex!==null){if(pirateEditingIndex<pirateNames.length)pirateNames[pirateEditingIndex]=name;pirateEditingIndex=null}else pirateNames.push(name);
  $("pirateName").value="";$("pirateAddForm").classList.remove("open");
  const submit=$("pirateAddForm").querySelector('[type="submit"]');if(submit)submit.textContent="Add";
  renderPirate();savePirateState();
}
function undoPirateMove(){
  if(!pirateMoves.length)return;
  hidePirateToast();clearTimeout(piratePopTimer);pirateBigPop.hidden=true;
  const move=pirateMoves.pop();pirateRedoMoves.push(move);
  pirateMarks={...move.before.marks};pirateNames=[...move.before.players];
  renderPirate();savePirateState();
}
function redoPirateMove(){
  if(!pirateRedoMoves.length)return;
  hidePirateToast();const move=pirateRedoMoves.pop();pirateMoves.push(move);
  pirateMarks={...move.after.marks};pirateNames=[...move.after.players];
  renderPirate();savePirateState();showPiratePop(move.coordinate,1000);
}
function flashPirateKey(key){
  const button=$("pirateKeyboard").querySelector('button[data-key="'+CSS.escape(key)+'"]');
  if(!button)return;
  button.classList.remove("pressed");
  void button.offsetWidth;
  button.classList.add("pressed");
  setTimeout(()=>button.classList.remove("pressed"),180);
}
function enterPirateKey(action){
  const input=$("pirateName"),value=input.value;
  if(action==="backspace")input.value=value.slice(0,-1);
  else if(action==="clear")input.value="";
  else if(action==="space"){if(value.length&&!value.endsWith(" "))input.value=value+" "}
  else if(value.length<24)input.value=value+action;
  input.dispatchEvent(new Event("input",{bubbles:true}));
}
$("pirateAddToggle").addEventListener("click",()=>{
  const form=$("pirateAddForm");form.classList.toggle("open");
  if(form.classList.contains("open")){pirateEditingIndex=null;$("pirateName").value="";const submit=form.querySelector('[type="submit"]');if(submit)submit.textContent="Add";$("pirateName").blur()}
});
$("pirateKeyboard").addEventListener("click",event=>{
  const key=event.target.closest("button[data-key]");if(!key)return;
  const action=key.dataset.key;
  flashPirateKey(action);
  enterPirateKey(action);
});
document.addEventListener("keydown",event=>{
  const form=$("pirateAddForm");
  if(!document.body.classList.contains("pirate-on")||!form.classList.contains("open")||event.ctrlKey||event.altKey||event.metaKey)return;
  const input=$("pirateName"),focused=document.activeElement===input;
  let action=null;
  if(event.key==="Backspace")action="backspace";
  else if(event.key===" ")action="space";
  else if(event.key==="Enter"){event.preventDefault();form.requestSubmit();return}
  else if(event.key.length===1&&/[a-z0-9]/i.test(event.key))action=event.key.toLowerCase();
  if(!action)return;
  flashPirateKey(action);
  if(!focused){event.preventDefault();enterPirateKey(action)}
});
$("pirateAddForm").addEventListener("submit",event=>{event.preventDefault();addPiratePlayer($("pirateName").value)});
$("pirateToastUndo").addEventListener("click",()=>{
  if(!pirateLastRemoved)return;
  pirateNames.unshift(pirateLastRemoved);hidePirateToast();renderPirate();savePirateState();
});
$("pirateUndo").addEventListener("click",undoPirateMove);
$("pirateRandom").addEventListener("click",()=>{const available=[];for(let row=1;row<=7;row++)for(const letter of pirateLetters){const coordinate=letter+row;if(!pirateMarks[coordinate])available.push(coordinate)}if(available.length)choosePirateSquare(available[Math.floor(Math.random()*available.length)])});
$("pirateRedo").addEventListener("click",redoPirateMove);
$("pirateReset").addEventListener("click",()=>{
  pirateMarks={};pirateMoves=[];pirateRedoMoves=[];pirateNames=[];pirateLastRemoved=null;hidePirateToast();clearTimeout(piratePopTimer);clearTimeout(piratePopFadeTimer);pirateBigPop.hidden=true;pirateBigPop.classList.remove("fading");renderPirate();savePirateState();
});
$("pirateBack").addEventListener("click",returnToPirateIntro);
$("pirateNewGame").addEventListener("click",startNewPirateGame);
$("pirateLoadGame").addEventListener("click",openPirateSaveList);
$("pirateLoadBack").addEventListener("click",()=>showPirateIntro(true));
$("pirateIntroMore").addEventListener("click",()=>{showMenu()});
loadPirateState();
window.addEventListener("pagehide",savePirateState);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")savePirateState()});
buildPirateBoard();
renderPirate();
if(pirateLastRemoved){$("pirateToastText").textContent=pirateLastRemoved+" was removed";pirateToast.hidden=false;}
if(routeScreen==="pirate")openPirateGame();
}
if(display)render();
try{
  const savedSound=localStorage.getItem("cowChalkSound");
  if(savedSound){
    const soundOption=document.querySelector('input[name="alarm"][value="'+CSS.escape(savedSound)+'"]');
    if(soundOption)soundOption.checked=true;
  }
  }catch(e){}
if(routeScreen==="more"&&moreMenu)moreMenu.hidden=false;
else if(routeScreen==="time"&&display)showRealTime();
else if(routeScreen==="stopwatch"&&display){stopwatchMode=true;page.classList.add("stopwatch-on")}

})();

;

(()=>{const grid=document.querySelector("#pirateGame>.pirate-grid-backdrop");if(grid&&!grid.children.length){const fragment=document.createDocumentFragment();for(let i=0;i<49;i++){const cell=document.createElement("div");cell.className="pirate-grid-cell";fragment.appendChild(cell)}grid.appendChild(fragment)}})();


document.documentElement.classList.add('route-ready');
