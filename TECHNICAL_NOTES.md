# 技术说明

## Git 输出到 stderr 的原因

### 为什么 Git 进度信息在 stderr 中？

Git 的设计哲学：
- **stdout (标准输出)** - 用于数据输出，可以被管道传递
- **stderr (标准错误)** - 用于进度、警告、状态信息

这样设计的好处：
```bash
# 可以这样使用管道，不会被进度信息干扰
git log --oneline | grep "feat"

# 进度信息输出到 stderr，不影响管道中的数据
git clone https://github.com/user/repo.git 2> /dev/null | process_output
```

### 常见的 stderr 输出

以下输出是**正常的**，不是错误：

```
Cloning into 'repo'...
remote: Enumerating objects: 1234, done.
remote: Counting objects: 100% (1234/1234), done.
From https://github.com/user/repo
 * branch            main       -> FETCH_HEAD
Already on 'main'
Your branch is up to date with 'origin/main'.
```

### 如何区分错误和信息？

1. **看 exit code**：0 表示成功，非 0 表示失败
2. **看关键字**：
   - ✅ 正常：`Cloning into`, `Already on`, `up to date`, `done`
   - ❌ 错误：`fatal`, `error`, `failed`, `Permission denied`

## 编辑器启动问题

### 为什么需要 nohup 和后台运行？

问题场景：
```bash
# 不使用 nohup - 问题
bash -c "code /path/to/project"
# Shell 脚本退出 → 子进程可能被终止
```

解决方案：
```bash
# 使用 nohup 和后台运行
nohup code /path/to/project > /dev/null 2>&1 &
```

**解释**：
- `nohup` - 忽略 HUP (hangup) 信号，进程不会因为 shell 退出而终止
- `&` - 在后台运行
- `> /dev/null 2>&1` - 将输出重定向到 /dev/null（不需要编辑器的输出）

### VSCode 的特殊行为

VSCode (`code` 命令) 的工作方式：
1. `code` 命令本身只是一个客户端
2. 它会连接到已经运行的 VSCode 实例（如果存在）
3. 告诉该实例打开指定的文件/文件夹
4. 然后 `code` 命令立即退出（返回 0）

所以即使不使用 `nohup`，VSCode 通常也能正常工作，因为：
- 主 VSCode 进程不是由 `code` 命令启动的
- `code` 命令只是发送消息给已存在的进程

但为了保险起见（支持首次启动、其他编辑器等情况），我们还是使用 `nohup` 和后台运行。

### 其他编辑器的行为

| 编辑器 | 命令 | 行为 | 需要 nohup? |
|--------|------|------|-------------|
| VS Code | `code` | 连接到现有实例 | 建议 |
| Cursor | `cursor` | 类似 VSCode | 建议 |
| IntelliJ IDEA | `idea` | 启动新进程 | **必需** |
| Sublime Text | `subl` | 连接到现有实例 | 建议 |
| Vim/Neovim | `vim`/`nvim` | 前台运行 | **必需** |

## Shell 脚本最佳实践

### 1. 使用 set -e

```bash
#!/bin/bash
set -e  # 任何命令失败时立即退出
```

**好处**：
- 防止错误被忽略
- 脚本在第一个失败的命令处停止

**注意**：
- 使用 `|| true` 可以允许某些命令失败
- 例如：`git pull origin main || true` （允许 pull 失败）

### 2. 路径展开

```bash
# ❌ 错误 - ~ 不会被展开
workdir="~/code"
cd $workdir  # 失败！

# ✅ 正确 - 使用 $HOME
workdir="$HOME/code"
cd $workdir  # 成功

# ✅ 或者在脚本中展开
cd ~/code  # Shell 会展开 ~
```

### 3. 引号使用

```bash
# ❌ 路径中有空格会出错
cd $HOME/My Projects

# ✅ 总是使用引号
cd "$HOME/My Projects"
```

## 服务器端处理

### workdir 路径展开

Node.js 中：
```javascript
// ~ 需要手动展开
const expandedWorkdir = workdir
    ? workdir.replace(/^~/, process.env.HOME || process.env.USERPROFILE || '~')
    : process.cwd();
```

### Shell 选择

```javascript
const options = {
    cwd: expandedWorkdir,
    shell: '/bin/bash'  // 明确指定使用 bash
};
```

**为什么指定 bash？**
- 默认的 `/bin/sh` 在不同系统中可能是不同的 shell
- macOS 上 `/bin/sh` 是 bash（或 zsh）
- 某些 Linux 上 `/bin/sh` 是 dash（功能较少）
- 明确使用 bash 确保行为一致

