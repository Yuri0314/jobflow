# jobflow 第一阶段 CLI Runtime 中文实施计划

**目标：** 把现在只有设计文档和空目录的 `jobflow`，推进到一个能跑通最小闭环的命令行工具。

最小闭环是：

```text
职位输入
  -> 保存原始输入 ingest
  -> 生成标准化职位 job
  -> 生成评分 score
  -> 更新求职流程 pipeline
  -> 输出下一步建议 next
```

这份文档是给你看的中文版本。更细的“执行代理版”在：

- `docs/superpowers/plans/2026-05-07-jobflow-phase-1-cli-runtime.md`

代码、命令、包名会保留英文，因为它们是实际工程里的名字。

---

## 1. 当前项目状态

现在项目还没有真正进入实现阶段。

已经有的东西：

- `README.md`
- 4 份设计文档
- `apps/cli`
- `apps/browser-extension`
- `packages/schema`
- `packages/protocol`
- `scripts`

但这些代码目录目前只有 `.gitkeep` 占位文件，没有真实代码。

另外，当前目录还不是 git 仓库，所以第一步会先初始化 git。

---

## 2. 技术栈决定

我决定第一版使用：

- **TypeScript**：主要开发语言
- **Node.js**：运行 CLI
- **pnpm workspace**：管理单仓多包结构
- **commander**：做命令行入口
- **zod**：做数据结构校验
- **vitest**：做测试
- **JSON 文件**：做第一版本地状态存储

为什么这样选：

- 这个项目未来会有浏览器插件，浏览器插件天然在 JavaScript / TypeScript 生态里。
- CLI、浏览器插件、schema、protocol 可以共享同一套类型定义。
- 第一阶段需要快速调整数据模型，TypeScript 比 Go/Rust 这类强二进制工具更灵活。
- 现在不需要数据库，先用 JSON 文件存本地状态，简单、可调试、够用。

这不是把项目做成“前端项目”。第一阶段重点仍然是命令行工具。

---

## 3. 第一阶段要做什么

第一阶段只做 CLI runtime 的核心闭环。

要做：

- 初始化工程结构
- 建立 `schema` 包
- 建立 `protocol` 包
- 搭建 `jobflow` CLI 命令入口
- 实现本地状态存储
- 实现 `ingest`
- 实现 `normalize`
- 实现 `score`
- 实现 `pipeline`
- 实现 `next`
- 增加测试和手动验证步骤

暂时不做：

- 浏览器插件界面
- 招聘网站页面解析
- 自动投递
- Web 前端 / 后端
- 数据库
- 自己做一个聊天式 agent
- 复杂评分算法
- 简历自动改写

---

## 4. 最终目录会变成什么样

计划中的核心结构是：

```text
jobflow/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  vitest.config.ts
  apps/
    cli/
      package.json
      src/
        main.ts
        cli.ts
        commands/
          ingest.ts
          normalize.ts
          score.ts
          pipeline.ts
          next.ts
        runtime/
          ids.ts
          normalize.ts
          score.ts
          pipeline.ts
          next.ts
        state/
          fs-store.ts
          state-schema.ts
        output.ts
      tests/
  packages/
    schema/
      package.json
      src/
        index.ts
      tests/
    protocol/
      package.json
      src/
        index.ts
      tests/
```

这些目录的意思：

- `apps/cli`：真正的命令行工具。
- `packages/schema`：职位、评分、流程状态等核心数据结构。
- `packages/protocol`：未来浏览器插件或外部 agent 调用 CLI 时用的通信格式。
- `apps/cli/src/state`：本地 JSON 文件读写。
- `apps/cli/src/runtime`：不依赖命令行的核心业务逻辑。
- `apps/cli/src/commands`：把业务逻辑包装成命令行命令。

---

## 5. 分阶段执行计划

### 阶段 1：初始化工程

目标：让项目变成一个可安装、可测试、可构建的 TypeScript monorepo。

