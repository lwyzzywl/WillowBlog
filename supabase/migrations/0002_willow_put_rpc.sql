-- ============================================================================
-- WillowBlog · 0002 并发安全的写入函数
-- ----------------------------------------------------------------------------
-- 前端保存模块时统一调用 willow_put()，它负责：
--   1. 再次校验管理员身份（RLS 之外的第二道闸门，防止匿名/普通用户直接调 RPC）
--   2. 校验 section 与目标表是否匹配（私人模块不可能写进公开表）
--   3. 乐观并发控制：expected_version 与云端不一致时抛 P0001，不覆盖别人更新的数据
--   4. 原子地 version + 1，避免「读-改-写」竞态
--   5. 未登录访客执行时抛 42501（insufficient_privilege）
--
-- 动态 SQL 只用 format() 的 %I 标识符占位符拼表名，且表名来自下面的白名单分支，
-- 不接受调用方传入的任意标识符。
-- ============================================================================

alter table public.willow_public  add column if not exists updated_by uuid;
alter table public.willow_private add column if not exists updated_by uuid;

comment on column public.willow_public.updated_by  is '最后一次写入的管理员 uid';
comment on column public.willow_private.updated_by is '最后一次写入的管理员 uid';

create or replace function public.willow_put(
  p_section          text,
  p_payload          jsonb,
  p_expected_version bigint  default null,
  p_is_public        boolean default false
)
returns table (version bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_table text;
  v_allowed      text[];
  v_uid          uuid := (select auth.uid());
  v_new_version  bigint;
  v_updated_at   timestamptz;
begin
  -- 1. 必须是已登录用户
  if v_uid is null then
    raise exception '需要登录后才能保存数据' using errcode = '42501';
  end if;

  -- 2. 必须是管理员
  if not public.is_willow_admin() then
    raise exception '当前账号不是 WillowBlog 管理员，无法写入数据' using errcode = '42501';
  end if;

  -- 3. section 与目标表必须匹配
  if p_is_public then
    v_target_table := 'willow_public';
    v_allowed := array['leetcode', 'notes'];
  else
    v_target_table := 'willow_private';
    v_allowed := array['checkins', 'studyLog', 'projects', 'sparkles', 'weekHours'];
  end if;

  if p_section is null or not (p_section = any (v_allowed)) then
    raise exception '模块 % 不允许写入 %', coalesce(p_section, '(null)'), v_target_table
      using errcode = '22023';
  end if;

  if p_payload is null then
    raise exception 'payload 不能为空' using errcode = '22004';
  end if;

  -- 4. 不带版本号 = 强制覆盖（仅用于管理员明确确认过的场景，例如数据导入）
  if p_expected_version is null then
    execute format(
      'insert into public.%I as t (section, payload, version, updated_at, updated_by)
         values ($1, $2, 1, now(), $3)
       on conflict (section) do update
         set payload = excluded.payload,
             version = t.version + 1,
             updated_at = now(),
             updated_by = excluded.updated_by
       returning t.version, t.updated_at',
      v_target_table
    )
    into v_new_version, v_updated_at
    using p_section, p_payload, v_uid;

    return query select v_new_version, v_updated_at;
    return;
  end if;

  -- 5. 带版本号 = 乐观并发控制
  begin
    execute format(
      'insert into public.%I (section, payload, version, updated_at, updated_by)
         values ($1, $2, $3, now(), $4)',
      v_target_table
    )
    using p_section, p_payload, p_expected_version, v_uid;
  exception
    when unique_violation then
      execute format(
        'update public.%I as t
            set payload = $2, version = t.version + 1, updated_at = now(), updated_by = $4
          where t.section = $1 and t.version = $3
        returning t.version, t.updated_at',
        v_target_table
      )
      into v_new_version, v_updated_at
      using p_section, p_payload, p_expected_version, v_uid;

      if v_new_version is null then
        -- 云端版本已经前进，拒绝覆盖
        raise exception '版本冲突：云端数据已被其他设备更新（期望版本 %）', p_expected_version
          using errcode = 'P0001';
      end if;

      return query select v_new_version, v_updated_at;
      return;
  end;

  -- insert 成功：首次写入
  execute format('select t.version, t.updated_at from public.%I t where t.section = $1', v_target_table)
    into v_new_version, v_updated_at
    using p_section;

  return query select v_new_version, v_updated_at;
end;
$$;

comment on function public.willow_put(text, jsonb, bigint, boolean) is
  'WillowBlog 管理员写入模块数据（乐观并发控制，冲突抛 P0001）';

revoke all on function public.willow_put(text, jsonb, bigint, boolean) from public;
revoke all on function public.willow_put(text, jsonb, bigint, boolean) from anon;
grant execute on function public.willow_put(text, jsonb, bigint, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 读取各模块版本号（用于导入前的冲突预检）
--
-- 为什么是 security definer：
--   函数体要 union 两张表，而 anon 对 willow_private 连表级 SELECT 都没有，
--   security invoker 会让整个函数直接 42501（连公开模块的版本也拿不到）。
--   因此提权读取，再用 is_willow_admin() 过滤私人行 —— 非管理员只看得到公开模块，
--   不会泄露「存在哪些私人模块」这类元数据。
--   search_path 固定为空，所有对象写全限定名。
--
-- 权限：只授予 authenticated（这是导入向导用的管理员功能，anon 没有理由调用）。
-- ---------------------------------------------------------------------------
create or replace function public.willow_versions()
returns table (section text, version bigint, updated_at timestamptz, is_public boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.section, p.version, p.updated_at, true
    from public.willow_public p
  union all
  select r.section, r.version, r.updated_at, false
    from public.willow_private r
   where public.is_willow_admin()
   order by 4 desc, 1;
$$;

comment on function public.willow_versions() is '列出各模块当前版本（非管理员只能看到公开模块）';

revoke all on function public.willow_versions() from public;
revoke all on function public.willow_versions() from anon;
grant execute on function public.willow_versions() to authenticated;
