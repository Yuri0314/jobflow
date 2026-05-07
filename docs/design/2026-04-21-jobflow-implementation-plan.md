# jobflow 第一阶段实现计划

日期：2026-04-21  
状态：可执行的第一阶段实现计划

## 1. 计划目标

本计划用于把当前设计文档落成第一阶段最小可验证实现。

本阶段目标不是做完整产品，而是跑通下面这条最小闭环：

1. 接收职位输入
2. 生成标准化职位记录
3. 生成评分结果
4. 维护 pipeline 状态
5. 返回下一步建议

## 2. 本阶段完成标准

若满足以下条件，则认为第一阶段实现完成：

- CLI 可执行 `ingest`、`normalize`、`score`、`pipeline`、`next` 这组核心能力
- 核心命令支持结构化 JSON 输出
- 本地状态能保存 ingest、job、score、pipeline、resume 五类对象
- 浏览器插件到 CLI 的输入协议已固化为可实现格式
- 至少存在一条从“职位输入”到“next 建议”的完整链路
- 基础文档足以支持后续 skill / tool 集成

## 3. 实现顺序

第一阶段建议按下面顺序推进。

### 阶段 A：仓库与开发骨架

目标：

- 建立 CLI 应用骨架
- 建立共享 schema / protocol 目录骨架
- 固定最基础的工程约定

任务：

- 在 `apps/cli` 中建立 CLI 入口结构
- 在 `packages/schema` 中建立 schema 占位文件
- 在 `packages/protocol` 中建立 protocol 占位文件
- 增加最小 README 或开发说明

完成标准：

- CLI 应用可运行空命令
- 目录结构和文档一致

### 阶段 B：核心 Schema 与本地状态层

目标：

- 先把数据模型和本地持久化边界做出来

任务：

- 实现 `JobIngestRecord`
- 实现 `JobRecord`
- 实现 `ScoreRecord`
- 实现 `PipelineRecord`
- 实现 `ResumeRecord`
- 提供本地状态读写接口

建议要求：

- 先采用最简单可工作的本地持久化方案
- 不在这一阶段追求复杂数据库抽象

完成标准：

- 可新增和读取五类核心对象
- 可按 `job_id` 关联 job、score、pipeline

### 阶段 C：实现 `ingest`

目标：

- 接收原始输入并持久化为 `JobIngestRecord`

任务：

- 支持 `--source link`
- 支持 `--source text`
- 支持标准输入 JSON
- 返回标准 JSON 响应
- 实现输入合法性校验

完成标准：

- 能生成 `ingest_id`
- 能接受最小合法输入
- 非法输入返回稳定错误码

### 阶段 D：实现 `normalize`

目标：

- 从 ingest 记录派生 `JobRecord`

任务：

- 定义从 ingest 到 job 的基础映射
- 实现最小标准化逻辑
- 补齐 `title`、`company_name` 等核心字段
- 生成 `job_id`
- 实现基础去重逻辑

完成标准：

- 对合法 ingest 可生成 `JobRecord`
- 对明显重复输入能复用已有 job

### 阶段 E：实现 `score`

目标：

- 基于最简单可工作的规则生成评分结果

任务：

- 定义第一版评分输入
- 实现最小规则评分逻辑
- 输出 `score`、`confidence`、`reasons`、`risks`、`suggested_action`
- 保存 `ScoreRecord`

说明：

- 第一版评分可以非常简单
- 核心是接口和记录结构稳定

完成标准：

- 对已有 `job_id` 可返回评分结果
- 评分结果可持久化和读取

### 阶段 F：实现 `pipeline`

目标：

- 维护职位推进状态

任务：

- 实现 `pipeline list`
- 实现 `pipeline get`
- 实现 `pipeline update`
- 加入状态迁移校验
- 支持 `priority`、`next_action`、`follow_up_at`

完成标准：

- 只能执行允许的状态迁移
- 非法迁移返回稳定错误

### 阶段 G：实现 `next`

目标：

- 给出当前最值得推进的下一步动作视图

任务：

- 读取最新 score + pipeline
- 定义简单优先级排序规则
- 输出推荐动作列表

完成标准：

- 对存在 job 数据的状态库，能生成稳定 JSON 结果

### 阶段 H：浏览器插件协议落地

目标：

- 让插件侧输入模型变成可对接接口

任务：

- 固化 `ingest_job` request envelope
- 固化 `ingest_job_result` response envelope
- 明确 request / response 示例
- 明确字段最小集

完成标准：

- 插件团队或后续你自己能按文档直接实现一条发送链路

## 4. 推荐任务拆分

建议把实现拆成下面这些小任务：

1. CLI 空壳和命令路由
2. 本地状态仓库接口
3. Schema 基础类型
4. `ingest` 输入与校验
5. `normalize` 派生逻辑
6. `score` 第一版规则
7. `pipeline` 状态更新
8. `next` 汇总逻辑
9. JSON 输出和错误码统一
10. 插件协议样例和对接脚本

## 5. 推荐实现顺序中的关键约束

实现时建议遵守这些约束：

- 先把 JSON 输出和错误结构做统一，再扩命令
- 先做最小规则评分，不要一开始引入复杂模型能力
- 先做单用户、本地状态，不扩展多用户语义
- 先做简单去重，不实现复杂合并策略
- 先保证命令可被 agent 调用，再优化人类交互体验

## 6. 建议的验证节点

### 验证点 1：CLI 能保存输入

需要验证：

- `ingest` 可接收最小输入
- 可返回 `ingest_id`
- 本地能读回 ingest 记录

### 验证点 2：CLI 能生成 job

需要验证：

- `normalize` 可生成 `job_id`
- 核心字段补齐逻辑有效
- 简单去重生效

### 验证点 3：CLI 能给出建议

需要验证：

- `score` 返回结构稳定
- `pipeline update` 可更新状态
- `next` 能返回推荐动作

### 验证点 4：插件协议可落地

需要验证：

- CLI 能接受与协议一致的 payload
- 返回值可被插件方稳定解析

## 7. 建议暂缓的内容

以下内容不建议在第一阶段前半段投入：

- 完整浏览器插件实现
- 平台页面专属解析优化
- 自动投递
- 聊天消息模型
- 复杂推荐策略
- 自有 agent mode

## 8. 下次会话建议起点

如果下次从 `E:\Code\jobflow` 目录开始继续，建议按这个顺序接：

1. 先搭 CLI 工程骨架
2. 再实现本地状态层
3. 先把 `ingest` 跑通
4. 然后依次接 `normalize`、`score`、`pipeline`、`next`

## 9. 对后续返工的看法

这一版计划允许后续返工，但返工应尽量局限在这些层面：

- 命令命名调整
- schema 字段调整
- 状态细节调整

不建议轻易返工这些层面：

- 产品定位
- 第一阶段边界
- CLI / 浏览器插件 / 外部 agent 的分工

