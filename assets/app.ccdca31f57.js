
const D = window.DOCTORS;
// URL: 医師・都道府県・得意部位ごとに個別ページ（build_site.py が静的HTMLを生成）
const SITE = window.SITE || { base:"/" };
const BASE = SITE.base;
const PREF_SLUG = window.PREF_SLUG || {};
const SPEC_SLUG = { "目":"eye", "鼻":"nose", "口":"mouth", "輪郭":"contour", "肌治療":"skin" };
const docURL = d => BASE + "doctor/" + d.slug + "/";
function navigate(url){ history.pushState({ app:1 }, "", url); route(); }
const META = window.META || {};
const AREAS = ["目","鼻","口","輪郭","肌治療"];
const QORDER = ["JSAPS専門医","形成外科専門医","頭蓋顎顔面外科専門医"];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const ICON_CHEV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
const ICON_BACK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
const isSP = () => matchMedia("(max-width:899px)").matches;

const state = { q:"", areas:new Set(), quals:new Set(), ctype:"", cases:"", pref:"", focus:null, sel:null, view:"map" };
const TIER = 50; // この件数以上を濃い色のピンにする
const tierOf = n => n >= TIER ? 2 : n > 0 ? 1 : 0;
const casesOf = d => d.cases ? d.cases.total : 0;
const PREF_RE = /(北海道|東京都|京都府|大阪府|.{2,3}県)/;
// 住所に都道府県名がない場合は市名・特別区名から補う
const CITY_PREF = { "札幌市":"北海道","仙台市":"宮城県","郡山市":"福島県","さいたま市":"埼玉県","千葉市":"千葉県","横浜市":"神奈川県","川崎市":"神奈川県","名古屋市":"愛知県","京都市":"京都府","大阪市":"大阪府","堺市":"大阪府","神戸市":"兵庫県","広島市":"広島県","岡山市":"岡山県","金沢市":"石川県","高松市":"香川県","福岡市":"福岡県","北九州市":"福岡県","熊本市":"熊本県","那覇市":"沖縄県" };
const TOKYO_WARDS = /^(千代田|中央|港|新宿|文京|台東|墨田|江東|品川|目黒|大田|世田谷|渋谷|中野|杉並|豊島|北|荒川|板橋|練馬|足立|葛飾|江戸川)区/;
D.forEach(d => {
  const a = (d.clinic.address || "").replace(/〒\d{3}-?\d{4}\s*/, "");
  const m = a.match(PREF_RE);
  d.pref = m ? m[1] : (Object.entries(CITY_PREF).find(([c]) => a.startsWith(c))?.[1] || (TOKYO_WARDS.test(a) ? "東京都" : ""));
});
const PREF_MIN = 5; // この人数以上いる都道府県だけ絞り込み対象にする
const prefCounts = D.reduce((o, d) => (o[d.pref] = (o[d.pref] || 0) + 1, o), {});
const PREFS = Object.keys(prefCounts).filter(p => p && prefCounts[p] >= PREF_MIN).sort((a, b) => prefCounts[b] - prefCounts[a]);
const FILTERS = [
  { key:"pref", title:"都道府県", note:"", multi:false, opts:PREFS.map(p => [p, p]) },
  { key:"areas", title:"得意部位", note:"選んだ部位すべてが得意な医師", multi:true, opts:AREAS.map(a => [a, a]) },
  { key:"quals", title:"資格", note:"", multi:true, opts:[["頭蓋顎顔面外科専門医","頭蓋顎顔面外科専門医"]] },
  { key:"ctype", title:"院の種類", note:"", multi:false, opts:[["美容","美容クリニック"],["形成外科クリニック","形成外科クリニック"],["病院","病院"]] },
  { key:"cases", title:"公式サイト掲載の症例", note:"", multi:false, opts:[["1","症例あり"],["50","50件以上"],["100","100件以上"]] },
];

// ---- filters ----
const isOn = (f, v) => f.multi ? state[f.key].has(v) : state[f.key] === v;
function toggle(f, v){ if (f.multi) { state[f.key].has(v) ? state[f.key].delete(v) : state[f.key].add(v); } else { state[f.key] = state[f.key] === v ? "" : v; } }
const activeCount = () => (state.pref?1:0) + state.areas.size + state.quals.size + (state.ctype?1:0) + (state.cases?1:0);
function filtered(){
  return D.filter(d =>
    (!state.q || [d.name, d.kana, d.clinic.name, d.clinic.address, d.ward].join(" ").includes(state.q)) &&
    [...state.areas].every(a => d.spec.list.includes(a)) &&
    [...state.quals].every(q => d.quals.includes(q)) &&
    (!state.pref || d.pref === state.pref) &&
    (!state.ctype || d.clinicType === state.ctype) &&
    (!state.cases || casesOf(d) >= Number(state.cases)));
}
function renderChips(){
  $("#chips").innerHTML =
    AREAS.map(a => `<button class="chip b2" data-k="areas" data-v="${a}" aria-pressed="${state.areas.has(a)}">${a}</button>`).join("") +
    `<button class="chip b2" data-k="cases" data-v="1" aria-pressed="${state.cases==="1"}">症例あり</button>`;
  document.querySelectorAll("#chips .chip").forEach(b => b.onclick = () => { toggle(FILTERS.find(f => f.key === b.dataset.k), b.dataset.v); render(); });
  const n = activeCount(); $("#fcount").hidden = !n; $("#fcount").textContent = n;
}
function openFilters(){ $("#fpanel").hidden = false; renderFilters(); }
function renderFilters(){
  $("#fsheet").innerHTML =
    `<div class="nav"><span class="side"><button class="navbtn" id="fclr">クリア</button></span><span class="t">絞り込み</span><span class="side r"><button class="navbtn" id="fx" aria-label="閉じる"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></span></div>
     <div class="fscroll">${FILTERS.map(f => `<div class="fgroup"><h3>${f.title}${f.note ? `<small>${f.note}</small>` : ""}</h3><div class="opts">${f.opts.map(([v,l]) => `<button class="opt b2" data-k="${f.key}" data-v="${v}" aria-pressed="${isOn(f,v)}">${l}</button>`).join("")}</div></div>`).join("")}</div>
     <button class="fgo" id="fgo">${filtered().length}件を表示</button>`;
  document.querySelectorAll("#fsheet .opt").forEach(b => b.onclick = () => { toggle(FILTERS.find(f => f.key === b.dataset.k), b.dataset.v); render(); renderFilters(); });
  $("#fx").onclick = $("#fgo").onclick = () => { $("#fpanel").hidden = true; };
  $("#fclr").onclick = () => { state.pref = ""; state.areas.clear(); state.quals.clear(); state.ctype = ""; state.cases = ""; render(); renderFilters(); };
}
$("#openF").onclick = openFilters;
$("#siteMenu").onclick = () => openSiteMenu();
$("#fullFilter").onclick = openFilters;
$("#fpanel").onclick = e => { if (e.target.id === "fpanel") $("#fpanel").hidden = true; };
$("#q").oninput = e => { state.q = e.target.value.trim(); render(); };