会做：

- `git init`
- 创建 `package.json`
- 创建 `pnpm-workspace.yaml`
- 创建 TypeScript 配置
- 创建 Vitest 测试配置
- 安装基础依赖

验证方式：

```powershell
pnpm test
pnpm build
```

这一阶段完成后，项目还没有业务功能，但工程骨架能跑。

---

### 阶段 2：实现共享 schema

目标：先把核心数据模型固定下来。

会定义这些对象：

- `JobIngestRecord`：一次原始职位输入
- `JobRecord`：标准化后的职位
- `ScoreRecord`：一次职位评分
- `PipelineRecord`：职位推进状态
- `ResumeRecord`：简历引用记录

这些对象来自现有设计文档，不重新发散。

验证方式：

- 写 schema 测试
- 确认合法数据能通过
- 确认非法 ingest 会被拒绝

---

### 阶段 3：实现共享 protocol

目标：先把未来浏览器插件和 CLI 的通信格式定下来。

第一版只需要支持：

- `ingest_job` 请求
- `ingest_job_result` 响应

大概格式是：

```json
{
  "version": "1",
  "type": "ingest_job",
  "request_id": "req_01",
  "sent_at": "2026-05-07T00:00:00.000Z",
  "payload": {}
}
```

这一阶段不会实现浏览器插件，只是把协议结构准备好。

---

### 阶段 4：搭 CLI 空壳

目标：让 `jobflow` 这个命令能运行，并能看到核心命令。

会有这些命令：

```text
jobflow ingest
jobflow normalize
jobflow score
jobflow pipeline list
jobflow pipeline get
jobflow pipeline update
jobflow next
```

验证方式：

```powershell
pnpm --filter @jobflow/cli dev -- --help
```

预期能看到命令帮助。

---

### 阶段 5：实现本地状态存储

目标：让 CLI 能把数据保存到本地。

第一版不用数据库，只用 JSON 文件：

```text
.jobflow/state.json
```

里面保存：

- `ingests`
- `jobs`
- `scores`
- `pipeline`
- `resumes`

为什么先用 JSON：

- 简单
- 可读
- 可手动检查
- 对第一阶段足够
- 后面如果需要，可以再替换成 SQLite

---

### 阶段 6：实现 `ingest`

目标：接收原始职位输入并保存。

支持几种输入：

```powershell
jobflow ingest --source link --url "https://example.com/job/1" --json
jobflow ingest --source text --text "职位描述文本" --json
jobflow ingest --source manual --title "后端工程师" --company "Example Tech" --json
```

成功后返回：

```json
{
  "ok": true,
  "command": "ingest",
  "data": {
    "ingest_id": "ingest_xxx",
    "job_id": null,
    "status": "accepted"
  },
  "error": null
}
```

---

### 阶段 7：实现 `normalize`

目标：从原始输入生成标准化职位。

输入：

```powershell
jobflow normalize --ingest-id "ingest_xxx" --json
```

输出里会有：

- `job_id`
- `title`
- `company_name`
- `canonical_url`
- `description_text`
- `normalized_at`

第一版标准化会很朴素：

- 有 `title_hint` 就用它当标题
- 有 `company_hint` 就用它当公司名
- 有 URL 就保留为标准 URL
- 有原始文本就保存为描述

不会一开始做复杂 NLP。

---

### 阶段 8：实现 `score`

目标：给职位生成一个最简单可工作的评分。

输入：

```powershell
jobflow score --job-id "job_xxx" --json
```

输出里会有：

- `score`
- `confidence`
- `reasons`
- `risks`
- `suggested_action`

第一版评分规则很简单，例如：

- 标题或描述里包含 `TypeScript`、`Node`、`backend`、`后端` 等关键词，加分。
- 缺少职位描述，扣分。
- 分数高则建议 `prepare`。
- 分数中等则建议 `review`。
- 分数低则建议 `ignore`。

