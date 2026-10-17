# 让别人打开你的页面

这份文档只回答一件事：**怎么把你的 WillowBlog 变成一个别人能打开的网址。**

---

## 先看一张决策表

| 你的目的 | 选哪个 | 要不要先配 Supabase |
| --- | --- | --- |
| 只让**同一 WiFi** 下的人看（同事/家人坐你旁边） | 本地局域网预览 | 建议配（否则看到示例内容） |
| 发给**任何人**、长期可访问、免费 | **GitHub Pages**（推荐，仓库已在 GitHub） | 要 |
| 想要最简单的自动部署 | Vercel | 要 |
| 只想先看看线上效果 | 直接发布，不配 Supabase | 不用（但只有示例内容） |

> ⚠️ **发布前必读**：`willow_public` 表里如果没有数据，访客看到的是 `src/data.js` 里的
> **内置示例**（3 道题、5 篇笔记），不是你的真实内容。此时页面会明确标注
> 「示例内容 · 云端还没有数据」。想展示真实内容，先把数据写进云端（见 `MIGRATION_GUIDE.md`）。

---

## 方案 A：同一 WiFi 快速预览（1 分钟）

适合「我旁边的人现在就想看」。

```bash
npm run dev -- --host
```

终端会打印两行地址：

```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.23:5173/
```

把 **Network** 那行发给对方，对方在同一 WiFi 下用手机/电脑打开即可。
你的电脑要一直开着，关掉终端就失效。

> 注意：局域网只能同网段访问；对方的手机上不需要装任何东西。

---

## 方案 B：GitHub Pages（推荐）

你的仓库 `https://github.com/lwyzzywl/WillowBlog` 是**公开**的，公开仓库用 Pages 免费。

### 一次性设置（约 3 分钟）

**第 1 步：开启 Pages**

1. 打开 `https://github.com/lwyzzywl/WillowBlog/settings/pages`
2. **Source** 选 **GitHub Actions**（不要选 “Deploy from a branch”）
3. 不用点保存，选完即可

**第 2 步：添加两个仓库 Secret**

1. 打开 `https://github.com/lwyzzywl/WillowBlog/settings/secrets/actions`
2. 点 **New repository secret**，加两条：

| Name | Secret |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<你的项目ref>.supabase.co`（**不要**带 `/rest/v1/`） |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 你的 publishable key（`sb_publishable_...`） |

> 这两个值都可以从你的 `.env.local` 里直接复制（它们本来就是打包进前端的公开值）。
> **绝对不要**在这里加 service_role / secret key。

**第 3 步：推送代码**

仓库里已经有 `.github/workflows/deploy-pages.yml`，推送后会自动构建部署：

```bash
git add -A
git commit -m "feat: Supabase 云端化 + 权限系统"
git push origin main
```

### 拿网址

推送后打开 `https://github.com/lwyzzywl/WillowBlog/actions`，
能看到 **Deploy to GitHub Pages** 在跑（约 1~2 分钟）。绿色 ✅ 之后：

你的网址是 **`https://lwyzzywl.github.io/WillowBlog/`**

（在 Actions 的运行详情里也能直接看到 `page_url`；仓库 Settings → Pages 顶部同样会显示。）

### 后续更新

以后只要 `git push` 到 `main`，就会自动重新构建发布。不需要手动上传任何文件。

### 如果构建失败

打开 Actions 里失败的那次运行，看红色步骤：

| 报错 | 原因 |
| --- | --- |
| `npm ci` 失败 / lock 不同步 | 本地执行 `npm install` 后把 `package-lock.json` 一起提交 |
| `npm test` 失败 | 本地先跑 `npm test` 修好再推 |
| 构建成功但页面白屏 | 打开浏览器 Console 看资源 404；检查 `vite.config.js` 的 `base`（本项目已设 `./`，子路径没问题） |
| 页面显示「Supabase 尚未配置」 | 两个 Secret 没加或名字拼错（必须完全一致） |

---

## 方案 C：Vercel（不用写 workflow）

1. 打开 <https://vercel.com> → **Add New… → Project** → 导入 `WillowBlog` 仓库
2. Framework Preset 选 **Vite**（通常会自动识别）
   - Build Command：`npm run build`
   - Output Directory：`dist`
3. 展开 **Environment Variables**，加同样两个变量（Production / Preview / Development 都勾上）
4. 点 **Deploy**，约 1 分钟得到 `https://willow-blog-xxx.vercel.app`

以后 `git push` 会自动部署；改了环境变量需要 **Redeploy** 才生效。

---

## 发布前检查清单

按顺序做一遍，能避免「发给别人却是空白/示例」这类尴尬。

```bash
npm run doctor      # 1. 后台通不通、RLS 有没有生效、云端有没有数据
npm test            # 2. 单元测试（56 项）
npm run test:sql    # 3. 真实执行 SQL + 压测权限（42 项）
npm run build       # 4. 能构建
```

然后人工确认：

- [ ] `npm run doctor` 里「公开模块」显示的是**真实条数**，不是 0
- [ ] `npm run doctor` 里「匿名读取私人表」是 ✅ 被拒
- [ ] 发布后**用无痕窗口**打开你的网址：
  - [ ] 只能力扣题解、知识笔记两个导航
  - [ ] 看不到打卡 / 项目日志 / 闪光点 / 专注计时器
  - [ ] 能看到「管理员登录」按钮
- [ ] 用管理员账号登录后七个模块齐全、能增删改
- [ ] 手机上也打开一次，确认排版正常

### 发布前必须想清楚的一件事

**力扣题解和知识笔记是公开的**，任何拿到网址的人都能读、能复制。
发布之前请检查这两块内容里有没有：

- 私人草稿、TODO、吐槽
- 公司内部信息、未脱敏的代码
- 不想被别人看到的截图（图片是 base64 存在正文里的）

确认没问题再发布。想先只给自己看，可以：
- 用 Vercel 的 **Deployment Protection**（密码保护预览环境），或
- 先不发布，用方案 A 局域网看

---

## 常见问题

**Q：网址能换成自己的域名吗？**
可以。Pages：Settings → Pages → Custom domain；Vercel：Project → Settings → Domains。配置后记得去 Supabase
Authentication → URL Configuration 把新域名加到 **Site URL / Redirect URLs**。

**Q：免费项目会休眠吗？**
Supabase 免费项目**长期无访问会暂停**（约一周无请求）。暂停后打开站点会连不上数据库，
页面会显示「云端暂不可用，正在显示内置内容」。去 Supabase Dashboard 点 **Restore** 即可恢复。
GitHub Pages 本身不休眠。

**Q：别人能看到我的私人数据吗？**
不能。私人模块的数据在 `willow_private` 表里，`anon` 连表级权限都没有，
已用真实请求验证过（`npm run doctor` 的「匿名读取私人表」必须是被拒）。
前端也只在管理员登录后才请求这些数据。

**Q：别人能改我的内容吗？**
不能。写操作只有管理员能通过 RLS，且 `anon` 连写入权限都没有。

**Q：手机上能编辑吗？**
能，登录后界面与桌面一致（响应式布局）。但手机上写长代码体验一般，建议手机主要用来阅读。

**Q：改了内容，另一台设备多久能看到？**
在下一次加载/刷新时看到。也可以在管理员界面点顶部「刷新云端数据」立即拉取。
没有做实时推送（第一阶段不追求）。

---

## 一句话总结

```bash
npm run doctor                    # 确认后台没问题、云端有真实数据
git push origin main              # 触发 GitHub Pages 自动部署
# 然后打开 https://lwyzzywl.github.io/WillowBlog/
```
