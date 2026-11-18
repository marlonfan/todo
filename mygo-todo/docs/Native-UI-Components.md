# Todo Native 组件与样式约定

`mygo-todo` 基于 Go / MyGo / lobe-mygo 原生桌面组件构建，采用独立的现代原生桌面视觉体系（不复刻或依赖 Electron 前端配色与布局）。任务模型、服务端 API、离线队列（Outbox）、冲突保护（`Revision` / `local_ack_revisions`）与重复实例（`instance_id` / `occurrence_date`）协议保持不变。以下路径均相对于 `mygo-todo/`。

## 样式入口与语义配色

- `internal/app/design_tokens.go`：`designTokens`、`tokensOf(c)`、`applyAppTheme(c)`、`elevatePopup(c, el)`、`elevateModal(c, el)`。统一定义 Claude 风格温润纸感浅色（Warm Parchment Ivory + Terracotta）与深炭灰暗色（Warm Charcoal + Coral Terracotta）语义 Token；全站采用无投影（Zero-Shadow）扁平 `1px` 细边框语言。
- `internal/app/design_metrics.go`：字体、4 单位间距基准、列宽（默认列表 360，可自由缩窄至 240、详情可扩展至 1600）、工具栏（50）、导航行（34）、任务行（44 / 52）与圆角（控件 6、浮层 8、模态框 10）。
- `internal/app/view.go`：三栏工作空间、导航（底部设置与同步状态预留充足呼吸留白）、统一视图工具栏、响应式分栏、稳定任务排序（`taskRecencyRank`）与稳定列表键（`stableTaskKey`）。
- `internal/storage/storage.go`：本机 `sidebar_width` / `task_list_width` 偏好。适配窗口的临时宽度和用户偏好分开，缩窄窗口不会覆写较宽窗口下的选择。

| 语义 | 浅色（Claude Warm Ivory） | 深色（Claude Warm Charcoal） |
|---|---|---|
| 主背景 / 列表 | `#FAF9F5` | `#21201E` |
| 侧栏 | `#F0EEE6` | `#191816` |
| 次级区域 / 软底槽 | `#F4F2EB` | `#2A2926` |
| 悬停 | `#E8E5DC` | `#33312D` |
| 导航选中 | `#E5DFD3` | `#3B342E` |
| 任务行选中 | `#EFECE2` | `#2E2C28` |
| 主文字 | `#141413` | `#F0EEE6` |
| 次级文字 | `#5F5B53` | `#B0ABA0` |
| 可读辅助 / 空值 / 占位文字 | `#57534C` | `#B5B0A4` |
| 弱文字 / 装饰图形 | `#858178` | `#7E7A71` |
| 常规 / 弱边框 | `#DEDAD0` / `#EBE8DF` | `#3A3833` / `#2D2B27` |
| 强调 / 悬停 | `#C96442` / `#B55333` | `#D97757` / `#E38A6C` |
| 强调色上的文字 | `#FAF9F5` | `#191816` |
| 危险 / 警告 / 成功 | `#C84337` / `#C4792B` / `#3D7F58` | `#E57368` / `#DFA055` / `#6BBF8A` |

`TextReadable` 与 `TextPrimary` 在主背景、侧栏、列表、次级、悬停、导航选中和任务选中七类背景上均满足 WCAG AA（≥ 4.5:1），由 `design_contrast_test.go` 验证线性 sRGB 对比度与实际渲染像素；`Danger` 语义色在任务列表中严格保留给逾期日期提醒，高优先级采用琥珀色 `Warning` 标签提示。

## 共用组件与核心模块

