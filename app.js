/**********************
 * Utils
 **********************/
const $ = (sel) => document.querySelector(sel);
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pad2 = (n) => String(n).padStart(2,"0");

function toISODate(d){
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = pad2(dt.getMonth()+1);
  const day = pad2(dt.getDate());
  return `${y}-${m}-${day}`;
}
function parseISODate(s){
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y, m-1, d);
}
function monthKeyFromISO(isoDate){ return isoDate.slice(0,7); }
function monthLabel(yyyyMm){
  const [y,m] = yyyyMm.split("-").map(Number);
  const dt = new Date(y, m-1, 1);
  return dt.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
function uid(){ return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16); }
function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }

function toast(title, detail){
  const el = $("#toast");
  $("#toastT").textContent = title;
  $("#toastD").textContent = detail || "";
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> el.classList.remove("show"), 2800);
}

/**********************
 * Data
 **********************/
const STORAGE_KEY = "house_bills_dashboard_v1";

const CATEGORY_COLORS = {
  "Moradia": "#7c5cff",
  "Energia/Água": "#27d5ff",
  "Internet/Telefone": "#2fe19a",
  "Mercado": "#ffcc66",
  "Transporte": "#ff5c7a",
  "Saúde": "#66b3ff",
  "Educação": "#b18cff",
  "Assinaturas": "#65f0d6",
  "Impostos": "#ff8ab1",
  "Outros": "#c7d2fe"
};
const DEFAULT_CATEGORIES = Object.keys(CATEGORY_COLORS);

const state = {
  items: [],
  sort: { by: "due", dir: "asc" },
  filters: { q: "", month: "", status: "all", category: "all" }
};

function load(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return;
  try{
    const data = JSON.parse(raw);
    if(Array.isArray(data.items)) state.items = data.items;
    if(data.sort) state.sort = data.sort;
    if(data.filters) state.filters = { ...state.filters, ...data.filters };
  }catch(e){
    console.warn("Erro ao carregar storage:", e);
  }
}
function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    items: state.items,
    sort: state.sort,
    filters: state.filters
  }));
}

/**********************
 * Domain helpers
 **********************/
function computeStatus(item){
  if(item.paid) return "paid";
  const today = new Date();
  const due = parseISODate(item.due);
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const d0 = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  return d0 < t0 ? "late" : "open";
}
function inSelectedMonth(item, yyyyMm){
  return monthKeyFromISO(item.due) === yyyyMm;
}
function filteredItems(){
  const { q, month, status, category } = state.filters;
  const qq = (q||"").trim().toLowerCase();
  return state.items.filter(it => {
    if(month && !inSelectedMonth(it, month)) return false;
    if(category && category !== "all" && it.category !== category) return false;
    if(qq){
      const hay = `${it.name} ${it.category} ${it.paymentMethod||""}`.toLowerCase();
      if(!hay.includes(qq)) return false;
    }
    const st = computeStatus(it);
    if(status !== "all" && st !== status) return false;
    return true;
  });
}
function sortedItems(items){
  const { by, dir } = state.sort;
  const mult = dir === "asc" ? 1 : -1;
  return [...items].sort((a,b)=>{
    if(by === "due") return (parseISODate(a.due) - parseISODate(b.due)) * mult;
    if(by === "amount") return ((a.amount||0) - (b.amount||0)) * mult;
    return 0;
  });
}
function totalsForMonth(yyyyMm){
  const monthItems = state.items.filter(it => inSelectedMonth(it, yyyyMm));
  const total = monthItems.reduce((s,it)=> s + (Number(it.amount)||0), 0);
  const paid = monthItems.filter(it=> it.paid).reduce((s,it)=> s + (Number(it.amount)||0), 0);
  const open = total - paid;
  const openCount = monthItems.filter(it=> !it.paid).length;
  const paidPct = total > 0 ? (paid/total)*100 : 0;
  return { total, paid, open, openCount, paidPct, count: monthItems.length };
}
function categoryTotalsForMonth(yyyyMm){
  const monthItems = state.items.filter(it => inSelectedMonth(it, yyyyMm));
  const map = new Map();
  for(const it of monthItems){
    const k = it.category || "Outros";
    map.set(k, (map.get(k)||0) + (Number(it.amount)||0));
  }
  const rows = Array.from(map.entries()).map(([category, amount])=>({category, amount}));
  rows.sort((a,b)=> b.amount - a.amount);
  return rows;
}

