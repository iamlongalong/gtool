# GitHub Clone & Open - 油猴插件

一键克隆并打开 GitHub 仓库的油猴插件，支持自动切换分支、标签、提交，并在本地编辑器中打开指定路径。

## 功能特性

- ✨ 在 GitHub 仓库页面添加 "Clone&Open" 按钮
- 🔄 自动检测当前浏览的分支、标签、提交或文件路径
- 📁 智能克隆或更新本地仓库
- 🚀 自动在配置的编辑器中打开指定路径
- ⚙️ 可配置的 API 地址、基础路径、编辑器等
- 🎯 支持所有 GitHub 仓库页面类型

## 安装步骤

### 1. 安装油猴扩展

首先需要安装油猴（Tampermonkey）浏览器扩展：

- [Chrome/Edge](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/)
- [Safari](https://apps.apple.com/app/tampermonkey/id1482490089)

### 2. 安装脚本

1. 打开 Tampermonkey 管理面板
2. 点击「+」按钮创建新脚本
3. 复制 [github-clone-open.user.js](./github-clone-open.user.js) 的内容
4. 粘贴到编辑器中并保存

### 3. 配置后端服务

插件需要配合一个本地 HTTP 服务来执行命令。

#### 使用 Node.js 后端服务（推荐）

```bash
# 进入项目目录
cd opengit

# 启动服务（方式一：使用启动脚本）
./start.sh

# 启动服务（方式二：使用 npm）
npm start

# 启动服务（方式三：直接运行）
node server.js
```

服务默认监听 `http://localhost:8080`

#### 测试服务

启动服务后，可以运行测试脚本验证功能：

```bash
npm test
```

这将测试：
- ✅ 基本命令执行
- ✅ 目录操作
- ✅ Shell 脚本执行
- ✅ 安全验证（拒绝危险命令）

## 使用方法

### 1. 首次配置

1. 访问任意 GitHub 仓库页面
2. 点击 "Clone&Open" 按钮旁边的 ⚙️ 设置按钮
3. 配置以下信息：
   - **API 地址**: 后端服务地址（默认：`http://localhost:8080/api/v1/exec`）
   - **基础路径**: 代码克隆目录（例如：`~/code` 或 `~/workspace`）
   - **编辑器命令**: 使用的编辑器命令（例如：`code`、`cursor`、`idea`）
   - **默认分支**: 默认主分支名称（默认：`main`）
   - **自动打开编辑器**: 克隆后是否自动打开编辑器
4. 点击保存

### 2. 克隆并打开仓库

访问任意 GitHub 仓库页面，点击 "Clone&Open" 按钮即可。插件会：

1. 自动检测当前页面信息（仓库、分支、路径等）
2. 在本地克隆或更新仓库
3. 切换到指定分支/标签/提交
4. 在编辑器中打开指定路径

**查看执行日志**：打开浏览器控制台（F12），所有请求和响应详情都会以结构化日志打印：

```
🚀 GitHub Clone & Open - Request
  📍 API URL: http://localhost:8080/api/v1/exec
  📦 Payload: {...}

📥 GitHub Clone & Open - Response
  📊 Status: 200 OK
  📝 Standard Output (stdout):
    Repository exists, updating...
    Already up to date.
    Opening in code...
  ⏱️ Duration: 1234ms
  🔢 Exit Code: 0
```

### 3. 支持的页面类型

- **仓库根目录**: `github.com/username/repo`
- **分支页面**: `github.com/username/repo/tree/branch-name`
- **文件/目录**: `github.com/username/repo/blob/branch-name/path/to/file`
- **提交页面**: `github.com/username/repo/commit/abc123`
- **标签页面**: `github.com/username/repo/releases/tag/v1.0.0`

## 工作原理

### 架构设计

```
┌─────────────────────────────────────────┐
│         油猴插件 (前端)                    │
│  ┌───────────────────────────────────┐  │
│  │ ConfigManager  (配置管理)          │  │
│  │ GitHubParser   (页面信息提取)      │  │
│  │ CommandBuilder (命令构建)          │  │
│  │ HttpClient     (HTTP 请求)         │  │
│  │ UIManager      (界面管理)          │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    │
                    │ HTTP POST
                    │
┌─────────────────────────────────────────┐
│       后端服务 (本地 HTTP Server)         │
│  ┌───────────────────────────────────┐  │
│  │ 接收请求                            │  │
│  │ 执行 Shell 脚本                     │  │
│  │ - git clone/pull                   │  │
│  │ - git checkout                     │  │
│  │ - 打开编辑器                         │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 生成的命令示例

当你在 `github.com/golang/go/tree/master/src/fmt` 点击 "Clone&Open" 时，插件会生成类似这样的脚本：

```bash
#!/bin/bash
set -e

# Repository information
REPO_URL="https://github.com/golang/go.git"
REPO_PATH="$HOME/code/golang/go"
USERNAME="golang"
REPO="go"

# Create base directory if not exists
mkdir -p "$HOME/code/golang"

# Clone or update repository
if [ -d "${REPO_PATH}" ]; then
    echo "Repository exists, updating..."
    cd "${REPO_PATH}"
    git fetch --all --tags --prune
else
    echo "Cloning repository..."
    git clone "${REPO_URL}" "${REPO_PATH}"
    cd "${REPO_PATH}"
fi

# Checkout branch
git checkout master
git pull origin master || true

# Open in editor
if command -v code &> /dev/null; then
    echo "Opening in code..."
    code "$HOME/code/golang/go/src/fmt"
else
    echo "Editor 'code' not found in PATH"
    echo "Repository ready at: $HOME/code/golang/go/src/fmt"
fi
```

## API 接口

### 请求格式

```
POST /api/v1/exec
Content-Type: application/json

{
  "command": "bash",
  "args": ["-c", "<shell脚本内容>"],
  "workdir": "/path/to/workdir",
  "env": {}
}
```

### 响应格式

```json
{
  "success": true,
  "exitCode": 0,
  "stdout": "命令标准输出",
  "stderr": "命令错误输出",
  "duration": 1234,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 健康检查

```
GET /health

Response:
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 安全机制

服务器实现了以下安全措施：

### 🛡️ 命令验证

自动拒绝包含危险模式的命令：
- ❌ `rm` - 删除命令
- ❌ `format` - 格式化命令
- ❌ `del` - Windows 删除命令
- ❌ `> /dev/sd*` - 直接写入磁盘设备
- ❌ Fork bomb 等恶意脚本

示例：

```bash
# ❌ 这些命令会被拒绝
rm -rf /path
bash -c "rm -rf /tmp/test"

# ✅ 这些命令可以执行
git clone https://github.com/user/repo.git
code /path/to/project
```

### 🔒 其他安全建议

1. **仅本地访问**：服务默认只监听 localhost，不对外网开放
2. **超时控制**：命令执行超时时间为 5 分钟
3. **输出限制**：命令输出限制为 10MB
4. **工作目录限制**：建议只在指定的代码目录下操作
5. **定期审查**：检查服务日志，确保没有异常活动

⚠️ **注意**：此服务会在本地执行任意命令，请只在信任的环境中使用！

## 配置说明

### 编辑器命令示例

| 编辑器 | 命令 |
|--------|------|
| VS Code | `code` |
| VS Code Insiders | `code-insiders` |
| Cursor | `cursor` |
| IntelliJ IDEA | `idea` |
| Sublime Text | `subl` |
| Vim/Neovim | `vim` / `nvim` |

确保编辑器命令已添加到系统 PATH。

### 基础路径配置

推荐的目录结构：

```
~/code/
├── username1/
│   ├── repo1/
│   └── repo2/
└── username2/
    └── repo3/
```

配置 `baseDir` 为 `~/code`，插件会自动创建 `username/repo` 的目录结构。

## 开发说明

### 代码结构

- **ConfigManager**: 使用 GM_setValue/GM_getValue 管理配置持久化
- **GitHubParser**: 解析 URL 和 DOM 提取仓库信息
- **CommandBuilder**: 根据配置和仓库信息构建 Shell 脚本
- **HttpClient**: 使用 GM_xmlhttpRequest 发送跨域请求
- **UIManager**: 管理按钮创建、加载状态、通知等 UI 交互
- **CloneOpenController**: 主控制器，协调各模块工作

### 扩展功能

你可以轻松扩展插件功能：

1. **添加新的编辑器支持**: 修改 `CommandBuilder.build()` 方法
2. **自定义命令模板**: 修改生成的 Shell 脚本逻辑
3. **添加快捷键**: 在 `UIManager` 中监听键盘事件
4. **支持其他 Git 平台**: 创建新的 Parser 类（如 GitLabParser）

## 常见问题

### Q: 点击按钮没有反应？

1. 检查浏览器控制台是否有错误
2. 确认后端服务是否正常运行
3. 检查 Tampermonkey 是否启用了该脚本

### Q: 提示 "Network error"？

1. 确认后端服务地址配置正确
2. 检查防火墙是否阻止了请求
3. 在 Tampermonkey 脚本设置中允许跨域请求

### Q: 克隆很慢？

1. 考虑使用镜像加速（如 ghproxy.com）
2. 配置 Git 使用代理
3. 对于大型仓库，首次克隆需要更长时间

### Q: 如何支持私有仓库？

确保：
1. 本地 Git 已配置 SSH 密钥或凭据
2. 修改命令使用 SSH URL 而不是 HTTPS

## License

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
