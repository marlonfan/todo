# Todo NSGo Mobile（Android 原生客户端）

基于 **NSGo (`github.com/nsgo-dev/nsgo v0.2.0`)** 纯 Go 编写的移动端原生 Todo 客户端，面向 **Android** 优先设计，视觉风格参照仓库内 `mygo-todo` 的暖白/暗褐编辑感语义色系，并复用其纯 Go API 客户端、本地缓存与离线同步队列引擎。

## 风格与架构

- **暖白 / 暗褐语义主题**（[theme.go](internal/app/theme.go)）：
  - 浅色：画布 `#FAF9F6`、卡片 `#FFFFFF`、次级底面 `#F5F3EE`、输入框 `#F2F0EA`、陶土主色 `#C46849`
  - 深色：画布 `#181715`、卡片 `#232220`、次级底面 `#1E1D1B`、输入框 `#2A2926`、暖陶土主色 `#D67E60`
- **Android 原生交互**：
  - `ui.TabShell` 自动映射为 Android 原生底部导航栏（任务 / 分类 / 同步 / 我的），附带 Lucide SVG 图标与主色着染。
  - `base.NewNav` + `ui.NavPage` / `ui.NavHeader` 自动使用 Android 原生顶部工具栏与系统返回手势。
  - `core.Scroll` 内置下拉刷新（Pull-to-Refresh）、底部抽屉 `ui.Sheet`（快速新建与分类编辑）、`ui.AlertDialog` 删除与退出确认、触觉反馈 `PlayHaptic`。
  - 会话令牌通过 `cx.Secrets()` 加密保存在 Android Keystore 中，离线缓存原子写入应用私有目录 `cx.DataDir()`。
- **纯 Go 业务层复用**：
  - `internal/api`：对接现有 Todo Go 后端（`/api/auth/*`、`/api/tasks/sync`、`/api/tasks`、`/api/categories`、`/api/tasks/next-occurrences`），支持 `If-Match`、`X-Client-Op-Id` 幂等与 401 串行刷新。
  - `internal/storage` & `internal/syncer`：离线优先读写、冲突检测（409）与显式覆盖/放弃处理。
  - `internal/domain`：按账户时区进行今天/收件箱/即将到来/全部/已完成筛选、逾期判定、计数与排序。

## 常用命令

所有命令在 `nsgo-todo/` 目录下运行（Go 1.27.3+ 会自动切换工具链，无需安装 Android SDK/NDK/JDK 即可构建 ARM64 APK）：

```sh
# 静态检查（同时校验 Android 与 Windows 目标）
go tool nsgo check -target android_arm64,windows_x64

# 运行完整单元测试与 nsgotest 移动端端到端界面测试
go tool nsgo test ./...

# 在当前电脑上以手机比例（400x844）热重载预览
go tool nsgo dev

# 连接 Android 真机/模拟器进行热重载调试
go tool nsgo dev -target android

# 打包可安装的 Android ARM64 APK（输出在 dist/releases/）
go tool nsgo build -target android_arm64
```

> 提示：Android 真机连接本地后端时，请在登录页将服务地址设为电脑局域网 IP（如 `http://192.168.1.10:8080`）或你的公网 HTTPS 域名。

## 第一阶段已实现范围

- 登录 / 注册 / 服务地址配置、Keystore 凭据持久化、会话恢复、退出登录（含未同步修改保护）
- 任务清单：今天 / 收件箱 / 即将到来 / 全部 / 已完成筛选与真实计数、本地关键词搜索、下拉刷新
- 快捷新建底部抽屉（日期预设、优先级、分类选择、一键展开完整编辑）
- 任务详情页：标题、描述、状态、优先级、全天开关、截止/开始日期选择器、多分类切换、删除确认、同步状态底栏
- 分类管理：新建 / 编辑（表情 + 暖色板）/ 删除、点击跳转分类任务列表、离线队列支持
- 同步中心：在线/离线状态、待提交与冲突统计、手动同步、409 冲突本地覆盖与放弃修改
- 我的与设置：账户信息卡片、任务统计、浅色 / 深色 / 跟随系统主题切换与持久化

## 后续阶段规划

- 第二阶段：移动日历视图（日/周/月）、重复规则编辑器、单次实例改期与历史记录
- 第三阶段：本地推送提醒、CalDAV 外部日历管理、AI 助手对话与任务草稿
