(() => {
/* Theme toggle */
const root = document.documentElement;
const saved = localStorage.getItem("theme");
if (saved) root.setAttribute("data-theme", saved);
document.getElementById("themeToggle").addEventListener("click", () => {
const curr = root.getAttribute("data-theme");
const next = curr === "dark" ? "light" : "dark";
root.setAttribute("data-theme", next);
localStorage.setItem("theme", next);
});

/* Data helpers */
const RAW = JSON.parse(document.getElementById("games-json").textContent);
const slugify = s => s.toLowerCase()
.replace(/[:’'"]/g,"")
.replace(/&/g,"and")
.replace(/[^a-z0-9]+/g,"-")
.replace(/(^-|-$)/g,"");
const qp = n => new URL(location.href).searchParams.get(n)||"";
const basePath = () => location.pathname.replace(/\/index\.html$/,"").replace(/\/$/,"");
const rulebookUrl = s => `${basePath()}/rulebooks/${s}.pdf`;
const remindersUrl = s => `${basePath()}/reminders/${s}.html`;
const coverUrl = s => `${basePath()}/covers/${s}.webp`; // we'll fall back to .jpg at runtime
const BGSTATS_ID_PREFIX = "bgstats://app.bgstatsapp.com/addPlay.html?gameId=";
const extractBggId = s => String(s||"").match(/(\d{2,})/)?.[1] || "";

/* Build data */
const DATA = {};
(RAW.names||[]).forEach(n=>{
const slug = slugify(n);
DATA[slug] = { name:n, slug, ...(RAW.enrich?.[slug]||{}) };
});

const $app = document.getElementById("app");

/* List item */
function listRow(g){
const sub=[g.players,g.time?`${g.time} min`:null,g.year].filter(Boolean).join(" • ");
return `<a class="card" href="#/game/${g.slug}">
<div class="thumb">
<img loading="lazy" src="${coverUrl(g.slug)}"
style="width:100%;height:100%;object-fit:contain"
onerror="this.onerror=null;this.src=this.src.replace('.webp','.jpg')">
</div>
<div class="metaWrap"><h2>${g.name}</h2><p class="sub">${sub}</p></div>
</a>`;
}

function renderList(f=""){
f=f.toLowerCase();
const games=Object.values(DATA)
.filter(g=>!f||g.name.toLowerCase().includes(f))
.sort((a,b)=>a.name.localeCompare(b.name));
$app.innerHTML=`<input id="search" placeholder="Search your collection…" aria-label="Search games" value="${f.replace(/"/g,'&quot;')}">
<section class="grid">${games.map(listRow).join("")}</section>`;
document.getElementById("search").addEventListener("input",e=>renderList(e.target.value));
}

function renderDetail(slug,action="quicksetup"){
const g=DATA[slug];
if(!g){ $app.innerHTML=`<div class='detail'><p>Game not found: <code>${slug}</code></p></div>`; return; }

const sub=[g.players,g.time?`${g.time} min`:null,g.year].filter(Boolean).join(" • ");
const links={
youtube: g.youtube || "",
bgstats: g.bggId ? `${BGSTATS_ID_PREFIX}${extractBggId(g.bggId)}` : "",
reminders: g.reminders || remindersUrl(slug),
rulebook: g.rulebook || rulebookUrl(slug),
cover: coverUrl(slug)
};

$app.innerHTML = `
<article class="detail">
<div class="cover">
<img src="${links.cover}" alt=""
onerror="this.onerror=null;this.src=this.src.replace('.webp','.jpg')">
</div>
<div>
<h2 class="title">${g.name}</h2>
<p class="byline">${sub || ""}</p>

<div class="actions">
${links.youtube
? `<a class="btnlink" id="btn-youtube" href="${links.youtube}" target="_blank" rel="noopener">▶️ How-to-Play</a>`
: `<a class="btnlink" id="btn-youtube" aria-pressed="false" aria-disabled="true" role="button">▶️ How-to-Play</a>`}

<button class="btn" id="btn-quick" aria-pressed="false">Quick Setup</button>

${links.bgstats
? `<a class="btnlink" href="${links.bgstats}">BG Stats — Log a Play</a>`
: `<a class="btnlink" aria-pressed="false" aria-disabled="true" role="button">BG Stats — Log a Play</a>`}

<a class="btnlink" href="${links.reminders}" target="_blank" rel="noopener">Quick Reminders</a>
<a class="btnlink" href="${links.rulebook}" target="_blank" rel="noopener">Open Rulebook (PDF)</a>

<button class="btn" id="share">Share / Copy Link</button>

<section id="qs" class="qs">
<pre>${(g.quickStart||"").trim()||"(No quick setup yet.)"}</pre>
</section>
</div>
</div>
</article>
<footer>Rulebook path: <code>${links.rulebook}</code></footer>`;

const qs = document.getElementById("qs");
const quickBtn = document.getElementById("btn-quick");

const setQuickSelected = (on) => {
quickBtn.setAttribute("aria-pressed", on ? "true" : "false");
};

// Toggle Quick Setup panel + selected state (turns blue only when selected)
quickBtn.addEventListener("click", () => {
qs.classList.toggle("open");
setQuickSelected(qs.classList.contains("open"));
});

// Share / copy link
document.getElementById("share").addEventListener("click", async () => {
const u = location.href;
try {
if (navigator.share) {
await navigator.share({title:g.name, text:`Quick Menu — ${g.name}`, url:u});
return;
}
} catch(_) {}
try { await navigator.clipboard.writeText(u); alert("Link copied"); }
catch(_) { prompt("Copy link:", u); }
});

// Default behavior: open Quick Setup immediately and mark selected
if (action === "quicksetup" || !action) {
qs.classList.add("open");
setQuickSelected(true);
} else if (action === "youtube" && links.youtube) {
document.getElementById("btn-youtube").click();
}
}

/* Routing */
function normalizeIncoming(){
const q = qp("game");
if (q){
const want = q.trim();
const slug = (DATA[want.toLowerCase()] ? want.toLowerCase() : slugify(want));
const a = (qp("action")||"quicksetup").toLowerCase();
location.replace(`#\/game\/${slug}?action=${encodeURIComponent(a)}`);
return true;
}
return false;
}
function parseHash(){
const h=location.hash||"#/";
const [path,q] = h.slice(2).split("?");
const parts=(path||"").split("/");
const params=new URLSearchParams(q||"");
if (parts[0]==="game" && parts[1]) return {route:"detail", slug:parts[1].toLowerCase(), action:(params.get("action")||"quicksetup").toLowerCase()};
return {route:"list"};
}
function render(){
if (normalizeIncoming()) return;
const {route, slug, action} = parseHash();
route==="detail" ? renderDetail(slug, action) : renderList("");
}
window.addEventListener("hashchange", render);
document.addEventListener("DOMContentLoaded", render);

/* Optional: service worker (kept from your original) */
if ("serviceWorker" in navigator) {
try { navigator.serviceWorker.register(`${basePath()}/sw.js`); } catch(_) {}
}
})();
