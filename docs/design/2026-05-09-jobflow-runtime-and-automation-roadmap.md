# jobflow Runtime 与浏览器自动化长期路线图

日期：2026-05-09  
状态：长期方向设计草案，用于校准产品终局与后续阶段边界

## 1. 文档目的

本文档用于补齐 `jobflow` 的长期路线图。

此前设计文档主要覆盖第一阶段：先把 CLI runtime、schema、protocol、浏览器插件采集链路做稳。这个方向仍然正确，但它没有完整表达项目的终局目标。

`jobflow` 的长期目标不是单纯做一个浏览器插件，也不是只做一个桌面软件，而是成为一个本地优先的个人求职自动化 runtime。它未来应同时支持两种使用形态：

1. 桌面端本地工作台。
2. 被外部 AI agent、plugin、skill 或脚本调用的求职自动化能力层。

这两种形态共享同一套底层 runtime、schema、protocol 和本地状态，不应各自复制业务逻辑。

## 2. 核心定位修正

长期定位建议调整为：

```text
jobflow 是一个本地优先的个人求职自动化 runtime。
它提供稳定的求职数据、决策、状态和浏览器自动化能力。
桌面端、CLI、插件、skill、外部 AI agent 都只是它的不同入口。
```

这意味着：

- CLI 不是唯一产品形态。
- 浏览器插件不是唯一自动化执行层。
- 桌面端不应只是 CLI 的图形壳。
- 外部 AI agent 不应直接绕过 `jobflow` 的数据模型和状态系统。
- 投递自动化属于高风险后期能力，应建立在搜索、采集、评分、去重和审计稳定之后。

## 3. 两种长期形态

### 3.1 形态 A：桌面端本地工作台

桌面端是强交互入口，适合用户自己长期使用。

它可以包含：

- 内嵌浏览器。
- 职位列表和详情视图。
- 本地评分、去重和 pipeline 状态展示。
- 下一步动作视图。
- 半自动投递确认界面。
- 后期有限自动化操作入口。

桌面端不应该每一步都通过“执行 CLI 命令”来和系统交互。长期更合理的方式是：

```text
apps/desktop
  -> packages/runtime
  -> packages/schema
  -> packages/protocol
  -> local jobflow state
```

也就是说，桌面端应直接调用共享 runtime package。CLI 只是另一个入口，而不是桌面端的底层交互方式。

### 3.2 形态 B：CLI capability + plugin / skill 调用

这一形态适合外部 AI agent、Codex skill、Claude skill、本地脚本或其他自动化系统调用。

典型流程是：

```text
External AI Agent / Skill / Script
  -> jobflow CLI / protocol command
  -> jobflow runtime
  -> browser automation controller
  -> browser extension / site adapter
  -> recruiting site
```

这个形态的重点不是图形体验，而是：

- 命令稳定。
- JSON 输入输出稳定。
- 错误码可预测。
- 状态可审计。
- agent 能安全地拆分任务、恢复失败、查询结果。

这也是当前 CLI-first 方向的长期价值：它让 `jobflow` 可以作为 agent 生态中的专业求职能力工具，而不是只能被人手动打开。

## 4. 推荐长期架构

推荐架构如下：

```text
                         apps/desktop
                              |
External AI Agent / Skill -> apps/cli
                              |
                        packages/runtime
                              |
          +-------------------+-------------------+
          |                   |                   |
   packages/schema     packages/protocol   local jobflow state
                              |
                browser automation controller
                              |
          +-------------------+-------------------+
          |                                       |
 apps/browser-extension                 site adapters
          |                                       |
 BOSS / Liepin / Lagou / LinkedIn / other sources
```

各层职责：

- `packages/runtime`：长期核心。负责求职数据、状态、去重、评分、pipeline、任务编排。
- `apps/cli`：命令行入口。面向人类、脚本和外部 AI agent。
- `apps/desktop`：未来桌面端入口。负责内嵌浏览器、工作台 UI 和用户确认流程。
- `apps/browser-extension`：轻量页面入口。负责页面上下文采集、页面内辅助动作和少量现场反馈。
- `browser automation controller`：本地浏览器自动化执行层。负责打开页面、搜索、等待页面状态、调度 site adapter。
- `site adapters`：平台适配层。负责不同招聘网站的页面识别、字段提取、可执行动作描述。
- `packages/schema`：共享领域模型。
- `packages/protocol`：共享消息和能力调用契约。

## 5. CLI、runtime、桌面端的关系

需要明确三者关系：

```text
runtime 是核心能力。
CLI 是 runtime 的命令行入口。
桌面端是 runtime 的图形入口和内嵌浏览器工作台。
```

短期可以让 CLI 直接承载较多 runtime 逻辑，因为实现成本低，验证快。

中期应把 CLI 内部已经稳定的能力逐步下沉到 `packages/runtime`：

- 本地状态读写。
- ingest / normalize / score / pipeline / next。
- 协议命令执行。
- 任务状态机。
- 去重和审计逻辑。

这样未来桌面端不需要“调用 CLI 命令”来完成业务动作，而是和 CLI 一样调用 `packages/runtime`。

