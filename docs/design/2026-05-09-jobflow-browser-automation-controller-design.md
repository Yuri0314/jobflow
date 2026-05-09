# jobflow 浏览器自动化 Controller 设计

日期：2026-05-09
状态：设计草案，用于支撑 Level 1 自动搜索与采集

## 1. 文档目的

本文档定义 `jobflow` 的 browser automation controller。

长期路线图已经明确：`jobflow` 不应只停留在浏览器插件采集当前页面，也不应立即跳到自动投递。下一阶段应先完成 Level 1：

```text
CLI / agent 创建搜索任务
-> browser automation controller 打开本地浏览器
-> site adapter 采集搜索结果
-> runtime 写入职位状态
-> CLI 返回评分和 next actions
```

controller 的目标是把“浏览器怎么被驱动”从 CLI、桌面端和 runtime 中拆出来，形成一个可测试、可替换、可被多入口复用的执行层。

## 2. 核心定位

browser automation controller 是执行层，不是决策层。

它负责：

- 启动或连接本地浏览器。
- 创建隔离的浏览器 profile。
- 加载 `jobflow` 浏览器插件。
- 打开目标页面。
- 等待页面到达可采集状态。
- 调用 site adapter 执行平台相关页面动作。
- 收集结构化结果和执行日志。
- 把失败原因转换为稳定错误码。

它不负责：

- 职位评分。
- 去重策略。
- pipeline 状态决策。
- 简历选择策略。
- 是否投递的最终判断。
- 绕过验证码或平台风控。
- 维护长期求职状态。

这些仍由 `packages/runtime`、CLI 或未来桌面端的用户确认流程负责。

## 3. 推荐模块位置

近期建议新增：

```text
packages/browser-automation/
  src/
    controller.ts
    browser-session.ts
    task.ts
    result.ts
    errors.ts
    adapters/
      fixture.ts
      boss.ts
```

原因：

- 它不是 CLI 私有能力。
- 未来桌面端也需要复用。
- 它依赖浏览器执行环境，但不应污染 `packages/runtime`。
- 它需要自己的测试 fixture 和 smoke harness。

长期关系：

```text
apps/cli
  -> packages/runtime
  -> packages/browser-automation

apps/desktop
  -> packages/runtime
  -> packages/browser-automation

external agent / skill
  -> apps/cli / protocol
  -> packages/runtime
  -> packages/browser-automation
```

## 4. 组件边界

### 4.1 `AutomationController`

顶层执行入口。

输入：

- search task
- browser options
- adapter registry
- output sink / runtime callback

输出：

- task result
- collected jobs
- action log
- structured errors

它只编排流程，不写平台细节。

### 4.2 `BrowserSession`

负责浏览器生命周期。

职责：

- 选择浏览器可执行文件。
- 创建临时或持久 profile。
- 选择 debugging port。
- 加载扩展。
- 打开页面。
- 关闭浏览器。
- 保留失败 profile 以便调试。

当前扩展 E2E smoke 里已经有一部分 CDP 控制逻辑。后续应把可复用部分抽到这一层，而不是继续留在测试脚本里。

### 4.3 `SiteAdapter`

平台适配接口。

每个招聘网站一个 adapter，例如：

- fixture adapter
- boss adapter
- liepin adapter
- lagou adapter
- linkedin adapter

adapter 负责：

- 判断当前 URL 是否属于自己。
- 构造搜索 URL 或执行搜索输入动作。
- 等待搜索结果出现。
- 提取职位列表。
- 打开详情页或提取详情链接。
- 把页面字段转换为 `jobflow` ingest payload。

adapter 不负责评分、去重和投递策略。

### 4.4 `AutomationTask`

描述一次浏览器自动化任务。

第一版只需要 search task：

```ts
type SearchTask = {
  task_id: string;
  site: "fixture" | "boss" | "liepin" | "lagou" | "linkedin";
  keyword: string;
  city?: string;
  limit?: number;
  created_at: string;
};
```

后续再扩展：

- collect detail task
- prepare apply task
- confirmed apply task

不要一开始就设计完整自动投递任务。

### 4.5 `AutomationResult`

一次任务的结构化结果。

建议第一版：

```ts
type AutomationResult = {
  task_id: string;
  status: "completed" | "partial" | "failed" | "blocked";
  site: string;
  collected: IngestJobPayload[];
  action_log: AutomationActionLog[];
  error?: AutomationError;
  started_at: string;
  finished_at: string;
};
```

其中：

- `completed`：任务完成，采集结果达到预期。
- `partial`：任务部分完成，例如采集到少量结果但未达到 limit。
- `failed`：代码或页面结构导致失败。
- `blocked`：登录、验证码、风控提示、权限问题等需要用户介入。

## 5. 第一版数据流

第一版应先走 fixture，不直接接真实 BOSS。

