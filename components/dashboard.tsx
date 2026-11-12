"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, ArrowDownLeft, ArrowUpRight, CalendarDays, Camera, Check, ChevronRight, Download, FileText, LayoutDashboard, Loader2, Pencil, Plus, RefreshCw, Search, Settings2, Sparkles, WalletCards } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import type { BudgetRecord, TransactionRecord } from "@/lib/types";

type Report = {
  income: number; expenses: number; netCashFlow: number; transactionCount: number; incompleteJpyCount: number;
  categorySpending: Array<{ category: string; amount: number; percentage: number }>;
  unusualSpending: TransactionRecord[]; ambiguousEntries: TransactionRecord[];
  budgetUsage: Array<BudgetRecord & { spent: number; remaining: number; percentage: number }>;
};
type ApiData = { month: string; lastSync: string; demoMode: boolean; transactions: TransactionRecord[]; budgets: BudgetRecord[]; report: Report };
type Tab = "overview" | "transactions" | "budgets" | "reports";

const COLORS = ["#264d43", "#d77454", "#d9b66f", "#76988e", "#856f5d", "#b6a590"];
const CATEGORIES = ["อาหารและเครื่องดื่ม", "รถยนต์และการเดินทาง", "ท่องเที่ยวและพักผ่อน", "งานอดิเรก", "เทคโนโลยี", "สุขภาพ", "ของใช้ในบ้าน", "ดูแลส่วนตัว", "อื่นๆ", "รายรับ"];
const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const shortMoney = new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 });
const currentMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);

