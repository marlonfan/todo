# 第三轮修复与检测

日期：2026-10-22。延续 [前两轮报告](FRONTEND_REVIEW.md)。本轮修改仅在本地构建和运行，未提交、推送或发布。

## 本轮范围与结果

本轮处理上轮提出的保存失败与草稿恢复、日历键盘与焦点、重复规则重复实现、页面独立职责拆分及后端权限检查。

| 项目 | 修复结果 | 验证 |
| --- | --- | --- |
| 保存失败被当作成功，弹窗提前关闭 | 任务详情、新建/编辑弹窗、快速添加共用草稿持久化模块；等待任务及 outbox 的本地落盘后才完成保存，网络同步继续独立执行。失败时显示恢复提示或弹窗错误，保留输入和恢复副本。 | 分别注入 tasks / outbox 写入失败，覆盖切换任务、刷新、重试、重复 Enter 和新建不重复；移动弹窗失败后保持打开。 |
| 任务切换、重复实例及临时 ID 影响恢复内容 | 日志按账户、任务及重复实例隔离；写入串行，旧结果不能移除新草稿；临时 ID 映射后恢复操作转为修改已有任务。退出登录停止后续草稿写入、等待在途工作并清理恢复副本。 | 9 项模块回归，包含在途 ID 映射、新建重试和退出登录。 |
| 日历事件缺少统一键盘入口和可见焦点 | 日/周/月事件采用原生按钮，支持 Enter / 空格；只读详情使用焦点约束，Escape 关闭后返回事件；保留原有指针拖动。 | 三种视图的 Tab、Enter、空格、Escape、焦点样式与指针点击回归。 |
| 月视图 Tab 导航进入数百个缓存日期 | 月视图独立为 CalendarMonthGrid，按日期及其事件组织 DOM；仅可见周加入 Tab 顺序，其余保留原生滚动缓存。 | 缓存日期 tabIndex=-1；可见日期入口不超过 42 个；真实 Electron 验证焦点不会跳到数月前。 |
| 两个编辑器重复解析、摘要和序列化规则 | TaskList / TaskModal 共用 taskRecurrence，统一周/月间隔、日期别名、工作日和农历规则。 | 11 项模块回归；桌面详情和 375px 弹窗均从每 3 月 15 日改为每 4 月 15 日，核对服务器保存值。 |
| 订阅令牌可能被当作登录令牌 | 登录令牌新增 access 用途；校验 HS256、过期时间、有效账户身份和用途。兼容原有无 purpose 的合法登录令牌，拒绝 calendar_feed 等其他用途。 | 实际订阅令牌访问任务、写任务、读取 AI 配置及刷新令牌均返回 401；原订阅仍返回有效 ICS。 |
| 业务对象的账户隔离缺少集中回归 | 检查任务、分类、Prompt、关联分类、活动、通知及公开 DAV/feed 入口的鉴权路径。 | 跨账户读写删除和 Prompt 历史关联被拒绝；关联他人分类失败时，任务标题、版本和分类均回滚；正常登录和过期宽限内刷新成功。 |

## 架构收敛

- taskDraftPersistence 的小接口封装串行持久化、备份、失败恢复、ID 映射与关闭；useTaskDraftPersistence 负责 React 订阅和任务写入适配，TaskList 和 TaskModal 复用同一账户会话。
- CalendarMonthGrid 承担月视图分组、绘制及可见范围键盘入口；CalendarEventButton 统一事件激活，区分画布处理的指针手势和原生按钮点击。
- taskRecurrence 同时服务两个编辑器的解析、选择回填、摘要与提交，避免修改规则时遗漏另一入口。
- 相对前两轮后的状态：TaskList 5,917 → 5,773 行；TaskModal 2,615 → 2,424 行；InfiniteCalendarCanvas 2,179 → 1,972 行。行数仅辅助说明职责移动，并非复杂度或流畅度的充分指标。
- TaskList 的选中投影、草稿 UI 会话和日历的惯性/拖动仍有进一步演进空间；本轮没有全面重写这些状态，也没有声称已经完成全系统安全审计。

