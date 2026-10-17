# Supabase 初始配置指南

本文档带你从零把 WillowBlog 接到 Supabase 上，并确认权限真的生效。
全程大约 15 分钟。

> 涉及密码、密钥的操作都在 Supabase 后台完成。**任何步骤都不需要把密码告诉我**，
> 你也不需要提交任何凭据到 GitHub。

---

## 目录

1. [创建 Supabase 项目](#1-创建-supabase-项目)
2. [妥善保存数据库密码](#2-妥善保存数据库密码)
3. [找到 Project URL 与 publishable key](#3-找到-project-url-与-publishable-key)
4. [执行 SQL Migration](#4-执行-sql-migration)
5. [创建唯一管理员账号](#5-创建唯一管理员账号)
6. [关闭公开注册](#6-关闭公开注册)
7. [配置本地环境变量](#7-配置本地环境变量)
8. [验证 RLS 已生效](#8-验证-rls-已生效)
9. [配置部署环境变量](#9-配置部署环境变量)
10. [常见问题](#10-常见问题)

---

## 1. 创建 Supabase 项目

1. 打开 <https://supabase.com> 登录，进入 Dashboard。
2. 点 **New project**，选择你的 Organization。
3. **Name**：例如 `willow-blog`。
4. **Database Password**：点 **Generate a password**，然后**立刻复制到密码管理器**（见下一节）。
5. **Region**：选择**离你所在地区最近**的区域，例如
   - 中国大陆用户通常选 `Southeast Asia (Singapore)` 延迟最低；
   - 如果你常在国外访问，选离你最近的那个即可。
   Region 建好之后**不能修改**，所以选之前想一下主要访问地点。
6. **Plan**：Free 足够个人博客使用（免费额度：500MB 数据库、1GB 存储、5GB 流量/月）。
7. 点 **Create new project**，等 1~2 分钟初始化完成。

---

## 2. 妥善保存数据库密码

- 数据库密码只会在创建项目时显示一次。请存入密码管理器（1Password / Bitwarden / KeePass 等）。
- **这个密码绝对不能写进前端代码、`.env.local` 里的 `VITE_*` 变量或 GitHub。**
- 如果只是用本项目的功能，你甚至不需要用到这个密码 ——
  前端只用 publishable key，权限靠 RLS 强制。
- 万一忘了密码：Dashboard → Project Settings → Database → Reset database password。
  重置会影响直连数据库的工具，不影响本站前端。

---

## 3. 找到 Project URL 与 publishable key

在 Dashboard 左侧进入 **Project Settings**：

| 需要的东西 | 位置 | 形如 |
| --- | --- | --- |
| Project URL | **Data API** → Project URL | `https://abcdefghijklmn.supabase.co` |
| Publishable key | **API Keys** → Publishable key | `sb_publishable_xxxxxxxx` |
| （旧项目）anon public key | **API Keys** → Legacy API keys → `anon` `public` | `eyJhbGciOi...`（很长的 JWT） |

> ⚠️ 同一个页面上还有 **`service_role` / `secret`** 密钥。
> 它**绕过所有 RLS**，等同于数据库管理员权限。
> **永远不要**把它写进任何 `VITE_` 变量、前端代码或提交到仓库。
> 本项目的 `src/lib/supabase.js` 会检测并拒绝这种配置。

---

## 4. 执行 SQL Migration

Dashboard 左侧 → **SQL Editor** → **New query**，然后**按顺序**执行下面两个文件
（每个文件全选复制粘贴，点 **Run**）：

### ① `supabase/migrations/0001_init_willow_tables.sql`

会创建：

- `willow_public`（力扣题解、知识笔记）— 访客可读，仅管理员可写
- `willow_private`（打卡、专注、项目、闪光点、每周时长）— 仅管理员可读写
- `willow_admins`（管理员名单）— 只有 SQL Editor 能改
- 开启 RLS、撤销默认权限、显式 GRANT、创建策略与 `updated_at` 触发器
- `is_willow_admin()` 判定函数（`security definer` + `search_path = ''`）

返回 `Success. No rows returned` 即成功。

### ② `supabase/migrations/0002_willow_put_rpc.sql`

会创建写入函数 `willow_put()`（带乐观并发控制）与 `willow_versions()`，
并收紧函数执行权限（`anon` 不能调用）。

### ③ 自检

执行 `supabase/sql/verify_rls.sql`，逐条检查输出：

- 三张表 `已开启RLS` 都是 `true`
- `willow_private` / `willow_admins` **没有** `anon` 的权限行
- `willow_public` 的 `anon` 只有 `SELECT`
- CHECK 约束存在（`willow_public_section_allowed` / `willow_private_section_allowed`）

> 用 Supabase CLI 的等价做法：`supabase link` 之后 `supabase db push`
> （`supabase/migrations/` 已是 CLI 标准目录结构）。

---

## 5. 创建唯一管理员账号

本项目**不提供注册入口**，管理员账号在后台手动创建。

1. Dashboard → **Authentication** → **Users** → **Add user** → **Create new user**
2. **Email**：你的邮箱（例如 `me@example.com`）
3. **Password**：设一个强密码（≥12 位，含大小写与符号），存进密码管理器
4. ✅ 勾选 **Auto Confirm User**（否则邮箱未确认，登录会报 “Email not confirmed”）
5. 点 **Create user**

### 找到管理员 User UID

在 Users 列表里，该用户所在行的 **UID** 列（形如 `3f1a9c2e-8b7d-4f10-9d21-6c5b4a3d2e1f`），
点一下即可复制。

### 把 UID 写进数据库

打开 `supabase/sql/setup_admin.sql`，把占位符替换成真实 UID：

```sql
insert into public.willow_admins (user_id, note)
values ('3f1a9c2e-8b7d-4f10-9d21-6c5b4a3d2e1f', 'WillowBlog 站长')
on conflict (user_id) do update set note = excluded.note;
```

> 文件里预置的是占位符 `<<<ADMIN_USER_UID>>>`，**必须由你填入真实值** ——
> 这样不会出现「以为配好了其实指向别人账号」的情况。

在 SQL Editor 执行，然后用文件末尾那条 `select` 确认名单里是你的邮箱。

**这是整个项目里唯一需要手改 UID 的地方**，其它文件都不硬编码 UID。

### 想换管理员？

```sql
delete from public.willow_admins where user_id = '旧UID';
insert into public.willow_admins (user_id, note) values ('新UID', 'WillowBlog 站长');
```

策略与 RPC 会自动跟着变，不需要改任何前端代码。

---

## 6. 关闭公开注册

Dashboard → **Authentication** → **Sign In / Providers**（或 **Settings**）：

1. 关闭 **Allow new users to sign up**（不同版本叫法略有差异：Enable signup / Allow new users to sign up）
2. 建议同时关闭邮箱以外的登录方式（Google / GitHub 等），只留 **Email**
3. **Authentication → URL Configuration**：
   - **Site URL**：填你的线上地址，例如 `https://你的域名/` 或 GitHub Pages 地址
     `https://<用户名>.github.io/WillowBlog/`
   - **Redirect URLs**：把本地与线上地址都加上
     （`http://localhost:5173`、`https://<用户名>.github.io/WillowBlog/`）

本项目使用邮箱密码登录，不做 OAuth 跳转，所以 Redirect URLs 主要用于后台邮件链接；
但配置正确可以避免以后启用邮件功能时踩坑。

---

## 7. 配置本地环境变量

```bash
copy .env.example .env.local      # macOS/Linux: cp .env.example .env.local
```

编辑 `.env.local`：

```ini
VITE_SUPABASE_URL=https://abcdefghijklmn.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
# 如果项目仍是旧版命名，也可以改用这一项：
# VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

要点：

- 变量名必须以 `VITE_` 开头，Vite 才会把它注入前端
- 改完 `.env.local` 要**重启** `npm run dev`
- `.env.local` 已在 `.gitignore` 里，不会被提交
- 只填 publishable / anon key，**不要**填 service_role

启动：

```bash
npm run dev
```

看到顶部状态从「读取云端…」变成「云端已同步」或「显示内置内容」就说明连通了。
如果显示橙色的「Supabase 尚未配置」，说明变量没读到，检查文件名与重启。

---

## 8. 验证 RLS 已生效

### 方式一：项目自带脚本（推荐）

脚本会用**三种真实角色**发请求验证：匿名访客、非管理员登录用户、管理员。

1. 先在 `.env.local` 里补上（**不提交**）：

```ini
# 仅用于测试时创建/删除一个临时账号，不会用于权限断言
SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key
WILLOW_ADMIN_EMAIL=me@example.com
WILLOW_ADMIN_PASSWORD=你的管理员密码
```

2. 运行：

```bash
npm run verify:rls
```

预期输出（全部 ✅）：

```
A. 匿名访客（anon key，无 JWT）
✅ 匿名单读公开表成功（访客可见题解/笔记）
✅ 匿名读私人表得到 0 行
✅ 匿名写入公开表被拒绝
✅ 匿名写入私人表被拒绝
✅ 匿名调用 willow_put 被拒绝
✅ 匿名读管理员名单被拒绝或为空

B. 非管理员已登录用户
✅ 非管理员账号可以登录（但不应获得权限）
✅ 非管理员读私人表得到 0 行
✅ 非管理员改公开表被拒绝（0 行受影响或报错）
✅ 非管理员调用 willow_put 被拒绝

C. 管理员（真实登录）
✅ 管理员登录成功
✅ 管理员读私人表成功
✅ 管理员写入成功且版本 +1
✅ 过期版本号写入被拒绝（防止静默覆盖）
```

> 没有 service_role key 时脚本会跳过 B 部分并明确标注「尚未验证」——
> 不会假装通过。没有管理员密码时同样跳过 C 部分。
> 测试用的 `SUPABASE_SERVICE_ROLE_KEY` **只用于建/删临时账号**，所有权限断言都用受限角色的真实 JWT 发起。

3. 测完可以把 `SUPABASE_SERVICE_ROLE_KEY` 从 `.env.local` 删掉；临时账号脚本会自动删除。

### 方式二：手动验证

1. 用**无痕窗口**打开线上站点 → 应该只能力扣题解和知识笔记，
   看不到打卡、项目日志、闪光点、专注计时器。
2. 打开开发者工具 → Console，粘贴下面这段（把两个值换成你的）：

```js
// 访客身份尝试读取私人表：应该返回空数组
const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
const sb = createClient('你的URL', '你的publishable_key')
console.log('私人表（应为 []）:', (await sb.from('willow_private').select('section')).data)
console.log('公开表（应有数据）:', (await sb.from('willow_public').select('section')).data)
// 访客尝试写入公开表：应该报错 permission denied / RLS
console.log('写入（应报错）:', (await sb.from('willow_public').update({ payload: [] }).eq('section', 'notes')).error?.code)
```

3. 用管理员账号登录 → 应该看到完整七模块，并能新增/编辑/删除。

---

## 9. 配置部署环境变量

前端构建时会把这些变量**编译进产物**，所以托管平台上也必须配置：

| 平台 | 配置位置 |
| --- | --- |
| GitHub Pages | 仓库 → Settings → Secrets and variables → **Actions** → New repository secret：`VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`，然后在 workflow 里 `env:` 引用 |
| Vercel | Project → Settings → **Environment Variables**，添加同名两项（Production / Preview / Development 都勾上） |

> 部署环境**同样不要**配置 service_role / 数据库密码。

**GitHub Pages 注意事项**

- 本项目 `vite.config.js` 已设 `base: './'`（相对路径），
  因此部署在 `https://<用户名>.github.io/WillowBlog/` 子路径下也能正常加载资源。
- 单页应用刷新 404 问题：本项目所有导航都是锚点（`#notes` 等），没有前端路由，
  所以不需要 404.html 重写规则。
- 若用 GitHub Actions 部署，把两个变量写进构建步骤：

```yaml
- run: npm ci && npm run build
  env:
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
```

**Vercel 注意事项**

- Framework Preset 选 **Vite**，Build Command `npm run build`，Output Directory `dist`。
- 环境变量在构建时注入，改完需要 **Redeploy** 才会生效。

---

## 10. 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| 顶部橙色「Supabase 尚未配置」 | `.env.local` 没读到。确认文件名、`VITE_` 前缀，并重启 dev server |
| 提示「检测到前端配置里填入了 service_role / secret key」 | 变量填错了，改成 publishable / anon key，并**立即去后台轮换那个 secret** |
| 登录报 `Invalid login credentials` | 邮箱或密码不对；或账号还没创建 |
| 登录报 `Email not confirmed` | 创建用户时没勾 Auto Confirm User，去 Users 里确认邮箱 |
| 登录成功但提示「不是 WillowBlog 管理员」 | `willow_admins` 里没有该 UID，回到[第 5 步](#5-创建唯一管理员账号) |
| 保存报 `没有权限执行该操作` | RLS 拒绝：确认已执行两个 migration，且当前账号在管理员名单里 |
| 保存报「云端数据已被其他设备更新」 | 正常的并发保护。点「加载云端最新」看别人的改动，再决定是否覆盖 |
| 报 `找不到数据表` / `PGRST205` | migration 没执行，回到[第 4 步](#4-执行-sql-migration) |
| 首页显示「显示内置内容」 | 云端暂时读不到（未配置 / 网络问题）。此时页面是**只读**的，不会写入任何数据 |
| 一直停在「读取云端…」 | 网络问题或 Project URL 错误；点顶部状态重试，或看浏览器 Console |

---

## 权限设计说明（给想深究的你）

- **两层判定**：表级 `GRANT`（有没有资格碰这张表）+ RLS 策略（能碰哪些行）。
  只写 RLS 而忘了 GRANT 会出现「策略看着对但一直 42501」。
- **管理员判定唯一入口**：`public.is_willow_admin()`，数据来自 `willow_admins` 表。
  前端、策略、RPC 都用它，不重复硬编码 UID。
- **为什么 `is_willow_admin()` 是 `security definer`**：
  策略里需要读 `willow_admins`，而调用者本身没有该表读权限，必须提权。
  函数体不拼接任何动态 SQL，因此把 `search_path` 设为空串（最严格），所有对象写全限定名。
- **`anon` 能执行 `willow_versions()`**：它只是列出各模块版本号给迁移预检用，
  而且 `security invoker` —— RLS 依然生效，访客只会看到公开模块的版本。
- **写入统一走 `willow_put()`**：原子地 `version + 1`，避免「读-改-写」竞态；
  并在函数内再校验一次管理员身份（RLS 之外的第二道闸门）。
