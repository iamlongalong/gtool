# 故障排查指南

## 常见问题与解决方案

### 1. 油猴脚本问题

#### 问题：找不到按钮插入点

**错误信息：**
```
Failed to initialize Clone&Open: Error: Timeout waiting for element
```

**原因：** GitHub 页面结构变化，或者页面加载较慢。

**解决方案：**
1. 刷新页面重试
2. 检查控制台是否有其他错误
3. 确保在仓库页面（不是个人主页或设置页面）
4. 更新到最新版本的脚本

#### 问题：按钮不显示

**可能原因：**
- 不在 GitHub 仓库页面
- 页面 DOM 结构不符合预期
- 脚本被其他扩展干扰

**解决方案：**
1. 打开控制台（F12），查看是否有错误
2. 检查 URL 是否匹配 `https://github.com/*/*` 格式
3. 禁用其他可能冲突的浏览器扩展
4. 手动刷新页面

#### 问题：点击按钮没反应

**排查步骤：**
1. 打开浏览器控制台（F12）
2. 查看是否有 JavaScript 错误
3. 检查网络请求是否发送到 `localhost:8080`
4. 确认后端服务是否运行

### 2. 后端服务问题

#### 问题：服务无法启动

**错误：`Error: Port 8080 is already in use`**

**解决方案：**
```bash
# 方案 1：使用其他端口
PORT=3000 node server.js

# 方案 2：杀死占用端口的进程（macOS/Linux）
lsof -ti:8080 | xargs kill -9

# 方案 2：杀死占用端口的进程（Windows）
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

然后在油猴脚本配置中修改 API 地址为 `http://localhost:3000/api/v1/exec`

#### 问题：无法连接到服务器

**错误信息：**
```
Network error: Failed to fetch
```

**排查步骤：**
1. 确认服务器正在运行：
   ```bash
   curl http://localhost:8080/health
   ```

2. 检查防火墙设置

3. 确认 Tampermonkey 允许访问 localhost：
   - 打开脚本编辑器
   - 检查 `@connect localhost` 和 `@connect 127.0.0.1` 是否存在

4. 检查浏览器控制台的网络标签，查看请求详情

#### 问题：命令执行超时

**症状：** 请求发送后长时间没有响应

**可能原因：**
- Git clone 大型仓库耗时过长
- 网络连接问题
- Git 凭据认证失败（卡在输入密码）

**解决方案：**
1. 使用 shallow clone（修改脚本添加 `--depth 1`）
2. 配置 Git SSH 密钥避免密码输入
3. 检查网络连接
4. 增加超时时间（修改 server.js 中的 timeout 值）

### 3. Git 相关问题

#### 问题：Git clone 失败

**查看日志：**
打开浏览器控制台，查看 stderr 输出

**常见错误：**

1. **认证失败**
   ```
   fatal: Authentication failed
   ```
   **解决方案：**
   - 配置 SSH 密钥
   - 使用 GitHub Personal Access Token
   - 运行 `git config --global credential.helper store`

2. **仓库不存在**
   ```
   fatal: repository 'https://github.com/user/repo.git' not found
   ```
   **解决方案：**
   - 检查仓库 URL 是否正确
   - 确认仓库是否为私有（需要认证）

3. **权限问题**
   ```
   Permission denied (publickey)
   ```
   **解决方案：**
   - 配置 SSH 密钥到 GitHub
   - 或使用 HTTPS URL 而不是 SSH

#### 问题：无法切换分支

**错误：**
```
error: pathspec 'branch-name' did not match any file(s) known to git
```

**解决方案：**
1. 分支名称可能错误
2. 使用 `git fetch --all` 获取所有分支
3. 检查是否在正确的仓库目录

### 4. 编辑器问题

#### 问题：编辑器没有打开

**检查清单：**
1. 编辑器命令是否在 PATH 中：
   ```bash
   which code    # VS Code
   which cursor  # Cursor
   which idea    # IntelliJ IDEA
   ```