## 6. 浏览器自动化方向

长期目标包括 CLI 或外部 agent 触发浏览器执行求职流程：

```text
jobflow search --site boss --keyword "TypeScript 后端" --city "上海"
```

未来执行流程可以是：

1. CLI 或 agent 创建搜索任务。
2. runtime 持久化任务和约束。
3. browser automation controller 启动或连接本地浏览器。
4. site adapter 打开目标平台搜索页。
5. adapter 采集搜索结果列表。
6. runtime 去重、评分、入库。
7. 用户或 agent 查询候选职位和下一步动作。
8. 后续阶段再进入半自动或有限自动投递。

这里的关键是：浏览器自动化 controller 负责“怎么操作浏览器”，runtime 负责“为什么操作、如何记录、如何决策”。

## 7. 投递自动化分级

投递能力不应一步到位。建议分为四级。

### Level 0：手动采集

用户打开职位页，插件或桌面端采集当前页面。

当前项目已经接近这一层。

### Level 1：自动搜索与采集

CLI 或 agent 发起搜索任务，浏览器自动打开搜索结果页，采集职位列表和详情页。

这一层是下一阶段最合理的目标。

完成标准：

- 能创建搜索任务。
- 能打开本地浏览器。
- 能采集至少一个平台的搜索结果。
- 能把职位写入 `jobflow` 状态。
- 能生成评分和下一步动作。
- 遇到登录、验证码、页面结构异常时停止并返回可解释错误。

### Level 2：半自动投递

系统准备投递动作，但关键动作由用户确认。

例如：

- 自动打开职位详情页。
- 自动选择推荐简历。
- 自动生成或准备打招呼文本。
- 在点击最终投递前要求用户确认。
- 保存确认记录和投递结果。

这一层适合桌面端工作台，也适合 agent 发起任务后让用户确认。

### Level 3：有限自动投递

系统在严格规则下自动执行部分投递动作。

必须满足：

- 明确的每日数量限制。
- 明确的岗位匹配阈值。
- 公司黑名单和岗位黑名单。
- 投递前规则检查。
- 投递后审计记录。
- 遇到验证码、登录异常、页面不确定、风控提示立即停止。
- 不做验证码绕过。
- 不做 stealth 反风控对抗。

这一层是后期能力，不应作为近期实现目标。

## 8. 安全与边界

`jobflow` 可以做本地浏览器工作流自动化，但不应变成反风控或批量爬取工具。

明确不做：

- 绕过验证码。
- 隐藏自动化痕迹。
- 对抗招聘平台风控。
- 未经用户授权批量投递。
- 在页面状态不确定时继续点击。
- 绕过平台登录或权限限制。

应该做：

- 使用用户本地浏览器和用户自己的登录状态。
- 只处理用户可访问、可见、可操作的页面。
- 控制频率。
- 记录所有自动化动作。
- 把失败原因结构化返回给 CLI / agent / desktop。
- 对高风险动作增加确认门槛。

## 9. 与现有文档的关系

现有文档仍然有效：

- `2026-04-21-jobflow-foundation-design.md` 定义第一阶段 CLI runtime 和能力边界。
- `2026-04-21-jobflow-implementation-plan.md` 定义第一阶段最小闭环。
- `2026-05-07-jobflow-desktop-shell-design.md` 记录未来桌面端方向。
- `2026-05-07-jobflow-phase-1-cli-runtime.zh.md` 解释第一阶段实施计划。

本文档补充的是更高层的长期路线图：

- 为什么 CLI-first 仍然重要。
- 为什么未来桌面端不应该只是 CLI 壳。
- 为什么需要 `packages/runtime`。
- 为什么外部 agent / plugin / skill 调用是一等入口。
- 为什么浏览器自动化 controller 应独立于 CLI 和桌面 UI。
- 为什么自动投递必须后置并分级。

## 10. 当前建议的下一阶段

当前代码已经具备：

- CLI runtime 最小闭环。
- 初始 `packages/runtime` 共享包，承载状态存储和核心业务 primitives。
- 共享 schema 和 protocol。
- 浏览器插件采集壳。
- 浏览器插件自动 smoke E2E。

下一阶段建议不是直接做自动投递，而是启动 Level 1：

```text
CLI 创建搜索任务
-> browser automation controller 打开本地浏览器
-> site adapter 采集一个招聘平台的搜索结果
-> runtime 写入职位状态
-> CLI 返回评分和 next actions
```

第一版可以先不接真实 BOSS 页面，先用本地 fixture 或可控测试页完成 controller 架构和任务状态机。随后再接入真实平台页面适配。

## 11. 近期设计调整建议

为了支撑长期路线，后续可以按顺序做这些调整：

1. 继续扩展 `packages/runtime`，把更多 CLI 内部业务编排下沉进去。
2. 新增浏览器自动化 controller 的设计文档。
3. 扩展 protocol，增加 search task / automation task / task status envelope。
4. 为 browser extension 增加 site adapter 结构。
5. 为搜索结果采集增加 fixture 测试。
6. 最后再讨论真实平台搜索和半自动投递。

这样做可以同时服务两个未来形态：桌面端和外部 agent 调用。
