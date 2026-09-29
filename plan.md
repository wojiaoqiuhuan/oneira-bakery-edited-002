# ONEIRA 梦面包运营中台重构计划

## 产品目标

基于现有 ONEIRA 门店运营仓库，重构为一个面向管理员、运营、店长的三角色协作中台。保留有效的门店、日报、建议、问题和总结数据模型，同时引入可信的服务端角色隔离、日报模板、复盘备忘录、特殊日期日历和操作审计。

## 角色与权限

### 管理员

- 门店、用户、角色和权限的增删改查、停用和删除。
- 日报模板的增删改查：模板字段、分组、必填项、排序、启用状态和微信复制字段配置。
- 日报、建议、问题、复盘、特殊日期的检索、查看、新增、编辑、删除。
- 查看和筛选关键操作审计记录。

### 运营

- 查看门店和日报，按门店、日期、状态筛选。
- 回复和评论门店建议与问题。
- 更新处理状态，记录处理过程。
- 创建、编辑和检索复盘备忘录。
- 查看并维护特殊日期日历中的节假日、活动日和特别销售情况标注。
- 不具备用户、权限和日报模板治理权限。

### 店长

- 查看绑定门店的日报模板和历史日报。
- 按模板提交、编辑和复制日报。
- 一键生成适合直接粘贴到微信报账群的日报文本。
- 提交建议和问题，查看运营回复、评论和处理记录。
- 创建、编辑和检索本店复盘备忘录。
- 查看绑定门店的特殊日期标注，不维护全局日历。

## UI 与交互

- 三种角色登录后进入对应工作台，侧边导航 / 移动底部导航保持角色化。
- 桌面端采用宽屏工作台：侧栏、主内容、上下文详情抽屉。
- 移动端采用底部导航、全屏抽屉和底部操作栏。
- 简约、留白充足、低认知负担；以 warm cream、deep ink、burnt orange、sage、sky 为状态语义色。
- 使用 Framer Motion 实现页面切换、卡片错峰进入、列表布局变化、抽屉和弹窗进出、状态标签反馈、日期选中和复制成功反馈。
- 动效强调响应和层次，不使用长时间阻塞动画；尊重 `prefers-reduced-motion`。
- 产品品牌采用面包 / 麦穗抽象符号，沿用 ONEIRA 梦面包的温暖识别感。

## 前端结构

```text
client/src/
  App.tsx                         路由与全局 Providers
  pages/
    AccessPage.tsx                角色登录入口
    AdminWorkspace.tsx            管理员工作台
    OperationsWorkspace.tsx       运营工作台
    StoreWorkspace.tsx            店长工作台
  features/
    dashboard/                    三角色概览卡片和待办
    reports/                      日报列表、模板表单、复制到微信
    collaboration/                建议、问题、评论、处理记录
    retrospectives/               复盘备忘录
    calendar/                     特殊日期日历与标注编辑
    admin/                        用户、门店、模板、审计管理
  components/
    shell/                        侧栏、移动导航、页面标题、状态栏
    ui/                           通用 Radix / Tailwind 组件
  lib/
    api.ts                        tRPC 客户端和 query helpers
    permissions.ts                前端能力映射，仅用于展示，不作为安全边界
```

第一阶段优先完成一个可用的三角色前端工作台和本地演示数据，保留 tRPC 客户端结构；第二阶段将领域 API 与数据库约束迁移到服务端可信权限模型。

## 后端结构

```text
server/
  _core/                          Express、tRPC、认证、静态文件
  routers.ts                      appRouter 聚合入口
  routers/auth.ts                 登录和当前用户
  routers/admin.ts                管理和审计
  routers/reports.ts              日报、日报模板和微信文本
  routers/collaboration.ts        建议、问题、评论、处理记录
  routers/retrospectives.ts       复盘备忘录
  routers/calendar.ts             特殊日期
  auth/                           服务端可信角色和门店范围
```

所有业务写操作必须从 `ctx.user` 获取角色和门店范围，不能把客户端传入的 role 当作授权依据。对 store 角色使用资源级门店校验；对 operator 使用运营范围校验；对 admin 使用全量管理权限。

## 数据模型演进

保留并迁移原有：

- stores
- dailyReports
- storeSuggestions
- operationSummaries
- monthlyTargets
- openingNodes
- productRanks

新增或规范化：

- reportTemplates
- reportTemplateFields
- reportComments
- issueActivityLogs
- retrospectives
- specialDates
- auditLogs
- userRoles / storeMemberships（或在现有 users 上扩展）

业务表逐步从 `storeName` 字符串关联迁移到 `storeId`，金额字段使用 decimal，日期字段使用规范日期类型。日报和总结继续保持门店 + 日期 / 周期的幂等约束。

## 微信日报复制

日报详情中提供“复制到微信”操作：

- 将模板中启用并排序的字段转换为稳定的纯文本格式。
- 使用适合微信群阅读的分组标题、短行和关键数值。
- 复制成功后显示明确 toast，并保留“查看文本”回退入口。
- 不调用微信 API，不自动发送，只写入系统剪贴板。

## 交付与验证

- 维护 `/manus-routes.json`，当前页面路由包括 `/`、`/admin`、`/operations`、`/store`。
- 使用现有 TypeScript 检查、项目构建和单元测试作为主要验证。
- 首次运行前注册 Web Dev 托管诊断。
- 当前版本使用 SPA 前端 + Express/tRPC API，发布时静态前端走 static，`/api/*` 走 server，私有 API 不做共享缓存。