重点不是算法聪明，而是接口稳定、结果可保存。

---

### 阶段 9：实现 `pipeline`

目标：维护每个职位的求职流程状态。

核心命令：

```powershell
jobflow pipeline list --json
jobflow pipeline get --job-id "job_xxx" --json
jobflow pipeline update --job-id "job_xxx" --status reviewing --priority high --next-action "review and tailor resume" --json
```

第一版状态：

- `new`
- `saved`
- `reviewing`
- `ready`
- `applied`
- `follow_up`
- `closed`

会做简单状态迁移校验，避免从 `saved` 直接跳到 `applied` 这种语义不清的状态。

---

### 阶段 10：实现 `next`

目标：输出当前最应该处理的下一步事项。

输入：

```powershell
jobflow next --json
```

输出类似：

```json
{
  "ok": true,
  "command": "next",
  "data": {
    "items": [
      {
        "job_id": "job_xxx",
        "title": "TypeScript Backend Engineer",
        "company_name": "Example Tech",
        "recommended_action": "review and tailor resume",
        "priority": "high",
        "score": 80
      }
    ]
  },
  "error": null
}
```

排序规则第一版很简单：

1. 优先级高的排前面
2. 分数高的排前面
3. 已关闭的职位不显示

---

### 阶段 11：端到端验证

最终要手动跑通这条链路：

```powershell
pnpm install
$env:JOBFLOW_HOME="D:\tmp\jobflow-smoke"

pnpm --filter @jobflow/cli dev -- ingest --source text --title "TypeScript Backend Engineer" --company "Example Tech" --text "Node.js TypeScript backend role" --json

pnpm --filter @jobflow/cli dev -- normalize --ingest-id "<ingest_id>" --json

pnpm --filter @jobflow/cli dev -- score --job-id "<job_id>" --json

pnpm --filter @jobflow/cli dev -- pipeline update --job-id "<job_id>" --status reviewing --priority high --next-action "review and tailor resume" --json

pnpm --filter @jobflow/cli dev -- next --json
```

如果最后 `next` 能返回下一步建议，就说明第一阶段最小闭环跑通。

---

## 6. 成功标准

第一阶段完成时，应满足：

- 可以安装依赖
- 可以运行测试
- 可以运行 `jobflow --help`
- 可以保存原始职位输入
- 可以生成标准化职位
- 可以生成评分
- 可以更新 pipeline 状态
- 可以输出 next 建议
- 所有核心命令都有 JSON 输出
- 错误输出有稳定错误码

---

## 7. 我建议的执行方式

我建议直接在当前会话按这个计划执行。

原因：

- 项目现在很空，没有复杂历史包袱。
- 阶段 1 到阶段 5 是强顺序依赖，拆给多个代理并行意义不大。
- 等 CLI 骨架起来之后，再拆模块并行会更合适。

执行时我会按小步走：

1. 先写测试
2. 运行测试确认失败
3. 写最小实现
4. 再运行测试确认通过
5. 进入下一步

---

## 8. 你需要理解的核心点

你不需要懂 TypeScript 或 pnpm 才能判断这个计划。

你只需要看这几个问题：

- 方向有没有跑偏？没有，还是 CLI runtime。
- 有没有过早做浏览器插件？没有。
- 有没有过早做自动投递？没有。
- 有没有过早做复杂 UI？没有。
- 有没有先把最小闭环跑通？有。
- 未来能不能接浏览器插件？能，因为提前留了 schema 和 protocol。

我的判断：这个计划适合现在的项目阶段，可以直接开始执行。

---

## 9. 自检 Review 记录

这次 review 我重点检查了三件事：

1. 是否符合原始设计文档
2. 是否适合当前项目阶段
3. 英文详细执行计划是否真的能指导实现

### 9.1 结论：总体方向合理

计划没有偏离原始设计。