// ---- card / row ----
const sortQ = d => [...d.quals].sort((a,b) => QORDER.indexOf(a) - QORDER.indexOf(b));
const tagsHTML = d => sortQ(d).map(q => `<span class="tag${q === "JSAPS専門医" ? " main" : ""}">${q}</span>`).join("");
const metaHTML = d => `<div class="meta"><span>得意 <b class="pk">${d.spec.list.length ? AREAS.filter(a => d.spec.list.includes(a)).join("・") : "―"}</b></span><span>掲載症例 <b>${casesOf(d) ? casesOf(d) + "件" : "不明"}</b></span>${rvStat(d.id).n ? `<span>口コミ <b class="cardstar">★${rvStat(d.id).avg.toFixed(1)}</b>（${rvStat(d.id).n}）</span>` : ""}</div>`;
const inner = d => `<div class="nm"><b>${esc(d.name)}</b><small>${esc(d.title || "")}</small></div>
  <div class="cl">${esc(d.clinic.name)}・${esc(d.ward)}</div>
  <div class="tags">${tagsHTML(d)}</div>${metaHTML(d)}`;
const cardHTML = d => `<a class="card${state.sel === d.id ? " on" : ""}" href="${docURL(d)}" data-id="${d.id}">${inner(d)}</a>`;
const rowHTML = d => `<a class="row" href="${docURL(d)}" data-id="${d.id}">${inner(d)}</a>`;
const footHTML = () => `<div class="foot">
  資格情報の出典：<a href="https://www.jsaps.com/profile/" target="_blank" rel="noopener">日本美容外科学会（JSAPS）会員紹介</a>。勤務先・得意分野・症例数は各クリニックの公式サイトの記載によります。症例数は公式サイトに掲載された症例の件数で、実際の手術件数ではありません。<br>
  情報確認日：${esc(META.checked || "")}。最新の情報は各クリニックにご確認ください。本サイトは学会の公式サイトではありません。<br>
  <button class="fixbtn b2" type="button">掲載内容の修正・掲載停止を依頼する</button>${browseLinksHTML()}${legalLinksHTML()}</div>`;
const browseLinksHTML = () => `<nav class="seo-nav"><h2>都道府県から探す</h2>${Object.keys(PREF_SLUG).filter(p => D.some(d => d.pref === p)).map(p => `<a href="${BASE}area/${PREF_SLUG[p]}/" data-nav>${p}</a>`).join("")}<h2>得意部位から探す</h2>${AREAS.map(a => `<a href="${BASE}specialty/${SPEC_SLUG[a]}/" data-nav>${a}</a>`).join("")}</nav>`;
document.addEventListener("click", e => { const a = e.target.closest("a[data-nav]"); if (a) { e.preventDefault(); navigate(a.getAttribute("href")); } });
function bindFix(){ document.querySelectorAll(".fixbtn").forEach(b => b.onclick = () => { const d = !$("#detail").hidden && D.find(x => x.id === curDetail); openContact("掲載内容の修正・掲載停止", d ? `${d.name}（${d.clinic.name}）` : ""); }); }
function toast(m){ const t = document.createElement("div"); t.className = "toast"; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3500); }

