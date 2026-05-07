# jobflow CLI 与集成接口设计

日期：2026-04-21  
状态：第一阶段接口设计草案

## 1. 文档目的

本文档用于定义 `jobflow` 第一阶段的工程落地接口。

它要解决的问题是：

- CLI 应提供哪些核心命令
- 命令输入和输出的基本形式是什么
- 外部 agent 应如何稳定调用这些命令
- 浏览器插件与 CLI 之间应如何交换数据
- 第一阶段需要哪些核心 schema

本文档不解决这些问题：

- 具体语言和框架选型
- 本地存储最终实现
- 浏览器插件的 UI 细节
- 评分算法的最终策略细节

## 2. 设计目标

第一阶段接口设计应满足以下目标：

- 命令语义稳定
- 输入输出结构清晰
- 默认支持 JSON 输出
- 便于 mature agent 通过 tool / skill 调用
- 便于浏览器插件作为现场采集入口接入
- 便于后续演进而不破坏已有调用方式

## 3. CLI 设计原则

### 3.1 命令优先，不做大交互壳

第一阶段以明确命令为主，不优先设计复杂交互式 shell。

推荐形式：

- `jobflow ingest`
- `jobflow score`
- `jobflow pipeline list`
- `jobflow next`

### 3.2 默认可结构化输出

所有面向外部集成的核心命令，都应支持：

- 机器可读输出
- JSON 格式
- 字段稳定

建议默认提供：

- `--json`

如有需要，可再补充：

- `--output json`

### 3.3 人用与 agent 用共存，但以 agent 可调用性优先

命令仍然要能被人直接调用，但设计优先级应是：

1. agent 易调用
2. 自动化脚本易组合
3. 人类终端体验可接受

## 4. CLI 顶层命令模型

第一阶段建议的顶层命令如下：

- `jobflow ingest`
- `jobflow normalize`
- `jobflow score`
- `jobflow pipeline`
- `jobflow next`
- `jobflow resume`

对应能力映射：

| CLI 命令 | 对应能力 |
|---|---|
| `jobflow ingest` | `ingest_job` |
| `jobflow normalize` | `normalize_job` |
| `jobflow score` | `score_job` |
| `jobflow pipeline` | `track_pipeline` |
| `jobflow next` | `summarize_next` |
| `jobflow resume` | `resume_context` |

## 5. 命令详细设计

### 5.1 `jobflow ingest`

作用：

- 接收原始机会输入
- 记录原始 payload
- 创建一条待标准化或可立即标准化的机会记录

支持输入来源：

- `--source extension`
- `--source link`
- `--source text`
- `--source file`

推荐输入方式：

- 通过标准输入传 JSON
- 通过参数传链接
- 通过参数传文本文件路径

示例：

```bash
jobflow ingest --source extension --json
jobflow ingest --source link --url "https://example.com/job/123" --json
```

成功输出示例：

```json
{
  "ok": true,
  "command": "ingest",
  "job_id": "job_01",
  "ingest_id": "ingest_01",
  "status": "accepted"
}
```

### 5.2 `jobflow normalize`

作用：

- 将已有原始输入转换为标准化职位记录
- 补齐核心字段
- 生成结构化职位对象

示例：

```bash
jobflow normalize --job-id job_01 --json
```

成功输出示例：

```json
{
  "ok": true,
  "command": "normalize",
  "job_id": "job_01",
  "status": "normalized",
  "normalized_job": {
    "title": "Python 后端工程师",
    "company_name": "Example Tech",
    "city": "上海"
  }
}
```

### 5.3 `jobflow score`

作用：

- 按当前用户目标、偏好、约束对职位进行评估
- 返回评分结果、理由和建议动作

示例：

```bash
jobflow score --job-id job_01 --json
```

成功输出示例：

```json
{
  "ok": true,
  "command": "score",
  "job_id": "job_01",
  "score_result": {
    "score": 78,
    "confidence": "medium",
    "reasons": [
      "技术栈匹配度较高",
      "城市符合偏好"
    ],
    "risks": [
      "岗位描述中没有明确远程/混合办公信息"
    ],
    "suggested_action": "review"
  }
}
```

### 5.4 `jobflow pipeline`

作用：

- 查看 pipeline
- 更新 pipeline 状态
- 写入下一步动作与跟进时间

建议子命令：

- `jobflow pipeline list`
- `jobflow pipeline get --job-id <id>`
- `jobflow pipeline update --job-id <id> --status <status>`

可支持的第一阶段状态：

- `new`
- `saved`
- `reviewing`
- `ready`
- `applied`
- `follow_up`
- `closed`

更新示例：

```bash
jobflow pipeline update --job-id job_01 --status reviewing --json
```

### 5.5 `jobflow next`

作用：

- 汇总当前最值得推进的下一步动作
- 给 agent 或用户一个简洁的行动视图

示例：

```bash
jobflow next --json
```

成功输出示例：

```json
{
  "ok": true,
  "command": "next",
  "items": [
    {
      "job_id": "job_01",
      "title": "Python 后端工程师",
      "recommended_action": "review",
      "priority": "high"
    }
  ]
}
```

### 5.6 `jobflow resume`

作用：