## 检测证据

- ./build.sh：lint、213 项前端测试（fail 0）、Vite 生产构建、Go 可执行文件构建通过；按照仓库要求停止并重启 8080 服务。
- CGO_ENABLED=1 go test ./...：全部通过；CGO_ENABLED=1 go vet ./...：退出码 0、无输出。
- 草稿与弹窗定向浏览器回归：13 passed（54.7 秒）。
- 完整浏览器回归：31 passed（58.5 秒），包含新增快速添加失败恢复回归。
- 真实 Electron：失败提示与重试、月视图 Tab / Enter / Escape、关闭后焦点返回均通过，pageErrors=[]。
- 375px Web：新建失败保留输入、错误可见、重试成功；无横向溢出，pageErrors=[]。
- Service Worker 缓存更新至 v44；哈希 /assets/* 使用 public, max-age=31536000, immutable，index.html / sw.js / manifest.webmanifest 使用 no-cache, no-store, must-revalidate。
- git diff --check 通过。

本地验证日志：/tmp/todo-round3-build.log、/tmp/todo-round3-go.log、/tmp/todo-round3-vet.log、/tmp/todo-round3-full-e2e.log、/tmp/todo-round3-preview.log、/tmp/todo-round3-cache.log。

已打开并检查截图：

- [Electron 草稿恢复提示](/tmp/todo-review-round3/electron-draft-recovery.png)
- [Electron 月视图键盘焦点](/tmp/todo-review-round3/electron-calendar-keyboard.png)
- [Electron 日历事件详情](/tmp/todo-review-round3/electron-calendar-dialog.png)
- [375px 保存失败保留输入](/tmp/todo-review-round3/web-mobile-save-error.png)
- [375px 重试后的任务列表](/tmp/todo-review-round3/web-mobile-after-retry.png)

## 限制

恢复副本使用本机 localStorage，不能代替跨设备备份。IndexedDB 与 Web Storage 同时不可用时仅保留内存并提示勿关闭窗口；浏览器强制终止、双存储同时故障等极端情况不能保证恢复。恢复后的草稿需用户明确重试，不静默覆盖服务端数据。

## 本批通过后确认的下一轮问题

### N01：修改密码不会撤销旧登录会话（高优先级）

定位：internal/service/auth_service.go 的 UpdatePassword 与 RefreshTokenFromRaw、internal/api/middleware/auth.go。

使用独立测试账户实测：修改密码返回 200，修改前的 access token 仍可读取 /api/tasks（200），也仍能通过 /api/auth/refresh 换取新令牌（200）。当前仅更新密码哈希，没有账户会话版本或令牌撤销时间校验；旧凭证暴露后，改密无法切断已有会话。

建议下一轮引入账户会话版本或凭证生效时间，同时校验访问和刷新路径，并决定改密后当前设备是否重新签发令牌。订阅链接有独立的长期有效语义，应单独设计可轮换和可撤销能力，不与登录会话混用。

### N02：设置页异步回填覆盖正在编辑的输入（中优先级）

定位：web/src/components/Settings.jsx 初始化 authAPI.me 的 Effect（约 345 行）及默认开始时间输入（约 1465 行）。

使用实际 Chrome 复现：进入设置并暂缓个人资料响应，在“偏好设置”的默认开始时间填入 13:45，随后释放先前已取得的资料响应，输入立即被无提示重置为旧值 09:00。初始化响应直接 setState，没有区分用户已修改的字段或表单会话版本。

建议下一轮按字段记录 dirty 状态或表单版本，仅对未编辑字段应用回填，同时处理保存请求乱序返回。复现脚本与输出位于 /tmp/todo-review-round3/audit.mjs 和 /tmp/todo-round3-next-audit.log。

这两项是本批通过后的新发现，尚未修改。跨源 DAV 读取在本机 Chrome 验证中被拒绝，本轮不将 CORS 直接标为已确认可利用漏洞。
