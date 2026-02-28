// Replit Assistant Clone — app.js (OpenRouter powered)
const OPENROUTER_API_KEY = "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";
const MODEL = "mistralai/mistral-7b-instruct:free";
const MODEL_FALLBACK = "liquid/lfm-2.5-1.2b-instruct:free";
const SITE_URL = "https://github.com/fypak-ai/replit-assistant-clone";
const SITE_NAME = "Replit Assistant Clone";

// ── State ─────────────────────────────────────────────────────────────────────
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
  chatHistory: [],
};

const EXT_ICON = {py:"🐍",js:"📜",ts:"📘",html:"🌐",css:"🎨",json:"📋",md:"📝",txt:"📄",sh:"⚙️"};
const icon = n => EXT_ICON[n.split(".").pop().toLowerCase()] || "📄";
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderFileTree();
  openTab(S.activeFile);
  setupListeners();
  appendMsg("assistant", "👋 Olá! Sou o **Replit Assistant** (powered by OpenRouter).\n\nPosso te ajudar com:\n• Propor mudanças em arquivos (Apply)\n• Executar comandos no shell\n• Instalar pacotes\n• Responder dúvidas de código\n• Redirecionar para Secrets ou Deploy quando necessário\n\nO que você quer fazer hoje?");
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

  const fp = document.getElementById("file-panel");
  const app = document.getElementById("app");
  if(tool==="files"){ fp.classList.toggle("hidden"); app.classList.toggle("show-files"); return; }

  document.querySelectorAll(".right-tab").forEach(t=>t.classList.add("hidden"));
  const panel = document.getElementById("panel-"+tool);
  if(panel) panel.classList.remove("hidden");
  S.activePanel = tool;
}