function StatCard({ label, value, icon, tone = "" }: { label: string; value: string; icon: React.ReactNode; tone?: string }) {
  return <Card className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div><p>{label}</p><strong>{value}</strong></div></Card>;
}

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonth);
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [showManual, setShowManual] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await fetch(`/api/dashboard?month=${month}`, { cache: "no-store" }); if (!response.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ"); setData(await response.json()); }
    catch (e) { setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด"); }
    finally { setLoading(false); }
  }, [month]);
  useEffect(() => {
    let active = true;
    fetch(`/api/dashboard?month=${month}`, { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ"); return response.json() as Promise<ApiData>; })
      .then((result) => { if (active) { setData(result); setError(""); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "เกิดข้อผิดพลาด"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month]);

  const filtered = useMemo(() => (data?.transactions ?? []).filter((t) => (!query || `${t.description} ${t.original_text}`.toLowerCase().includes(query.toLowerCase())) && (!category || t.category === category)), [data, query, category]);
  const daily = useMemo(() => {
    const map = new Map<string, number>();
    (data?.transactions ?? []).filter((t) => t.type === "expense" && t.amount_jpy !== null).forEach((t) => map.set(t.date.slice(8), (map.get(t.date.slice(8)) ?? 0) + (t.amount_jpy ?? 0)));
    return [...map].sort((a, b) => Number(a[0]) - Number(b[0])).map(([day, amount]) => ({ day: `${day}日`, amount }));
  }, [data]);

  async function downloadPng() {
    if (!reportRef.current) return;
    const url = await toPng(reportRef.current, { pixelRatio: 2, backgroundColor: "#f3efe6", cacheBust: true });
    const link = document.createElement("a"); link.download = `moneyflow-${month}.png`; link.href = url; link.click();
  }

  if (loading && !data) return <main className="loading-screen"><Loader2 className="spin"/><p>กำลังจัดระเบียบกระแสเงิน…</p></main>;
  if (!data) return <main className="loading-screen"><AlertCircle/><p>{error || "ไม่พบข้อมูล"}</p><Button onClick={refresh}>ลองอีกครั้ง</Button></main>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span>MF</span><div><strong>MONEYFLOW</strong><small>JAPAN</small></div></div>
      <nav>{([
        ["overview", "ภาพรวม", <LayoutDashboard key="o"/>], ["transactions", "รายการ", <WalletCards key="t"/>],
        ["budgets", "งบประมาณ", <Sparkles key="b"/>], ["reports", "รายงาน", <FileText key="r"/>],
      ] as [Tab, string, React.ReactNode][]).map(([id, label, icon]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{icon}<span>{label}</span>{id === "transactions" && data.report.ambiguousEntries.length > 0 && <b>{data.report.ambiguousEntries.length}</b>}</button>)}</nav>
      <div className="sidebar-foot"><div className="avatar">P</div><div><strong>บัญชีส่วนตัว</strong><small>{data.demoMode ? "โหมดสาธิต" : "Supabase"}</small></div><Settings2/></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div><p className="eyebrow">PERSONAL FINANCE · TOKYO</p><h1>{tab === "overview" ? "ภาพรวมการเงิน" : tab === "transactions" ? "รายการทั้งหมด" : tab === "budgets" ? "งบประมาณรายเดือน" : "รายงานและอินโฟกราฟิก"}</h1></div><div className="top-actions"><label className="month-picker"><CalendarDays/><input type="month" value={month} onChange={(e) => setMonth(e.target.value)}/></label><button className="icon-button" onClick={refresh} aria-label="รีเฟรช"><RefreshCw className={loading ? "spin" : ""}/></button></div></header>
      {data.demoMode && <div className="demo-banner"><Sparkles/><span><strong>โหมดสาธิต</strong> — ข้อมูลตัวอย่างจะหายเมื่อรีสตาร์ตเซิร์ฟเวอร์ เชื่อม Supabase ก่อนใช้งานจริง</span></div>}
      {error && <div className="error-banner">{error}</div>}
      {tab === "overview" && <Overview data={data} daily={daily} setTab={setTab}/>} 
      {tab === "transactions" && <Transactions rows={filtered} query={query} setQuery={setQuery} category={category} setCategory={setCategory} onRefresh={refresh} onAdd={() => setShowManual(true)}/>} 
      {tab === "budgets" && <Budgets data={data} onRefresh={refresh}/>} 
      {tab === "reports" && <Reports data={data} month={month} reportRef={reportRef} downloadPng={downloadPng}/>} 
      <footer>อัปเดตล่าสุด {new Date(data.lastSync).toLocaleString("th-TH", { timeZone: "Asia/Tokyo" })} · ตัวเลขเป็นกระแสเงินสุทธิ ไม่ใช่ยอดเงินในบัญชี</footer>
    </main>
    <nav className="mobile-nav">{([ ["overview", "ภาพรวม", LayoutDashboard], ["transactions", "รายการ", WalletCards], ["budgets", "งบ", Sparkles], ["reports", "รายงาน", FileText] ] as const).map(([id,label,Icon]) => <button key={id} onClick={() => setTab(id)} className={tab === id ? "active" : ""}><Icon/><span>{label}</span></button>)}</nav>
    {showManual && <ManualModal month={month} onClose={() => setShowManual(false)} onSaved={() => { setShowManual(false); void refresh(); }}/>} 
  </div>;
}

function Overview({ data, daily, setTab }: { data: ApiData; daily: Array<{ day: string; amount: number }>; setTab: (tab: Tab) => void }) {
  const report = data.report;
  const top = [...data.transactions].filter((t) => t.type === "expense" && t.amount_jpy !== null).sort((a, b) => (b.amount_jpy ?? 0) - (a.amount_jpy ?? 0)).slice(0, 5);
  return <div className="page-stack">
    <section className="stats-grid"><StatCard label="รายรับเดือนนี้" value={money.format(report.income)} icon={<ArrowDownLeft/>} tone="income"/><StatCard label="รายจ่ายเดือนนี้" value={money.format(report.expenses)} icon={<ArrowUpRight/>} tone="expense"/><StatCard label="กระแสเงินสุทธิ" value={money.format(report.netCashFlow)} icon={<WalletCards/>} tone="net"/><StatCard label="จำนวนรายการ" value={`${report.transactionCount} รายการ`} icon={<FileText/>}/></section>
    <section className="charts-grid"><Card className="chart-card wide"><div className="card-head"><div><p className="eyebrow">DAILY FLOW</p><h2>แนวโน้มรายจ่ายรายวัน</h2></div><Badge>JPY</Badge></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={daily}><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#264d43" stopOpacity={0.35}/><stop offset="1" stopColor="#264d43" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e8e1d5"/><XAxis dataKey="day" axisLine={false} tickLine={false}/><YAxis tickFormatter={(v) => shortMoney.format(v)} axisLine={false} tickLine={false}/><Tooltip formatter={(v) => money.format(Number(v))}/><Area type="monotone" dataKey="amount" stroke="#264d43" strokeWidth={3} fill="url(#area)"/></AreaChart></ResponsiveContainer></div></Card>
      <Card className="chart-card"><div className="card-head"><div><p className="eyebrow">CATEGORY MIX</p><h2>รายจ่ายตามหมวด</h2></div></div><div className="donut-wrap"><ResponsiveContainer width="52%" height={220}><PieChart><Pie data={report.categorySpending} dataKey="amount" nameKey="category" innerRadius={60} outerRadius={90} paddingAngle={3}>{report.categorySpending.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}</Pie><Tooltip formatter={(v) => money.format(Number(v))}/></PieChart></ResponsiveContainer><div className="legend">{report.categorySpending.slice(0,5).map((item,i) => <div key={item.category}><i style={{background: COLORS[i % COLORS.length]}}/><span>{item.category}</span><b>{item.percentage}%</b></div>)}</div></div></Card></section>
    <section className="bottom-grid"><Card className="list-card"><div className="card-head"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>รายการล่าสุด</h2></div><button className="text-link" onClick={() => setTab("transactions")}>ดูทั้งหมด <ChevronRight/></button></div><TransactionList rows={data.transactions.slice(0,6)}/></Card>
      <div className="side-stack"><Card className="budget-mini"><div className="card-head"><div><p className="eyebrow">BUDGET PULSE</p><h2>สถานะงบประมาณ</h2></div></div>{report.budgetUsage.length ? report.budgetUsage.slice(0,4).map((b) => <div className="budget-row" key={b.category_id}><div><span>{b.category_id}</span><b>{Math.round(b.percentage)}%</b></div><div className="progress"><i style={{width: `${Math.min(b.percentage,100)}%`}} className={b.percentage >= 100 ? "over" : b.percentage >= 80 ? "warn" : ""}/></div><small>{money.format(b.spent)} / {money.format(b.budget_jpy)}</small></div>) : <p className="empty">ยังไม่ได้กำหนดงบ</p>}</Card>
      <Card className="top-expenses"><div className="card-head"><div><p className="eyebrow">TOP 5</p><h2>รายจ่ายสูงสุด</h2></div></div>{top.map((t,i) => <div key={t.transaction_id}><span>{i+1}</span><p>{t.description}<small>{t.category}</small></p><b>{money.format(t.amount_jpy ?? 0)}</b></div>)}</Card></div></section>
  </div>;
}

function TransactionList({ rows, editable = false, onRefresh }: { rows: TransactionRecord[]; editable?: boolean; onRefresh?: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");
  async function save(row: TransactionRecord) { await fetch(`/api/transactions/${row.transaction_id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ category: editCategory, review_status: "confirmed" }) }); setEditing(null); onRefresh?.(); }
  return <div className="transaction-list">{rows.map((row) => <div className="transaction-row" key={row.transaction_id}><div className={`tx-icon ${row.type}`}><span>{row.type === "income" ? "↙" : "↗"}</span></div><div className="tx-main"><strong>{row.description}</strong><span>{row.date} · {row.subcategory || row.category}</span></div>{editing === row.transaction_id ? <div className="inline-edit"><Select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select><button onClick={() => save(row)}><Check/></button></div> : <><div className="tx-meta">{row.review_status === "needs_review" && <Badge tone="warn">ตรวจสอบ</Badge>}<strong className={row.type}>{row.type === "expense" ? "−" : "+"}{row.amount_jpy === null ? `${row.original_amount} ${row.original_currency}` : money.format(row.amount_jpy)}</strong></div>{editable && <button className="edit-button" onClick={() => { setEditing(row.transaction_id); setEditCategory(row.category); }}><Pencil/></button>}</>}</div>)}{rows.length === 0 && <p className="empty">ไม่พบรายการ</p>}</div>;
}

function Transactions({ rows, query, setQuery, category, setCategory, onRefresh, onAdd }: { rows: TransactionRecord[]; query: string; setQuery:(v:string)=>void; category:string; setCategory:(v:string)=>void; onRefresh:()=>void; onAdd:()=>void }) {
  return <div className="page-stack"><Card className="toolbar"><label className="search"><Search/><Input placeholder="ค้นหารายการหรือร้านค้า" value={query} onChange={(e) => setQuery(e.target.value)}/></label><Select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">ทุกหมวดหมู่</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select><Button onClick={onAdd}><Plus/> เพิ่มรายการ</Button></Card><Card className="list-card full"><div className="card-head"><div><p className="eyebrow">TRANSACTION LEDGER</p><h2>{rows.length} รายการ</h2></div><Badge tone={rows.some((r) => r.review_status === "needs_review") ? "warn" : "good"}>{rows.filter((r) => r.review_status === "needs_review").length} รอตรวจสอบ</Badge></div><TransactionList rows={rows} editable onRefresh={onRefresh}/></Card></div>;
}

function Budgets({ data, onRefresh }: { data: ApiData; onRefresh:()=>void }) {
  const [category, setCategory] = useState(CATEGORIES[0]); const [amount, setAmount] = useState(""); const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) { e.preventDefault(); setSaving(true); await fetch("/api/budgets", { method:"PUT", headers:{"content-type":"application/json"}, body:JSON.stringify({month:data.month,category_id:category,budget_jpy:Number(amount),rollover_enabled:false,notes:""}) }); setAmount(""); setSaving(false); onRefresh(); }
  return <div className="page-stack"><Card className="budget-form"><div><p className="eyebrow">MONTHLY PLAN</p><h2>กำหนดงบที่ตั้งใจใช้</h2><p>งบประมาณเป็นแผนของคุณ ระบบจะไม่สร้างตัวเลขให้เอง</p></div><form onSubmit={save}><Select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.filter((c) => c !== "รายรับ").map((c)=><option key={c}>{c}</option>)}</Select><Input type="number" min="1" placeholder="งบประมาณ (JPY)" value={amount} onChange={(e)=>setAmount(e.target.value)} required/><Button disabled={saving}>{saving ? <Loader2 className="spin"/>:<Plus/>} บันทึกงบ</Button></form></Card><section className="budget-cards">{data.report.budgetUsage.map((b) => <Card key={b.category_id} className="budget-detail"><div className="card-head"><h2>{b.category_id}</h2><Badge tone={b.percentage >= 100 ? "warn" : "good"}>{Math.round(b.percentage)}%</Badge></div><div className="big-progress"><i style={{width:`${Math.min(b.percentage,100)}%`}} className={b.percentage >= 100 ? "over":""}/></div><div className="budget-numbers"><div><small>งบเดือนนี้</small><b>{money.format(b.budget_jpy)}</b></div><div><small>ใช้แล้ว</small><b>{money.format(b.spent)}</b></div><div><small>{b.remaining >= 0 ? "คงเหลือ":"เกินงบ"}</small><b className={b.remaining < 0 ? "negative":""}>{money.format(Math.abs(b.remaining))}</b></div></div></Card>)}{data.report.budgetUsage.length===0 && <Card className="empty-card">ยังไม่ได้กำหนดงบ</Card>}</section></div>;
}

function Reports({ data, month, reportRef, downloadPng }: { data:ApiData; month:string; reportRef:React.RefObject<HTMLDivElement | null>; downloadPng:()=>void }) {
  const bar = [{name:"กระแสเงิน",income:data.report.income,expenses:data.report.expenses}];
  return <div className="page-stack"><div className="report-actions"><div><p>รายงานเดือน {month}</p><small>สร้างจากรายการที่ตรวจสอบได้ใน Supabase</small></div><a className="button button-secondary" href={`/api/export/csv?month=${month}`}><Download/> CSV</a><Button onClick={downloadPng}><Camera/> ดาวน์โหลด PNG</Button></div><Card className="infographic" ref={reportRef}><div className="info-head"><div className="brand"><span>MF</span><div><strong>MONEYFLOW</strong><small>JAPAN</small></div></div><div><p>MONTHLY FINANCE NOTE</p><strong>{month}</strong></div></div><div className="info-hero"><p>กระแสเงินสุทธิ</p><strong>{money.format(data.report.netCashFlow)}</strong><span>รายรับ {money.format(data.report.income)} · รายจ่าย {money.format(data.report.expenses)}</span></div><div className="info-grid"><div className="info-chart"><h3>รายรับเทียบรายจ่าย</h3><ResponsiveContainer width="100%" height={220}><BarChart data={bar}><CartesianGrid vertical={false} stroke="#ded6c8"/><XAxis dataKey="name" hide/><YAxis tickFormatter={(v)=>shortMoney.format(v)} axisLine={false} tickLine={false}/><Tooltip formatter={(v)=>money.format(Number(v))}/><Bar dataKey="income" name="รายรับ" fill="#264d43" radius={[10,10,0,0]}/><Bar dataKey="expenses" name="รายจ่าย" fill="#d77454" radius={[10,10,0,0]}/></BarChart></ResponsiveContainer></div><div className="info-categories"><h3>หมวดรายจ่ายหลัก</h3>{data.report.categorySpending.slice(0,5).map((c,i)=><div key={c.category}><span><i style={{background:COLORS[i%COLORS.length]}}/>{c.category}</span><b>{money.format(c.amount)} <small>{c.percentage}%</small></b></div>)}</div></div><div className="info-foot"><span>{data.report.transactionCount} รายการ</span><span>{data.report.ambiguousEntries.length} รายการรอตรวจสอบ</span><span>{data.report.incompleteJpyCount ? `${data.report.incompleteJpyCount} รายการ FX ไม่สมบูรณ์` : "การแปลงสกุลเงินครบถ้วน"}</span></div></Card></div>;
}

function ManualModal({ month, onClose, onSaved }: { month:string; onClose:()=>void; onSaved:()=>void }) {
  const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setSaving(true);setError("");const form=new FormData(e.currentTarget);const body=Object.fromEntries(form);const response=await fetch("/api/transactions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...body,original_amount:Number(body.original_amount),original_currency:"JPY"})});if(response.ok)onSaved();else{const result=await response.json();setError(result.error||"บันทึกไม่สำเร็จ");setSaving(false)}}
  return <div className="modal-backdrop" onMouseDown={onClose}><Card className="modal" onMouseDown={(e)=>e.stopPropagation()}><div className="card-head"><div><p className="eyebrow">MANUAL ENTRY</p><h2>เพิ่มรายการ</h2></div><button className="icon-button" onClick={onClose}>×</button></div><form onSubmit={submit}><label>วันที่<Input name="date" type="date" defaultValue={`${month}-01`} required/></label><label>รายละเอียด<Input name="description" placeholder="เช่น กาแฟ" required/></label><div className="form-row"><label>ประเภท<Select name="type"><option value="expense">รายจ่าย</option><option value="income">รายรับ</option></Select></label><label>จำนวนเงิน (JPY)<Input name="original_amount" type="number" min="1" required/></label></div><label>หมวดหมู่<Select name="category">{CATEGORIES.map((c)=><option key={c}>{c}</option>)}</Select></label>{error&&<p className="form-error">{error}</p>}<Button disabled={saving}>{saving?<Loader2 className="spin"/>:<Check/>} บันทึกรายการ</Button></form></Card></div>;
}
