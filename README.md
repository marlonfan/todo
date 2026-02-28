# Todo App

一个功能完善的 Todo 应用，支持日历视图、重复任务和插件式通知系统。

## 功能特性

- ✅ **多用户支持**：JWT 认证，安全的多用户系统
- ✅ **日历视图**：React + FullCalendar，支持拖拽调整任务时间
- ✅ **重复任务**：支持多种重复规则（每日、每周、每月等）
- ✅ **插件式通知**：支持 Telegram、ntfy、Webhook
- ✅ **双数据库支持**：SQLite（单二进制部署）和 PostgreSQL
- ✅ **分类管理**：为任务添加颜色和分类

## 项目结构

```
todo-app/
├── cmd/server/           # 服务端入口
│   └── main.go
├── internal/             # 内部包
│   ├── api/             # HTTP API
│   │   ├── handler/     # 请求处理器
│   │   ├── middleware/  # 中间件
│   │   └── router.go    # 路由配置
│   ├── models/          # 数据模型
│   ├── repository/      # 数据访问层
│   ├── service/         # 业务逻辑层
│   ├── notify/          # 通知插件系统
│   ├── scheduler/       # 定时任务
│   └── config/          # 配置管理
├── web/                 # React 前端
│   ├── src/
│   └── dist/           # 构建输出
├── migrations/          # 数据库迁移
└── config.yaml         # 配置文件
```

## 快速开始

### 方法一：直接使用预编译二进制

下载对应平台的二进制文件，运行：

```bash
./todo-app
```

然后访问 http://localhost:8080

### 方法二：从源码构建

#### 1. 克隆仓库

```bash
git clone <repo-url>
cd todo-app
```

#### 2. 构建前端

```bash
cd web
npm install
npm run build
cd ..
```

#### 3. 构建后端

```bash
# 准备嵌入文件
mkdir -p cmd/server/web/dist
cp -r web/dist/* cmd/server/web/dist/

# 构建
go build -o todo-app cmd/server/main.go
```

#### 4. 运行

```bash
./todo-app
```

访问 http://localhost:8080

### 方法三：Docker 运行

```bash
docker build -t yourname/todo-app:latest .
docker run --rm -p 8080:8080 yourname/todo-app:latest
```

## 配置

配置文件 `config.yaml`：

```yaml
server:
  port: 8080
  host: "0.0.0.0"

database:
  driver: sqlite      # sqlite 或 postgres
  dsn: "todo.db"      # SQLite 文件路径 或 Postgres DSN

jwt:
  secret: "your-secret-key"
  expire: 72h

notify:
  check_interval: 60s  # 通知检查间隔

plugins:
  telegram:
    enabled: true
  ntfy:
    enabled: true
  webhook:
    enabled: true
```

## 数据库配置

### SQLite（默认，单文件）

```yaml
database:
  driver: sqlite
  dsn: "todo.db"
```

### PostgreSQL

```yaml
database:
  driver: postgres
  dsn: "host=localhost user=todo password=todo dbname=todo port=5432 sslmode=disable"
```

## API 文档

### 认证

- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户
- `POST /api/auth/refresh` - 刷新 Token

### 任务

- `GET /api/tasks` - 任务列表
- `POST /api/tasks` - 创建任务
- `GET /api/tasks/:id` - 任务详情
- `PUT /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务
- `PATCH /api/tasks/:id/status` - 更新状态
- `PATCH /api/tasks/:id/schedule` - 调整时间（拖拽用）

### 日历

- `GET /api/calendar` - 获取日历事件

### 分类

- `GET /api/categories` - 分类列表
- `POST /api/categories` - 创建分类
- `PUT /api/categories/:id` - 更新分类
- `DELETE /api/categories/:id` - 删除分类

### 通知设置

- `GET /api/notify/settings` - 获取通知设置
- `POST /api/notify/settings` - 添加通知渠道
- `DELETE /api/notify/settings/:id` - 删除通知设置
- `POST /api/notify/test` - 测试通知

## 开发指南

### 开发模式

启动前端开发服务器：

```bash
cd web
npm run dev
```

启动后端（另一个终端）：

```bash
go run cmd/server/main.go
```

前端代理配置在 `web/vite.config.js` 中，API 请求会自动转发到后端。

### 添加新的通知插件

1. 在 `internal/notify/` 下创建新的包
2. 实现 `notify.Notifier` 接口
3. 在 `main.go` 中注册插件

示例：

```go
package myplugin

type MyNotifier struct{}

func (m *MyNotifier) Name() string { return "myplugin" }
func (m *MyNotifier) Send(ctx context.Context, userID int64, config map[string]string, msg *notify.Message) error {
    // 实现发送逻辑
    return nil
}
func (m *MyNotifier) ValidateConfig(config map[string]string) error {
    // 验证配置
    return nil
}
func (m *MyNotifier) DefaultTemplate() string { return "{{.Title}}" }
```

## 技术栈

- **后端**: Go 1.21+, Gin, GORM
- **前端**: React 18, FullCalendar, TailwindCSS
- **数据库**: SQLite / PostgreSQL
- **认证**: JWT

## Gitea Runner 自动构建镜像

仓库已包含流程文件：`.gitea/workflows/docker-image.yml`

触发条件：

- 推送到 `main` / `master`
- 推送 `v*` tag
- 手动触发（workflow_dispatch）

请在 Gitea 仓库 Secrets 中配置：

- `DOCKERHUB_USERNAME`: DockerHub 用户名
- `DOCKERHUB_TOKEN`: DockerHub Access Token
- `DOCKERHUB_IMAGE`: 镜像名（例如 `marlon/todo-app`）

推送策略：

- 默认分支推送：`latest` + `sha-xxxxxxx`
- 非默认分支推送：`分支名` + `sha-xxxxxxx`
- tag 推送：`tag名` + `sha-xxxxxxx`

## 许可证

MIT License
