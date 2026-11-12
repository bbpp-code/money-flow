-- Run once in the Supabase SQL Editor. No client policies are granted: all access uses server routes.
create table if not exists public.transactions (
  transaction_id uuid primary key,
  date date not null,
  created_at timestamptz not null default now(),
  description text not null,
  original_text text not null,
  type text not null check (type in ('expense','income')),
  category text not null,
  subcategory text not null default '',
  original_amount numeric(20,6) not null check (original_amount > 0),
  original_currency text not null,
  fx_rate numeric(20,10),
  fx_rate_date date,
  fx_provider text not null default '',
  amount_jpy bigint,
  payment_method text not null default '',
  source text not null,
  source_reference text not null unique,
  confidence numeric(5,4) not null,
  review_status text not null check (review_status in ('confirmed','needs_review')),
  notes text not null default '',
  updated_at timestamptz not null default now()
);
create index if not exists transactions_date_idx on public.transactions(date desc);
create index if not exists transactions_category_idx on public.transactions(category);

create table if not exists public.categories (
  category_id text primary key,
  name_th text not null,
  name_en text not null,
  parent_category text not null default '',
  keywords text not null default '',
  category_type text not null check (category_type in ('expense','income')),
  active boolean not null default true
);
create table if not exists public.budgets (
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  category_id text not null,
  budget_jpy bigint not null check (budget_jpy > 0),
  rollover_enabled boolean not null default false,
  notes text not null default '',
  primary key (month, category_id)
);
create table if not exists public.exchange_rates (
  date date not null,
  from_currency text not null,
  to_currency text not null,
  rate numeric(20,10) not null check (rate > 0),
  provider text not null,
  fetched_at timestamptz not null,
  primary key (date, from_currency, to_currency)
);
create table if not exists public.import_history (
  import_id uuid primary key default gen_random_uuid(),
  source text not null,
  source_reference text not null unique,
  fingerprint text not null,
  imported_at timestamptz not null default now(),
  status text not null,
  error text not null default ''
);
create table if not exists public.category_rules (
  rule_id text primary key,
  keyword_or_pattern text not null,
  category_id text not null references public.categories(category_id),
  subcategory text not null default '',
  priority integer not null default 0,
  enabled boolean not null default true
);
create table if not exists public.report_snapshots (
  report_id uuid primary key,
  date date not null unique,
  generated_at timestamptz not null,
  summary_json text not null
);

alter table public.transactions enable row level security;
alter table public.categories enable row level security;
alter table public.budgets enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.import_history enable row level security;
alter table public.category_rules enable row level security;
alter table public.report_snapshots enable row level security;

insert into public.categories (category_id,name_th,name_en,category_type) values
 ('income','รายรับ','Income','income'),
 ('food','อาหารและเครื่องดื่ม','Food & Drinks','expense'),
 ('transport','รถยนต์และการเดินทาง','Transportation','expense'),
 ('travel','ท่องเที่ยวและพักผ่อน','Travel & Leisure','expense'),
 ('hobby','งานอดิเรก','Hobbies','expense'),
 ('technology','เทคโนโลยี','Technology','expense'),
 ('health','สุขภาพ','Healthcare','expense'),
 ('household','ของใช้ในบ้าน','Household','expense'),
 ('personal','ดูแลส่วนตัว','Personal Care','expense'),
 ('other','อื่นๆ','Other','expense')
on conflict (category_id) do nothing;

insert into public.category_rules (rule_id,keyword_or_pattern,category_id,subcategory,priority) values
 ('rule-coffee','กาแฟ','food','กาแฟ',100),
 ('rule-shabu','ชาบู','food','ร้านอาหาร',100),
 ('rule-toll','ค่าทางด่วน','transport','ทางด่วน',100),
 ('rule-fuel','ค่าน้ำมัน','transport','น้ำมัน',100),
 ('rule-onsen','ออนเซ็น','travel','ออนเซ็น',100),
 ('rule-snow','สโนว์บอร์ด','hobby','สโนว์บอร์ด',100),
 ('rule-diving','ดำน้ำ','travel','กิจกรรม',100),
 ('rule-doctor','หมอ','health','การรักษา',100),
 ('rule-dentist','ทำฟัน','health','ทันตกรรม',100),
 ('rule-salary','เงินเดือนเข้า','income','เงินเดือน',100)
on conflict (rule_id) do nothing;