```text
CLI command
  -> runtime creates search task
  -> automation controller starts browser
  -> fixture adapter opens local search page
  -> adapter extracts result cards
  -> controller returns ingest payloads
  -> runtime stores ingests
  -> runtime can normalize / score / next
```

这样可以先验证 controller 架构，而不是一开始被真实网站登录、反爬、页面变化卡住。

## 6. 与浏览器插件的关系

controller 和浏览器插件不是二选一。

推荐关系：

```text
controller: 控制浏览器、页面导航、任务流程
extension: 页面内采集、页面上下文读取、少量辅助动作
site adapter: 平台页面规则和字段映射
```

第一版可以不强依赖插件，直接用 CDP 或页面脚本采集 fixture。

但长期建议让 controller 加载 `apps/browser-extension/dist`，并复用插件已有的页面采集能力。这样手动采集和自动采集使用同一套页面理解逻辑。

## 7. 与 `packages/runtime` 的关系

`packages/runtime` 负责保存和决策。

controller 不直接决定职位是否值得投递。它只返回候选输入。

推荐调用关系：

```text
runtime:
  create search task
  call controller
  persist automation result
  ingest collected jobs
  normalize / score
  update next actions

controller:
  execute browser steps
  return collected payloads and logs
```

如果后续需要长期保存 automation task，应该由 runtime 定义 task 状态模型，而不是 controller 自己维护一套长期数据库。

## 8. 错误边界

controller 必须把失败分成可处理类型。

建议第一版错误码：

- `BROWSER_NOT_FOUND`
- `BROWSER_LAUNCH_FAILED`
- `EXTENSION_BUILD_MISSING`
- `PAGE_NAVIGATION_FAILED`
- `ADAPTER_NOT_FOUND`
- `ADAPTER_UNSUPPORTED_PAGE`
- `RESULTS_NOT_FOUND`
- `LOGIN_REQUIRED`
- `CAPTCHA_REQUIRED`
- `PLATFORM_BLOCKED`
- `PAGE_STRUCTURE_CHANGED`
- `TASK_TIMEOUT`

其中 `LOGIN_REQUIRED`、`CAPTCHA_REQUIRED`、`PLATFORM_BLOCKED` 都应视为 `blocked`，不能继续自动点击。

## 9. 安全边界

第一版明确不做：

- 自动登录。
- 验证码识别或绕过。
- stealth 反风控。
- 批量投递。
- 自动打招呼。
- 在不确定页面状态下继续点击。

第一版应该做：

- 限制采集数量。
- 清晰返回 blocked 状态。
- 保存 action log。
- 支持保留失败 profile 供调试。
- 只对 fixture 或用户明确指定的站点执行。

## 10. 测试策略

### 10.1 Unit tests

覆盖：

- task schema
- result schema
- error mapping
- adapter registry
- fixture adapter HTML parsing

### 10.2 Fixture E2E

使用本地 HTTP fixture 页面：

- 搜索结果页。
- 职位详情页。
- 空结果页。
- 登录拦截页。
- 页面结构变化页。

验证：

- controller 能启动浏览器。
- adapter 能采集列表。
- blocked 状态能被识别。
- action log 可读。

### 10.3 Real-site manual validation

真实 BOSS 等平台只做人工或半自动验证，不作为稳定 CI 测试。

原因：

- 登录状态不可控。
- 页面变化频繁。
- 风控和验证码不可预测。
- CI 环境不适合跑真实招聘网站。

## 11. 实现阶段建议

### 阶段 1：controller scaffold

目标：

- 新建 `packages/browser-automation`。
- 定义 task/result/error 类型。
- 实现 adapter registry。
- 实现 fixture adapter 的纯解析测试。

不启动真实浏览器。

### 阶段 2：fixture browser smoke

目标：

- 复用现有扩展 smoke 的 CDP/浏览器启动经验。
- 打开本地 fixture 搜索页。
- 采集搜索结果。
- 返回 `AutomationResult`。

### 阶段 3：runtime integration

目标：

- runtime 能创建 search task。
- runtime 调 controller。
- runtime 把 collected payload 写入 ingests。
- CLI 增加实验性命令。

示例：

```powershell
corepack pnpm --filter @jobflow/cli dev search --site fixture --keyword "TypeScript" --limit 5 --json
```

### 阶段 4：真实平台 adapter 设计

目标：

- 先写 BOSS adapter 设计。
- 收集页面结构和失败场景。
- 不实现自动投递。

## 12. 当前建议的下一步

下一步建议实现阶段 1：

```text
packages/browser-automation scaffold
-> task/result/error schema
-> adapter registry
-> fixture adapter parsing test
```

这一步不需要真实浏览器，也不碰 BOSS。它的价值是先把 controller 的类型边界和测试入口定下来。
