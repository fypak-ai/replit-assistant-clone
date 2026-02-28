// Replit Assistant Clone — app.js
// State
const S = {
  files: {
    "main.py": 'print("Hello, World!")\n',
    "index.html": '<!DOCTYPE html>\n<html>\n<head><title>App</title></head>\n<body>\n  <h1>Hello!</h1>\n</body>\n</html>\n',
    "style.css": 'body { font-family: sans-serif; margin: 40px; }\nh1 { color: #f26207; }\n',
  },
  activeFile: "main.py",
  openTabs: ["main.py"],
  activePanel: "assistant",
  secrets: {},
  contextFile: null,
};

const EXT_ICON = {py:"🐍",js:"📜",ts:"📘",html:"🌐",css:"🎨",json:"📋",md:"📝",txt:"📄",sh:"⚙️"};
const icon = n => EXT_ICON[n.split(".").pop().toLowerCase()] || "📄";

function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderFileTree();
  openTab(S.activeFile);
  setupListeners();
  appendMsg("assistant", "👋 Olá! Sou o **Replit Assistant**.\n\nPosso te ajudar com:\n• Propor mudanças em arquivos (Apply)\n• Executar comandos no shell\n• Instalar pacotes\n• Responder dúvidas de código\n• Redirecionar para Secrets ou Deploy quando necessário\n\nO que você quer fazer hoje?");
});

// ── File Tree ──────────────────────────────────────────────────────────────────
function renderFileTree(){
  const ul = document.getElementById("file-tree");
  ul.innerHTML = "";
  Object.keys(S.files).forEach(n => {
    const li = document.createElement("li");
    li.innerHTML = icon(n) + " " + n;
    if(n === S.activeFile) li.classList.add("active");
    li.onclick = () => openTab(n);
    ul.appendChild(li);
  });
}

// ── Tabs ───────────────────────────────────────────────────────────────────────
function openTab(n){
  if(!S.openTabs.includes(n)) S.openTabs.push(n);
  S.activeFile = n;
  renderTabs(); renderFileTree(); loadEditor(n);
}
function closeTab(n){
  saveEditorToState();
  const idx = S.openTabs.indexOf(n);
  if(idx === -1) return;
  S.openTabs.splice(idx, 1);
  if(!S.openTabs.length){ document.getElementById("editor").value = ""; document.getElementById("tabs-list").innerHTML = ""; S.activeFile = null; return; }
  openTab(S.openTabs[Math.max(0, idx-1)]);
}
function renderTabs(){
  const tl = document.getElementById("tabs-list");
  tl.innerHTML = "";
  S.openTabs.forEach(n => {
    const d = document.createElement("div");
    d.className = "tab" + (n===S.activeFile?" active":"");
    d.innerHTML = icon(n) + " " + n + ' <span class="close-tab" data-n="' + n + '">&times;</span>';
    d.onclick = e => { if(!e.target.classList.contains("close-tab")) openTab(n); };
    d.querySelector(".close-tab").onclick = e => { e.stopPropagation(); closeTab(n); };
    tl.appendChild(d);
  });
}
function loadEditor(n){
  const ed = document.getElementById("editor");
  ed.value = S.files[n] || "";
  updateLN();
}
function saveEditorToState(){
  if(S.activeFile) S.files[S.activeFile] = document.getElementById("editor").value;
}

// ── Line Numbers ───────────────────────────────────────────────────────────────
function updateLN(){
  const ed = document.getElementById("editor");
  const ln = document.getElementById("line-numbers");
  const n = ed.value.split("\n").length;
  ln.innerHTML = Array.from({length:n},(_,i)=>i+1).join("\n");
}

