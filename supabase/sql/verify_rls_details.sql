-- ============================================================================
-- WillowBlog · RLS 明细查询（可选，逐条执行查看细节）
-- ----------------------------------------------------------------------------
-- verify_rls.sql 给出的是一张 PASS/FAIL 汇总表；想看底层明细时用这里的查询。
-- 每条单独选中执行即可（SQL Editor 只显示最后一条语句的结果）。
-- ============================================================================

-- ① 三张表的表级权限矩阵
select
  t.relname as 表名,
  r.rolname as 角色,
  string_agg(distinct p.privilege_type, ', ' order by p.privilege_type) as 权限
from pg_class t
join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
cross join (values ('anon'), ('authenticated')) as r(rolname)
left join information_schema.role_table_grants p
  on p.table_schema = 'public' and p.table_name = t.relname and p.grantee = r.rolname
where t.relname in ('willow_public', 'willow_private', 'willow_admins')
group by t.relname, r.rolname
order by 1, 2;

-- ② 策略明细（含完整表达式）
select
  tablename as 表名, policyname as 策略名, cmd as 命令,
  array_to_string(roles, ',') as 适用角色,
  coalesce(qual, '-') as using表达式,
  coalesce(with_check, '-') as with_check表达式
from pg_policies
where schemaname = 'public'
  and tablename in ('willow_public', 'willow_private', 'willow_admins')
order by tablename, cmd, policyname;

-- ③ CHECK 约束明细
select
  c.relname as 表名, con.conname as 约束名,
  pg_get_constraintdef(con.oid) as 定义
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('willow_public', 'willow_private')
  and con.contype = 'c'
order by 1, 2;

-- ④ 函数权限
select
  p.proname as 函数名,
  pg_get_function_identity_arguments(p.oid) as 参数,
  case when p.prosecdef then 'security definer（提权）' else 'security invoker' end as 类型,
  coalesce(array_to_string(p.proconfig, ', '), '未固定 search_path') as 配置,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon可执行,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated可执行
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_willow_admin', 'willow_put', 'willow_versions', 'willow_touch_updated_at')
order by 1;

-- ⑤ 数据概览（不显示 payload 内容，只看模块 / 版本 / 条数）
select
  'willow_public' as 表, section as 模块, version as 版本, updated_at as 更新时间,
  jsonb_typeof(payload) as payload类型,
  case jsonb_typeof(payload)
    when 'array' then jsonb_array_length(payload)::text || ' 条'
    else '标量（非数组）'
  end as 记录数
from public.willow_public
union all
select
  'willow_private', section, version, updated_at,
  jsonb_typeof(payload),
  case jsonb_typeof(payload)
    when 'array' then jsonb_array_length(payload)::text || ' 条'
    else '标量（非数组）'
  end
from public.willow_private
order by 1, 2;

-- ⑥ 管理员名单
select
  a.user_id, u.email, a.note, a.created_at,
  case when u.id is null then '异常：auth.users 中找不到该用户' else '正常' end as 状态
from public.willow_admins a
left join auth.users u on u.id = a.user_id;