// ---- map ----
const map = L.map("map", { zoomControl:false, attributionControl:true }).setView([35.67, 139.72], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom:19, attribution:'&copy; OpenStreetMap' }).addTo(map);
if (!isSP()) L.control.zoom({ position:"topright" }).addTo(map);
map.on("click", () => { if (state.view === "sheet") setView("map"); });
let meMarker;
$("#locate").onclick = () => {
  if (!navigator.geolocation) { toast("この端末では現在地を取得できません"); return; }
  $("#locate").classList.add("busy");
  navigator.geolocation.getCurrentPosition(p => {
    $("#locate").classList.remove("busy");
    const ll = [p.coords.latitude, p.coords.longitude];
    if (meMarker) meMarker.setLatLng(ll); else meMarker = L.marker(ll, { icon:L.divIcon({ className:"", html:'<div class="me"></div>', iconSize:[16,16], iconAnchor:[8,8] }), interactive:false, zIndexOffset:2000 }).addTo(map);
    map.setView(ll, 15);
  }, () => { $("#locate").classList.remove("busy"); toast("現在地を取得できませんでした。位置情報の利用を許可してください"); }, { enableHighAccuracy:true, timeout:10000, maximumAge:60000 });
};
const TOKYO = [35.672, 139.735]; // 起動時の地図中心（東京・港区付近）
const markers = new Map();
const clinicKey = d => d.clinic.lat.toFixed(5) + "," + d.clinic.lng.toFixed(5);
const pinIcon = (n, on, tier) => L.divIcon({ className:"", html:`<div class="pin t${tier ?? 2}${on ? " on" : ""}"><span>${n > 1 ? n : ""}</span></div>`, iconSize:[30,30], iconAnchor:[15,30] });
const groupTier = ds => tierOf(Math.max(...ds.map(casesOf)));

let lastPref = "";
function fitPref(){
  if (state.pref === lastPref) return; lastPref = state.pref;
  const pts = D.filter(d => !state.pref || d.pref === state.pref);
  if (!state.pref) { map.setView(TOKYO, 11); return; }
  map.fitBounds(L.latLngBounds(pts.map(d => [d.clinic.lat, d.clinic.lng])).pad(0.2), { maxZoom:13 });
}
function render(){
  const list = filtered();
  fitPref();
  renderChips();
  $("#fabtext").textContent = `${list.length}件をリストで表示`;
  $("#count").innerHTML = `<b>${list.length}</b>件の専門医`;
  $("#fullTitle").textContent = `${state.pref ? state.pref + "の" : ""}専門医 ${list.length}件`;
  if (state.focus && !list.some(d => clinicKey(d) === state.focus)) state.focus = null;
  if (state.sel && !list.some(d => d.id === state.sel)) state.sel = list[0]?.id || null;
  const shown = state.focus ? list.filter(d => clinicKey(d) === state.focus) : list;
  $("#count").innerHTML = state.focus ? `<b>${shown.length}</b>件（この院）` : `<b>${list.length}</b>件の専門医`;
  $("#cards").innerHTML = shown.map(cardHTML).join("") || `<div class="card">条件に合う医師がいません。絞り込みを変更してください。</div>`;
  $("#fullBody").innerHTML = list.map(rowHTML).join("") + footHTML();
  document.querySelectorAll(".card[data-id], .row[data-id]").forEach(c => c.onclick = e => { e.preventDefault(); onCardTap(c.dataset.id, c.classList.contains("card")); });
  bindFix();
  // pins (grouped by clinic)
  const groups = new Map();
  list.forEach(d => { const k = clinicKey(d); (groups.get(k) || groups.set(k, []).get(k)).push(d); });
  markers.forEach(m => m.remove()); markers.clear();
  groups.forEach((ds, k) => {
    const on = ds.some(d => d.id === state.sel);
    const m = L.marker([ds[0].clinic.lat, ds[0].clinic.lng], { icon:pinIcon(ds.length, on, groupTier(ds)), zIndexOffset:on ? 1000 : 0, title:ds[0].clinic.name })
      .addTo(map).on("click", e => { L.DomEvent.stopPropagation(e); focusClinic(k, ds[0].id); });
    markers.set(k, m);
  });
}
function refreshPins(){ const list = filtered(); markers.forEach((m,k) => { const ds = list.filter(d => clinicKey(d) === k); const on = ds.some(d => d.id === state.sel); m.setIcon(pinIcon(ds.length, on, groupTier(ds))); m.setZIndexOffset(on ? 1000 : 0); }); }
function markCards(){ document.querySelectorAll("#cards .card").forEach(c => c.classList.toggle("on", c.dataset.id === state.sel)); }
function scrollToCard(id, smooth){ const el = document.querySelector(`#cards .card[data-id="${id}"]`); if (el) el.scrollIntoView({ behavior:smooth ? "smooth" : "auto", inline:"center", block:"nearest" }); }

// pin tap → carousel opens at that doctor
function select(id){
  state.sel = id;
  if (state.view !== "sheet") setView("sheet");
  refreshPins(); markCards(); scrollToCard(id, true);
  const d = D.find(x => x.id === id); map.panTo([d.clinic.lat, d.clinic.lng]);
}
// pin tap → show only doctors of that clinic
function focusClinic(k, id){
  state.focus = k; state.sel = id;
  setView("sheet");
  const d = D.find(x => x.id === id); map.panTo([d.clinic.lat, d.clinic.lng]);
}
// card tap: unselected card → select it, selected card → detail
function onCardTap(id, isCard){
  if (isCard && isSP() && state.sel !== id) { select(id); return; }
  navigate(docURL(D.find(x => x.id === id)));
}
// swipe carousel → follow on map
let st; $("#cards").addEventListener("scroll", () => {
  if (!isSP()) return;
  clearTimeout(st); st = setTimeout(() => {
    const box = $("#cards").getBoundingClientRect(), mid = box.left + box.width / 2;
    let best, bd = 1e9;
    document.querySelectorAll("#cards .card[data-id]").forEach(c => { const r = c.getBoundingClientRect(), dd = Math.abs(r.left + r.width / 2 - mid); if (dd < bd) { bd = dd; best = c; } });
    if (best && best.dataset.id !== state.sel) { state.sel = best.dataset.id; const d = D.find(x => x.id === state.sel); map.panTo([d.clinic.lat, d.clinic.lng]); refreshPins(); markCards(); }
  }, 120);
}, { passive:true });