### 超时和资源限制

```javascript
const options = {
    maxBuffer: 10 * 1024 * 1024,  // 10MB 输出缓冲
    timeout: 5 * 60 * 1000        // 5 分钟超时
};
```

**大型仓库建议**：
- 使用 shallow clone：`git clone --depth 1`
- 增加超时时间
- 或者显示进度给用户

## 安全考虑

### 1. 命令注入防护

```javascript
// ❌ 危险 - 容易被注入
exec(`git clone ${userInput}`);

// ✅ 安全 - 使用数组和转义
const args = ['-c', command];
exec(command, args.map(arg => `'${arg.replace(/'/g, "'\\''")}'`));
```

### 2. 工作目录验证

```javascript
// 验证工作目录存在且安全
if (expandedWorkdir.includes('..')) {
    throw new Error('Invalid workdir: contains ..');
}
```

### 3. 命令白名单

对于更严格的安全：
```javascript
const ALLOWED_COMMANDS = ['bash', 'sh', 'git'];
if (!ALLOWED_COMMANDS.includes(command)) {
    throw new Error('Command not allowed');
}
```

## 调试技巧

### 1. 查看完整的生成脚本

在浏览器控制台中：
```javascript
// 查找 "🔨 Generated Shell Script" 日志
// 复制脚本内容
```

手动运行测试：
```bash
bash -c '
#!/bin/bash
set -e
# ... 粘贴脚本内容 ...
'
```

### 2. 服务器端日志

在 `server.js` 中添加更多日志：
```javascript
console.log('[DEBUG] Full command:', fullCommand);
console.log('[DEBUG] Options:', JSON.stringify(options));
```

### 3. 测试单个命令

```bash
# 测试 Git 命令
curl -X POST http://localhost:8080/api/v1/exec \
  -H "Content-Type: application/json" \
  -d '{
    "command": "git",
    "args": ["--version"],
    "workdir": "/tmp"
  }'

# 测试编辑器启动
curl -X POST http://localhost:8080/api/v1/exec \
  -H "Content-Type: application/json" \
  -d '{
    "command": "bash",
    "args": ["-c", "nohup code /tmp > /dev/null 2>&1 & echo launched"],
    "workdir": "/tmp"
  }'
```

## 常见问题

### Q: 为什么 git clone 很慢？

A: 几种优化方案：
1. 使用 shallow clone：
   ```bash
   git clone --depth 1 --single-branch <url>
   ```
2. 配置 Git 代理
3. 使用 GitHub 镜像服务

### Q: 编辑器启动了但没有打开正确的路径

A: 检查：
1. 路径是否正确（查看生成的脚本）
2. 权限问题
3. 编辑器是否支持从命令行打开路径

### Q: 如何支持 Windows？

A: Windows 用户应该：
1. 使用 WSL2
2. 在 WSL 中运行服务器
3. 路径使用 Unix 格式（`/mnt/c/Users/...`）
4. 安装 WSL 版本的编辑器

## 性能优化

### 1. Git 操作优化

```bash
# 只 fetch 需要的分支
git fetch origin $BRANCH

# 使用 sparse checkout（只检出部分文件）
git sparse-checkout init --cone
git sparse-checkout set path/to/dir

# 使用 git worktree（多个工作目录共享一个 .git）
git worktree add ../project-feature feature-branch
```

### 2. 缓存策略

在服务器端实现缓存：
```javascript
const repoCache = new Map();

// 如果仓库已存在，只更新不重新克隆
if (fs.existsSync(repoPath)) {
    // 快速更新
    exec('git fetch --all', { cwd: repoPath });
}
```

### 3. 并发控制

限制同时运行的 Git 操作：
```javascript
const pLimit = require('p-limit');
const limit = pLimit(3); // 最多 3 个并发操作
```

## 扩展想法

### 1. 添加进度条

使用 Server-Sent Events (SSE) 实时显示进度：
```javascript
// 服务器端
res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache'
});

// 发送进度
res.write(`data: Cloning...\n\n`);
```

### 2. 历史记录

保存最近打开的仓库：
```javascript
GM_setValue('recentRepos', JSON.stringify([
    { repo: 'user/repo', lastOpened: Date.now() }
]));
```

### 3. 快捷键支持

添加键盘快捷键：
```javascript
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'k') {
        // 触发 Clone&Open
    }
});
```

### 4. 配置预设

支持多个配置预设（工作、个人项目等）：
```javascript
const presets = {
    work: { baseDir: '~/work', editor: 'idea' },
    personal: { baseDir: '~/projects', editor: 'code' }
};
```
