#!/usr/bin/env node

const http = require('http');
const { exec } = require('child_process');

// 配置
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || 'localhost';

// 危险命令列表
const DANGEROUS_PATTERNS = [
    /\brm\b/i,           // rm 命令
    /\bformat\b/i,       // format 命令
    /\bdel\b/i,          // Windows del 命令
    />\s*\/dev\/sd/i,    // 直接写入磁盘设备
    /:\(\)\{.*:\|:.*\}/i // Fork bomb
];

/**
 * 验证命令安全性
 */
function validateCommand(command, args) {
    // 合并命令和参数
    const fullCommand = [command, ...args].join(' ');

    // 检查危险模式
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(fullCommand)) {
            return {
                valid: false,
                reason: `Command contains dangerous pattern: ${pattern.source}`
            };
        }
    }

    return { valid: true };
}

/**
 * 执行命令
 */
function executeCommand(command, args, workdir, env) {
    return new Promise((resolve, reject) => {
        // 构建完整命令
        const fullCommand = args && args.length > 0
            ? `${command} ${args.map(arg => `'${arg.replace(/'/g, "'\\''")}'`).join(' ')}`
            : command;

        // Expand ~ to home directory
        const expandedWorkdir = workdir
            ? workdir.replace(/^~/, process.env.HOME || process.env.USERPROFILE || '~')
            : process.cwd();

        console.log('[EXEC] Running command:', fullCommand.substring(0, 200) + (fullCommand.length > 200 ? '...' : ''));
        console.log('[EXEC] Working directory:', expandedWorkdir);

        // Check if working directory exists
        const fs = require('fs');
        if (!fs.existsSync(expandedWorkdir)) {
            console.error('[EXEC] Working directory does not exist:', expandedWorkdir);
            resolve({
                success: false,
                exitCode: 1,
                stdout: '',
                stderr: `Working directory does not exist: ${expandedWorkdir}`,
                error: 'Working directory not found',
                duration: 0
            });
            return;
        }

        const options = {
            cwd: expandedWorkdir,
            env: {
                ...process.env,
                ...env,
                GIT_TERMINAL_PROMPT: '0', // Disable Git interactive prompts
                GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' // Disable SSH password prompts
            },
            maxBuffer: 10 * 1024 * 1024, // 10MB
            timeout: 5 * 60 * 1000, // 5 minutes
            shell: '/bin/bash' // Explicitly use bash
        };

        const startTime = Date.now();

        const child = exec(fullCommand, options, (error, stdout, stderr) => {
            const duration = Date.now() - startTime;
            console.log('[EXEC] Command completed in', duration, 'ms');

            if (error) {
                console.error('[EXEC] Command failed:', error.message);
                console.log('[EXEC] stdout:', stdout.substring(0, 500));
                console.log('[EXEC] stderr:', stderr.substring(0, 500));
                resolve({
                    success: false,
                    exitCode: error.code || 1,
                    stdout: stdout,
                    stderr: stderr,
                    error: error.message,
                    duration
                });
            } else {
                console.log('[EXEC] Command succeeded');
                console.log('[EXEC] Output preview:', stdout.substring(0, 200));
                resolve({
                    success: true,
                    exitCode: 0,
                    stdout: stdout,
                    stderr: stderr,
                    duration
                });
            }
        });

        // Log progress for long-running commands
        const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            console.log(`[EXEC] Still running... ${(elapsed / 1000).toFixed(1)}s elapsed`);
        }, 10000); // Log every 10 seconds

        // Clear interval when command completes
        child.on('exit', () => {
            clearInterval(progressInterval);
        });
    });
}

/**
 * 处理 API 请求
 */
async function handleApiRequest(req, res) {
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    // 读取请求体
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const data = JSON.parse(body);
            const { command, args = [], workdir, env = {} } = data;

            if (!command) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing required field: command' }));
                return;
            }

            // 验证命令安全性
            const validation = validateCommand(command, args);
            if (!validation.valid) {
                console.warn('[SECURITY] Rejected dangerous command:', command, args);
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: 'Command rejected for security reasons',
                    reason: validation.reason
                }));
                return;
            }

            // 执行命令
            const result = await executeCommand(command, args, workdir, env);

            // 返回结果
            res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: result.success,
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
                error: result.error,
                duration: result.duration,
                timestamp: new Date().toISOString()
            }));

        } catch (error) {
            console.error('[ERROR] Request handling failed:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Internal server error',
                message: error.message
            }));
        }
    });
}

/**
 * 处理健康检查
 */
function handleHealthCheck(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    }));
}

/**
 * 创建 HTTP 服务器
 */
const server = http.createServer((req, res) => {
    // CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const url = new URL(req.url, `http://${req.headers.host}`);

    console.log(`[${new Date().toISOString()}] ${req.method} ${url.pathname}`);

    // 路由
    if (url.pathname === '/api/v1/exec') {
        handleApiRequest(req, res);
    } else if (url.pathname === '/health' || url.pathname === '/') {
        handleHealthCheck(req, res);
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

// 错误处理
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Error: Port ${PORT} is already in use`);
        process.exit(1);
    } else {
        console.error('Server error:', error);
    }
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n[INFO] Shutting down server...');
    server.close(() => {
        console.log('[INFO] Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n[INFO] Shutting down server...');
    server.close(() => {
        console.log('[INFO] Server closed');
        process.exit(0);
    });
});

// 启动服务器
server.listen(PORT, HOST, () => {
    console.log('='.repeat(60));
    console.log('  GitHub Clone & Open - HTTP Server');
    console.log('='.repeat(60));
    console.log(`  Server running at: http://${HOST}:${PORT}`);
    console.log(`  API endpoint: http://${HOST}:${PORT}/api/v1/exec`);
    console.log(`  Health check: http://${HOST}:${PORT}/health`);
    console.log('='.repeat(60));
    console.log('  Press Ctrl+C to stop');
    console.log('='.repeat(60));
    console.log('');
});
