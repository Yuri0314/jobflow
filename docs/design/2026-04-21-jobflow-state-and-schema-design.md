# jobflow 状态模型与 Schema 细化设计

日期：2026-04-21  
状态：第一阶段状态与数据模型设计草案

## 1. 文档目的

本文档用于细化 `jobflow` 第一阶段的数据边界与状态边界。

它重点回答这些问题：

- 核心 schema 的字段约束应该如何收紧
- 第一阶段本地状态模型至少要保存哪些对象
- pipeline 状态应如何迁移
- 哪些字段是必须稳定的，哪些字段允许后续扩展

本文档不解决这些问题：

- 底层数据库技术选型
- 具体 ORM 或文件存储实现
- 评分算法的内部规则
- CLI 命令的最终参数细节

## 2. 设计目标

第一阶段状态模型应满足以下目标：

- 支持最小闭环，不多建模
- 字段语义稳定，便于外部 agent 理解
- 允许部分字段缺失，不把数据接入门槛定得过高
- 为后续跨来源扩展预留空间
- 避免把平台特有字段直接做成核心模型的一部分

## 3. 核心对象总览

第一阶段建议保留 5 类核心对象：

- `JobIngestRecord`
- `JobRecord`
- `ScoreRecord`
- `PipelineRecord`
- `ResumeRecord`

这些对象之间的关系如下：

```text
JobIngestRecord
    -> JobRecord
        -> ScoreRecord
        -> PipelineRecord

ResumeRecord
    -> 可被 ScoreRecord / PipelineRecord 引用
```

## 4. Schema 细化原则

### 4.1 原始输入与标准化结果分离

原始接入数据与标准化职位记录必须分开建模。

原因：

- 原始输入常常不完整
- 不同来源格式差异很大
- 后续标准化策略可能迭代
- 需要保留原始证据，便于调试与重新处理

### 4.2 可缺字段与核心字段分开看待

第一阶段不要求一次把所有字段提全。  
应区分：

- 核心识别字段
- 建议补全字段
- 扩展字段

### 4.3 避免平台特化污染核心模型

例如：

- 某平台的内部职位 ID
- 某平台特有的沟通状态
- 某平台特殊标签

可以放在 `source_metadata` 中，但不应直接进入核心通用字段。

## 5. JobIngestRecord

### 5.1 定义

表示一次原始机会输入记录。

它是“采集事件”的记录，而不是最终职位实体。

### 5.2 建议字段

- `ingest_id`
  全局唯一 ID，必须

- `source_type`
  输入来源类型，必须  
  枚举建议：`extension | link | text | file | manual`

- `source_site`
  来源站点，可选  
  枚举建议：`boss | liepin | lagou | linkedin | unknown`

- `captured_at`
  采集时间，必须

- `job_url`
  职位链接，可选但强烈建议存在

- `page_url`
  当前页面链接，可选

- `title_hint`
  页面或输入中提取到的标题提示，可选

- `company_hint`
  页面或输入中提取到的公司提示，可选

- `raw_text`
  原始文本内容，可选但推荐

- `raw_html_excerpt`
  页面片段，可选

- `source_metadata`
  来源特有附加信息，可选

### 5.3 最低可接受输入

第一阶段建议允许以下几种最低输入成立：

情况 A：

- `source_type`
- `captured_at`
- `job_url`

情况 B：

- `source_type`
- `captured_at`
- `raw_text`

情况 C：

- `source_type`
- `captured_at`
- `title_hint`
- `company_hint`

如果连上述最小条件都不满足，应判定为 `INVALID_INPUT`。

## 6. JobRecord

### 6.1 定义

表示标准化后的职位实体。

### 6.2 建议字段

- `job_id`
  全局唯一 ID，必须

- `canonical_url`
  标准职位链接，可选

- `source_site`
  主来源站点，可选

- `source_job_key`
  来源侧职位标识，可选

- `title`
  职位标题，建议必填

- `company_name`
  公司名，建议必填

- `city`
  城市，可选

- `salary_text`
  原始薪资描述，可选

- `experience_text`
  原始经验要求，可选

- `education_text`
  原始学历要求，可选

- `description_text`
  职位描述正文，可选

- `tags`
  标签数组，可选

- `source_metadata`
  平台特有字段，可选

- `created_at`
  创建时间，必须

- `normalized_at`
  标准化时间，必须

### 6.3 标准化完成条件

第一阶段可把“标准化完成”定义为至少补齐：

- `job_id`
- `title`
- `company_name`
- `normalized_at`

其余字段可以延后补全。

## 7. ScoreRecord

### 7.1 定义

表示对某个职位在某一时刻的评估结果。

### 7.2 建议字段

- `score_id`
  全局唯一 ID，必须

- `job_id`
  关联职位 ID，必须

- `resume_id`
  引用的简历 ID，可选

- `score`
  数值分数，建议范围 `0-100`

- `confidence`
  置信度，建议枚举：`low | medium | high`

- `reasons`
  正向理由数组，可选

- `risks`
  风险数组，可选

- `suggested_action`
  建议动作，建议枚举：`ignore | review | prepare | apply`

- `scoring_profile`
  评分时采用的偏好/上下文快照，可选

- `scored_at`
  评分时间，必须

### 7.3 设计说明

评分记录建议设计成可多次生成，而不是覆盖写死。  
原因：