原始设计把 `jobflow` 定义为 CLI capability runtime，而不是完整 Web 产品、自动投递工具或聊天式 agent。当前计划也是先做 CLI runtime，先跑通最小闭环，没有提前做浏览器插件界面、网页解析、自动投递或复杂 UI。

这个方向是合理的。

### 9.2 结论：技术栈选择合理

`TypeScript + pnpm + Node CLI` 对这个项目是合适的。

主要原因：

- CLI 和未来浏览器插件都能共用 TypeScript 类型。
- `packages/schema` 和 `packages/protocol` 可以被多个模块复用。
- 第一阶段数据模型还会调整，TypeScript 改动成本低。
- 先用 JSON 文件存状态，符合“第一版先简单可工作”的原则。

我不建议这个阶段上数据库、ORM、Go、Rust 或完整后端框架。那些会让第一阶段变重。

### 9.3 已发现并修正的问题 1：schema / protocol 的 zod 组合方式

英文详细计划里原本有一个实现风险：

```ts
jobIngestRecordSchema.omit(...)
```

但 `jobIngestRecordSchema` 做了 `superRefine` 校验之后，再直接 `.omit()` 容易在 zod 类型上出问题。

我已经修正为：

- 先定义 `jobIngestPayloadBaseSchema`
- 再分别导出：
  - `jobIngestPayloadSchema`
  - `jobIngestRecordSchema`
- `protocol` 包直接使用 `jobIngestPayloadSchema`

这个修正让 schema 和 protocol 的关系更清楚：

- payload 是外部输入
- record 是本地保存后的记录

### 9.4 已发现并修正的问题 2：Task 8 原本太像提纲

英文详细计划里的 Task 8 原本只列了函数签名和规则，对真正执行的人来说不够完整。

我已经把它补成具体文件级代码，包括：

- `apps/cli/src/commands/normalize.ts`
- `apps/cli/src/commands/score.ts`
- `apps/cli/src/commands/pipeline.ts`
- `apps/cli/src/commands/next.ts`

这样后续执行时不会只靠猜。

### 9.5 有意保留的取舍：暂时不做 `resume` 命令

原始接口设计里提到了 `jobflow resume`，状态模型里也有 `ResumeRecord`。

当前计划会先把 `ResumeRecord` 放进 schema 和本地状态里，但不会在第一轮核心闭环里实现完整 `resume add/list/set-default`。

这是一个刻意取舍。

原因：

- 最小闭环不依赖简历管理。
- 当前最重要的是先跑通 `ingest -> normalize -> score -> pipeline -> next`。
- 简历命令可以在核心闭环跑通后，作为一个很小的后续任务补上。

如果你希望“第一阶段完成标准”严格包含 resume 管理命令，那我建议在核心闭环之后马上加一个小任务：

```text
jobflow resume add
jobflow resume list
jobflow resume set-default
```

但我不建议把它插到 `ingest` 之前。

### 9.6 有意保留的取舍：评分规则先简单

第一版评分会比较朴素，只做关键词和缺失信息判断。

这不是因为评分不重要，而是因为第一阶段真正要验证的是：

- 数据能不能保存
- 命令能不能稳定调用
- 输出格式能不能被 agent 或脚本解析
- pipeline 能不能推动下一步动作

复杂评分可以后面换掉，只要 `ScoreRecord` 输出结构稳定即可。

### 9.7 有意保留的取舍：JSON 文件优先于数据库

第一版用 `.jobflow/state.json`。

这对早期项目更合适：

- 容易看
- 容易调试
- 不需要安装数据库
- 不会过早陷入 ORM 设计

后面如果数据量变大，或者需要更复杂查询，再迁移到 SQLite。

### 9.8 Review 后的建议执行顺序

我建议保持原顺序：

1. 初始化工程
2. schema
3. protocol
4. CLI 空壳
5. 本地状态
6. ingest
7. normalize
8. score
9. pipeline
10. next
11. 端到端验证
12. 再补最小 resume 命令

也就是说：**先核心闭环，再 resume 补齐。**

