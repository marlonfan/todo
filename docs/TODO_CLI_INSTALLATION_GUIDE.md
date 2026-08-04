# Todo CLI 安装指南

以下步骤面向 AI Agent。安装过程中，Todo 服务地址和账号登录需要用户确认或在本机终端中配合完成。

## 环境要求

开始安装之前，请确保环境中已安装：

- Node.js 18+（包含 npm 和 npx）
- 一个可访问的 Todo 服务地址
- Todo 账号；如果服务尚未部署，请先完成服务端部署

## 第 1 步：安装 CLI 和 AI Skill

Agent 运行：

```shell
# 安装或升级 Todo CLI
npm install -g @marlonfan/todo-app-cli@latest

# 为本机支持的 AI Agent 安装 Todo Skill
npx -y skills add marlonfan/todo@todo-cli -g --agent '*' -y
```

不要使用 `npx todo-cli` 代替已安装的命令，因为它可能运行与 Skill 不匹配的旧版本。如果全局安装遇到权限问题，不要擅自使用 `sudo`，请让用户选择 Node/npm 的安装方式。

## 第 2 步：配置 Todo 服务

如果用户没有提供服务地址，Agent 应先询问，不要把本地开发地址当成远程服务。取得地址后运行：

```shell
todo-cli init --base-url https://your-todo-server.example.com
```

本机开发环境默认可使用：

```shell
todo-cli init --base-url http://127.0.0.1:8080
```

## 第 3 步：登录

请用户在自己的终端中运行登录命令；不要要求用户把密码发到聊天中：

```shell
todo-cli auth login --username YOUR_USERNAME --password YOUR_PASSWORD
```

登录成功后，凭证会保存在 `~/.todo-cli/config.json`。不要把登录输出或该配置文件发送到聊天中。

## 第 4 步：验证

Agent 运行：

```shell
npm list -g @marlonfan/todo-app-cli --depth=0
todo-cli --help
todo-cli doctor
todo-cli auth status
todo-cli task list --status pending --format table
```

全部命令成功后，告诉用户安装完成，并提醒用户新开一个 Agent 会话，让宿主重新加载 Todo Skill。

## 常见问题

### 找不到 `todo-cli`

查看 npm 全局安装目录：

```shell
npm prefix -g
```

将该目录对应的 `bin` 路径加入 `PATH`，然后重新打开终端。

### `doctor` 无法连接服务器

确认 Todo 服务地址可以从当前机器访问，再重新配置：

```shell
todo-cli init --base-url https://your-todo-server.example.com
```

### 登录过期或返回 401

先尝试刷新凭证：

```shell
todo-cli auth refresh
```

刷新失败时，请用户重新执行登录命令。

### Agent 没有发现 Todo Skill

重新安装 Skill，然后新开 Agent 会话：

```shell
npx -y skills add marlonfan/todo@todo-cli -g --agent '*' -y
```

更多 CLI 命令参见 [`cli/README.md`](../cli/README.md)。
