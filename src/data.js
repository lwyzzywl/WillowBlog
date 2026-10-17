import {
  Binary,
  BookOpen,
  Braces,
  Clock,
  Code2,
  Cpu,
  Database,
  MemoryStick,
  Network,
  Rocket,
  Star,
} from 'lucide-react'

/* ---------------- 每日一句 ---------------- */
export const QUOTES = [
  '你不需要很厉害才能开始，但你需要开始才会很厉害。',
  '把大目标拆成小步子，每天走一点，就不焦虑了。',
  '代码会记住你的每一次认真。',
  'Bug 只是暂时迷路的思路，耐心一点，总能带它回家。',
  '今天的努力，是明天惊喜的伏笔。',
  '允许自己慢一点，但别停下来。',
  '学习不是比赛，是和自己温柔地较劲。',
  '每一次「原来如此」，都是给未来的自己点亮一盏灯。',
]

/** 按时段返回问候语 */
export function getGreeting(date) {
  const h = date.getHours()
  if (h >= 5 && h < 9) return { emoji: '🌅', text: '早上好', sub: '今天也是充满干劲的一天' }
  if (h >= 9 && h < 12) return { emoji: '☀️', text: '上午好', sub: '精神满满地开始学习吧' }
  if (h >= 12 && h < 14) return { emoji: '🌤️', text: '中午好', sub: '休息一下，下午继续发光' }
  if (h >= 14 && h < 18) return { emoji: '🍃', text: '下午好', sub: '泡杯茶，慢慢把今天过成喜欢的样子' }
  if (h >= 18 && h < 23) return { emoji: '🌙', text: '晚上好', sub: '安静的夜晚最适合沉淀知识' }
  return { emoji: '🌌', text: '夜深了', sub: '记得好好休息，明天继续前进' }
}

