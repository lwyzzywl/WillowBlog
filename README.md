# 柳树小屋 · Willow Blog

一个温暖治愈风格的「个人博客 + 成长记录」单页应用。
数据存放在 **Supabase 云端**，支持手机 / 平板 / 电脑多设备同步；
**力扣题解与知识笔记对所有人公开，其余个人数据只有管理员登录后才能看到。**

技术栈：React 19 + Vite + Tailwind CSS v4 + Lucide React + canvas-confetti + Supabase

---

## 目录

- [功能与权限](#功能与权限)
- [快速开始](#快速开始)
- [常见命令](#常见命令)
- [第一次部署（必读）](#第一次部署必读)
- [项目结构](#项目结构)
- [数据与安全](#数据与安全)
- [相关文档](#相关文档)

---

## 功能与权限

| 模块 | 存储位置 | 访客 | 管理员 |
| --- | --- | --- | --- |
| 力扣题解 `leetcode` | `willow_public` | ✅ 可读 | ✅ 可增删改 |
| 知识笔记 `notes` | `willow_public` | ✅ 可读 | ✅ 可增删改 |
| 打卡记录 `checkins` | `willow_private` | ❌ 完全不可见 | ✅ |
| 专注时长 `studyLog` | `willow_private` | ❌ | ✅ |
| 项目日志 `projects` | `willow_private` | ❌ | ✅ |
| 闪光点 `sparkles` | `willow_private` | ❌ | ✅ |
| 每周学习时长 `weekHours` | `willow_private` | ❌ | ✅ |

- **访客**：无需注册登录即可阅读题解与笔记。界面只显示这两个模块与一个低调的管理员登录入口，
  私人模块的导航、页面、统计数字都不会出现在 DOM 里。
- **管理员**：用 Supabase Auth 邮箱密码登录后恢复完整的七模块界面，可增删改。
  在一台设备上改完，另一台设备刷新（或点顶部「刷新云端数据」）即可看到。
- **权限由数据库强制**：真正的边界是 PostgreSQL 的行级安全策略（RLS），
  即使有人打开开发者工具直接调 Supabase API，也无法改公开内容或读私人数据。

---

## 快速开始

```bash
npm install

# 1. 配置 Supabase（详见 SUPABASE_SETUP.md）
copy .env.example .env.local      # macOS/Linux 用 cp
#   在 .env.local 里填 VITE_SUPABASE_URL 与 VITE_SUPABASE_PUBLISHABLE_KEY

# 2. 在 Supabase SQL Editor 依次执行
#   supabase/migrations/0001_init_willow_tables.sql
#   supabase/migrations/0002_willow_put_rpc.sql
#   supabase/sql/setup_admin.sql   （记得先填入你的管理员 UID）

npm run dev
```

打开 http://localhost:5173 。未配置 Supabase 时页面依然能打开，
会看到一条橙色配置提示，并用内置示例内容以只读方式展示，不会写入任何数据。

---

## 常见命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动本地开发服务器 |
| `npm run build` | 生产构建（输出到 `dist/`） |
| `npm run preview` | 本地预览构建产物 |
| `npm test` | 运行单元测试（vitest，47 项：Markdown 变换 / 备份校验 / 权限划分 / 错误文案） |
| `npm run test:sql` | **真实执行两个 migration + `verify_rls.sql`**，并用三种角色压测 RLS 权限（PGlite，无需任何凭据） |
| `npm run verify:app` | 浏览器端验收：访客权限隔离、静态产物无密钥泄露 |
| `npm run verify:rls` | 对真实 Supabase 项目验证 RLS（匿名 / 非管理员 / 管理员三种真实 JWT） |

`verify:app` 需要先 `npm run build`，并另起一个静态服务器指向 `dist/`：

```bash
node scripts/static-server.mjs dist 5199
npm run verify:app http://127.0.0.1:5199/
```

---

## 第一次部署（必读）

1. 建 Supabase 项目 → 拿 **Project URL** 与 **publishable key**
2. SQL Editor 执行两个 migration 文件
3. Auth 里手动创建唯一管理员账号（关闭公开注册），把 UID 填进 `setup_admin.sql` 执行
4. 本地写好 `.env.local`，先跑 `npm run test:sql`（本地真实执行 SQL），再跑 `npm run verify:rls` 确认权限在你的项目上真的生效
5. 旧数据：在原浏览器里导出备份 → 管理员登录新站点 → 顶部「旧数据迁移」导入（见 [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)）
6. 部署到 GitHub Pages 或 Vercel，并在托管平台配置同样的两个环境变量

完整步骤、截图级说明与排查清单见 **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)**。

---

## 项目结构

```
src/
  lib/supabase.js              Supabase 客户端（只接受公开密钥，误填 service_role 会被识别并拦截）
  services/
    cloudStorage.js            两张表的数据访问：fetchSection / saveSection / fetchVersions
    legacyBackup.js            旧 localStorage 备份的键名定义与结构校验
    migration.js               迁移计划、执行、复核、云端备份导出
  context/
    CloudDataProvider.jsx      七个模块的云端状态集中管理（退出登录时统一清空私人数据）
  hooks/
    useAuth.jsx                登录 / 退出 / 会话恢复 / 管理员判定
    useCloudData.js            单模块读写状态机（加载 / 防抖保存 / 并发冲突 / 离线回退）
  components/
    AdminLogin.jsx             管理员登录弹窗
    MigrationDialog.jsx        旧数据迁移向导
    SyncStatus.jsx             顶部同步状态
    CloudStatusBar.jsx         模块级保存状态
    ...                       原有业务组件（视觉与交互保持不变）
supabase/
  migrations/0001_init_willow_tables.sql   建表 + RLS + GRANT + 触发器
  migrations/0002_willow_put_rpc.sql       并发安全的写入函数
  sql/setup_admin.sql                      设置管理员 UID（唯一需要手改的地方）
  sql/verify_rls.sql                       权限自检（单条语句出 13 项 PASS/FAIL 报告）
  sql/verify_rls_details.sql               策略/约束/函数/数据明细（可选）
scripts/
  build.mjs          构建入口（规避部分 Windows 环境的 TEMP 权限问题）
  test-sql.mjs       用 PGlite 真实执行 migration + verify_rls.sql 并压测 RLS
  verify-app.mjs     浏览器端验收
  rls-check.mjs      对真实 Supabase 项目做 RLS 行为验证
  static-server.mjs  验收用静态服务器
public/backup-legacy.js   可在旧站点控制台直接执行的导出脚本
tests/                    vitest 单元测试
```

---

## 数据与安全

- **云端结构**：两张表 `willow_public` / `willow_private`，按 `section` 分行、`payload` 用 JSONB
  **原样保存**各模块既有数据结构（数组、嵌套 solutions、甚至 `weekHours` 这样的纯数字），
  因此现有组件几乎不需要改数据结构。
- **并发控制**：每行有 `version`。保存时带上读到的版本号，云端版本前进就拒绝覆盖并提示冲突，
  不会静默丢掉另一台设备的更新。
- **不会误清空**：只有「云端读取成功之后」才允许保存；读取失败时绝不把空数据写回。
  改题解不会影响笔记，改笔记不会碰到私人模块 —— 每个模块独立保存。
- **密钥**：前端只用 publishable / anon key。`service_role`、`sb_secret_`、数据库密码永远不进前端、
  不进仓库（`.gitignore` 已覆盖 `.env.local` 与备份文件）；`src/lib/supabase.js` 还会主动识别误填的
  service_role JWT 并在界面上阻止使用。
- **退出登录**：先 flush 未落盘的修改，再清空内存与界面上的私人数据。
- **计时器**：专注计时只在「一次专注结束」时写一次云端，不会每秒写数据库。

---

## 相关文档

- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) —— Supabase 项目创建、SQL 执行、管理员配置、环境变量、权限验证
- [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) —— 旧 localStorage 数据导出、导入、冲突处理、验证与回滚
- `.env.example` —— 环境变量模板
