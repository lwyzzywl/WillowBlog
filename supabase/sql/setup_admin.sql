-- ============================================================================
-- WillowBlog · 设置管理员（唯一需要你手动改一处 UID 的 SQL）
-- ----------------------------------------------------------------------------
-- 使用步骤
--   1. Supabase Dashboard → Authentication → Users → Add user
--      填你的邮箱 + 密码，并勾选 Auto Confirm User（否则收不到确认邮件就登不上）
--   2. 在用户列表里复制该用户的 UID（形如 3f1a9c2e-....-....）
--   3. 把下面 <<<ADMIN_USER_UID>>> 替换成真实 UID（保留单引号），在 SQL Editor 执行
--   4. 执行 supabase/sql/verify_rls.sql 自检
--
-- 注意
--   * 这里没有预填任何 UUID —— 必须由你填入真实值，避免出现「看似配好其实不是你的账号」。
--   * 想换管理员：insert 新 UID、delete 旧 UID 即可，函数与策略会自动跟着变。
--   * 只有 SQL Editor（postgres 角色）能改这张表，前端与 API 都写不进来。
-- ============================================================================

insert into public.willow_admins (user_id, note)
values ('<<<ADMIN_USER_UID>>>', 'WillowBlog 站长')
on conflict (user_id) do update set note = excluded.note;

-- 查看当前管理员名单
select a.user_id, u.email, a.note, a.created_at
  from public.willow_admins a
  left join auth.users u on u.id = a.user_id
 order by a.created_at;

-- ---------------------------------------------------------------------------
-- 可选：确认当前 uid() 对应哪个邮箱（在 SQL Editor 里 uid() 为 null，属正常）
-- ---------------------------------------------------------------------------
-- select (select auth.uid()) as current_uid, public.is_willow_admin() as is_admin;