/** 依据日期确定每日一句（每天固定一句） */
export function getQuoteIndex(date) {
  const start = new Date(date.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((date - start) / 86400000)
  return ((dayOfYear % QUOTES.length) + QUOTES.length) % QUOTES.length
}

export function formatDateCN(date) {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 · 星期${weekdays[date.getDay()]}`
}

/* ---------------- 学习热力图 ---------------- */
export const HEAT_COLORS = ['#eae4d9', '#cfe8c9', '#8fcf9d', '#4faf72', '#2d8a56']

/** 生成最近一年的打卡热力图（GitHub 风格网格，只统计真实打卡记录） */
export function buildHeatmap(today = new Date(), checkinKeys = []) {
  const checked = new Set(checkinKeys)
  const end = new Date(today)
  end.setHours(0, 0, 0, 0)

  const days = []
  for (let i = 364; i >= 0; i--) {
    const date = new Date(end)
    date.setDate(date.getDate() - i)
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    const level = checked.has(key) ? 3 : 0
    days.push({ date, count: level, level, isToday: i === 0 })
  }

  const offset = days[0].date.getDay()
  const grid = [...Array(offset).fill(null), ...days]
  const weeks = []
  for (let w = 0; w < grid.length / 7; w++) weeks.push(grid.slice(w * 7, w * 7 + 7))

  const labels = []
  let prevMonth = -1
  weeks.forEach((week, index) => {
    const first = week.find(Boolean)
    if (first && first.date.getMonth() !== prevMonth) {
      prevMonth = first.date.getMonth()
      labels.push({ index, label: `${prevMonth + 1} 月` })
    }
  })

  return {
    weeks,
    labels,
    activeDays: days.filter((d) => d.level > 0).length,
  }
}

/* ---------------- 仪表盘速览 ---------------- */
export const QUICK_STATS = [
  { id: 'time', label: '本周学习时长', value: '12.5 小时', delta: '▲ 1.2h', icon: Clock, tint: 'bg-sky-100', color: 'text-sky-500' },
  { id: 'chapter', label: '已掌握章节', value: '32 个', delta: '▲ 4', icon: BookOpen, tint: 'bg-emerald-100', color: 'text-emerald-500' },
  { id: 'project', label: '进行中项目', value: '2 个', delta: '稳步推进', icon: Rocket, tint: 'bg-amber-100', color: 'text-amber-500' },
  { id: 'star', label: '收集闪光点', value: '28 颗', delta: '▲ 3', icon: Star, tint: 'bg-rose-100', color: 'text-rose-400' },
]

/* ---------------- 计算机四大件 ---------------- */
export const SUBJECTS = [
  {
    id: 'algo',
    name: '数据结构与算法',
    en: 'Data Structures & Algorithms',
    icon: Binary,
    desc: '打好一切编码的内功基础',
    color: {
      iconBox: 'bg-rose-100 text-rose-500',
      rowHover: 'hover:bg-rose-50',
      ring: '#fb7185',
      ringEnd: '#fb923c',
    },
    chapters: [
      { id: 'a1', title: '数组与链表', status: 'done' },
      { id: 'a2', title: '栈与队列', status: 'done' },
      { id: 'a3', title: '树与二叉树', status: 'done' },
      { id: 'a4', title: '红黑树', status: 'done' },
      { id: 'a5', title: '动态规划', status: 'doing' },
      { id: 'a6', title: '图论与最短路径', status: 'todo' },
    ],
  },
  {
    id: 'os',
    name: '操作系统',
    en: 'Operating System',
    icon: Cpu,
    desc: '理解计算机的调度与管理艺术',
    color: {
      iconBox: 'bg-sky-100 text-sky-500',
      rowHover: 'hover:bg-sky-50',
      ring: '#38bdf8',
      ringEnd: '#818cf8',
    },
    chapters: [
      { id: 'o1', title: '进程与线程', status: 'done' },
      { id: 'o2', title: 'CPU 调度算法', status: 'done' },
      { id: 'o3', title: '虚拟内存', status: 'doing' },
      { id: 'o4', title: '死锁', status: 'todo' },
      { id: 'o5', title: '文件系统', status: 'todo' },
      { id: 'o6', title: 'I/O 模型', status: 'todo' },
    ],
  },
  {
    id: 'net',
    name: '计算机网络',
    en: 'Computer Network',
    icon: Network,
    desc: '拆解比特如何在世界里旅行',
    color: {
      iconBox: 'bg-amber-100 text-amber-500',
      rowHover: 'hover:bg-amber-50',
      ring: '#f59e0b',
      ringEnd: '#fbbf24',
    },
    chapters: [
      { id: 'n1', title: 'OSI 与 TCP/IP 模型', status: 'done' },
      { id: 'n2', title: 'TCP 三次握手四次挥手', status: 'done' },
      { id: 'n3', title: 'HTTP 与 HTTPS', status: 'doing' },
      { id: 'n4', title: 'DNS 解析过程', status: 'todo' },
      { id: 'n5', title: '拥塞控制', status: 'todo' },
    ],
  },
  {
    id: 'co',
    name: '计算机组成原理',
    en: 'Computer Organization',
    icon: MemoryStick,
    desc: '看懂 CPU 的每一次心跳',
    color: {
      iconBox: 'bg-violet-100 text-violet-500',
      rowHover: 'hover:bg-violet-50',
      ring: '#a78bfa',
      ringEnd: '#f472b6',
    },
    chapters: [
      { id: 'c1', title: '冯诺依曼结构', status: 'done' },
      { id: 'c2', title: '数据的机器级表示', status: 'done' },
      { id: 'c3', title: 'CPU 流水线', status: 'doing' },
      { id: 'c4', title: '存储层次结构', status: 'todo' },
      { id: 'c5', title: '指令周期与微程序', status: 'todo' },
    ],
  },
]

export const STATUS_LABELS = { done: '已掌握', doing: '正在学习', todo: '待学习' }
/* ---------------- 自定义科目配置 ---------------- */
export const SUBJECT_ICON_OPTIONS = [
  { id: 'binary', icon: Binary },
  { id: 'cpu', icon: Cpu },
  { id: 'network', icon: Network },
  { id: 'memory', icon: MemoryStick },
  { id: 'book', icon: BookOpen },
  { id: 'braces', icon: Braces },
  { id: 'database', icon: Database },
  { id: 'code', icon: Code2 },
]

export const SUBJECT_COLOR_SCHEMES = [
  { id: 'rose', label: '蜜桃粉', iconBox: 'bg-rose-100 text-rose-500', rowHover: 'hover:bg-rose-50', ring: '#fb7185', ringEnd: '#fb923c' },
  { id: 'sky', label: '雾霾蓝', iconBox: 'bg-sky-100 text-sky-500', rowHover: 'hover:bg-sky-50', ring: '#38bdf8', ringEnd: '#818cf8' },
  { id: 'amber', label: '暖阳橙', iconBox: 'bg-amber-100 text-amber-500', rowHover: 'hover:bg-amber-50', ring: '#f59e0b', ringEnd: '#fbbf24' },
  { id: 'violet', label: '香芋紫', iconBox: 'bg-violet-100 text-violet-500', rowHover: 'hover:bg-violet-50', ring: '#a78bfa', ringEnd: '#f472b6' },
  { id: 'emerald', label: '薄荷绿', iconBox: 'bg-emerald-100 text-emerald-500', rowHover: 'hover:bg-emerald-50', ring: '#34d399', ringEnd: '#14b8a6' },
  { id: 'wood', label: '原木棕', iconBox: 'bg-orange-100 text-orange-500', rowHover: 'hover:bg-orange-50', ring: '#c99a6b', ringEnd: '#f59e0b' },
]

export const PROJECT_EMOJIS = ['💻', '🕸️', '🎨', '📱', '🤖', '📊', '🎮', '📦']

/* ---------------- 项目实战日志 ---------------- */
export const PROJECTS = [
  {
    id: 'p1',
    emoji: '💻',
    name: 'Mini-OS 玩具操作系统内核',
    status: '进行中',
    period: '2026.06 — 至今',
    stack: ['C', 'x86 汇编', 'QEMU', 'Makefile'],
    pitfall:
      '在裸机上打印字符时，VGA 缓冲区地址写错了偏移，字符全变成乱码。排查半天才发现要按 (行 × 80 + 列) × 2 寻址——字符和属性字节是成对存储的。',
    review: '',
  },
  {
    id: 'p2',
    emoji: '🕸️',
    name: '极简 HTTP 服务器',
    status: '已完成',
    period: '2026.03 — 2026.05',
    stack: ['Python', 'Socket', 'HTTP/1.1'],
    pitfall:
      '浏览器一直 pending 不渲染，最后发现 Content-Length 和实际字节数差 1——少算了一个换行符。协议细节里没有小事。',
    review:
      '把协议规范逐字读一遍，比盲目调试更高效；写完顺手做了压力测试，发现串行 accept 才是真正的瓶颈，为下一步重构指明了方向。',
  },
  {
    id: 'p3',
    emoji: '🎨',
    name: '算法可视化 Web 应用',
    status: '已完成',
    period: '2025.11 — 2026.02',
    stack: ['React', 'TypeScript', 'Canvas'],
    pitfall:
      '动画帧率掉到个位数，原来是每帧都在 new 大数组。改成双缓冲 + requestAnimationFrame 后丝般顺滑，也让我第一次直观理解了「避免无谓分配」。',
    review:
      '可视化让排序过程从抽象变成直觉，自己讲给别人听时也更有底气。用户反馈想要「步进按钮」，已记入下一版 Roadmap。',
  },
  {
    id: 'p4',
    emoji: '📱',
    name: '校园二手书小程序（个人版）',
    status: '进行中',
    period: '2026.07 — 至今',
    stack: ['微信小程序', '云开发', 'JavaScript'],
    pitfall:
      '云数据库默认安全规则拒绝所有读取，折腾了一晚上才找到规则配置入口。教训：先读官方文档的「安全」章节再动手。',
    review: '',
  },
]

/* ---------------- 闪光点碎片 ---------------- */
export const INITIAL_SPARKLES = [
  {
    id: 's1',
    emoji: '🧘',
    text: '今天遇到 Bug 没有烦躁，先喝了口水再排查，情绪超稳定，我很棒！',
    bg: '#fff3d6',
    date: '8 月 24 日',
  },
  {
    id: 's2',
    emoji: '🤝',
    text: '帮群里的小伙伴解决了一个指针越界的小问题，被感谢的感觉真好。',
    bg: '#ffe9ec',
    date: '8 月 22 日',
  },
  {
    id: 's3',
    emoji: '🔥',
    text: '坚持连续学习打卡 3 周啦，自律值 +1！',
    bg: '#e8f0fb',
    date: '8 月 20 日',
  },
  {
    id: 's4',
    emoji: '🗺️',
    text: '把一周学过的内容画成了思维导图，复习时省了好多时间。',
    bg: '#eaf6ea',
    date: '8 月 17 日',
  },
  {
    id: 's5',
    emoji: '🎉',
    text: '第一次完整跑通了 mini OS 的 hello world，成就感爆棚！',
    bg: '#f2edfb',
    date: '8 月 15 日',
  },
]

export const SPARKLE_EMOJIS = ['✨', '🌟', '💪', '🌱', '🤗', '🎉']

export const SPARKLE_COLORS = [
  { name: '奶油黄', bg: '#fff3d6' },
  { name: '蜜桃粉', bg: '#ffe9ec' },
  { name: '雾霾蓝', bg: '#e8f0fb' },
  { name: '薄荷绿', bg: '#eaf6ea' },
  { name: '香芋紫', bg: '#f2edfb' },
]

/* ---------------- 知识笔记本 ---------------- */
export const INITIAL_NOTES = [
  {
    id: 'note-os-vm',
    category: 'os',
    title: '虚拟内存：给每个进程一台「假的」完整机器',
    keywords: ['虚拟内存', '页表', '缺页中断', 'MMU'],
    updatedAt: '8 月 29 日',
    content: `虚拟内存让每个进程都以为自己独占一整台机器，**逻辑地址**与**物理地址**通过页表完成映射。

> 我的理解：虚拟内存 = 地址翻译 + 按需加载 + 换入换出，三者缺一不可。

- 页表由 MMU 配合查询，每次访存都离不开它
- \`TLB\` 是页表的高速缓存，命中率极高
- 缺页中断后，内核负责把磁盘上的页换进内存

\`\`\`c
void *ptr = mmap(NULL, 4096, PROT_READ | PROT_WRITE,
                 MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
*ptr = 42; // 第一次写入时触发缺页中断
\`\`\`
`,
  },
  {
    id: 'note-os-thread',
    category: 'os',
    title: '进程与线程：一次分清「资源」与「执行」',
    keywords: ['进程', '线程', '上下文切换'],
    updatedAt: '8 月 27 日',
    content: `进程是**资源分配**的最小单位，线程是**CPU 调度**的最小单位。

> 一句话记忆：进程管「有什么」，线程管「跑什么」。

- 同一进程内的线程共享堆与全局变量，但栈各自独立
- 线程切换比进程切换轻量，共享数据时却要小心竞争
- \`fork()\` 复制整个进程，\`clone()\` 可以选择性共享资源

\`\`\`text
进程：资源容器（地址空间、文件描述符、信号处理）
线程：执行流（寄存器、栈、程序计数器）
\`\`\`
`,
  },
  {
    id: 'note-algo-rb',
    category: 'algo',
    title: '红黑树：用颜色规则换来的稳定 O(log n)',
    keywords: ['红黑树', '平衡树', '旋转'],
    updatedAt: '8 月 25 日',
    content: `红黑树是一棵**自平衡的二叉搜索树**，用颜色规则换来了 O(log n) 的稳定查找。

> 五条性质只记一句：红黑红黑，红不连红，黑高相同。

- 插入后最多旋转 2 次就能恢复平衡，删除最多 3 次
- Java 的 \`TreeMap\`、C++ 的 \`std::map\` 底层都是红黑树
- 适合频繁插入删除又要求有序遍历的场景

\`\`\`c
// 插入修复的经典套路：按「叔叔节点」的颜色分类讨论
if (uncle && uncle->color == RED) {
  parent->color = BLACK;
  uncle->color = BLACK;
  grandparent->color = RED;
  node = grandparent;
}
\`\`\`
`,
  },
  {
    id: 'note-algo-dp',
    category: 'algo',
    title: '动态规划四步走：从暴力递归到空间优化',
    keywords: ['动态规划', 'DP', '状态转移'],
    updatedAt: '8 月 23 日',
    content: `动态规划的核心是**重叠子问题 + 最优子结构**，把大问题拆成可复用的小答案。

> 看到「最值 + 可拆分 + 会重复计算」，先想 DP 而不是暴力递归。

1. 定义状态：\`dp[i]\` 代表什么
2. 找转移方程：\`dp[i]\` 由哪些状态推出来
3. 确定初始条件与遍历顺序
4. 最后看能否用滚动数组做空间优化

\`\`\`python
def fib(n):
    dp = [0, 1] + [0] * (n - 1)
    for i in range(2, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]
    return dp[n]
\`\`\`
`,
  },
  {
    id: 'note-proj-idt',
    category: 'projects',
    title: 'Mini-OS 记一笔：键盘终于有反应了！',
    keywords: ['Mini-OS', '中断', 'IDT', '踩坑'],
    updatedAt: '8 月 21 日',
    content: `今天给 Mini-OS 加上了中断描述符表（IDT），键盘第一次能收到输入了！

> 踩坑：门描述符里的段选择子忘了写 GDT 偏移，一按键盘就三连异常重启。

- 先把 8259A PIC 的 IRQ 0-15 重映射到 32-47
- \`lidt\` 之前要把 IDT 地址塞进结构体
- 下一步：把中断服务程序重写成 C 语言版本
`,
  },
]