- 偏好会变化
- 简历版本会变化
- 评分策略会变化

第一阶段可以只保留“最新评分”为默认读取结果，但底层模型不应把评分限定为唯一单例。

## 8. PipelineRecord

### 8.1 定义

表示职位在当前求职流程中的推进状态。

### 8.2 建议字段

- `job_id`
  关联职位 ID，必须

- `status`
  当前状态，必须

- `priority`
  优先级，建议枚举：`low | medium | high`

- `next_action`
  下一步动作，可选

- `follow_up_at`
  跟进时间，可选

- `notes`
  备注，可选

- `resume_id`
  当前主要关联简历，可选

- `updated_at`
  最近更新时间，必须

- `closed_reason`
  关闭原因，可选

### 8.3 第一阶段状态枚举

第一阶段建议只保留这些状态：

- `new`
  新接入，尚未处理

- `saved`
  已保存，等待进一步判断

- `reviewing`
  正在人工或 agent 审查

- `ready`
  已具备推进条件

- `applied`
  已投递

- `follow_up`
  等待跟进或已进入跟进阶段

- `closed`
  已结束，不再继续推进

## 9. Pipeline 状态迁移规则

### 9.1 状态机目标

第一阶段状态机要足够简单，避免一开始引入过细状态。

### 9.2 允许的主要迁移

建议允许以下迁移：

- `new -> saved`
- `new -> reviewing`
- `saved -> reviewing`
- `reviewing -> ready`
- `reviewing -> closed`
- `ready -> applied`
- `ready -> closed`
- `applied -> follow_up`
- `applied -> closed`
- `follow_up -> closed`

### 9.3 回退策略

第一阶段允许有限回退：

- `reviewing -> saved`
- `ready -> reviewing`

不建议允许大量任意跳转，否则状态语义会变差。

### 9.4 `closed` 处理

`closed` 应被视为终态。  
进入 `closed` 后，默认不再自动推进，但允许人工重新打开。

如需重开，建议：

- `closed -> reviewing`

### 9.5 `closed_reason`

关闭时建议支持这些原因：

- `not_fit`
- `duplicate`
- `expired`
- `applied_elsewhere`
- `manual_drop`
- `unknown`

## 10. ResumeRecord

### 10.1 定义

表示一份被系统引用的简历记录。

### 10.2 建议字段

- `resume_id`
  全局唯一 ID，必须

- `label`
  用户可读名称，必须

- `file_path`
  文件路径，可选

- `source_type`
  建议枚举：`file | text | generated`

- `is_default`
  是否默认简历，必须

- `target_roles`
  目标岗位列表，可选

- `summary`
  简要摘要，可选

- `updated_at`
  更新时间，必须

### 10.3 第一阶段限制

第一阶段只要求做到“可引用”和“可区分不同版本”。  
不要求实现完整的简历内容解析和自动定制工作流。

## 11. 本地状态模型建议

第一阶段本地状态至少需要保存以下集合：

- `ingests`
- `jobs`
- `scores`
- `pipeline`
- `resumes`

从逻辑上看，系统至少要支持这几类读写操作：

- 新增 ingest
- 从 ingest 派生 job
- 为 job 追加 score
- 更新 job 对应的 pipeline
- 维护 resume 引用

## 12. 去重与关联策略

### 12.1 第一阶段目标

第一阶段不追求复杂去重，只需要避免明显重复。

### 12.2 基础去重建议

优先比较：

- `canonical_url`
- `job_url`
- `source_site + source_job_key`

如果这些都不存在，再退化到弱匹配：

- `title + company_name + city`

### 12.3 去重结果处理

发现疑似重复时，建议：

- 保留新的 `JobIngestRecord`
- 复用已有 `JobRecord`
- 在 ingest 与 job 之间建立关联

这样既保留采集历史，也不把职位实体炸成多个副本。

## 13. 字段稳定性分级

为了方便后续演进，建议把字段分成三层：

### 13.1 核心稳定字段

这些字段一旦对外暴露，应尽量保持稳定：

- `job_id`
- `resume_id`
- `status`
- `score`
- `suggested_action`
- `next_action`
- `updated_at`

### 13.2 建议稳定字段

这些字段应尽量稳定，但后续可扩展：

- `city`
- `salary_text`
- `experience_text`
- `education_text`
- `priority`

### 13.3 扩展字段

这些字段允许随来源和策略扩展：

- `source_metadata`
- `tags`
- `summary`
- `scoring_profile`

## 14. 第一阶段约束建议

建议在第一阶段遵守以下约束：

- 不为每个平台单独建一套职位核心模型
- 不把沟通记录系统纳入第一阶段主模型
- 不把投递细节拆成复杂子表
- 不把评分和 pipeline 强耦合成一个对象

## 15. 第一阶段最小状态闭环

只要以下链路成立，第一阶段状态模型就足够支撑验证：

1. 能保存原始接入记录
2. 能生成标准化职位记录
3. 能为职位追加评分记录
4. 能维护一个当前 pipeline 状态
5. 能查询哪些职位值得下一步推进

## 16. 后续待细化项

以下内容建议在后续文档中进一步展开：

- 具体 JSON schema
- 字段合法值约束
- 时间字段格式规范
- 去重置信度规则
- pipeline 更新时的校验逻辑