// ---- views: map / sheet (carousel) / full ----
function setView(v){
  // PCは地図だけの状態を持たず、常にサイドバーに一覧を出す
  if (v === "map" && !isSP()) { state.sel = null; state.focus = null; v = "sheet"; }
  state.view = v;
  $("#sheet").hidden = v !== "sheet";
  $("#full").hidden = v !== "full";
  $("#toList").hidden = v !== "map";
  if (v === "map") { state.sel = null; state.focus = null; }
  if (v === "sheet" && !state.sel && isSP()) state.sel = filtered()[0]?.id || null;
  document.documentElement.style.setProperty("--sheet-h", v === "sheet" ? (isSP() ? "190px" : "0px") : "72px");
  render();
  if (v === "sheet" && state.sel) scrollToCard(state.sel, false);
}
$("#toList").onclick = () => { state.focus = null; state.sel = null; setView("sheet"); };
$("#closeSheet").onclick = () => setView("map");
$("#toFull").onclick = () => setView("full");
$("#fullBack").onclick = () => { if (location.pathname !== BASE) history.pushState({ app:1 }, "", BASE); state.pref = ""; state.areas.clear(); setView("map"); };

// ---- 口コミ（保存先: Googleスプレッドシート＋Apps Script） ----
const REVIEW_API = "https://script.google.com/macros/s/AKfycbxzSYO0ZK-TSZexsG5OJhPxPB6arNQdG347AynqlwGFeqQkPM9FfIUavM8XmN5P1_TV/exec"; // Apps Script ウェブアプリ（info@modelab.store）
const RV_READY = !!REVIEW_API;
const RV = {};                // 医師ID → 承認済み口コミ（ビルド時点の内容を window.REVIEWS で受け取り、表示後にAPIで最新化）
(window.REVIEWS || []).forEach(v => (RV[v.doctor] = RV[v.doctor] || []).push(v));
// ログイン: メールに届く6桁の確認コードで本人確認し、トークンを30日保持する
let auth = null; try { auth = JSON.parse(localStorage.getItem("senmap_auth") || "null"); } catch (e) {}
const api = async body => { const r = await (await fetch(REVIEW_API, { method:"POST", body:JSON.stringify(body) })).json(); if (!r.ok) throw new Error(r.error || "送信できませんでした"); return r; };
async function loadReviews(){
  if (!REVIEW_API) return;
  try {
    const r = await (await fetch(REVIEW_API + "?action=list")).json();
    Object.keys(RV).forEach(k => delete RV[k]);
    (r.reviews || []).forEach(v => (RV[v.doctor] = RV[v.doctor] || []).push(v));
    render(); route();
  } catch (e) {}
}
const rvStat = id => { const a = RV[id] || []; return { n:a.length, avg:a.length ? a.reduce((s, v) => s + v.rating, 0) / a.length : 0 }; };
const starsHTML = n => `<span class="stars">${[1,2,3,4,5].map(i => i <= Math.round(n) ? "★" : "<i>★</i>").join("")}</span>`;
function reviewsHTML(d){
  const list = (RV[d.id] || []).slice().reverse(), s = rvStat(d.id);
  const dist = [5,4,3,2,1].map(k => [k, list.filter(v => v.rating === k).length]);
  return `${s.n ? `<div class="rvsum"><div class="rvavg"><b>${s.avg.toFixed(1)}</b>${starsHTML(s.avg)}<br><small>${s.n}件の口コミ</small></div>
      <div class="rvdist">${dist.map(([k, n]) => `<div class="bar5"><span>${k}</span><span class="tr"><span class="fl" style="width:${s.n ? n / s.n * 100 : 0}%"></span></span><span class="n">${n}</span></div>`).join("")}</div></div>
      ${list.map(v => `<div class="rv" id="rv-${esc(v.id)}"><div class="rvhead">${starsHTML(v.rating)}<b>${esc(v.nickname)}</b><span class="dt">${esc(v.date)}</span></div>
        ${v.area ? `<div class="rvarea">施術部位：${esc(v.area)}</div>` : ""}
        <div class="rvbody">${esc(v.body)}</div>
        ${v.images && v.images.length ? `<div class="rvimgs">${v.images.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="投稿画像" loading="lazy"></a>`).join("")}</div>` : ""}
        <div class="rvacts">
          <button class="rvact rvlike" data-rid="${esc(v.id)}" aria-pressed="${liked.has(v.id)}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3zm0 0 4-8a2.5 2.5 0 0 1 2.5 2.5V9h5.2a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.5 20H7"/></svg>高評価<span class="n">${v.likes ? v.likes : ""}</span></button>
          <button class="rvact rvshare" data-rid="${esc(v.id)}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>共有</button>
          <button class="rvrep" data-rid="${esc(v.id)}">通報する</button>
        </div></div>`).join("")}`
    : `<div class="none">まだ口コミはありません。</div>`}
    <button class="rvwrite b2" id="rvWrite"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>この医師の口コミを書く</button>
    <div class="rvnote">口コミは運営が投稿ルールに沿って確認したうえで掲載します。運営が内容を書き換えたり、都合で非表示にしたりすることはありません。<button class="rvRules">投稿ルール・通報について</button></div>`;
}
// 高評価: ログイン不要。押した口コミはこのブラウザに記録して二重に数えない
let liked = new Set(); try { liked = new Set(JSON.parse(localStorage.getItem("senmap_liked") || "[]")); } catch (e) {}
const saveLiked = () => { try { localStorage.setItem("senmap_liked", JSON.stringify([...liked])); } catch (e) {} };
async function toggleLike(d, rid){
  const v = (RV[d.id] || []).find(x => x.id === rid); if (!v) return;
  const on = !liked.has(rid);
  on ? liked.add(rid) : liked.delete(rid); saveLiked();
  v.likes = Math.max(0, (v.likes || 0) + (on ? 1 : -1));
  $("#rvbox").innerHTML = reviewsHTML(d); bindReviews(d);
  if (!RV_READY) return;
  try { const r = await api({ action:"like", reviewId:rid, on }); v.likes = r.likes; }
  catch (e) { on ? liked.delete(rid) : liked.add(rid); saveLiked(); v.likes = Math.max(0, v.likes + (on ? -1 : 1)); toast("高評価を送れませんでした"); }
  $("#rvbox").innerHTML = reviewsHTML(d); bindReviews(d);
}
async function shareReview(d, rid){
  const url = location.origin + docURL(d) + "#r-" + rid;
  const text = `${d.name} 医師（${d.clinic.name}）の口コミ｜SenMap`;
  if (navigator.share) { try { await navigator.share({ title:text, text, url }); } catch (e) {} return; }
  try { await navigator.clipboard.writeText(url); toast("リンクをコピーしました"); } catch (e) { prompt("このリンクをコピーしてください", url); }
}
function bindReviews(d){
  $("#rvWrite").onclick = () => openWrite(d);
  document.querySelectorAll(".rvrep").forEach(b => b.onclick = () => openReport(b.dataset.rid));
  document.querySelectorAll(".rvlike").forEach(b => b.onclick = () => toggleLike(d, b.dataset.rid));
  document.querySelectorAll(".rvshare").forEach(b => b.onclick = () => shareReview(d, b.dataset.rid));
  document.querySelectorAll(".rvRules").forEach(b => b.onclick = openRules);
}
function openModal(title, html){
  $("#msheet").innerHTML = `<div class="nav"><span class="side"></span><span class="t">${title}</span><span class="side r"><button class="navbtn" id="mx" aria-label="閉じる"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></span></div><div class="fscroll">${html}</div>`;
  $("#mpanel").hidden = false; $("#mx").onclick = closeModal;
}
function closeModal(){ $("#mpanel").hidden = true; $("#msheet").innerHTML = ""; }
$("#mpanel").onclick = e => { if (e.target.id === "mpanel") closeModal(); };

// ---- 規約・ポリシー（運営者は個人。氏名・住所は請求に応じて回答） ----
// 規約類の本文は src/legal.json（build_site.py が window.LEGAL に埋め込む。各ページは /terms/ などの独立URLでも表示）
const LEGAL = window.LEGAL || {};
const CONTACT_KINDS = ["掲載内容の修正・掲載停止","口コミの削除依頼","個人情報に関する請求","その他"];
function openContact(kind, target){
  openModal("お問い合わせ", `<div class="form">
    <div><label class="t" for="ck">種別<em>必須</em></label><select id="ck">${CONTACT_KINDS.map(k => `<option${k === kind ? " selected" : ""}>${k}</option>`).join("")}</select></div>
    <div><label class="t" for="ct">対象の医師・クリニック・口コミ</label><input type="text" id="ct" maxlength="100" value="${esc(target || "")}"></div>
    <div><label class="t" for="ce">返信先メールアドレス<em>必須</em></label><input type="text" id="ce" inputmode="email" autocomplete="email"></div>
    <div><label class="t" for="cb">内容<em>必須</em></label><textarea id="cb" maxlength="2000" placeholder="医師・医療機関の方は、ご所属とご依頼の内容をご記入ください"></textarea></div>
    <button class="fgo" id="csend" style="margin:0">送信する</button></div>`);
  $("#csend").onclick = async () => {
    if (!RV_READY) return toast("パイロット版のため、まだ送信できません");
    $("#csend").disabled = true;
    try { await api({ action:"contact", kind:$("#ck").value, target:$("#ct").value, email:$("#ce").value.trim(), body:$("#cb").value.trim() });
      openModal("お問い合わせ", `<div class="done"><b>送信しました</b>内容を確認のうえ、ご入力のメールアドレスにご連絡します。</div>`);
    } catch (e) { toast(e.message); $("#csend").disabled = false; }
  };
}
document.addEventListener("click", e => { const b = e.target.closest("[data-contact]"); if (b) { e.preventDefault(); openContact(b.dataset.contact); } });
function openLegal(k){ if (k === "rules") return openRules(); if (k === "contact") return openContact(); openModal(LEGAL[k].title, LEGAL[k].html); }
const LEGAL_LINKS = [["terms","利用規約"],["rules","投稿ルール"],["privacy","プライバシーポリシー"],["disclaimer","免責事項"],["about","運営者情報"],["contact","お問い合わせ"]];
const legalHref = k => k === "contact" ? "#" : BASE + k + "/";
const legalLinksHTML = () => `<div class="legal">${LEGAL_LINKS.map(([k, l]) => `<a href="${legalHref(k)}" data-legal="${k}">${l}</a>`).join("")}</div>`;
document.addEventListener("click", e => { const b = e.target.closest("[data-legal]"); if (b) { e.preventDefault(); openLegal(b.dataset.legal); } });
function openSiteMenu(){ openModal("このサイトについて", `<div class="menu">${LEGAL_LINKS.map(([k, l]) => `<a class="linkrow" href="${legalHref(k)}" data-legal="${k}"><span>${l}</span>${ICON_CHEV}</a>`).join("")}</div>`); }

const RULES_HTML = (LEGAL.rules || {}).html || "";
function openRules(){ openModal("投稿ルール", RULES_HTML); }

function openReport(rid){
  const reasons = ["個人攻撃・誹謗中傷","効果の断定","虚偽・なりすまし・関係者の投稿","個人情報の掲載","医師・医療機関からの削除依頼","その他"];
  openModal("口コミを通報", `<div class="form"><div><label class="t">理由<em>必須</em></label><div class="radios">${reasons.map((r, i) => `<label><input type="radio" name="rr" value="${r}"${i ? "" : " checked"}>${r}</label>`).join("")}</div></div>
    <div><label class="t" for="rd">詳細</label><textarea id="rd" maxlength="1000" placeholder="該当する箇所や理由をご記入ください"></textarea></div>
    <button class="fgo" id="rsend" style="margin:0">送信する</button></div>`);
  $("#rsend").onclick = async () => {
    if (!RV_READY) { toast("パイロット版のため送信はまだできません"); return; }
    const reason = document.querySelector('input[name=rr]:checked').value;
    try { await api({ action:"report", reviewId:rid, reason, detail:$("#rd").value }); openModal("口コミを通報", `<div class="done"><b>通報を受け付けました</b>運営が内容を確認して対応します。</div>`);
    } catch (e) { toast("送信できませんでした：" + e.message); }
  };
}

function openWrite(d){
  if (!auth) {
    openModal("ログイン", `<div class="form">
      <div class="none">口コミの投稿にはメールアドレスの確認が必要です。メールアドレスは公開されません。</div>
      <div id="st1"><label class="t" for="le">メールアドレス</label><input type="text" id="le" inputmode="email" autocomplete="email" placeholder="example@mail.com"><button class="fgo" id="lsend" style="margin:10px 0 0;width:100%">確認コードを送る</button></div>
      <div id="st2" hidden><label class="t" for="lc">メールに届いた6桁の確認コード</label><input type="text" id="lc" inputmode="numeric" maxlength="6" autocomplete="one-time-code"><button class="fgo" id="lok" style="margin:10px 0 0;width:100%">ログインする</button></div>
      <button class="rvRules" style="font-size:12px;text-decoration:underline;color:var(--rose-deep)">投稿ルールを読む</button></div>`);
    document.querySelector("#msheet .rvRules").onclick = openRules;
    $("#lsend").onclick = async () => {
      if (!RV_READY) return toast("パイロット版のため、まだ送信できません");
      const email = $("#le").value.trim(); $("#lsend").disabled = true;
      try { await api({ action:"sendCode", email }); $("#st1").hidden = true; $("#st2").hidden = false; toast("確認コードを送りました"); }
      catch (e) { toast(e.message); $("#lsend").disabled = false; }
    };
    $("#lok").onclick = async () => {
      try { const r = await api({ action:"verifyCode", email:$("#le").value.trim(), code:$("#lc").value.trim() });
        auth = { token:r.token, email:r.email }; try { localStorage.setItem("senmap_auth", JSON.stringify(auth)); } catch (e) {}
        openWrite(d);
      } catch (e) { toast(e.message); }
    };
    return;
  }
  let rating = 0; const imgs = [];
  openModal("口コミを書く", `<div class="form">
    <div class="who">${esc(auth.email)} でログイン中（公開されません）<button class="rvlogout" style="margin-left:8px;font-size:10px;text-decoration:underline;color:var(--label)">ログアウト</button></div>
    <div><label class="t">${esc(d.name)} 医師の評価<em>必須</em></label><div class="starpick" id="sp">${[1,2,3,4,5].map(i => `<button data-v="${i}" aria-label="${i}">★</button>`).join("")}</div></div>
    <div><label class="t" for="wn">ニックネーム<em>必須</em></label><input type="text" id="wn" maxlength="20" placeholder="例）さくら"></div>
    <div><label class="t" for="wa">施術部位</label><select id="wa"><option value="">選択しない</option>${AREAS.concat("その他").map(a => `<option>${a}</option>`).join("")}</select></div>
    <div><label class="t" for="wb">口コミ<em>必須・30〜1000文字</em></label><textarea id="wb" maxlength="1000" placeholder="カウンセリングの様子、仕上がり、アフターケアなど、ご自身の体験を書いてください"></textarea><div class="cnt2" id="wc">0 / 1000</div></div>
    <div><label class="t">画像（3枚まで）</label><div class="thumbs" id="th"></div><input type="file" id="wf" accept="image/*" multiple hidden></div>
    <label class="chk"><input type="checkbox" id="g1"><span><button type="button" data-legal="rules">投稿ルール</button>・<button type="button" data-legal="terms">利用規約</button>・<button type="button" data-legal="privacy">プライバシーポリシー</button>に同意します</span></label>
    <label class="chk"><input type="checkbox" id="g2"><span>施術を受けた事実など、健康に関わる情報を含む投稿内容の取得・掲載に同意します</span></label>
    <button class="fgo" id="wsend" style="margin:0">投稿する</button></div>`);
  $("#msheet .rvlogout").onclick = () => { auth = null; try { localStorage.removeItem("senmap_auth"); } catch (e) {} openWrite(d); };
  document.querySelectorAll("#sp button").forEach(b => b.onclick = () => { rating = +b.dataset.v; document.querySelectorAll("#sp button").forEach(x => x.classList.toggle("on", +x.dataset.v <= rating)); });
  $("#wb").oninput = () => $("#wc").textContent = `${$("#wb").value.length} / 1000`;
  const drawThumbs = () => {
    $("#th").innerHTML = imgs.map((u, i) => `<div class="th"><img src="${u}" alt=""><button data-i="${i}" aria-label="削除">×</button></div>`).join("") + (imgs.length < 3 ? `<button class="addimg b2" id="wadd">＋<br>画像を追加</button>` : "");
    document.querySelectorAll("#th .th button").forEach(b => b.onclick = () => { imgs.splice(+b.dataset.i, 1); drawThumbs(); });
    if ($("#wadd")) $("#wadd").onclick = () => $("#wf").click();
  };
  $("#wf").onchange = async e => { for (const f of [...e.target.files].slice(0, 3 - imgs.length)) imgs.push(await shrink(f)); e.target.value = ""; drawThumbs(); };
  drawThumbs();
  $("#wsend").onclick = async () => {
    const body = $("#wb").value.trim(), nickname = $("#wn").value.trim();
    if (!rating) return toast("評価（星）を選んでください");
    if (!nickname) return toast("ニックネームを入力してください");
    if (body.length < 30) return toast("口コミは30文字以上で入力してください");
    if (!$("#g1").checked || !$("#g2").checked) return toast("2つの同意にチェックしてください");
    $("#wsend").disabled = true; $("#wsend").textContent = "送信中…";
    try {
      await api({ action:"post", token:auth.token, doctorId:d.id, doctorName:d.name, rating, nickname, area:$("#wa").value, body, images:imgs, agreeRules:true, agreePrivacy:true });
      openModal("口コミを書く", `<div class="done"><b>投稿を受け付けました</b>運営が投稿ルールに沿って確認したあと掲載します。掲載できない場合は、理由をメールでお知らせします。</div>`);
    } catch (e) {
      if (/ログイン/.test(e.message)) { auth = null; try { localStorage.removeItem("senmap_auth"); } catch (x) {} }
      toast("投稿できませんでした：" + e.message); $("#wsend").disabled = false; $("#wsend").textContent = "投稿する";
    }
  };
}
// 画像は長辺1280pxのJPEGに縮小してから送る
function shrink(file){
  return new Promise((ok, ng) => { const img = new Image(); img.onload = () => {
    const k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src); ok(c.toDataURL("image/jpeg", 0.82)); }; img.onerror = ng; img.src = URL.createObjectURL(file); });
}

// ---- detail ----
let mini, curDetail = null;
function showDetail(id){
  const d = D.find(x => x.id === id); if (!d) return hideDetail();
  curDetail = id;
  document.title = `${d.name}（${d.clinic.name}）｜美容外科専門医｜SenMap`;
  const gmap = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(d.clinic.name + " " + d.clinic.address);
  const specSrc = [
    d.spec.source === "declared" ? `医師本人が得意分野として明記${d.spec.url ? `（<a href="${esc(d.spec.url)}" target="_blank" rel="noopener">出典</a>）` : ""}` :
    d.spec.source === "cases" ? "公式サイト掲載の症例で最も多い部位" :
    d.spec.source === "other" ? "掲載症例の多くは5部位以外（ボディ・リフト等）" : "",
    ...Object.entries(d.spec.certs || {}).map(([a, q]) => `${a}：${q}の資格による`)
  ].filter(Boolean).join("<br>");
  const max = d.cases ? Math.max(0, ...AREAS.concat("その他").map(a => d.cases.by?.[a] || 0)) : 0;
  $("#detail").innerHTML = `
    <div class="nav"><span class="side"><button class="navbtn" id="back">${ICON_BACK}戻る</button></span><span class="t">${esc(d.name)}</span><span class="side r"></span></div>
    <div class="dscroll">
      <div class="hero">
        <div class="kana">${esc(d.kana)}</div>
        <h1 class="dname">${esc(d.name)}</h1>
        <div class="role">${esc(d.clinic.name)}${d.title ? "　" + esc(d.title) : ""}</div>
        <div class="tags">${tagsHTML(d)}</div>
      </div>
      <div class="sec"><h2 class="hl">勤務先</h2><div class="body">
        <a class="linkrow" href="${esc(d.clinic.url)}" target="_blank" rel="noopener"><span>${esc(d.clinic.name)}</span>${ICON_CHEV}</a>
        <div class="addr">${esc(d.clinic.address)}</div>
        <div class="minimap" id="mini"></div>
        <div class="btns"><a class="btn b2 pri" href="${esc(d.clinic.url)}" target="_blank" rel="noopener">公式サイト</a><a class="btn b2" href="${gmap}" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>Googleマップで開く</a></div>
        ${d.doctorPage ? `<div class="sub"><a href="${esc(d.doctorPage)}" target="_blank" rel="noopener">医師紹介ページ</a></div>` : ""}
      </div></div>
      <div class="sec"><h2 class="hl">得意分野</h2><div class="body">
        ${d.spec.list.length ? `<div class="spec">${AREAS.filter(a => d.spec.list.includes(a)).map(a => `<span>${a}</span>`).join("")}</div>` : `<div class="none">判定できる情報がありません</div>`}
        ${specSrc ? `<div class="sub">${specSrc}</div>` : ""}
      </div></div>
      <div class="sec"><h2 class="hl">公式サイト掲載の症例</h2><div class="body">
        ${casesOf(d) ? `<div class="total">${d.cases.total}<small>件</small></div>
          <div class="bars">${AREAS.concat("その他").map(a => { const n = d.cases.by[a] || 0; return `<div class="bar5${a === "その他" ? " dim" : ""}"><span>${a}</span><span class="tr"><span class="fl" style="width:${max ? n / max * 100 : 0}%"></span></span><span class="n">${n}</span></div>`; }).join("")}</div>`
          : `<div class="total">不明</div><div class="none">${d.cases && d.cases.mode === "attributed" ? "担当医としてこの医師の名前が明記された症例は見つかりませんでした。" : "公式サイトに症例の掲載が見つかりませんでした。"}</div>`}
        <div class="sub">${d.cases ? (d.cases.mode === "sole" ? "執刀医がこの医師1名の院のため、サイト掲載の全症例を計上。" : d.cases.mode === "attributed" ? "医師が複数在籍する院のため、担当医としてこの医師の名前が明記された症例のみ計上。" : "") + `計測日 ${esc(d.cases.at || "")}` + (d.cases.url ? `（<a href="${esc(d.cases.url)}" target="_blank" rel="noopener">症例ページ</a>）` : "") : ""}</div>
      </div></div>
      <div class="sec"><h2 class="hl">資格</h2><div class="body">
        ${sortQ(d).map(q => `<div class="qrow">${q}${q === "JSAPS専門医" && d.jsapsExpire ? `<span>有効期限 ${esc(d.jsapsExpire)}</span>` : ""}</div>`).join("")}
        ${d.otherQuals && d.otherQuals.length ? `<div class="sub">その他：${d.otherQuals.map(esc).join("、")}</div>` : ""}
      </div></div>
      <div class="sec"><h2 class="hl">口コミ</h2><div class="body" id="rvbox">${reviewsHTML(d)}</div></div>
      ${footHTML()}
    </div>`;
  $("#detail").hidden = false; $(".dscroll").scrollTop = 0;
  $("#back").onclick = () => (history.state && history.state.app) ? history.back() : navigate(BASE);
  bindFix(); bindReviews(d);
  if (mini) mini.remove();
  mini = L.map("mini", { zoomControl:false, attributionControl:false, dragging:false, scrollWheelZoom:false, doubleClickZoom:false, touchZoom:false, boxZoom:false, keyboard:false }).setView([d.clinic.lat, d.clinic.lng], 16);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom:19 }).addTo(mini);
  L.marker([d.clinic.lat, d.clinic.lng], { icon:pinIcon(1, false, 2) }).addTo(mini);
}
function showLegalPage(k){
  curDetail = null;
  $("#detail").innerHTML = `<div class="nav"><span class="side"><button class="navbtn" id="back">${ICON_BACK}戻る</button></span><span class="t">${esc(LEGAL[k].title)}</span><span class="side r"></span></div>
    <div class="dscroll"><div class="hero"><h1 class="dname">${esc(LEGAL[k].title)}</h1></div><div class="sec"><div class="body">${LEGAL[k].html}</div></div>${footHTML()}</div>`;
  $("#detail").hidden = false; $(".dscroll").scrollTop = 0;
  $("#back").onclick = () => (history.state && history.state.app) ? history.back() : navigate(BASE);
  bindFix(); document.title = `${LEGAL[k].title}｜SenMap`;
}
function hideDetail(){ $("#detail").hidden = true; if (mini) { mini.remove(); mini = null; } }
function route(){
  // 旧URL（#d/<id>/r/<rid>）は新URLへ置き換える
  const old = location.hash.match(/^#d\/([^/]+)(?:\/r\/(.+))?$/);
  if (old) { const d = D.find(x => x.id === decodeURIComponent(old[1])); if (d) history.replaceState(null, "", docURL(d) + (old[2] ? "#r-" + old[2] : "")); }
  const path = location.pathname.startsWith(BASE) ? decodeURIComponent(location.pathname.slice(BASE.length)) : "";
  let m;
  if ((m = path.match(/^doctor\/([^/]+)\/?$/))) {
    const d = D.find(x => x.slug === m[1]);
    if (d) {
      showDetail(d.id);
      const r = location.hash.match(/^#r-(.+)$/), el = r && document.getElementById("rv-" + r[1]);
      if (el) setTimeout(() => { el.scrollIntoView({ block:"center" }); el.style.background = "var(--rose-tint)"; setTimeout(() => el.style.background = "", 1500); }, 400);
      return;
    }
  }
  if ((m = path.match(/^(terms|privacy|disclaimer|about|rules)\/?$/)) && LEGAL[m[1]]) { showLegalPage(m[1]); return; }
  hideDetail();
  document.title = "SenMap｜美容外科専門医（JSAPS）を地図で探す";
  if ((m = path.match(/^area\/([^/]+)\/?$/))) {
    const pref = Object.keys(PREF_SLUG).find(p => PREF_SLUG[p] === m[1]);
    if (pref) { state.pref = pref; state.areas.clear(); setView("full"); document.title = `${pref}の美容外科専門医一覧（${filtered().length}名）｜SenMap`; }
  } else if ((m = path.match(/^specialty\/([^/]+)\/?$/))) {
    const a = Object.keys(SPEC_SLUG).find(k => SPEC_SLUG[k] === m[1]);
    if (a) { state.pref = ""; state.areas = new Set([a]); setView("full"); document.title = `${a}の施術を得意とする美容外科専門医一覧（${filtered().length}名）｜SenMap`; }
  }
}
window.addEventListener("popstate", route);


const syncTop = () => { document.documentElement.style.setProperty("--top-h", $("#top").offsetHeight + "px"); map.invalidateSize(); };
syncTop(); window.addEventListener("resize", syncTop); new ResizeObserver(syncTop).observe($("#top"));
setView("map");
map.setView(TOKYO, 11);
route();
loadReviews();