/**********************
 * Rendering
 **********************/
function setSwitch(el, on){
  el.classList.toggle("on", !!on);
  el.setAttribute("aria-checked", on ? "true" : "false");
}
function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function renderCategorySelects(){
  const cats = DEFAULT_CATEGORIES;
  $("#category").innerHTML = cats.map(c=> `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  $("#catFilter").innerHTML = [
    `<option value="all">Todas</option>`,
    ...cats.map(c=> `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
  ].join("");
  $("#catFilter").value = state.filters.category || "all";
}
function statusBadge(item){
  const st = computeStatus(item);
  if(st === "paid") return `<span class="status paid"><span class="dot"></span>Pago</span>`;
  if(st === "late") return `<span class="status late"><span class="dot"></span>Atrasado</span>`;
  return `<span class="status open"><span class="dot"></span>Em aberto</span>`;
}
function categoryTag(cat){
  const c = CATEGORY_COLORS[cat] || "#c7d2fe";
  return `<span class="tag"><span class="sw" style="background:${c}"></span>${escapeHtml(cat)}</span>`;
}

function renderTable(){
  const items = sortedItems(filteredItems());
  const tbody = $("#tbody");
  tbody.innerHTML = "";

  $("#countsPill").textContent = `${items.length} conta${items.length === 1 ? "" : "s"}`;

  if(items.length === 0){
    $("#emptyState").style.display = "block";
    return;
  } else {
    $("#emptyState").style.display = "none";
  }

  const isMobile = window.matchMedia("(max-width: 760px)").matches;

  const td = (label, html) => {
    if(!isMobile) return html;
    return `<span class="td-label">${label}</span>${html}`;
  };

  for(const it of items){
    const paidLabel = it.paid ? "Desmarcar pago" : "Marcar pago";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        ${td("Conta", `
          <div style="display:flex; flex-direction:column; gap:2px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <strong style="font-weight:700; font-size:13px;">${escapeHtml(it.name)}</strong>
              ${it.recurring ? `<span class="pill" style="background:rgba(124,92,255,.16);border-color:rgba(124,92,255,.28);">recorrente</span>` : ``}
              ${it.paymentMethod && it.paymentMethod !== "—" ? `<span class="pill" style="background:rgba(39,213,255,.14);border-color:rgba(39,213,255,.26);">${escapeHtml(it.paymentMethod)}</span>` : ``}
            </div>
            <div class="sub" style="font-size:12px;">id: <span style="font-family:var(--mono);">${escapeHtml(it.id.slice(0,8))}</span></div>
          </div>
        `)}
      </td>
      <td>${td("Categoria", categoryTag(it.category))}</td>
      <td class="mono">${td("Venc.", escapeHtml(it.due))}</td>
      <td class="mono right">${td("Valor", money.format(Number(it.amount)||0))}</td>
      <td>${td("Status", statusBadge(it))}</td>
      <td class="right">
        ${td("Ações", `
          <div class="menu" data-menu data-id="${escapeHtml(it.id)}">
            <button class="btn small" type="button" data-menu-btn>
              Ações
              <svg viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <div class="menu-panel" data-menu-panel role="menu" aria-label="Ações da conta">
              <button class="btn small" type="button" data-act="togglePaid" data-id="${escapeHtml(it.id)}">${escapeHtml(paidLabel)}</button>
              <button class="btn small" type="button" data-act="edit" data-id="${escapeHtml(it.id)}">Editar</button>
              <button class="btn small" type="button" data-act="duplicate" data-id="${escapeHtml(it.id)}">Duplicar</button>
              <div class="menu-sep"></div>
              <button class="btn small danger" type="button" data-act="delete" data-id="${escapeHtml(it.id)}">Excluir</button>
            </div>
          </div>
        `)}
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function renderKpis(){
  const m = state.filters.month;
  $("#monthLabel").textContent = m ? monthLabel(m) : "Selecione um mês";
  if(!m){
    $("#kpiTotal").textContent = money.format(0);
    $("#kpiPaid").textContent = money.format(0);
    $("#kpiOpen").textContent = money.format(0);
    $("#kpiPaidPct").textContent = "0%";
    $("#kpiOpenCount").textContent = "0";
    return;
  }
  const t = totalsForMonth(m);
  $("#kpiTotal").textContent = money.format(t.total);
  $("#kpiPaid").textContent = money.format(t.paid);
  $("#kpiOpen").textContent = money.format(t.open);
  $("#kpiPaidPct").textContent = `${Math.round(t.paidPct)}%`;
  $("#kpiOpenCount").textContent = `${t.openCount}`;
}

function renderChart(){
  const m = state.filters.month;
  const el = $("#chart");
  el.innerHTML = "";
  if(!m){
    el.innerHTML = `<div class="empty">Selecione um mês para ver o gráfico por categoria.</div>`;
    return;
  }
  const rows = categoryTotalsForMonth(m);
  const max = rows.reduce((mx,r)=> Math.max(mx, r.amount), 0) || 1;

  if(rows.length === 0){
    el.innerHTML = `<div class="empty">Sem dados no mês selecionado.</div>`;
    return;
  }

  for(const r of rows){
    const pct = clamp((r.amount/max)*100, 0, 100);
    const color = CATEGORY_COLORS[r.category] || "#7c5cff";
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.innerHTML = `
      <div class="nm" title="${escapeHtml(r.category)}"><span class="sw" style="background:${color}; width:10px; height:10px; border-radius:3px;"></span>${escapeHtml(r.category)}</div>
      <div class="track"><div class="fill" style="width:${pct}%; background: linear-gradient(90deg, ${color}, rgba(39,213,255,.75));"></div></div>
      <div class="val">${money.format(r.amount)}</div>
    `;
    el.appendChild(bar);
  }
}

function renderAll(){
  renderKpis();
  renderTable();
  renderChart();
  save();
}

/**********************
 * Form
 **********************/
function clearForm(){
  $("#id").value = "";
  $("#name").value = "";
  $("#category").value = DEFAULT_CATEGORIES[0] || "Outros";
  $("#due").value = toISODate(new Date());
  $("#amount").value = "";
  $("#paymentMethod").value = "—";
  setSwitch($("#recurring"), false);
  setSwitch($("#paid"), false);

  $("#formTitle").textContent = "Nova conta";
  $("#formSubtitle").textContent = "Adicione uma conta do mês (ou recorrente)";
  $("#btnCancelEdit").style.display = "none";
}
function fillForm(item){
  $("#id").value = item.id;
  $("#name").value = item.name;
  $("#category").value = item.category;
  $("#due").value = item.due;
  $("#amount").value = Number(item.amount||0);
  $("#paymentMethod").value = item.paymentMethod || "—";
  setSwitch($("#recurring"), !!item.recurring);
  setSwitch($("#paid"), !!item.paid);

  $("#formTitle").textContent = "Editar conta";
  $("#formSubtitle").textContent = `Editando: ${item.name}`;
  $("#btnCancelEdit").style.display = "inline-flex";
}
function readForm(){
  const id = $("#id").value || uid();
  const name = $("#name").value.trim();
  const category = $("#category").value;
  const due = $("#due").value;
  const amount = Number($("#amount").value);
  const paymentMethod = $("#paymentMethod").value;
  const recurring = $("#recurring").classList.contains("on");
  const paid = $("#paid").classList.contains("on");

  if(!name) throw new Error("Informe o nome.");
  if(!due) throw new Error("Informe o vencimento.");
  if(!Number.isFinite(amount) || amount < 0) throw new Error("Informe um valor válido.");

  return { id, name, category, due, amount, paymentMethod, recurring, paid };
}
function upsert(item){
  const idx = state.items.findIndex(x => x.id === item.id);
  if(idx >= 0) state.items[idx] = item;
  else state.items.unshift(item);
}

/**********************
 * Dropdown menu
 **********************/
function closeAllMenus(){
  document.querySelectorAll("[data-menu-panel].open").forEach(p=> p.classList.remove("open"));
}
function toggleMenu(menuEl){
  const panel = menuEl.querySelector("[data-menu-panel]");
  const willOpen = !panel.classList.contains("open");
  closeAllMenus();
  if(willOpen) panel.classList.add("open");
}

/**********************
 * Actions
 **********************/
function bind(){
  // Filters
  $("#q").addEventListener("input", (e)=>{ state.filters.q = e.target.value; renderAll(); });
  $("#month").addEventListener("input", (e)=>{ state.filters.month = e.target.value; renderAll(); });
  $("#status").addEventListener("change", (e)=>{ state.filters.status = e.target.value; renderAll(); });
  $("#catFilter").addEventListener("change", (e)=>{ state.filters.category = e.target.value; renderAll(); });

  // Sort
  $("#btnSortDue").addEventListener("click", ()=>{
    if(state.sort.by === "due") state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
    state.sort.by = "due";
    toast("Ordenação", `Vencimento (${state.sort.dir})`);
    renderAll();
  });
  $("#btnSortValue").addEventListener("click", ()=>{
    if(state.sort.by === "amount") state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
    state.sort.by = "amount";
    toast("Ordenação", `Valor (${state.sort.dir})`);
    renderAll();
  });

  // Switches
  const toggleSwitch = (el) => setSwitch(el, !el.classList.contains("on"));
  for(const id of ["recurring","paid"]){
    const el = $("#"+id);
    el.addEventListener("click", ()=> toggleSwitch(el));
    el.addEventListener("keydown", (e)=>{
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        toggleSwitch(el);
      }
    });
  }

  // Form
  $("#form").addEventListener("submit", (e)=>{
    e.preventDefault();
    try{
      const item = readForm();
      const editing = !!$("#id").value;
      upsert(item);
      renderAll();
      toast(editing ? "Conta atualizada" : "Conta adicionada", `${item.name} • ${money.format(item.amount)}`);
      clearForm();
    }catch(err){
      toast("Não foi possível salvar", err.message || String(err));
    }
  });

  $("#btnClearForm").addEventListener("click", ()=>{
    clearForm();
    toast("Formulário", "Campos limpos.");
  });
  $("#btnCancelEdit").addEventListener("click", ()=>{
    clearForm();
    toast("Edição cancelada", "Voltando para Nova conta.");
  });

  $("#btnNew").addEventListener("click", ()=>{
    clearForm();
    $("#name").focus();
  });

  // Table actions + dropdown
  $("#tbody").addEventListener("click", (e)=>{
    const menuBtn = e.target.closest("[data-menu-btn]");
    if(menuBtn){
      const menu = menuBtn.closest("[data-menu]");
      if(menu) toggleMenu(menu);
      return;
    }

    const btn = e.target.closest("button[data-act]");
    if(!btn) return;

    const act = btn.dataset.act;
    const id = btn.dataset.id;
    const item = state.items.find(x=> x.id === id);
    if(!item) return;

    closeAllMenus();

    if(act === "togglePaid"){
      item.paid = !item.paid;
      upsert(item);
      renderAll();
      toast("Status atualizado", item.paid ? "Marcada como paga." : "Marcada como em aberto.");
      return;
    }
    if(act === "edit"){
      fillForm(item);
      $("#name").focus();
      return;
    }
    if(act === "duplicate"){
      const copy = { ...item, id: uid(), paid: false };
      upsert(copy);
      renderAll();
      toast("Duplicado", `${copy.name} (novo)`);
      return;
    }
    if(act === "delete"){
      if(!confirm(`Excluir "${item.name}"?`)) return;
      state.items = state.items.filter(x=> x.id !== id);
      renderAll();
      toast("Excluído", item.name);
      return;
    }
  });

  // close menus on outside click / escape
  document.addEventListener("click", (e)=>{
    if(e.target.closest("[data-menu]")) return;
    closeAllMenus();
  });
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape") closeAllMenus();
  });
  window.addEventListener("resize", ()=> closeAllMenus());

  // Seed
  $("#btnSeed").addEventListener("click", ()=>{
    const m = state.filters.month || $("#month").value || (()=> {
      const n = new Date();
      return `${n.getFullYear()}-${pad2(n.getMonth()+1)}`;
    })();
    const [yy,mm] = m.split("-").map(Number);
    const mk = (day) => `${yy}-${pad2(mm)}-${pad2(day)}`;

    const examples = [
      { name:"Aluguel", category:"Moradia", due: mk(5), amount: 1800.00, paymentMethod:"Pix", recurring:true, paid:false },
      { name:"Condomínio", category:"Moradia", due: mk(10), amount: 480.00, paymentMethod:"Boleto", recurring:true, paid:false },
      { name:"Luz", category:"Energia/Água", due: mk(12), amount: 230.40, paymentMethod:"Débito automático", recurring:true, paid:true },
      { name:"Água", category:"Energia/Água", due: mk(15), amount: 98.72, paymentMethod:"Débito automático", recurring:true, paid:false },
      { name:"Internet", category:"Internet/Telefone", due: mk(18), amount: 129.90, paymentMethod:"Cartão", recurring:true, paid:false },
      { name:"Mercado", category:"Mercado", due: mk(22), amount: 620.15, paymentMethod:"Cartão", recurring:false, paid:false },
      { name:"Assinaturas (streaming)", category:"Assinaturas", due: mk(20), amount: 79.90, paymentMethod:"Cartão", recurring:true, paid:true }
    ].map(x=> ({ id: uid(), ...x }));

    const key = (it)=> `${it.name}|${it.due}|${it.amount}`;
    const existing = new Set(state.items.map(key));
    let added = 0;
    for(const ex of examples){
      if(existing.has(key(ex))) continue;
      state.items.unshift(ex);
      added++;
    }
    renderAll();
    toast("Exemplo", `${added} conta(s) adicionada(s) no mês.`);
  });

  // Export
  $("#btnExport").addEventListener("click", ()=>{
    const payload = { exported_at: new Date().toISOString(), version: 1, items: state.items };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contas-da-casa_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Exportado", "Arquivo JSON baixado.");
  });

  // Import
  $("#importFile").addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    e.target.value = "";
    if(!file) return;
    try{
      const txt = await file.text();
      const data = JSON.parse(txt);
      const items = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : null);
      if(!items) throw new Error("JSON inválido. Esperado: { items: [...] }");

      let merged = 0;
      for(const raw of items){
        if(!raw) continue;
        const it = {
          id: raw.id || uid(),
          name: String(raw.name || "").trim() || "Sem nome",
          category: DEFAULT_CATEGORIES.includes(raw.category) ? raw.category : "Outros",
          due: raw.due ? String(raw.due).slice(0,10) : toISODate(new Date()),
          amount: Number(raw.amount || 0),
          paymentMethod: raw.paymentMethod || "—",
          recurring: !!raw.recurring,
          paid: !!raw.paid
        };
        upsert(it);
        merged++;
      }
      renderAll();
      toast("Importado", `${merged} item(ns) mesclado(s) no dashboard.`);
    }catch(err){
      toast("Falha ao importar", err.message || String(err));
    }
  });

  // Reset
  $("#btnReset").addEventListener("click", ()=>{
    if(!confirm("Isso vai apagar TODAS as contas salvas neste navegador. Continuar?")) return;
    state.items = [];
    save();
    renderAll();
    clearForm();
    toast("Limpo", "Dados removidos do localStorage.");
  });

  // Ctrl/Cmd + K focuses search
  window.addEventListener("keydown", (e)=>{
    const isMac = navigator.platform.toLowerCase().includes("mac");
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if(mod && e.key.toLowerCase() === "k"){
      e.preventDefault();
      $("#q").focus();
    }
  });

  // Re-render on breakpoint change to update mobile labels
  window.addEventListener("resize", ()=>{
    renderTable();
  });
}

/**********************
 * Init
 **********************/
function init(){
  load();
  renderCategorySelects();

  $("#q").value = state.filters.q || "";
  $("#status").value = state.filters.status || "all";

  const now = new Date();
  const m = `${now.getFullYear()}-${pad2(now.getMonth()+1)}`;
  state.filters.month = state.filters.month || m;

  $("#month").value = state.filters.month;
  $("#catFilter").value = state.filters.category || "all";

  clearForm();
  bind();
  renderAll();
}

init();
