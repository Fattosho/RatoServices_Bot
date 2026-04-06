create table if not exists users (
  id bigserial primary key,
  telegram_id bigint not null unique,
  username text,
  full_name text,
  is_affiliate boolean not null default false,
  affiliate_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists leads (
  id bigserial primary key,
  telegram_id bigint not null,
  username text,
  full_name text,
  referred_by_code text,
  first_contact_at timestamptz not null default now(),
  last_contact_at timestamptz not null default now()
);

create table if not exists services (
  id bigserial primary key,
  external_service_id text not null unique,
  category text not null,
  name text not null,
  description text,
  supplier_price numeric(20,2) not null,
  final_price numeric(20,2) not null,
  raw_payload jsonb not null,
  active boolean not null default true,
  catalog_platform text not null default 'Outros',
  catalog_reason text,
  catalog_score integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id bigserial primary key,
  telegram_id bigint not null,
  service_id bigint references services(id),
  display_service_name text,
  status text not null default 'pending',
  external_payment_id text,
  external_service_status text not null default 'pending',
  external_supplier_order_id text,
  total_amount numeric(20,2) not null default 0,
  credits_used numeric(20,2) not null default 0,
  pix_amount numeric(20,2) not null default 0,
  target_link text,
  quantity integer,
  referred_by_code text,
  last_notified_external_status text,
  last_supplier_check_at timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists checkout_carts (
  id bigserial primary key,
  telegram_id bigint not null unique,
  service_id bigint references services(id),
  platform text,
  service_type text,
  origin text,
  refill_mode text,
  target_link text,
  quantity integer,
  amount numeric(20,2),
  stage text not null default 'platform',
  status text not null default 'active',
  reminder_count integer not null default 0,
  last_reminder_at timestamptz,
  recovered_at timestamptz,
  converted_order_id bigint references orders(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_interaction_at timestamptz not null default now()
);

create table if not exists affiliate_wallets (
  id bigserial primary key,
  telegram_id bigint not null unique,
  pending_credits numeric(20,2) not null default 0,
  available_credits numeric(20,2) not null default 0,
  used_credits numeric(20,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists user_wallets (
  id bigserial primary key,
  telegram_id bigint not null unique,
  balance numeric(20,2) not null default 0,
  total_added numeric(20,2) not null default 0,
  total_spent numeric(20,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists wallet_topups (
  id bigserial primary key,
  telegram_id bigint not null,
  amount numeric(20,2) not null,
  status text not null default 'pending',
  external_payment_id text,
  referred_by_code text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists wallet_transactions (
  id bigserial primary key,
  telegram_id bigint not null,
  type text not null,
  amount numeric(20,2) not null,
  description text,
  reference_type text,
  reference_id text,
  created_at timestamptz not null default now()
);

create table if not exists support_tickets (
  id bigserial primary key,
  telegram_id bigint not null,
  category text not null,
  order_id bigint references orders(id),
  status text not null default 'open',
  assigned_to bigint,
  last_message_preview text,
  last_customer_message_at timestamptz,
  last_support_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists support_messages (
  id bigserial primary key,
  ticket_id bigint not null references support_tickets(id) on delete cascade,
  sender_role text not null,
  telegram_id bigint not null,
  message_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists order_action_logs (
  id bigserial primary key,
  telegram_id bigint not null,
  order_id bigint references orders(id),
  action text not null,
  supplier_order_id text,
  success boolean not null default false,
  message text,
  response_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists affiliate_credit_transactions (
  id bigserial primary key,
  telegram_id bigint not null,
  type text not null,
  amount numeric(20,2) not null,
  description text,
  reference_type text,
  reference_id text,
  created_at timestamptz not null default now()
);

alter table orders add column if not exists external_supplier_order_id text;
alter table orders add column if not exists external_payment_id text;
alter table orders add column if not exists display_service_name text;
alter table orders add column if not exists external_service_status text not null default 'pending';
alter table orders add column if not exists total_amount numeric(20,2) not null default 0;
alter table orders add column if not exists credits_used numeric(20,2) not null default 0;
alter table orders add column if not exists pix_amount numeric(20,2) not null default 0;
alter table orders add column if not exists target_link text;
alter table orders add column if not exists quantity integer;
alter table orders add column if not exists referred_by_code text;
alter table orders add column if not exists last_notified_external_status text;
alter table orders add column if not exists last_supplier_check_at timestamptz;
alter table orders add column if not exists paid_at timestamptz;

alter table services add column if not exists catalog_platform text not null default 'Outros';
alter table services add column if not exists catalog_reason text;
alter table services add column if not exists catalog_score integer not null default 0;

alter table wallet_topups add column if not exists external_payment_id text;
alter table wallet_topups add column if not exists referred_by_code text;
alter table wallet_topups add column if not exists paid_at timestamptz;

alter table checkout_carts add column if not exists service_id bigint references services(id);
alter table checkout_carts add column if not exists platform text;
alter table checkout_carts add column if not exists service_type text;
alter table checkout_carts add column if not exists origin text;
alter table checkout_carts add column if not exists refill_mode text;
alter table checkout_carts add column if not exists target_link text;
alter table checkout_carts add column if not exists quantity integer;
alter table checkout_carts add column if not exists amount numeric(20,2);
alter table checkout_carts add column if not exists stage text not null default 'platform';
alter table checkout_carts add column if not exists status text not null default 'active';
alter table checkout_carts add column if not exists reminder_count integer not null default 0;
alter table checkout_carts add column if not exists last_reminder_at timestamptz;
alter table checkout_carts add column if not exists recovered_at timestamptz;
alter table checkout_carts add column if not exists converted_order_id bigint references orders(id);
alter table checkout_carts add column if not exists created_at timestamptz not null default now();
alter table checkout_carts add column if not exists updated_at timestamptz not null default now();
alter table checkout_carts add column if not exists last_interaction_at timestamptz not null default now();
alter table support_tickets add column if not exists telegram_id bigint not null default 0;
alter table support_tickets add column if not exists category text not null default 'geral';
alter table support_tickets add column if not exists order_id bigint references orders(id);
alter table support_tickets add column if not exists status text not null default 'open';
alter table support_tickets add column if not exists assigned_to bigint;
alter table support_tickets add column if not exists assigned_to_name text;
alter table support_tickets add column if not exists last_message_preview text;
alter table support_tickets add column if not exists last_customer_message_at timestamptz;
alter table support_tickets add column if not exists last_support_message_at timestamptz;
alter table support_tickets add column if not exists created_at timestamptz not null default now();
alter table support_tickets add column if not exists updated_at timestamptz not null default now();
alter table support_tickets add column if not exists closed_at timestamptz;
alter table support_messages add column if not exists sender_role text not null default 'customer';
alter table support_messages add column if not exists telegram_id bigint not null default 0;
alter table support_messages add column if not exists message_text text not null default '';
alter table support_messages add column if not exists created_at timestamptz not null default now();
alter table order_action_logs add column if not exists telegram_id bigint not null default 0;
alter table order_action_logs add column if not exists order_id bigint references orders(id);
alter table order_action_logs add column if not exists action text not null default 'status';
alter table order_action_logs add column if not exists supplier_order_id text;
alter table order_action_logs add column if not exists success boolean not null default false;
alter table order_action_logs add column if not exists message text;
alter table order_action_logs add column if not exists response_payload jsonb;
alter table order_action_logs add column if not exists created_at timestamptz not null default now();

create unique index if not exists affiliate_credit_transactions_order_credit_uidx
  on affiliate_credit_transactions (reference_type, reference_id, type)
  where reference_type = 'order' and type = 'credit';

create unique index if not exists affiliate_credit_transactions_ref_credit_uidx
  on affiliate_credit_transactions (reference_type, reference_id, type)
  where type = 'credit';

create index if not exists checkout_carts_status_interaction_idx
  on checkout_carts (status, last_interaction_at);

create index if not exists orders_supplier_sync_idx
  on orders (status, external_service_status, last_supplier_check_at);

create index if not exists services_catalog_platform_idx
  on services (active, catalog_platform, category);

create index if not exists support_tickets_user_status_idx
  on support_tickets (telegram_id, status, updated_at desc);

create index if not exists support_tickets_status_updated_idx
  on support_tickets (status, updated_at desc);

create index if not exists support_messages_ticket_created_idx
  on support_messages (ticket_id, created_at asc);

create index if not exists order_action_logs_user_created_idx
  on order_action_logs (telegram_id, created_at desc);

create index if not exists order_action_logs_user_action_created_idx
  on order_action_logs (telegram_id, action, created_at desc);

create index if not exists order_action_logs_order_action_created_idx
  on order_action_logs (order_id, action, created_at desc);
