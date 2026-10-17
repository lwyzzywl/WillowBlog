-- ============================================================================
-- WillowBlog · RLS / 权限自检（单条语句，一次执行出一张表）
-- ----------------------------------------------------------------------------
-- 用法：Supabase Dashboard → SQL Editor → 全选本文件 → Run
--
-- 为什么写成一条语句：
--   SQL Editor 只会展示最后一条语句的结果，原来拆成多个 select 时你只能看到最后一段。
--   现在一次执行就能拿到完整报告，看「结论」列：PASS / FAIL / WARN。
--
-- 本文件只读系统目录，不改任何数据，可随时重复执行。
-- 真正的越权行为测试（用匿名 / 非管理员 / 管理员三种真实 JWT 发请求）：
--   npm run verify:rls          （需要项目 URL + publishable key）
--
-- 更深一层的信息（策略明细、数据条数、管理员名单、函数权限）见：
--   supabase/sql/verify_rls_details.sql
-- ============================================================================

with chk as (

  -- 1. 三张表都开启了 RLS
  select 1 as 序号, '三张表均已开启 RLS' as 检查项,
    case
      when (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname in ('willow_public','willow_private','willow_admins')) < 3
        then 'FAIL(表不存在，migration 未执行)'
      when (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname in ('willow_public','willow_private','willow_admins')
               and c.relrowsecurity) = 3 then 'PASS'
      else 'FAIL(有表未开启 RLS)'
    end as 结论,
    (select string_agg(c.relname || '=' || c.relrowsecurity::text, ', ')
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname in ('willow_public','willow_private','willow_admins')) as 详情

  union all

  -- 2. 公开表有 section 白名单约束（私人模块不可能写进公开表）
  select 2, '公开表 section 白名单约束存在',
    case when exists (
      select 1 from pg_constraint con
        join pg_class c on c.oid = con.conrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = 'willow_public' and con.contype = 'c'
         and pg_get_constraintdef(con.oid) ilike '%leetcode%'
         and pg_get_constraintdef(con.oid) ilike '%notes%'
    ) then 'PASS' else 'FAIL(缺 CHECK 约束)' end,
    coalesce((select string_agg(con.conname || ' → ' || pg_get_constraintdef(con.oid), ' | ')
                from pg_constraint con
                join pg_class c on c.oid = con.conrelid
                join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = 'willow_public' and con.contype = 'c'), '无')

  union all

  -- 3. 私人表有 section 白名单约束
  select 3, '私人表 section 白名单约束存在',
    case when exists (
      select 1 from pg_constraint con
        join pg_class c on c.oid = con.conrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = 'willow_private' and con.contype = 'c'
         and pg_get_constraintdef(con.oid) ilike '%checkins%'
         and pg_get_constraintdef(con.oid) ilike '%weekHours%'
    ) then 'PASS' else 'FAIL(缺 CHECK 约束)' end,
    coalesce((select string_agg(con.conname || ' → ' || pg_get_constraintdef(con.oid), ' | ')
                from pg_constraint con
                join pg_class c on c.oid = con.conrelid
                join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = 'willow_private' and con.contype = 'c'), '无')

  union all

  -- 4. anon 对公开表只有 SELECT，没有任何写权限
  select 4, 'anon 对 willow_public 只读',
    case
      when to_regclass('public.willow_public') is null then 'FAIL(表不存在)'
      when not has_table_privilege('anon', 'public.willow_public', 'SELECT') then 'FAIL(连读都没有)'
      when has_table_privilege('anon', 'public.willow_public', 'INSERT')
        or has_table_privilege('anon', 'public.willow_public', 'UPDATE')
        or has_table_privilege('anon', 'public.willow_public', 'DELETE') then 'FAIL(anon 拥有写权限)'
      else 'PASS'
    end,
    'SELECT=' || has_table_privilege('anon', 'public.willow_public', 'SELECT')::text
      || ', INSERT=' || has_table_privilege('anon', 'public.willow_public', 'INSERT')::text
      || ', UPDATE=' || has_table_privilege('anon', 'public.willow_public', 'UPDATE')::text
      || ', DELETE=' || has_table_privilege('anon', 'public.willow_public', 'DELETE')::text

  union all

  -- 5. anon 对私人表没有任何权限（连 SELECT 都不应有）
  select 5, 'anon 对 willow_private 无任何权限',
    case
      when to_regclass('public.willow_private') is null then 'FAIL(表不存在)'
      when has_table_privilege('anon', 'public.willow_private', 'SELECT')
        or has_table_privilege('anon', 'public.willow_private', 'INSERT')
        or has_table_privilege('anon', 'public.willow_private', 'UPDATE')
        or has_table_privilege('anon', 'public.willow_private', 'DELETE') then 'FAIL(anon 能访问私人表)'
      else 'PASS'
    end,
    'SELECT=' || coalesce(has_table_privilege('anon', 'public.willow_private', 'SELECT')::text, '?')
      || ', INSERT=' || coalesce(has_table_privilege('anon', 'public.willow_private', 'INSERT')::text, '?')
      || ', UPDATE=' || coalesce(has_table_privilege('anon', 'public.willow_private', 'UPDATE')::text, '?')
      || ', DELETE=' || coalesce(has_table_privilege('anon', 'public.willow_private', 'DELETE')::text, '?')

  union all

  -- 6. anon 对管理员名单无任何权限
  select 6, 'anon 对 willow_admins 无任何权限',
    case
      when to_regclass('public.willow_admins') is null then 'FAIL(表不存在)'
      when has_table_privilege('anon', 'public.willow_admins', 'SELECT')
        or has_table_privilege('anon', 'public.willow_admins', 'INSERT')
        or has_table_privilege('anon', 'public.willow_admins', 'UPDATE')
        or has_table_privilege('anon', 'public.willow_admins', 'DELETE') then 'FAIL(anon 能访问管理员表)'
      else 'PASS'
    end,
    'SELECT=' || coalesce(has_table_privilege('anon', 'public.willow_admins', 'SELECT')::text, '?')

  union all

  -- 7. authenticated 有表级 DML 权限（否则策略写对了也会 42501）
  select 7, 'authenticated 具备表级读写权限（供 RLS 再筛）',
    case
      when to_regclass('public.willow_public') is null or to_regclass('public.willow_private') is null then 'FAIL(表不存在)'
      when has_table_privilege('authenticated', 'public.willow_public', 'SELECT')
        and has_table_privilege('authenticated', 'public.willow_public', 'UPDATE')
        and has_table_privilege('authenticated', 'public.willow_private', 'SELECT')
        and has_table_privilege('authenticated', 'public.willow_private', 'UPDATE') then 'PASS'
      else 'FAIL(表级 GRANT 缺失)'
    end,
    'public: SELECT=' || coalesce(has_table_privilege('authenticated', 'public.willow_public', 'SELECT')::text, '?')
      || ' UPDATE=' || coalesce(has_table_privilege('authenticated', 'public.willow_public', 'UPDATE')::text, '?')
      || ' / private: SELECT=' || coalesce(has_table_privilege('authenticated', 'public.willow_private', 'SELECT')::text, '?')
      || ' UPDATE=' || coalesce(has_table_privilege('authenticated', 'public.willow_private', 'UPDATE')::text, '?')

  union all

  -- 8. 私人表策略：只对 authenticated，且都校验 is_willow_admin()
  select 8, '私人表策略仅 authenticated 且校验管理员',
    case
      when not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'willow_private')
        then 'FAIL(没有任何策略)'
      when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'willow_private' and 'anon' = any (roles))
        then 'FAIL(策略误授权给 anon)'
      when exists (
        select 1 from pg_policies
         where schemaname = 'public' and tablename = 'willow_private'
           and cmd in ('SELECT','INSERT','UPDATE','DELETE')
           and (coalesce(qual, '') || coalesce(with_check, '')) not ilike '%is_willow_admin%'
      ) then 'FAIL(有策略未校验管理员身份)'
      when (select count(distinct cmd) from pg_policies where schemaname = 'public' and tablename = 'willow_private') = 4 then 'PASS'
      else 'WARN(策略命令不完整)'
    end,
    coalesce((select string_agg(policyname || '(' || cmd || '→' || array_to_string(roles, ',') || ')', '; ')
                from pg_policies where schemaname = 'public' and tablename = 'willow_private'), '无策略')

  union all

  -- 9. 公开表策略：访客可读、写入仅管理员
  select 9, '公开表策略：访客可读 / 写入仅管理员',
    case
      when not exists (
        select 1 from pg_policies
         where schemaname = 'public' and tablename = 'willow_public' and cmd = 'SELECT' and 'anon' = any (roles)
      ) then 'FAIL(访客读不到公开表)'
      when exists (
        select 1 from pg_policies
         where schemaname = 'public' and tablename = 'willow_public'
           and cmd in ('INSERT','UPDATE','DELETE')
           and ('anon' = any (roles) or (coalesce(qual, '') || coalesce(with_check, '')) not ilike '%is_willow_admin%')
      ) then 'FAIL(写策略未限制为管理员)'
      when not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'willow_public' and cmd in ('INSERT','UPDATE','DELETE'))
        then 'FAIL(缺少写策略)'
      else 'PASS'
    end,
    coalesce((select string_agg(policyname || '(' || cmd || '→' || array_to_string(roles, ',') || ')', '; ')
                from pg_policies where schemaname = 'public' and tablename = 'willow_public'), '无策略')

  union all

  -- 10. 管理员名单没有任何写策略（只能由 SQL Editor / postgres 维护）
  select 10, 'willow_admins 无写策略（仅 SQL Editor 可改）',
    case
      when exists (
        select 1 from pg_policies
         where schemaname = 'public' and tablename = 'willow_admins' and cmd in ('INSERT','UPDATE','DELETE')
      ) then 'FAIL(API 可以修改管理员名单)'
      else 'PASS'
    end,
    coalesce((select string_agg(policyname || '(' || cmd || ')', '; ')
                from pg_policies where schemaname = 'public' and tablename = 'willow_admins'), '无策略')

  union all

  -- 11. anon 不能执行写入函数 / 管理员判定函数 / 版本列表函数
  select 11, 'anon 不能执行 willow_put / is_willow_admin / willow_versions',
    case
      when to_regprocedure('public.willow_put(text,jsonb,bigint,boolean)') is null then 'FAIL(willow_put 不存在)'
      when has_function_privilege('anon', 'public.willow_put(text,jsonb,bigint,boolean)', 'EXECUTE')
        or has_function_privilege('anon', 'public.is_willow_admin()', 'EXECUTE')
        or has_function_privilege('anon', 'public.willow_versions()', 'EXECUTE') then 'FAIL(anon 可执行提权函数)'
      when not has_function_privilege('authenticated', 'public.willow_put(text,jsonb,bigint,boolean)', 'EXECUTE') then 'FAIL(管理员也执行不了，前端无法保存)'
      else 'PASS'
    end,
    'anon.willow_put=' || coalesce(has_function_privilege('anon', 'public.willow_put(text,jsonb,bigint,boolean)', 'EXECUTE')::text, '?')
      || ', anon.is_willow_admin=' || coalesce(has_function_privilege('anon', 'public.is_willow_admin()', 'EXECUTE')::text, '?')
      || ', anon.willow_versions=' || coalesce(has_function_privilege('anon', 'public.willow_versions()', 'EXECUTE')::text, '?')
      || ', authenticated.willow_put=' || coalesce(has_function_privilege('authenticated', 'public.willow_put(text,jsonb,bigint,boolean)', 'EXECUTE')::text, '?')

  union all

  -- 12. 提权函数固定了 search_path（防 search_path 劫持）
  select 12, '提权函数已固定 search_path',
    case
      when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                        where n.nspname = 'public' and p.proname in ('is_willow_admin','willow_put','willow_touch_updated_at')) then 'FAIL(函数不存在)'
      when exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('is_willow_admin','willow_put','willow_touch_updated_at')
           and not exists (select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg where cfg like 'search_path=%')
      ) then 'FAIL(有函数未固定 search_path)'
      else 'PASS'
    end,
    coalesce((select string_agg(p.proname || '=' || coalesce(array_to_string(p.proconfig, ','), '未设置'), '; ')
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname in ('is_willow_admin','willow_put','willow_touch_updated_at')), '无')

  union all

  -- 13. 管理员名单是否已配置（空名单会让谁都进不去，属于配置未完成）
  select 13, '管理员名单已配置',
    case
      when to_regclass('public.willow_admins') is null then 'FAIL(表不存在)'
      when (select count(*) from public.willow_admins) = 0 then 'WARN(还没执行 setup_admin.sql 填 UID)'
      else 'PASS'
    end,
    '共 ' || coalesce((select count(*)::text from public.willow_admins), '0') || ' 位管理员'
      || coalesce((select '（' || string_agg(u.email, ', ') || '）'
                     from public.willow_admins a left join auth.users u on u.id = a.user_id), '')

)
select 序号, 检查项, 结论, 详情
  from chk
 order by 序号;