// ── Run ────────────────────────────────────────────────────────────────────────
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
  const re = /print\(["'`](.*?)["'`]\)/g; const out=[]; let m;
  while((m=re.exec(c))!==null) out.push(m[1]);
  return out.length ? out.join("\n") : "(Simulated — no print() found)";
}
function simJS(c){
  const re = /console\.log\(["'`](.*?)["'`]\)/g; const out=[]; let m;
  while((m=re.exec(c))!==null) out.push(m[1]);
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
  const s=document.createElement("span"); s.className="sline "+cls; s.textContent=txt;
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
    d.innerHTML='<span class="key">'+esc(k)+'</span><span class="val">••••••••</span><button onclick="delSecret(\''+esc(k)+'\')">×</button>';
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

// ── AI Chat (OpenRouter) ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Replit Assistant, an AI programming assistant embedded inside an online IDE called Replit.

Your role is to assist users with coding tasks. You MUST:
1. Focus on the user's request precisely, adhering to existing code patterns.
2. Propose file changes when asked to modify/create code.
3. Suggest shell commands when needed (installation, setup, etc.).
4. Answer coding questions with clear natural language responses.
5. Nudge users towards the Secrets tool for API keys/environment variables.
6. Nudge users towards the Deploy tool for publishing/deploying projects.

When proposing file changes, format your response as JSON at the end using this exact structure:
<ACTIONS>
[
  {"type":"file_edit","file":"filename.py","code":"full new content here","summary":"brief description"},
  {"type":"shell","cmd":"npm install express","summary":"Install express"},
  {"type":"package","pkg":"requests","summary":"Install requests"},
  {"type":"nudge","tool":"secrets","msg":"Use Secrets panel to store your API key"},
  {"type":"nudge","tool":"deploy","msg":"Use Deploy panel to publish your project"}
]
</ACTIONS>

Only include the <ACTIONS> block when you actually want to propose changes. The text before <ACTIONS> is your natural language explanation.`;

function buildContextMsg(userText){
  let content = userText;
  if(S.contextFile && S.files[S.contextFile]){
    content = "Current file context (" + S.contextFile + "):\n```\n" + S.files[S.contextFile] + "\n```\n\nUser question: " + userText;
  }
  return content;
}

async function callOpenRouter(messages, model) {
  model = model || MODEL;
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + OPENROUTER_API_KEY,
      "HTTP-Referer": "https://github.com/fypak-ai/replit-assistant-clone",
      "X-Title": "Replit Assistant Clone",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 1024,
    })
  });
  const rawText = await resp.text();
  if (!resp.ok) {
    // Try fallback model once
    if (model !== MODEL_FALLBACK) {
      console.warn("Model " + model + " failed (" + resp.status + "), trying fallback...");
      return callOpenRouter(messages, MODEL_FALLBACK);
    }
    throw new Error("HTTP " + resp.status + " — " + rawText.slice(0, 300));
  }
  let json;
  try { json = JSON.parse(rawText); } catch(e) { throw new Error("JSON parse error: " + rawText.slice(0, 200)); }
  if (!json.choices || !json.choices[0]) throw new Error("Resposta inesperada: " + JSON.stringify(json).slice(0, 200));
  return json.choices[0].message.content;
}

function parseActions(text){
  const match = text.match(/<ACTIONS>([\s\S]*?)<\/ACTIONS>/);
  if(!match) return { cleanText: text, actions: [] };
  let actions = [];
  try { actions = JSON.parse(match[1].trim()); } catch(e) { console.warn("Failed to parse actions:", e); }
  const cleanText = text.replace(/<ACTIONS>[\s\S]*?<\/ACTIONS>/, "").trim();
  return { cleanText, actions };
}

function setTyping(show){
  let el = document.getElementById("typing-indicator");
  if(show){
    if(!el){
      el = document.createElement("div");
      el.id = "typing-indicator";
      el.className = "msg assistant";
      el.innerHTML = '<div class="msg-role">Replit Assistant</div><div class="msg-body typing-dots"><span>.</span><span>.</span><span>.</span></div>';
      document.getElementById("chat-messages").appendChild(el);
      document.getElementById("chat-messages").scrollTop = 9999;
    }
  } else {
    if(el) el.remove();
  }
}

async function sendMsg(){
  const inp = document.getElementById("chat-input");
  const txt = inp.value.trim();
  if(!txt) return;
  inp.value = "";
  inp.disabled = true;
  document.getElementById("send-btn").disabled = true;

  appendMsg("user", txt);

  const userContent = buildContextMsg(txt);
  S.chatHistory.push({ role: "user", content: userContent });

  // Keep history bounded (last 10 exchanges)
  const historyWindow = S.chatHistory.slice(-20);
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...historyWindow
  ];

  setTyping(true);
  try {
    const raw = await callOpenRouter(messages);
    setTyping(false);
    const { cleanText, actions } = parseActions(raw);
    S.chatHistory.push({ role: "assistant", content: raw });
    appendMsg("assistant", cleanText, actions);
  } catch(err) {
    setTyping(false);
    const errMsg = "⚠️ Erro OpenRouter:\n" + err.message
      + "\n\nDicas:\n• Abra o Console do browser (F12) para ver detalhes\n• Verifique se está acessando via http://localhost e não file://\n• Modelo pode estar fora do ar — tente recarregar";
    appendMsg("assistant", errMsg);
    console.error("[OpenRouter Error]", err);
  } finally {
    inp.disabled = false;
    document.getElementById("send-btn").disabled = false;
    inp.focus();
  }
}

function appendMsg(role, text, actions){
  const c = document.getElementById("chat-messages");
  const wrap = document.createElement("div"); wrap.className = "msg " + role;
  const rl = document.createElement("div"); rl.className = "msg-role";
  rl.textContent = role === "user" ? "You" : "Replit Assistant";
  const body = document.createElement("div"); body.className = "msg-body";
  body.textContent = text;
  wrap.appendChild(rl); wrap.appendChild(body);
  if(actions && actions.length) actions.forEach(a => wrap.appendChild(buildCard(a)));
  c.appendChild(wrap); c.scrollTop = c.scrollHeight;
}

function buildCard(a){
  const card = document.createElement("div"); card.className = "proposed-action";
  const typeMap = { file_edit:["File Edit","file-edit"], shell:["Shell","shell"], package:["Package Install","package"], nudge:["Tool","nudge"] };
  const [badgeTxt, badgeCls] = typeMap[a.type] || ["Action","file-edit"];
  let pre = "";
  if(a.type==="file_edit") pre = (a.file||"?") + "\n" + (a.code||"");
  else if(a.type==="shell") pre = "$ " + (a.cmd||"");
  else if(a.type==="package") pre = "pip install " + (a.pkg||"");
  else pre = a.msg || "";
  card.innerHTML = '<div class="proposed-action-header"><div class="proposed-action-type"><span class="action-badge '+badgeCls+'">'+badgeTxt+'</span>'+(a.file?'<span style="font-size:12px;color:var(--muted)">'+esc(a.file)+'</span>':"")+(a.summary?'<span style="font-size:12px;color:var(--muted)">'+esc(a.summary)+'</span>':"")+' </div></div><pre>'+esc(pre)+'</pre><div class="action-buttons"><button class="btn-apply">Apply</button><button class="btn-dismiss">Dismiss</button></div>';
  card.querySelector(".btn-apply").onclick = () => applyCard(a, card);
  card.querySelector(".btn-dismiss").onclick = () => card.remove();
  return card;
}

function applyCard(a, card){
  if(a.type==="file_edit"){
    const t = a.file || S.activeFile;
    if(!S.files[t]) S.files[t] = "";
    S.files[t] = a.code || "";
    renderFileTree(); openTab(t);
    shellAppend("out", "Applied changes to " + t);
  } else if(a.type==="shell"){
    switchPanel("shell"); shellRun(a.cmd||"");
  } else if(a.type==="package"){
    switchPanel("shell"); shellRun("pip install " + (a.pkg||""));
  } else if(a.type==="nudge"){
    switchPanel(a.tool);
  }
  const btn = card.querySelector(".btn-apply");
  btn.textContent = "✓ Applied"; btn.disabled = true;
  card.querySelector(".btn-dismiss").style.display = "none";
}