/* ---------------- 力扣题解 ---------------- */
export const DIFFICULTIES = [
  { id: 'easy', label: '简单', badge: 'bg-emerald-50 text-emerald-600 ring-emerald-200' },
  { id: 'medium', label: '中等', badge: 'bg-amber-50 text-amber-600 ring-amber-200' },
  { id: 'hard', label: '困难', badge: 'bg-rose-50 text-rose-600 ring-rose-200' },
]

export const CODE_LANGS = ['C++', 'Java', 'Python', 'JavaScript', 'Go', 'Rust', 'SQL', '其他']

/** 大 O 记号的括号内容，界面显示为 O(1)、O(log n)、O(n²)… */
export const COMPLEXITY_OPTIONS = [
  { value: '1', label: 'O(1)' },
  { value: 'log n', label: 'O(log n)' },
  { value: 'n', label: 'O(n)' },
  { value: 'n log n', label: 'O(n log n)' },
  { value: 'n²', label: 'O(n²)' },
  { value: 'n³', label: 'O(n³)' },
  { value: '2ⁿ', label: 'O(2ⁿ)' },
  { value: 'n!', label: 'O(n!)' },
  { value: 'm + n', label: 'O(m + n)' },
  { value: 'm × n', label: 'O(m × n)' },
]

export const INITIAL_LEETCODE = [
  {
    id: 'lc-two-sum',
    title: '两数之和',
    link: 'https://leetcode.cn/problems/two-sum/',
    difficulty: 'easy',
    tags: ['数组', '哈希表'],
    solutions: [
      {
        id: 'sol-ts-1',
        title: '解法一：暴力枚举',
        lang: 'C++',
        approach: '双重循环枚举所有下标组合 (i, j)，找到两个数之和等于 target 就直接返回。',
        process: '外层循环固定第一个数，内层从 i + 1 开始找第二个数；题目保证恰好一组答案，所以找到即可提前返回。',
        timeComplexity: 'n²',
        spaceComplexity: '1',
        code: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        for (int i = 0; i < nums.size(); i++) {
            for (int j = i + 1; j < nums.size(); j++) {
                if (nums[i] + nums[j] == target) {
                    return {i, j};
                }
            }
        }
        return {};
    }
};`,
      },
      {
        id: 'sol-ts-2',
        title: '解法二：哈希表一遍遍历',
        lang: 'Python',
        approach: '用哈希表存「值 → 下标」，遍历时查 target - x 是否出现过，把查找从 O(n) 降到 O(1)。',
        process: '一边遍历一边登记；先查后存，避免当前元素和自己配对的问题。',
        timeComplexity: 'n',
        spaceComplexity: 'n',
        code: `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i, x in enumerate(nums):
            if target - x in seen:
                return [seen[target - x], i]
            seen[x] = i
        return []`,
      },
    ],
  },
  {
    id: 'lc-reverse-list',
    title: '反转链表',
    link: 'https://leetcode.cn/problems/reverse-linked-list/',
    difficulty: 'easy',
    tags: ['链表', '递归'],
    solutions: [
      {
        id: 'sol-rl-1',
        title: '解法一：迭代（三指针）',
        lang: 'C++',
        approach: '用 prev / head / next 三个指针，把当前节点的 next 指向前一个节点，逐节翻转。',
        process: '保存 next 防止断链，然后 head->next = prev，再整体前移一步，循环到链表末尾。',
        timeComplexity: 'n',
        spaceComplexity: '1',
        code: `class Solution {
public:
    ListNode* reverseList(ListNode* head) {
        ListNode* prev = nullptr;
        while (head) {
            ListNode* next = head->next;
            head->next = prev;
            prev = head;
            head = next;
        }
        return prev;
    }
};`,
      },
      {
        id: 'sol-rl-2',
        title: '解法二：递归',
        lang: 'Python',
        approach: '先递归翻转后面的部分，再把当前节点的 next 接回来，思路更「声明式」。',
        process: '递归到底返回新头节点；回溯时让 head.next.next = head，并断开 head.next 防止成环。',
        timeComplexity: 'n',
        spaceComplexity: 'n',
        code: `class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        if not head or not head.next:
            return head
        new_head = self.reverseList(head.next)
        head.next.next = head
        head.next = None
        return new_head`,
      },
    ],
  },
  {
    id: 'lc-three-sum',
    title: '三数之和',
    link: 'https://leetcode.cn/problems/3sum/',
    difficulty: 'medium',
    tags: ['数组', '双指针', '排序'],
    solutions: [
      {
        id: 'sol-3s-1',
        title: '解法一：排序 + 双指针',
        lang: 'C++',
        approach: '先排序，固定第一个数，再用左右双指针在剩余区间里夹逼找另外两个数。',
        process: '排序后 O(n²) 枚举；跳过重复元素去重，双指针根据三数之和与 0 的大小关系左右移动。',
        timeComplexity: 'n²',
        spaceComplexity: '1',
        code: `class Solution {
public:
    vector<vector<int>> threeSum(vector<int>& nums) {
        sort(nums.begin(), nums.end());
        vector<vector<int>> res;
        for (int i = 0; i < nums.size(); i++) {
            if (i > 0 && nums[i] == nums[i - 1]) continue;
            int left = i + 1, right = nums.size() - 1;
            while (left < right) {
                int sum = nums[i] + nums[left] + nums[right];
                if (sum < 0) left++;
                else if (sum > 0) right--;
                else {
                    res.push_back({nums[i], nums[left], nums[right]});
                    while (left < right && nums[left] == nums[left + 1]) left++;
                    while (left < right && nums[right] == nums[right - 1]) right--;
                    left++;
                    right--;
                }
            }
        }
        return res;
    }
};`,
      },
    ],
  },
]