2. 如果命令不存在，添加到 PATH：

   **VS Code (macOS):**
   ```bash
   # 在 VS Code 中按 Cmd+Shift+P
   # 输入 "shell command"
   # 选择 "Install 'code' command in PATH"
   ```

   **或手动添加：**
   ```bash
   export PATH="$PATH:/Applications/Visual Studio Code.app/Contents/Resources/app/bin"
   ```

3. 在配置中使用完整路径：
   ```
   /Applications/Visual Studio Code.app/Contents/MacOS/Electron
   ```

#### 问题：打开了错误的文件

**症状：** 编辑器打开了根目录而不是文件

**原因：** 路径解析问题

**调试：**
查看控制台日志中的 "Generated Shell Script"，确认 targetPath 是否正确

### 5. 安全问题

#### 问题：命令被拒绝

**错误：**
```json
{
  "error": "Command rejected for security reasons",
  "reason": "Command contains dangerous pattern: \\brm\\b"
}
```

**原因：** 命令包含危险关键字（如 `rm`）

**解决方案：**
- 这是安全机制，不应绕过
- 如果是误判，可以修改 `server.js` 中的 `DANGEROUS_PATTERNS`
- 但要**非常小心**，确保理解风险

### 6. 性能问题

#### 问题：克隆大型仓库很慢

**优化建议：**

1. **使用 shallow clone：**
   编辑 CommandBuilder.build() 方法：
   ```javascript
   git clone --depth 1 "\${REPO_URL}" "\${REPO_PATH}"
   ```

2. **使用镜像加速：**
   ```bash
   git config --global url."https://ghproxy.com/https://github.com".insteadOf "https://github.com"
   ```

3. **只获取需要的分支：**
   ```bash
   git clone --single-branch --branch main <url>
   ```

### 7. 调试技巧

#### 启用详细日志

**前端（浏览器）：**
- 打开控制台（F12）
- 所有日志已自动输出，无需额外配置

**后端（服务器）：**
服务器日志默认输出到终端，包括：
- 请求 URL 和方法
- 命令执行状态
- 错误信息

#### 测试单独的命令

在服务器运行时，可以手动测试：

```bash
curl -X POST http://localhost:8080/api/v1/exec \
  -H "Content-Type: application/json" \
  -d '{
    "command": "echo",
    "args": ["Hello World"],
    "workdir": "/tmp"
  }'
```

#### 查看生成的脚本

在控制台中找到 "🔨 Generated Shell Script"，复制脚本内容并手动运行：

```bash
bash -c '脚本内容'
```

### 8. 系统兼容性

#### macOS
✅ 完全支持，推荐使用

#### Linux
✅ 完全支持
- 确保安装了 Node.js 和 Git
- 编辑器命令可能需要完整路径

#### Windows
⚠️ 部分支持
- 需要 WSL 或 Git Bash
- 路径使用 `/` 而不是 `\`
- 某些命令可能需要调整

**Windows 用户建议：**
1. 使用 WSL2
2. 在 WSL 中运行服务器
3. 配置路径为 WSL 路径格式

### 获取帮助

如果以上方法都无法解决问题：

1. **查看完整日志：**
   - 浏览器控制台
   - 服务器终端输出

2. **创建 Issue：**
   提供以下信息：
   - 操作系统和版本
   - Node.js 版本（`node --version`）
   - 浏览器和版本
   - 完整的错误日志
   - 重现步骤

3. **检查已知问题：**
   查看项目 Issues 页面

## 快速诊断命令

运行以下命令检查环境：

```bash
# 检查 Node.js
node --version

# 检查服务器健康
curl http://localhost:8080/health

# 测试简单命令
curl -X POST http://localhost:8080/api/v1/exec \
  -H "Content-Type: application/json" \
  -d '{"command":"echo","args":["test"]}'

# 检查编辑器
which code
which cursor
which idea

# 检查 Git
git --version
git config --list
```

全部通过即说明环境配置正确！
