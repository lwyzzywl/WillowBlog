-- ============================================================================
-- WillowBlog · 0001 初始架构
-- ----------------------------------------------------------------------------
-- 建立两张按模块存储 JSONB 的表：
--   willow_public  ：力扣题解 / 知识笔记（访客可读，仅管理员可写）
--   willow_private ：打卡 / 专注时长 / 项目日志 / 闪光点 / 每周时长（仅管理员可读写）
-- 以及管理员名单表 willow_admins、RLS 策略、表级 GRANT、并发控制函数。
--
-- 执行方式：Supabase Dashboard → SQL Editor → 全选粘贴执行。
-- 幂等：可重复执行。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. 管理员名单（单一事实来源）
-- ---------------------------------------------------------------------------
-- 只有这张表里的 auth.users.id 才被视为管理员。
-- 前端不硬编码任何 UID；SQL 策略与 RPC 都通过 is_willow_admin() 判断。
-- 该表不开放任何写策略 —— 新增/删除管理员只能由你在 SQL Editor 里执行
-- （SQL Editor 以 postgres 角色运行，不受 RLS 限制）。
create table if not exists public.willow_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

comment on table public.willow_admins is 'WillowBlog 管理员名单；仅 SQL Editor 可写';

alter table public.willow_admins enable row level security;

drop policy if exists willow_admins_read_self on public.willow_admins;
create policy willow_admins_read_self
  on public.willow_admins
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.willow_admins from anon;
revoke all on table public.willow_admins from authenticated;
revoke all on table public.willow_admins from public;
-- 只给「读自己那一行」，用于前端判断当前登录账号是不是管理员
grant select on table public.willow_admins to authenticated;

-- ---------------------------------------------------------------------------
-- 1. 数据表
-- ---------------------------------------------------------------------------
-- payload 原样保存模块的原始数据结构（数组 / 对象 / 数字都允许），
-- 不做任何「统一成数组」的转换，保证现有 React 组件零改动读取。

create table if not exists public.willow_public (
  section    text primary key,
  payload    jsonb       not null default '[]'::jsonb,
  version    bigint      not null default 1,
  updated_at timestamptz not null default now(),
  constraint willow_public_section_allowed check (section in ('leetcode', 'notes'))
);

create table if not exists public.willow_private (
  section    text primary key,
  payload    jsonb       not null default '[]'::jsonb,
  version    bigint      not null default 1,
  updated_at timestamptz not null default now(),
  constraint willow_private_section_allowed check (section in ('checkins', 'studyLog', 'projects', 'sparkles', 'weekHours'))
);

comment on table public.willow_public  is 'WillowBlog 公开模块：力扣题解(leetcode)、知识笔记(notes)';
comment on table public.willow_private is 'WillowBlog 私人模块：checkins/studyLog/projects/sparkles/weekHours';

-- CHECK 约束把「私人模块误写入公开表」和「公开模块误写入私人表」在数据库层挡住
-- 说明：willow:weekHours 在现有代码里是「数字」而不是数组，所以两张表的默认值统一写成
-- jsonb 可接受的 '[]'，但绝不强制 payload 必须是数组 —— 数字、对象都允许写入。

-- ---------------------------------------------------------------------------
-- 2. 开启 RLS
-- ---------------------------------------------------------------------------
alter table public.willow_public  enable row level security;
alter table public.willow_private enable row level security;

-- ---------------------------------------------------------------------------
-- 3. 管理员判定函数
-- ---------------------------------------------------------------------------
-- security definer：策略里需要读 willow_admins，而调用者（anon/authenticated）
-- 本身没有该表的读权限，必须提权读取；函数体不拼接任何动态 SQL，
-- 所以把 search_path 设为空串（最严格），所有对象都写全限定名。
create or replace function public.is_willow_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.willow_admins a where a.user_id = (select auth.uid())
  );
$$;

comment on function public.is_willow_admin() is '当前会话是否为 WillowBlog 管理员';

-- 不暴露给 anon（未登录时 is_willow_admin() 恒为 false，但没有理由允许调用）
revoke all on function public.is_willow_admin() from public;
revoke all on function public.is_willow_admin() from anon;
grant execute on function public.is_willow_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. 撤销默认权限，再显式 GRANT（表级权限是 RLS 的前提）
-- ---------------------------------------------------------------------------
-- schema 层的 USAGE 也显式声明，不依赖 Dashboard 的默认配置
grant usage on schema public to anon;
grant usage on schema public to authenticated;

revoke all on table public.willow_public  from anon;
revoke all on table public.willow_private from anon;
revoke all on table public.willow_public  from public;
revoke all on table public.willow_private from public;
revoke all on table public.willow_public  from authenticated;
revoke all on table public.willow_private from authenticated;

-- 公开表：访客可读；写入交给 RLS（authenticated 有 DML 权限但策略只放行管理员）
grant select on table public.willow_public to anon;
grant select, insert, update, delete on table public.willow_public to authenticated;

-- 私人表：anon 完全不授予；authenticated 有 DML 权限但策略只放行管理员
grant select, insert, update, delete on table public.willow_private to authenticated;

-- ---------------------------------------------------------------------------
-- 5. RLS 策略
-- ---------------------------------------------------------------------------

-- 5.1 公开表：任何人可读
drop policy if exists willow_public_read_all on public.willow_public;
create policy willow_public_read_all
  on public.willow_public
  for select
  to anon, authenticated
  using (true);

-- 5.2 公开表：只有管理员可写
drop policy if exists willow_public_admin_insert on public.willow_public;
create policy willow_public_admin_insert
  on public.willow_public
  for insert
  to authenticated
  with check (public.is_willow_admin());

drop policy if exists willow_public_admin_update on public.willow_public;
create policy willow_public_admin_update
  on public.willow_public
  for update
  to authenticated
  using (public.is_willow_admin())
  with check (public.is_willow_admin());

drop policy if exists willow_public_admin_delete on public.willow_public;
create policy willow_public_admin_delete
  on public.willow_public
  for delete
  to authenticated
  using (public.is_willow_admin());

-- 5.3 私人表：只有管理员可读写（anon 没有任何策略 → 一行也读不到）
drop policy if exists willow_private_admin_select on public.willow_private;
create policy willow_private_admin_select
  on public.willow_private
  for select
  to authenticated
  using (public.is_willow_admin());

drop policy if exists willow_private_admin_insert on public.willow_private;
create policy willow_private_admin_insert
  on public.willow_private
  for insert
  to authenticated
  with check (public.is_willow_admin());

drop policy if exists willow_private_admin_update on public.willow_private;
create policy willow_private_admin_update
  on public.willow_private
  for update
  to authenticated
  using (public.is_willow_admin())
  with check (public.is_willow_admin());

drop policy if exists willow_private_admin_delete on public.willow_private;
create policy willow_private_admin_delete
  on public.willow_private
  for delete
  to authenticated
  using (public.is_willow_admin());

-- ---------------------------------------------------------------------------
-- 6. updated_at 自动维护（直接 UPDATE 时兜底）
-- ---------------------------------------------------------------------------
create or replace function public.willow_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.willow_touch_updated_at() from public;
revoke all on function public.willow_touch_updated_at() from anon;
revoke all on function public.willow_touch_updated_at() from authenticated;

drop trigger if exists willow_public_touch on public.willow_public;
create trigger willow_public_touch
  before update on public.willow_public
  for each row execute function public.willow_touch_updated_at();

drop trigger if exists willow_private_touch on public.willow_private;
create trigger willow_private_touch
  before update on public.willow_private
  for each row execute function public.willow_touch_updated_at();
