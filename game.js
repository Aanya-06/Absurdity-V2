import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getAuth,signInAnonymously,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {getDatabase,ref,onValue,runTransaction,serverTimestamp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import {firebaseConfig} from "./firebase-config.js";
import {QUESTIONS} from "./questions.js";
const $=id=>document.getElementById(id);
const visible=(id,yes)=>$(id).classList.toggle("hidden",!yes);
let db,auth,uid,roomId,room,unsubscribe,clockHandle,busy=false;
const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>alphabet[b%alphabet.length]).join("");
const clean=s=>(s||"").trim().replace(/\s+/g," ");
const normalize=s=>clean(s).toLocaleLowerCase().replace(/[^\p{L}\p{N} ]/gu,"").trim();
const error=e=>{$("status").textContent=e?.message||String(e)};
const btn=(id,fn)=>$(id).addEventListener("click",()=>Promise.resolve(fn()).catch(error));
const roomRef=()=>ref(db,"rooms/"+roomId);
const playerName=()=>clean($("name").value).slice(0,24);
const keyOf=(obj)=>Object.keys(obj||{});
function persistName(){const name=playerName();if(!name)throw Error("Enter your name first.");sessionStorage.setItem("absurdityName",name);return name}
function setupRoom(id){
  roomId=id;sessionStorage.setItem("absurdityRoom",id);
  history.replaceState(null,"",location.pathname+"?room="+id);
  if(unsubscribe)unsubscribe();
  unsubscribe=onValue(roomRef(),snap=>{room=snap.val();if(!room){error("Room not found, or it has been deleted.");return}render()},error);
}
async function create(){
  if(busy)return;busy=true;
  try{
    const name=persistName();const code=randomCode();const r=ref(db,"rooms/"+code);
    const result=await runTransaction(r,current=>current===null?{
      host:uid,phase:"lobby",round:0,
      players:{[uid]:{name,score:0}},used:{},createdAt:Date.now()
    }:undefined,{applyLocally:false});
    if(!result.committed)throw Error("Room code collision. Please try again.");
    setupRoom(code);
  }finally{busy=false}
}
async function join(code){
  if(busy)return;busy=true;
  try{
    const name=persistName();code=clean(code).toUpperCase();
    if(!/^[A-Z2-9]{6}$/.test(code))throw Error("Enter a valid 6-character room code.");
    const r=ref(db,"rooms/"+code);
    let reason="Room does not exist or has already started.";
    const result=await runTransaction(r,v=>{
      if(!v||v.phase!=="lobby"){return}
      v.players ||= {};
      if(!v.players[uid]&&keyOf(v.players).length>=12){reason="Room is full (12 players).";return}
      v.players[uid]={name,score:v.players[uid]?.score||0};
      return v;
    },{applyLocally:false});
    if(!result.committed)throw Error(reason);
    setupRoom(code);
  }finally{busy=false}
}
function newRound(v){
  const used=v.used||{};let choices=QUESTIONS.map((_,i)=>i).filter(i=>!used[i]);
  if(!choices.length){v.used={};choices=QUESTIONS.map((_,i)=>i)}
  const index=choices[Math.floor(Math.random()*choices.length)];
  v.used[index]=true;v.questionIndex=index;v.round=(v.round||0)+1;
  v.answers={};v.phase="answering";v.deadline=null;
  return v;
}
async function start(){
  const res=await runTransaction(roomRef(),v=>{
    if(!v||v.host!==uid||v.phase!=="lobby"||keyOf(v.players).length<2)return;
    return newRound(v);
  },{applyLocally:false});
  if(!res.committed)throw Error("Only the host can start, with at least 2 players.");
}
async function submit(skip=false){
  const a=skip?"":clean($("answer").value);
  if(a.split(/\s+/).filter(Boolean).length>3)throw Error("Maximum 3 words per answer.");
  const res=await runTransaction(roomRef(),v=>{
    if(!v||v.phase!=="answering"||!v.players?.[uid]||v.answers?.[uid]!==undefined)return;
    
    v.answers ||= {};v.answers[uid]=a;return v;
  },{applyLocally:false});
  if(!res.committed)throw Error("Answer already locked or time is up.");
}
function reveal(v){
  if(v.phase!=="answering")return v;
  const ids=keyOf(v.players),answers=v.answers||{},counts={};
  ids.forEach(id=>{const a=normalize(answers[id]);if(a)counts[a]=(counts[a]||0)+1});
  ids.forEach(id=>{const a=normalize(answers[id]);if(a&&counts[a]===1)v.players[id].score=(v.players[id].score||0)+1});
  v.phase="reveal";v.winners=ids.filter(id=>v.players[id].score>=8);
  return v;
}
async function maybeReveal(){
  if(!room||room.phase!=="answering")return;
  if(keyOf(room.answers).length<keyOf(room.players).length)return;
  await runTransaction(roomRef(),v=>{
    if(!v||v.phase!=="answering")return;
    if(keyOf(v.answers).length<keyOf(v.players).length)return;
    return reveal(v);
  },{applyLocally:false});
}
async function next(){
  const res=await runTransaction(roomRef(),v=>{
    if(!v||v.host!==uid||v.phase!=="reveal"||v.winners?.length)return;
    return newRound(v);
  },{applyLocally:false});
  if(!res.committed)throw Error("Only the host can advance rounds.");
}
function render(){
  $("status").textContent="";
  const phase=room.phase,host=room.host===uid,ids=keyOf(room.players);
  visible("setup",false);visible("lobby",phase==="lobby");visible("game",phase!=="lobby");visible("board",phase!=="lobby");
  $("roomcode").textContent=roomId;
  $("invite").textContent=location.href;
  $("lobbyplayers").replaceChildren(...ids.map(id=>{const p=document.createElement("p");p.textContent=room.players[id].name+(id===room.host?" (host)":"");return p}));
  visible("start",host&&ids.length>=2);
  if(phase==="lobby")return;
  $("round").textContent="ROUND "+room.round;
  $("question").textContent=QUESTIONS[room.questionIndex]||"";
  const answered=Object.prototype.hasOwnProperty.call(room.answers||{},uid);
  visible("entry",phase==="answering"&&!answered);
  visible("locked",phase==="answering"&&answered);
  visible("results",phase==="reveal");
  $("scores").replaceChildren(...ids.sort((a,b)=>room.players[b].score-room.players[a].score).map(id=>{
    const div=document.createElement("div");div.className="score";
    const name=document.createElement("span"),score=document.createElement("b");
    name.textContent=room.players[id].name;score.textContent=room.players[id].score+" / 8";div.append(name,score);return div;
  }));
  if(phase==="reveal"){
    const answers=room.answers||{},counts={};
    ids.forEach(id=>{const a=normalize(answers[id]);if(a)counts[a]=(counts[a]||0)+1});
    $("answerlist").replaceChildren(...ids.map(id=>{
      const a=answers[id]||"",unique=a&&counts[normalize(a)]===1;
      const div=document.createElement("div");div.className="answer "+(unique?"good":"bad");
      const label=document.createElement("span"),point=document.createElement("b");
      label.textContent=room.players[id].name+" — "+(a||"(no answer)");point.textContent=unique?"+1":"0";
      div.append(label,point);return div;
    }));
    const winners=room.winners||[];
    $("resulttitle").textContent=winners.length?"🏆 "+winners.map(id=>room.players[id]?.name).join(" & ")+" wins!":"Round results";
    visible("next",host&&!winners.length);
  }
}
async function tick(){
  if(!room||room.phase!=="answering"){ $("clock").textContent="✓";return }
  $("clock").textContent=keyOf(room.answers).length+"/"+keyOf(room.players).length+" submitted";
  if(keyOf(room.answers).length===keyOf(room.players).length)await maybeReveal();
}
btn("create",create);btn("join",()=>join($("code").value));btn("start",start);
btn("submit",()=>submit(false));btn("skip",()=>submit(true));btn("next",next);
btn("share",async()=>{
  const url=location.href;
  if(navigator.share){try{await navigator.share({title:"Join my Absurdity game",url});return}catch{}}
  await navigator.clipboard.writeText(url);$("status").textContent="Invite link copied!";
});
$("answer").addEventListener("keydown",e=>{if(e.key==="Enter")submit().catch(error)});
$("name").value=sessionStorage.getItem("absurdityName")||"";
const urlRoom=new URLSearchParams(location.search).get("room");
if(urlRoom)$("code").value=urlRoom.toUpperCase();
try{
  if(firebaseConfig.apiKey==="PASTE_API_KEY")throw Error("Firebase is not configured yet. Edit firebase-config.js first.");
  const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getDatabase(app);
  await signInAnonymously(auth);uid=auth.currentUser.uid;
  if(urlRoom){
    if(sessionStorage.getItem("absurdityRoom")===urlRoom.toUpperCase()&&sessionStorage.getItem("absurdityName")){
      const id=urlRoom.toUpperCase();const snap=await runTransaction(ref(db,"rooms/"+id),v=>{
        if(v?.players?.[uid])return v;
        return;
      },{applyLocally:false});
      if(snap.committed)setupRoom(id);
    }
  }
  clockHandle=setInterval(()=>tick().catch(error),500);
}catch(e){error(e)}
