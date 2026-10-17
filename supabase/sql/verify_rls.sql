-- ============================================================================
-- WillowBlog · RLS / 权限自检（在 Supabase SQL Editor 执行）
-- ----------------------------------------------------------------------------
-- 这些查询只读元数据，不会修改任何数据，可随时执行。
-- 前面的 1~6 项应该全部返回「符合预期」；7 项用于人工核对策略清单。
-- 真正的越权测试（用 anon key / 管理员 JWT 实际发请求）见 scripts/rls-check.mjs。
-- ============================================================================

-- 1. 两张表 + 管理员表都开启了 RLS
select
  c.relname                          as 表名,
  c.relrowsecurity                   as 已开启RLS,
  case when c.relrowsecurity then '符合预期' else '异常：RLS 未开启' end as 结论
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('willow_public', 'willow_private', 'willow_admins')
order by c.relname;

-- 2. 表级 GRANT（RLS 之外必须有表级权限，缺了就会出现「策略写对了却仍报 42501」）
select
  table_name  as 表名,
  grantee     as 角色,
  string_agg(distinct privilege_type, ', ' order by privilege_type) as 权限,
  case
    when table_name = 'willow_public'  and grantee = 'anon'
         and string_agg(distinct privilege_type, ',') = 'SELECT' then '符合预期（访客只读）'
    when table_name = 'willow_private' and grantee = 'anon' then '异常：私人表不应授予 anon'
    when table_name = 'willow_admins'  and grantee = 'anon' then '异常：管理员表不应授予 anon'
    when grantee = 'authenticated' then '符合预期（写入由 RLS 再限制为管理员）'
    else '请人工核对'
  end as 结论
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('willow_public', 'willow_private', 'willow_admins')
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

-- 3. CHECK 约束确实存在（防止私人模块写进公开表）
select
  con.conname  as 约束名,
  pg_get_constraintdef(con.oid) as 定义
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('willow_public', 'willow_private')
  and con.contype = 'c'
order by con.conname;

-- 4. RLS 策略清单
select
  tablename as 表名,
  policyname as 策略名,
  cmd       as 命令,
  roles     as 适用角色,
  coalesce(qual, '-')       as using条件,
  coalesce(with_check, '-') as with_check条件
from pg_policies
where schemaname = 'public'
  and tablename in ('willow_public', 'willow_private', 'willow_admins')
order by tablename, cmd, policyname;

-- 5. 函数权限（anon 不应能执行 is_willow_admin / willow_put）
select
  p.proname as 函数名,
  coalesce(string_agg(distinct a.rolname, ', '), '(无)') as 可执行角色
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
left join information_schema.routine_privileges rp
  on rp.routine_name = p.proname and rp.routine_schema = 'public'
left join pg_roles a on a.rolname = rp.grantee
where n.nspname = 'public'
  and p.proname in ('is_willow_admin', 'willow_put', 'willow_versions', 'willow_touch_updated_at')
group by p.proname
order by p.proname;

-- 6. 当前数据概览（不显示 payload 内容，只看模块与版本）
select
  'willow_public' as 表, section as 模块, version as 版本, updated_at as 更新时间,
  jsonb_typeof(payload) as payload类型,
  case jsonb_typeof(payload)
    when 'array'  then jsonb_array_length(payload)::text || ' 条'
    else '标量/对象'
  end as 记录数
from public.willow_public
union all
select
  'willow_private', section, version, updated_at,
  jsonb_typeof(payload),
  case jsonb_typeof(payload)
    when 'array'  then jsonb_array_length(payload)::text || ' 条'
    else '标量/对象'
  end
from public.willow_private
order by 1, 2;

-- 7. 管理员名单
select
  a.user_id, u.email, a.created_at,
  case when u.id is null then '异常：auth.users 中找不到该用户' else '正常' end as 结论
from public.willow_admins a
left join auth.users u on u.id = a.user_id;