| 组件 / 模块 | 入口 | 约定 |
|---|---|---|
| Button | `app_components.go`：`appButton` / `appActionButton` / `primaryButton` | `primary`、`secondary`、`ghost`、`destructive`；标准高 32，圆角 7；保留原生禁用、焦点与激活行为 |
| IconButton / Badge | `app_components.go`：`iconButton` / `countBadge`；`shared_components.go`：`appBadge` | 32×32 图标点击区、必填可访问名称与 Tooltip；侧栏计数采用 `tnum` 等宽数字，为零隐藏 |
| Soft-Filled Input / Search / Segmented | `shared_components.go`：`appInput`；`themed_controls.go`：`appSegmented` / `appSearchBar` | 无生硬线框的软填充输入与内嵌胶囊分段器（选中滑块无描边线框）；聚焦时柔和展示 `Accent` 边框 |
| Dropdown / Popover / Dialog | `dropdown_component.go`：`appDropdown`；`task_property_components.go`：`propertyPopover`；`shared_components.go`：`appDialog` | 统一挂载多层柔和投影（`elevatePopup` / `elevateModal`），保留键盘方向键、`Esc` 关闭与锚点焦点恢复 |
| TaskListItem | `task_list_item.go`：`taskListItem` | 固定逻辑高度 44（单行）/ 52（含元信息），常规后台待同步不追加额外副行文案以避免 44↔52 高度跳动；已完成显示柔和删除线 |
| Direct 1-Click DetailTitle | `detail_layout_metrics.go`：`detailTitle` | 普通任务与重复实例均默认挂载单次点击直编原生 `TextAreaBase`（18 号 Semibold、26 行高、1–5 行自适应）；`Enter` 提交并跳转描述，`Shift+Enter` 或自动折行保留完整 1–200 字符 |
| Horizontal Property Chips | `editor.go`：`taskMetadata`；`task_property_components.go`：`detailPropertyChip` / `taskDateProperty` | 标题下方紧凑横向胶囊栏，直观展示状态、日期与起止时间、优先级、多选分类、重复规则摘要与预设提醒；多选分类弹层连续点选不闪退，并支持输入名称一键内联新建并关联分类 |
| True WYSIWYG Markdown Editor | `markdown_wysiwyg.go`：`wysiwygMarkdownEditor` | 基于 MyGo 原生 `richtext.EditorBase` 的单表面所见即所得富文本编辑器：支持实时 `# ` 标题转换、任务复选框点击切换、格式工具栏（H1/H2/加粗/斜体/删除线/行内代码/列表/待办/引用/代码块/链接/AI）与 `源码` 切换；保留代码块语言标识，对含 GFM 表格或扩展 HTML 的任务自动启用无损渲染；通过 `ObserveInput` 同步跟踪 IME 合成状态并升级纯文本剪贴板粘贴 |
| Border-Minimal Calendar | `calendar_view.go`、`calendar_drag.go`、`calendar_data.go` | 单行 52px 现代日历工具栏（可点击标题跳选日期、`< 今天 >`、`日/周/月/日程`、`全部/任务/外部`、`- / +` 缩放）；月视图自适应铺满视口、单一 1px 极淡内部分隔线、今日圆形蓝底徽章、悬停 `+` 快捷新建与分类彩色事件条；周/日时间轴固定顶部全天栏并纯纵向滚动、带红点当前时间线与虚线幽灵块拖拽/拉伸预览；14 天分组日程流使用 `plainMarkdownPreview` 展示纯净摘要 |
| Zero-Flicker Sync Engine | `sync.go`、`remote_sync.go`、`task_writes.go`、`internal/syncer/task_receipt.go` | 后台同步与提醒轮询全部改用 `mygo.RunOnMain` 按需触发 `win.Invalidate()`（彻底移除每秒无条件全窗口重绘与 15 秒前台强制阻塞刷新）；后台同步使用非阻塞 `a.syncing` 而不锁死 `a.busy`；重复任务写入回执同帧刷新 `NextOccurrences`；非排期类系列修改原位更新日历缓存而不清空闪烁 |

## 编辑、键盘与数据边界

- **即时与防抖保存**：任务属性选择在无文本框焦点时即时落盘；标题与所见即所得描述在停输入 450ms、失焦或切换输入框时自动持久化到本机 Outbox，后台异步同步服务器。
- **IME 合成保护**：标题输入（`Element.Composing()`）与所见即所得富文本输入（`ObserveInput` `InputCompose` -> `a.richComposing` / `a.autosave.composing`）在拼音/候选词未确认期间严格禁止自动保存与草稿覆盖。
- **重复实例作用域**：点击重复任务或日历单次实例进入单次详情（顶栏一键支持`编辑整个系列`与`整个系列提醒与活动记录`，属性区前置`完成本次`、`跳过本次`与`编辑本次开始`），单次修改严格携带 `instance_id` 与 `occurrence_date`，绝不污染系列锚点。

## 验证命令

```sh
go test -race ./...
make preview
make build
```