// ── Listeners ──────────────────────────────────────────────────────────────────
function setupListeners(){
  const ed = document.getElementById("editor");
  ed.oninput = () => { saveEditorToState(); updateLN(); };
  ed.onscroll = () => { document.getElementById("line-numbers").scrollTop = ed.scrollTop; };
  ed.onkeydown = e => {
    if(e.key==="Tab"){ e.preventDefault(); const s=ed.selectionStart; ed.value=ed.value.slice(0,s)+"  "+ed.value.slice(ed.selectionEnd); ed.selectionStart=ed.selectionEnd=s+2; }
  };

  document.getElementById("new-file-btn").onclick = () => {
    const n = prompt("File name:"); if(!n||!n.trim()) return;
    const fn = n.trim(); if(!S.files[fn]) S.files[fn] = "";
    renderFileTree(); openTab(fn);
  };

  document.querySelectorAll(".nav-btn").forEach(b => b.onclick = () => switchPanel(b.dataset.tool));
  document.getElementById("run-btn").onclick = runCode;

  document.getElementById("send-btn").onclick = sendMsg;
  document.getElementById("chat-input").onkeydown = e => { if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendMsg(); } };

  document.getElementById("attach-file-btn").onclick = () => {
    if(S.activeFile){ S.contextFile=S.activeFile; document.getElementById("context-filename").textContent=S.activeFile; document.getElementById("context-badge").classList.remove("hidden"); }
  };
  document.getElementById("remove-context").onclick = () => { S.contextFile=null; document.getElementById("context-badge").classList.add("hidden"); };

  document.getElementById("shell-input").onkeydown = e => { if(e.key==="Enter"){ shellRun(e.target.value); e.target.value=""; } };
  document.getElementById("clear-shell-btn").onclick = () => { document.getElementById("shell-output").innerHTML=""; };

  document.getElementById("add-secret-btn").onclick = addSecret;
  document.getElementById("deploy-btn").onclick = simulateDeploy;
}

// ── Panel Switch ───────────────────────────────────────────────────────────────
function switchPanel(tool){
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
  const btn = document.querySelector('.nav-btn[data-tool="'+tool+'"]');
  if(btn) btn.classList.add("active");

  // toggle file panel
  const fp = document.getElementById("file-panel");
  const app = document.getElementById("app");
  if(tool==="files"){ fp.classList.toggle("hidden"); app.classList.toggle("show-files"); return; }

  document.querySelectorAll(".right-tab").forEach(t=>t.classList.add("hidden"));
  const panel = document.getElementById("panel-"+tool);
  if(panel) panel.classList.remove("hidden");
  S.activePanel = tool;
}