- 记录简历上下文
- 管理简历引用信息
- 维护目标偏好和简历关联关系

建议子命令：

- `jobflow resume add`
- `jobflow resume list`
- `jobflow resume set-default`

第一阶段不要求实现自动简历改写，但要为后续能力保留引用结构。

## 6. 统一输出约定

第一阶段所有核心命令在 `--json` 模式下应尽量遵循统一响应结构。

推荐结构：

```json
{
  "ok": true,
  "command": "score",
  "data": {},
  "warnings": [],
  "error": null
}
```

说明：

- `ok`
  布尔值，表示命令是否成功完成

- `command`
  当前命令名，便于 agent 校验返回来源

- `data`
  命令核心结果对象

- `warnings`
  非致命问题列表

- `error`
  致命错误对象；成功时为 `null`

更具体的错误结构建议为：

```json
{
  "ok": false,
  "command": "ingest",
  "data": null,
  "warnings": [],
  "error": {
    "code": "INVALID_INPUT",
    "message": "missing required field: source",
    "details": {
      "field": "source"
    }
  }
}
```

## 7. 错误码约定

第一阶段建议使用稳定字符串错误码。

首批错误码建议包括：

- `INVALID_INPUT`
- `NOT_FOUND`
- `CONFLICT`
- `UNSUPPORTED_SOURCE`
- `NORMALIZATION_FAILED`
- `SCORING_FAILED`
- `PIPELINE_UPDATE_FAILED`
- `INTERNAL_ERROR`

要求：

- 错误码稳定，不随文案变化
- `message` 面向人读
- `code` 面向 agent 判断

## 8. 核心 Schema 草案

### 8.1 `JobIngestPayload`

表示一次原始机会输入。

建议字段：

- `source_type`
  `extension | link | text | file`
- `source_site`
  如 `boss`, `liepin`, `unknown`
- `captured_at`
- `job_url`
- `page_url`
- `title_hint`
- `company_hint`
- `raw_text`
- `raw_html_excerpt`
- `metadata`

### 8.2 `NormalizedJob`

表示标准化后的职位记录。

建议字段：

- `job_id`
- `canonical_url`
- `source_site`
- `title`
- `company_name`
- `city`
- `salary_text`
- `experience_text`
- `education_text`
- `description_text`
- `tags`
- `normalized_at`

### 8.3 `ScoreResult`

表示职位评分结果。

建议字段：

- `job_id`
- `score`
- `confidence`
- `reasons`
- `risks`
- `suggested_action`
- `scored_at`

### 8.4 `PipelineEntry`

表示职位在求职流程中的状态。

建议字段：

- `job_id`
- `status`
- `priority`
- `next_action`
- `follow_up_at`
- `notes`
- `updated_at`

### 8.5 `ResumeReference`

表示简历引用信息。

建议字段：

- `resume_id`
- `label`
- `file_path`
- `is_default`
- `target_roles`
- `updated_at`

## 9. 浏览器插件到 CLI 的通信协议草案

第一阶段先定义逻辑协议，不绑定具体 IPC 技术实现。

插件发往 CLI 的消息建议采用统一 envelope。

推荐结构：

```json
{
  "version": "1",
  "type": "ingest_job",
  "request_id": "req_01",
  "sent_at": "2026-04-21T12:00:00Z",
  "payload": {
    "source_type": "extension",
    "source_site": "boss",
    "job_url": "https://example.com/job/123",
    "page_url": "https://example.com/job/123",
    "title_hint": "Python 后端工程师",
    "company_hint": "Example Tech",
    "raw_text": "职位描述文本"
  }
}
```

CLI 返回的响应建议同样使用 envelope。

推荐结构：

```json
{
  "version": "1",
  "type": "ingest_job_result",
  "request_id": "req_01",
  "ok": true,
  "payload": {
    "job_id": "job_01",
    "status": "accepted"
  },
  "error": null
}
```

协议要求：

- `version` 必填，便于后续演进
- `request_id` 必填，便于插件匹配响应
- `type` 必填，便于路由和 agent 分析
- `payload` 结构稳定
- `error` 结构应与 CLI JSON 错误结构保持一致

## 10. 外部 Agent 集成要求

为了便于 skill / tool 接入，CLI 应满足以下要求：

- 核心命令支持 `--json`
- 输出字段尽量稳定
- 不把关键信息只放在自然语言文案里
- 错误码稳定
- 命令退出码具备基本可预测性

建议：

- 成功返回退出码 `0`
- 调用失败返回非 `0`
- 详细机器可读信息放在 JSON 输出中

## 11. 第一阶段最小闭环

从接口视角看，第一阶段最小闭环应满足：

1. 浏览器插件能够提交一个职位页面 payload
2. CLI 能接受该 payload 并生成 `job_id`
3. CLI 能对该职位执行标准化
4. CLI 能返回评分结果
5. CLI 能写入和查询 pipeline 状态
6. `jobflow next` 能返回下一步建议

只要这条链路跑通，第一阶段就具备验证价值。

## 12. 暂不细化的内容

以下内容在后续文档中再展开：

- schema 的字段级约束细节
- 评分算法内部规则
- 本地数据库模型
- 插件具体事件监听策略
- skill 封装样式与示例 prompt

