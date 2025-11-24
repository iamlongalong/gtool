# 快速开始指南

## 5 分钟快速上手

### 1️⃣ 启动后端服务

```bash
cd opengit
./start.sh
```

你应该会看到：

```
============================================================
  GitHub Clone & Open - HTTP Server
============================================================
  Server running at: http://localhost:8080
  API endpoint: http://localhost:8080/api/v1/exec
  Health check: http://localhost:8080/health
============================================================
  Press Ctrl+C to stop
============================================================
```

### 2️⃣ 安装油猴脚本

1. 安装 [Tampermonkey 扩展](https://www.tampermonkey.net/)
2. 打开 Tampermonkey 管理面板
3. 创建新脚本
4. 复制 [github-clone-open.user.js](./github-clone-open.user.js) 内容并保存

### 3️⃣ 配置插件

1. 访问任意 GitHub 仓库（如：https://github.com/golang/go）
2. 点击页面顶部 "Clone&Open" 旁边的 ⚙️ 按钮
3. 配置：
   - **API 地址**：`http://localhost:8080/api/v1/exec`（默认）
   - **基础路径**：`~/code`（代码存储位置）
   - **编辑器**：`code`（VS Code）或 `cursor`、`idea` 等
4. 保存配置

### 4️⃣ 开始使用

1. 访问任意 GitHub 仓库页面
2. 点击 "Clone&Open" 按钮
3. 打开浏览器控制台（F12）查看执行日志
4. 等待克隆完成，编辑器会自动打开！

## 测试服务器

验证服务是否正常工作：

```bash
npm test
```

## 示例场景

### 场景 1：克隆并打开仓库根目录

访问：`https://github.com/golang/go`

点击 "Clone&Open"，将：
- 克隆到：`~/code/golang/go`
- 切换到：`main` 分支
- 打开：`~/code/golang/go`

### 场景 2：打开特定文件

访问：`https://github.com/golang/go/blob/master/src/fmt/print.go`

点击 "Clone&Open"，将：
- 克隆到：`~/code/golang/go`
- 切换到：`master` 分支
- 打开：`~/code/golang/go/src/fmt/print.go`

### 场景 3：查看特定提交

访问：`https://github.com/golang/go/commit/abc123`

点击 "Clone&Open"，将：
- 克隆到：`~/code/golang/go`
- 切换到：提交 `abc123`
- 打开：`~/code/golang/go`

### 场景 4：查看特定标签

访问：`https://github.com/golang/go/releases/tag/go1.21.0`

点击 "Clone&Open"，将：
- 克隆到：`~/code/golang/go`
- 切换到：标签 `go1.21.0`
- 打开：`~/code/golang/go`

## 控制台日志示例

打开浏览器控制台（F12），你会看到：

```
🔧 GitHub Clone & Open - Starting
  📂 Repository Info: {
    username: "golang",
    repo: "go",
    branch: "master",
    path: "src/fmt"
  }

  ⚙️ Configuration: {
    apiUrl: "http://localhost:8080/api/v1/exec",
    baseDir: "~/code",
    editor: "code"
  }

  🔨 Generated Shell Script:
    #!/bin/bash
    set -e
    ...

🚀 GitHub Clone & Open - Request
  📍 API URL: http://localhost:8080/api/v1/exec
  📦 Payload: {...}

📥 GitHub Clone & Open - Response
  📊 Status: 200 OK

  📝 Standard Output (stdout):
    Repository exists, updating...
    From https://github.com/golang/go
    Already up to date.
    Switched to branch 'master'
    Opening in code...

  ⏱️ Duration: 2341ms
  🔢 Exit Code: 0

✅ Command executed successfully
```

## 故障排查

### 问题：点击按钮没反应

1. 打开控制台查看错误
2. 确认服务器正在运行
3. 检查 Tampermonkey 是否启用脚本

### 问题：提示网络错误

1. 确认服务地址：http://localhost:8080/health
2. 检查防火墙设置
3. 在 Tampermonkey 设置中允许访问 localhost

### 问题：命令被拒绝

查看控制台错误，可能包含 `rm` 等危险命令被安全机制拦截。

### 问题：编辑器没打开

1. 确认编辑器命令在 PATH 中：`which code`
2. 检查配置中的编辑器命令是否正确
3. 查看控制台日志中的错误信息

## 高级配置

### 自定义端口

```bash
PORT=3000 node server.js
```

### 允许远程访问（不推荐）

```bash
HOST=0.0.0.0 PORT=8080 node server.js
```

⚠️ **警告**：不要在公网环境中开放此服务！

## 下一步

- 阅读 [完整文档](./README.md)
- 了解 [API 接口](./README.md#api-接口)
- 查看 [安全机制](./README.md#安全机制)
- 自定义命令模板

---

🎉 现在你可以一键克隆并打开任何 GitHub 仓库了！