// ── Run ───────────────────────────────────────────────────────────────────────
function runCode(){
  if(!S.activeFile) return;
  switchPanel("shell");
  const ext = S.activeFile.split(".").pop().toLowerCase();
  const code = S.files[S.activeFile]||"";
  shellAppend("cmd", "$ " + (ext==="py"?"python ":"node ") + S.activeFile);
  if(ext==="py") shellAppend("out", simPython(code));
  else if(ext==="js") shellAppend("out", simJS(code));
  else shellAppend("out", "[No runner for ."+ext+" files]");
}
function simPython(c){
  const re = /print\((['"\`])(.*?)\1\)/g; const out=[]; let m;
  while((m=re.exec(c))!==null) out.push(m[2]);
  return out.length ? out.join("\n") : "(Simulated — no print() found)";
}
function simJS(c){
  const re = /console\.log\((['"\`])(.*?)\1\)/g; const out=[]; let m;
  while((m=re.exec(c))!==null) out.push(m[2]);
  return out.length ? out.join("\n") : "(Simulated — no console.log() found)";
}

// ── Shell ─────────────────────────────────────────────────────────────────────
const CMDS = {
  ls:()=>Object.keys(S.files).join("  "),
  pwd:()=>"/home/runner/project",
  whoami:()=>"runner",
  date:()=>new Date().toString(),
  echo:a=>a.join(" "),
  clear:()=>{ document.getElementById("shell-output").innerHTML=""; return null; },
  cat:a=>{ const f=a[0]; return f&&S.files[f]!==undefined?S.files[f]:"cat: "+f+": No such file"; },
  python:a=>a[0]&&S.files[a[0]]?simPython(S.files[a[0]]):"Python 3.11 (simulated)",
  node:a=>a[0]&&S.files[a[0]]?simJS(S.files[a[0]]):"Node.js v20 (simulated)",
  pip:()=>"Requirement already satisfied (simulated)",
  npm:()=>"npm install complete (simulated)",
  help:()=>"Commands: ls, pwd, whoami, date, echo, cat, clear, python, node, pip, npm",
};
function shellRun(raw){
  if(!raw.trim()) return;
  const [cmd,...args] = raw.trim().split(/\s+/);
  shellAppend("cmd","$ "+raw);
  const handler=CMDS[cmd];
  const res=handler?handler(args):cmd+": command not found. Type 'help'.";
  if(res!==null&&res!==undefined) shellAppend(res.includes("not found")||res.includes("No such")?"err":"out", String(res));
}
function shellAppend(cls, txt){
  const out=document.getElementById("shell-output");
  const s=document.createElement("span");
  s.className="sline "+cls;
  s.textContent=txt;
  out.appendChild(s); out.appendChild(document.createElement("br"));
  out.scrollTop=out.scrollHeight;
}

// ── Secrets ───────────────────────────────────────────────────────────────────
function addSecret(){
  const k=document.getElementById("secret-key").value.trim();
  const v=document.getElementById("secret-value").value.trim();
  if(!k||!v) return;
  S.secrets[k]=v;
  document.getElementById("secret-key").value="";
  document.getElementById("secret-value").value="";
  renderSecrets();
}
function renderSecrets(){
  const list=document.getElementById("secrets-list");
  list.innerHTML="";
  Object.entries(S.secrets).forEach(([k])=>{
    const d=document.createElement("div"); d.className="secret-item";
    d.innerHTML='<span class="key">'+esc(k)+'</span><span class="val">••••••••</span><button onclick="delSecret(''+esc(k)+'')">×</button>';
    list.appendChild(d);
  });
}
function delSecret(k){ delete S.secrets[k]; renderSecrets(); }

// ── Deploy ────────────────────────────────────────────────────────────────────
function simulateDeploy(){
  const dot=document.getElementById("deploy-dot");
  const txt=document.getElementById("deploy-status-text");
  const log=document.getElementById("deploy-log");
  document.getElementById("deploy-btn").disabled=true;
  dot.className="status-dot deploying"; txt.textContent="Deploying..."; log.textContent="";
  const steps=["[1/4] Building project...","[2/4] Running tests...","[3/4] Packaging artifacts...","[4/4] Deploying to edge network...","✓ Deployed! https://replit-assistant-clone.fypak-ai.repl.co"];
  let i=0;
  const iv=setInterval(()=>{
    if(i<steps.length){ log.textContent+=steps[i++]+"\n"; }
    else{ clearInterval(iv); dot.className="status-dot live"; txt.textContent="Live"; document.getElementById("deploy-btn").disabled=false; }
  },600);
}

// ── AI Chat ───────────────────────────────────────────────────────────────────
function sendMsg(){
  const inp=document.getElementById("chat-input");
  const txt=inp.value.trim(); if(!txt) return;
  inp.value="";
  appendMsg("user", txt);
  setTimeout(()=>{
    const r=genResponse(txt, S.contextFile);
    appendMsg("assistant", r.text, r.actions);
  },350);
}

function appendMsg(role, text, actions){
  const c=document.getElementById("chat-messages");
  const wrap=document.createElement("div"); wrap.className="msg "+role;
  const rl=document.createElement("div"); rl.className="msg-role";
  rl.textContent=role==="user"?"You":"Replit Assistant";
  const body=document.createElement("div"); body.className="msg-body";
  body.textContent=text;
  wrap.appendChild(rl); wrap.appendChild(body);
  if(actions&&actions.length) actions.forEach(a=>wrap.appendChild(buildCard(a)));
  c.appendChild(wrap); c.scrollTop=c.scrollHeight;
}

function buildCard(a){
  const card=document.createElement("div"); card.className="proposed-action";
  const typeMap={file_edit:["File Edit","file-edit"],shell:["Shell","shell"],package:["Package Install","package"],nudge:["Tool","nudge"]};
  const [badgeTxt,badgeCls]=typeMap[a.type]||["Action","file-edit"];
  let pre="";
  if(a.type==="file_edit") pre=(a.file||"?")+"\n"+a.code;
  else if(a.type==="shell") pre="$ "+a.cmd;
  else if(a.type==="package") pre="pip install "+a.pkg;
  else pre=a.msg||"";
  card.innerHTML='<div class="proposed-action-header"><div class="proposed-action-type"><span class="action-badge '+badgeCls+'">'+badgeTxt+'</span>'+(a.file?'<span style="font-size:12px;color:var(--muted)">'+esc(a.file)+'</span>':"")+'</div></div><pre>'+esc(pre)+'</pre><div class="action-buttons"><button class="btn-apply">Apply</button><button class="btn-dismiss">Dismiss</button></div>';
  card.querySelector(".btn-apply").onclick=()=>applyCard(a,card);
  card.querySelector(".btn-dismiss").onclick=()=>card.remove();
  return card;
}

function applyCard(a,card){
  if(a.type==="file_edit"){
    const t=a.file||S.activeFile;
    if(!S.files[t]) S.files[t]="";
    S.files[t]=a.code;
    renderFileTree(); openTab(t);
    shellAppend("out","Applied changes to "+t);
  } else if(a.type==="shell"){
    switchPanel("shell"); shellRun(a.cmd);
  } else if(a.type==="package"){
    switchPanel("shell"); shellRun("pip install "+a.pkg);
  } else if(a.type==="nudge"){
    switchPanel(a.tool);
  }
  const btn=card.querySelector(".btn-apply");
  btn.textContent="✓ Applied"; btn.disabled=true;
  card.querySelector(".btn-dismiss").style.display="none";
}

// ── Response Engine ────────────────────────────────────────────────────────────
function genResponse(txt, ctxFile){
  const lo=txt.toLowerCase();

  if(/api.?key|secret|env|environment|openai|openrouter/i.test(txt))
    return {text:"Para configurar API keys e segredos, use a ferramenta Secrets — é o lugar seguro para variáveis de ambiente.", actions:[{type:"nudge",tool:"secrets",msg:"Abra o painel Secrets para adicionar sua chave."}]};

  if(/deploy|publish|produção|production|publicar|live/i.test(txt))
    return {text:"Para publicar seu projeto, use a ferramenta Deploy.", actions:[{type:"nudge",tool:"deploy",msg:"Abra o painel Deploy."}]};

  const installM=txt.match(/install\s+([\w\-]+)/i)||txt.match(/instalar\s+([\w\-]+)/i);
  if(installM) return {text:"Instalando o pacote `"+installM[1]+"`.", actions:[{type:"package",pkg:installM[1]}]};

  if(/add.*(function|método|def|class|classe)/i.test(txt)||/create.*function/i.test(txt)){
    const f=ctxFile||S.activeFile||"main.py";
    const ext=f.split(".").pop();
    let code=S.files[f]||"";
    if(ext==="py") code+="\ndef nova_funcao():\n    pass\n";
    else code+="\nfunction novaFuncao() {\n  // TODO\n}\n";
    return {text:"Adicionei uma nova função em `"+f+"`.", actions:[{type:"file_edit",file:f,code}]};
  }

  if(/hello world|ola mundo/i.test(txt)){
    const f=ctxFile||S.activeFile||"main.py";
    const ext=f.split(".").pop();
    let code="";
    if(ext==="py") code='print("Hello, World!")\n';
    else if(ext==="js") code='console.log("Hello, World!");\n';
    else if(ext==="html") code='<!DOCTYPE html>\n<html>\n<body>\n<h1>Hello, World!</h1>\n</body>\n</html>\n';
    else code="Hello, World!";
    return {text:"Aqui está um Hello World para `"+f+"`:", actions:[{type:"file_edit",file:f,code}]};
  }

  if(/run|rodar|executar|execute/i.test(txt))
    return {text:"Clique no botão Run (verde, parte superior) para executar o arquivo ativo. No Shell você pode rodar `python main.py` manualmente.", actions:[]};

  const newF=txt.match(/cri[ae].*?([a-z_\-]+\.[a-z]+)/i)||txt.match(/new file.*?([a-z_\-]+\.[a-z]+)/i);
  if(newF){ const fn=newF[1]; if(!S.files[fn]) S.files[fn]=""; renderFileTree(); openTab(fn); return {text:"Arquivo `"+fn+"` criado.", actions:[]}; }

  if(/como|o que|explain|what is/i.test(txt)) return {text:quickAnswer(txt), actions:[]};

  return {text:"Entendido! Me dê mais detalhes sobre o que quer implementar e posso propor mudanças nos arquivos diretamente.", actions:[]};
}

function quickAnswer(txt){
  if(/map|filter|reduce/i.test(txt)) return "map/filter/reduce são funções de alta ordem.\n\nExemplo Python:\nresult = list(map(lambda x: x*2, [1,2,3]))\n# [2, 4, 6]";
  if(/lambda/i.test(txt)) return "Lambda é uma função anônima de uma linha.\nPython: f = lambda x: x * 2\nJS: const f = x => x * 2";
  if(/async|await/i.test(txt)) return "async/await é syntactic sugar sobre Promises.\nasync function fetch() {\n  const r = await api.get(url);\n  return r.json();\n}";
  if(/list.*comprehension/i.test(txt)) return "List comprehension Python:\nquadrados = [x**2 for x in range(10)]";
  return "Boa pergunta! Mostre o código relevante e posso sugerir mudanças nos arquivos.";
}
