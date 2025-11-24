// ==UserScript==
// @name         GitHub Clone & Open
// @namespace    https://github.com/
// @version      1.0.0
// @description  Clone and open GitHub repository with one click
// @author       Your Name
// @match        https://github.com/*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @connect      127.0.0.1
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ==================== Configuration Manager ====================
    class ConfigManager {
        constructor() {
            this.defaults = {
                apiUrl: 'http://localhost:18800/api/v1/exec',
                baseDir: '~/code',
                editor: 'code', // vscode, code-insiders, cursor, idea, etc.
                defaultBranch: 'main',
                openInEditor: true
            };
        }

        get(key) {
            const value = GM_getValue(key);
            return value !== undefined ? value : this.defaults[key];
        }

        set(key, value) {
            GM_setValue(key, value);
        }

        getAll() {
            return {
                apiUrl: this.get('apiUrl'),
                baseDir: this.get('baseDir'),
                editor: this.get('editor'),
                defaultBranch: this.get('defaultBranch'),
                openInEditor: this.get('openInEditor')
            };
        }

        showConfigDialog() {
            const config = this.getAll();
            const html = `
                <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                     background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                     z-index: 10000; min-width: 500px; color: #24292f;">
                    <h3 style="margin-top: 0; font-size: 18px; font-weight: 600;">Clone & Open 配置</h3>

                    <div style="margin: 20px 0;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 500;">API 地址:</label>
                        <input id="gco-api-url" type="text" value="${config.apiUrl}"
                               style="width: 100%; padding: 8px; border: 1px solid #d0d7de; border-radius: 6px; box-sizing: border-box;">
                    </div>

                    <div style="margin: 20px 0;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 500;">基础路径 (Base Directory):</label>
                        <input id="gco-base-dir" type="text" value="${config.baseDir}"
                               style="width: 100%; padding: 8px; border: 1px solid #d0d7de; border-radius: 6px; box-sizing: border-box;">
                        <small style="color: #656d76; font-size: 12px;">代码将克隆到此目录下</small>
                    </div>

                    <div style="margin: 20px 0;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 500;">编辑器命令:</label>
                        <input id="gco-editor" type="text" value="${config.editor}"
                               style="width: 100%; padding: 8px; border: 1px solid #d0d7de; border-radius: 6px; box-sizing: border-box;">
                        <small style="color: #656d76; font-size: 12px;">例如: code, cursor, idea, subl</small>
                    </div>

                    <div style="margin: 20px 0;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 500;">默认分支:</label>
                        <input id="gco-default-branch" type="text" value="${config.defaultBranch}"
                               style="width: 100%; padding: 8px; border: 1px solid #d0d7de; border-radius: 6px; box-sizing: border-box;">
                    </div>

                    <div style="margin: 20px 0;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input id="gco-open-editor" type="checkbox" ${config.openInEditor ? 'checked' : ''}
                                   style="margin-right: 8px;">
                            <span style="font-weight: 500;">克隆后自动打开编辑器</span>
                        </label>
                    </div>

                    <div style="margin-top: 25px; display: flex; gap: 10px; justify-content: flex-end;">
                        <button id="gco-cancel" style="padding: 8px 16px; border: 1px solid #d0d7de;
                                background: white; border-radius: 6px; cursor: pointer; font-size: 14px;">
                            取消
                        </button>
                        <button id="gco-save" style="padding: 8px 16px; border: none;
                                background: #2da44e; color: white; border-radius: 6px; cursor: pointer; font-size: 14px;">
                            保存
                        </button>
                    </div>
                </div>
                <div id="gco-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                     background: rgba(0,0,0,0.5); z-index: 9999;"></div>
            `;

            const container = document.createElement('div');
            container.id = 'gco-config-dialog';
            container.innerHTML = html;
            document.body.appendChild(container);

            const close = () => container.remove();

            container.querySelector('#gco-cancel').addEventListener('click', close);
            container.querySelector('#gco-overlay').addEventListener('click', close);
            container.querySelector('#gco-save').addEventListener('click', () => {
                this.set('apiUrl', document.getElementById('gco-api-url').value);
                this.set('baseDir', document.getElementById('gco-base-dir').value);
                this.set('editor', document.getElementById('gco-editor').value);
                this.set('defaultBranch', document.getElementById('gco-default-branch').value);
                this.set('openInEditor', document.getElementById('gco-open-editor').checked);
                close();
                alert('配置已保存！');
            });
        }
    }

    // ==================== GitHub Info Parser ====================
    class GitHubParser {
        constructor() {
            this.urlPattern = /^\/([^\/]+)\/([^\/]+)(?:\/(.*))?$/;
        }

        parse() {
            const url = window.location.pathname;
            const match = url.match(this.urlPattern);

            if (!match) {
                // Not a repository page (e.g., user profile, settings, etc.)
                return null;
            }

            const [, username, repo, pathPart] = match;

            // Validate that we have both username and repo
            if (!username || !repo) {
                return null;
            }

            const info = {
                username,
                repo: repo.replace(/\.git$/, ''),
                branch: null,
                commit: null,
                tag: null,
                path: '',
                repoUrl: `https://github.com/${username}/${repo}`
            };

            if (!pathPart) {
                // At repository root
                info.branch = this.getDefaultBranch();
                return info;
            }

            const parts = pathPart.split('/');
            const type = parts[0];

            switch (type) {
                case 'tree':
                    // /tree/branch-name/path/to/file
                    info.branch = parts[1] || this.getDefaultBranch();
                    info.path = parts.slice(2).join('/');
                    break;

                case 'blob':
                    // /blob/branch-name/path/to/file
                    info.branch = parts[1] || this.getDefaultBranch();
                    info.path = parts.slice(2).join('/');
                    break;

                case 'commit':
                    // /commit/commit-hash
                    info.commit = parts[1];
                    break;

                case 'commits':
                    // /commits/branch-name
                    info.branch = parts[1] || this.getDefaultBranch();
                    break;

                case 'releases':
                    if (parts[1] === 'tag') {
                        // /releases/tag/v1.0.0
                        info.tag = parts[2];
                    }
                    break;

                case 'tags':
                    // /tags
                    break;

                default:
                    info.branch = this.getDefaultBranch();
            }

            return info;
        }

        getDefaultBranch() {
            // Try to get default branch from page
            const branchButton = document.querySelector('[data-hotkey="w"]');
            if (branchButton) {
                const branchName = branchButton.textContent.trim();
                if (branchName && branchName !== 'main' && branchName !== 'master') {
                    return branchName;
                }
            }

            // Try from branch selector
            const branchSelector = document.querySelector('summary[title*="Switch branches"]');
            if (branchSelector) {
                const text = branchSelector.textContent.trim();
                const match = text.match(/^[\s\S]*?([^\s]+)$/);
                if (match) return match[1];
            }

            return 'main'; // fallback
        }
    }

    // ==================== Command Builder ====================
    class CommandBuilder {
        constructor(config) {
            this.config = config;
        }

        build(repoInfo) {
            const { username, repo, branch, commit, tag, path, repoUrl } = repoInfo;
            const { baseDir, editor, openInEditor } = this.config;

            // Expand ~ to $HOME
            const expandedBaseDir = baseDir.startsWith('~')
                ? baseDir.replace('~', '$HOME')
                : baseDir;

            const repoPath = `${expandedBaseDir}/${username}/${repo}`;
            const targetPath = path ? `${repoPath}/${path}` : repoPath;

            let script = `#!/bin/bash
set -e

# Repository information
REPO_URL="${repoUrl}.git"
REPO_PATH="${repoPath}"
USERNAME="${username}"
REPO="${repo}"

# Create base directory if not exists
mkdir -p "${expandedBaseDir}/${username}"

# Clone or update repository
if [ -d "\${REPO_PATH}" ]; then
    echo "Repository exists, updating..."
    cd "\${REPO_PATH}"
    git fetch --all --tags --prune
else
    echo "Cloning repository..."
    git clone "\${REPO_URL}" "\${REPO_PATH}"
    cd "\${REPO_PATH}"
fi

`;

            // Checkout specific version
            if (commit) {
                script += `# Checkout specific commit
git checkout ${commit}
`;
            } else if (tag) {
                script += `# Checkout tag
git checkout tags/${tag}
`;
            } else if (branch) {
                script += `# Checkout branch
git checkout ${branch}
git pull origin ${branch} || true
`;
            }

            // Open in editor
            if (openInEditor && editor) {
                script += `
# Open in editor
if command -v ${editor} &> /dev/null; then
    echo "Opening in ${editor}..."
    # Run in background and detach from shell
    nohup ${editor} "${targetPath}" > /dev/null 2>&1 &
    echo "Editor launched successfully"
else
    echo "Editor '${editor}' not found in PATH"
    echo "Repository ready at: ${targetPath}"
fi
`;
            } else {
                script += `
echo "Repository ready at: ${targetPath}"
`;
            }

            return script;
        }

        buildRequest(repoInfo) {
            const command = this.build(repoInfo);

            return {
                command: 'bash',
                args: ['-c', command],
                workdir: this.config.baseDir,
                env: {}
            };
        }
    }

    // ==================== HTTP Client ====================
    class HttpClient {
        constructor(config) {
            this.config = config;
        }

        async send(repoInfo, commandBuilder) {
            const payload = commandBuilder.buildRequest(repoInfo);

            console.group('🚀 GitHub Clone & Open - Request');
            console.log('📍 API URL:', this.config.apiUrl);
            console.log('📦 Payload:', payload);
            console.groupEnd();

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: this.config.apiUrl,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify(payload),
                    onload: (response) => {
                        console.group('📥 GitHub Clone & Open - Response');
                        console.log('📊 Status:', response.status, response.statusText);
                        console.log('📄 Headers:', response.responseHeaders);

                        try {
                            const result = JSON.parse(response.responseText);
                            console.log('✅ Response Data:', result);

                            if (result.stdout) {
                                console.group('📝 Standard Output');
                                console.log(result.stdout);
                                console.groupEnd();
                            }

                            if (result.stderr) {
                                console.group('📋 Progress & Info (stderr)');
                                console.info(result.stderr);
                                console.log('ℹ️ Note: Git outputs progress info to stderr, this is normal');
                                console.groupEnd();
                            }

                            if (result.error) {
                                console.group('❌ Error Details');
                                console.error(result.error);
                                console.groupEnd();
                            }

                            console.log('⏱️ Duration:', result.duration ? `${result.duration}ms` : 'N/A');
                            console.log('🔢 Exit Code:', result.exitCode);

                        } catch (e) {
                            console.log('📄 Raw Response:', response.responseText);
                        }

                        console.groupEnd();

                        if (response.status >= 200 && response.status < 300) {
                            resolve(response);
                        } else {
                            reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
                        }
                    },
                    onerror: (error) => {
                        console.group('❌ GitHub Clone & Open - Network Error');
                        console.error('Error:', error);
                        console.groupEnd();
                        reject(new Error('Network error: ' + error));
                    },
                    ontimeout: () => {
                        console.group('⏰ GitHub Clone & Open - Timeout');
                        console.error('Request timed out after 30s');
                        console.groupEnd();
                        reject(new Error('Request timeout'));
                    },
                    timeout: 30000
                });
            });
        }
    }

    // ==================== UI Manager ====================
    class UIManager {
        constructor() {
            this.button = null;
            this.configButton = null;
        }

        createButton(onClick) {
            // Check if button already exists
            if (document.getElementById('gco-clone-open-btn')) {
                console.log('Clone&Open button already exists');
                return document.getElementById('gco-clone-open-btn');
            }

            // Add styles
            this.addStyles();

            // Find the tab navigation container (with data-pjax="#js-repo-pjax-container")
            const tabNav = document.querySelector('[data-pjax="#js-repo-pjax-container"]');

            if (!tabNav) {
                console.warn('Tab navigation not found, trying alternative selectors');
                return this.createButtonFallback(onClick);
            }

            console.log('Found tab navigation, inserting button to the right');

            // Create button HTML with absolute positioning
            const buttonHtml = `
                <div id="gco-button-container" style="position: absolute; right: 40%; bottom: 0; transform: translateY(-30%);
                                                      display: flex; gap: 4px; z-index: 10;">
                    <button id="gco-clone-open-btn" type="button"
                            style="display: inline-flex; align-items: center; padding: 5px 16px;
                                   background: #2da44e; color: white; border: none; border-radius: 6px;
                                   font-size: 14px; font-weight: 500; cursor: pointer; line-height: 20px;">
                        <svg style="width: 16px; height: 16px; margin-right: 4px;"
                             viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                        </svg>
                        Clone&Open
                    </button>
                    <button id="gco-config-btn" type="button"
                            style="display: inline-flex; align-items: center; justify-content: center;
                                   padding: 5px 10px; background: #f6f8fa; color: #24292f;
                                   border: 1px solid rgba(27,31,36,0.15); border-radius: 6px;
                                   font-size: 14px; cursor: pointer; line-height: 20px;"
                            title="配置 Clone&Open">
                        <svg style="width: 14px; height: 14px;" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294.016.257.016.515 0 .772-.01.147.038.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.12 8.12 0 0 1-.704-1.218c-.315-.675-.111-1.422.363-1.891l.815-.806c.05-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.038-.246-.088-.294l-.815-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0Zm-.571 1.525c-.036.003-.108.036-.137.146l-.289 1.105c-.147.561-.549.967-.998 1.189-.173.086-.34.183-.5.29-.417.278-.97.423-1.529.27l-1.103-.303c-.109-.03-.175.016-.195.045-.22.312-.412.644-.573.99-.014.031-.021.11.059.19l.815.806c.411.406.562.957.53 1.456a4.709 4.709 0 0 0 0 .582c.032.499-.119 1.05-.53 1.456l-.815.806c-.081.08-.073.159-.059.19.162.346.353.677.573.989.02.03.085.076.195.046l1.102-.303c.56-.153 1.113-.008 1.53.27.161.107.328.204.501.29.447.222.85.629.997 1.189l.289 1.105c.029.109.101.143.137.146a6.6 6.6 0 0 0 1.142 0c.036-.003.108-.036.137-.146l.289-1.105c.147-.561.549-.967.998-1.189.173-.086.34-.183.5-.29.417-.278.97-.423 1.529-.27l1.103.303c.109.029.175-.016.195-.045.22-.313.411-.644.573-.99.014-.031.021-.11-.059-.19l-.815-.806c-.411-.406-.562-.957-.53-1.456a4.709 4.709 0 0 0 0-.582c-.032-.499.119-1.05.53-1.456l.815-.806c.081-.08.073-.159.059-.19a6.464 6.464 0 0 0-.573-.989c-.02-.03-.085-.076-.195-.046l-1.102.303c-.56.153-1.113.008-1.53-.27a4.44 4.44 0 0 0-.501-.29c-.447-.222-.85-.629-.997-1.189l-.289-1.105c-.029-.11-.101-.143-.137-.146a6.6 6.6 0 0 0-1.142 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9.5 8a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 9.5 8Z"></path>
                        </svg>
                    </button>
                </div>
            `;

            // Ensure parent has position relative
            const parent = tabNav.parentElement;
            if (parent && getComputedStyle(parent).position === 'static') {
                parent.style.position = 'relative';
            }

            // Insert button into tab navigation
            tabNav.insertAdjacentHTML('beforeend', buttonHtml);

            this.button = document.getElementById('gco-clone-open-btn');
            this.configButton = document.getElementById('gco-config-btn');

            if (this.button) {
                this.button.addEventListener('click', onClick);
            }

            return this.button;
        }

        createButtonFallback(onClick) {
            // Fallback: try other locations
            const selectors = [
                '#repository-container-header',
                '[data-hpc]',
                'main'
            ];

            let insertionPoint = null;
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    console.log('Found fallback insertion point with selector:', selector);
                    insertionPoint = element;
                    break;
                }
            }

            if (!insertionPoint) {
                console.error('Could not find any suitable insertion point for button');
                return null;
            }

            const buttonHtml = `
                <div id="gco-button-container" style="display: inline-flex; gap: 4px; margin: 8px 0;">
                    <button id="gco-clone-open-btn" type="button"
                            style="display: inline-flex; align-items: center; padding: 5px 16px;
                                   background: #2da44e; color: white; border: none; border-radius: 6px;
                                   font-size: 14px; font-weight: 500; cursor: pointer; line-height: 20px;">
                        <svg style="width: 16px; height: 16px; margin-right: 4px;"
                             viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                        </svg>
                        Clone&Open
                    </button>
                    <button id="gco-config-btn" type="button"
                            style="display: inline-flex; align-items: center; justify-content: center;
                                   padding: 5px 10px; background: #f6f8fa; color: #24292f;
                                   border: 1px solid rgba(27,31,36,0.15); border-radius: 6px;
                                   font-size: 14px; cursor: pointer; line-height: 20px;"
                            title="配置 Clone&Open">
                        <svg style="width: 14px; height: 14px;" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294.016.257.016.515 0 .772-.01.147.038.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.12 8.12 0 0 1-.704-1.218c-.315-.675-.111-1.422.363-1.891l.815-.806c.05-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.038-.246-.088-.294l-.815-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0Zm-.571 1.525c-.036.003-.108.036-.137.146l-.289 1.105c-.147.561-.549.967-.998 1.189-.173.086-.34.183-.5.29-.417.278-.97.423-1.529.27l-1.103-.303c-.109-.03-.175.016-.195.045-.22.312-.412.644-.573.99-.014.031-.021.11.059.19l.815.806c.411.406.562.957.53 1.456a4.709 4.709 0 0 0 0 .582c.032.499-.119 1.05-.53 1.456l-.815.806c-.081.08-.073.159-.059.19.162.346.353.677.573.989.02.03.085.076.195.046l1.102-.303c.56-.153 1.113-.008 1.53.27.161.107.328.204.501.29.447.222.85.629.997 1.189l.289 1.105c.029.109.101.143.137.146a6.6 6.6 0 0 0 1.142 0c.036-.003.108-.036.137-.146l.289-1.105c.147-.561.549-.967.998-1.189.173-.086.34-.183.5-.29.417-.278.97-.423 1.529-.27l1.103.303c.109.029.175-.016.195-.045.22-.313.411-.644.573-.99.014-.031.021-.11-.059-.19l-.815-.806c-.411-.406-.562-.957-.53-1.456a4.709 4.709 0 0 0 0-.582c-.032-.499.119-1.05.53-1.456l.815-.806c.081-.08.073-.159.059-.19a6.464 6.464 0 0 0-.573-.989c-.02-.03-.085-.076-.195-.046l-1.102.303c-.56.153-1.113.008-1.53-.27a4.44 4.44 0 0 0-.501-.29c-.447-.222-.85-.629-.997-1.189l-.289-1.105c-.029-.11-.101-.143-.137-.146a6.6 6.6 0 0 0-1.142 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9.5 8a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 9.5 8Z"></path>
                        </svg>
                    </button>
                </div>
            `;

            insertionPoint.insertAdjacentHTML('afterbegin', buttonHtml);

            this.button = document.getElementById('gco-clone-open-btn');
            this.configButton = document.getElementById('gco-config-btn');

            if (this.button) {
                this.button.addEventListener('click', onClick);
            }

            return this.button;
        }

        setLoading(loading) {
            if (!this.button) return;

            if (loading) {
                this.button.disabled = true;
                this.button.style.opacity = '0.6';
                this.button.style.cursor = 'not-allowed';
                this.button.innerHTML = `
                    <svg style="width: 16px; height: 16px; margin-right: 4px; animation: spin 1s linear infinite;"
                         viewBox="0 0 16 16" fill="currentColor">
                        <path fill-rule="evenodd" d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm8-4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4z"></path>
                    </svg>
                    处理中...
                `;
            } else {
                this.button.disabled = false;
                this.button.style.opacity = '1';
                this.button.style.cursor = 'pointer';
                this.button.innerHTML = `
                    <svg style="width: 16px; height: 16px; margin-right: 4px;"
                         viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                    </svg>
                    Clone&Open
                `;
            }
        }

        showNotification(message, type = 'success') {
            const bgColor = type === 'success' ? '#2da44e' : '#cf222e';
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${bgColor};
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10001;
                font-size: 14px;
                animation: slideIn 0.3s ease-out;
            `;
            notification.textContent = message;

            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.animation = 'slideIn 0.3s ease-out reverse';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }

        addStyles() {
            if (document.getElementById('gco-styles')) return;

            const style = document.createElement('style');
            style.id = 'gco-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(400px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                #gco-clone-open-btn:hover {
                    background: #2c974b !important;
                }
                #gco-config-btn:hover {
                    background: #f3f4f6 !important;
                    border-color: rgba(27,31,36,0.2) !important;
                }
            `;
            document.head.appendChild(style);
        }

        getConfigButton() {
            return this.configButton;
        }
    }

    // ==================== Main Controller ====================
    class CloneOpenController {
        constructor() {
            this.configManager = new ConfigManager();
            this.parser = new GitHubParser();
            this.uiManager = new UIManager();
        }

        async init() {
            try {
                // Check if we're on a repository page first
                const repoInfo = this.parser.parse();
                if (!repoInfo) {
                    console.log('Not on a repository page, Clone&Open button will not be shown');
                    return;
                }

                // Wait for page to be ready - use more reliable selector
                await this.waitForElement('#repository-container-header, [data-hpc], main');

                // Create UI
                const button = this.uiManager.createButton(() => this.handleCloneOpen());
                const configButton = this.uiManager.getConfigButton();

                if (!button) {
                    console.warn('Could not create Clone&Open button - button might already exist or page structure changed');
                    return;
                }

                if (configButton) {
                    configButton.addEventListener('click', () => {
                        this.configManager.showConfigDialog();
                    });
                }

                console.log('GitHub Clone&Open initialized successfully');
            } catch (error) {
                console.error('Failed to initialize Clone&Open:', error);
                // Try to create button anyway
                try {
                    const button = this.uiManager.createButton(() => this.handleCloneOpen());
                    if (button) {
                        const configButton = this.uiManager.getConfigButton();
                        if (configButton) {
                            configButton.addEventListener('click', () => {
                                this.configManager.showConfigDialog();
                            });
                        }
                    }
                } catch (e) {
                    console.error('Could not create button:', e);
                }
            }
        }

        async handleCloneOpen() {
            try {
                console.group('🔧 GitHub Clone & Open - Starting');
                this.uiManager.setLoading(true);

                // Parse GitHub page info
                const repoInfo = this.parser.parse();

                // Check if we're on a repository page
                if (!repoInfo) {
                    console.warn('Not on a repository page, cannot clone');
                    alert('This page is not a GitHub repository page');
                    this.uiManager.setLoading(false);
                    console.groupEnd();
                    return;
                }

                console.log('📂 Repository Info:', repoInfo);

                // Get configuration
                const config = this.configManager.getAll();
                console.log('⚙️ Configuration:', config);

                // Build command
                const commandBuilder = new CommandBuilder(config);
                const command = commandBuilder.build(repoInfo);
                console.group('🔨 Generated Shell Script');
                console.log(command);
                console.groupEnd();

                // Send request
                const httpClient = new HttpClient(config);
                const response = await httpClient.send(repoInfo, commandBuilder);

                const result = JSON.parse(response.responseText);

                if (result.success) {
                    console.log('✅ Command executed successfully');
                    this.uiManager.showNotification('仓库克隆成功！', 'success');
                } else {
                    console.warn('⚠️ Command execution failed');
                    this.uiManager.showNotification('命令执行失败，请查看控制台', 'error');
                }

                console.groupEnd();

            } catch (error) {
                console.group('❌ GitHub Clone & Open - Error');
                console.error('Error:', error);
                console.error('Stack:', error.stack);
                console.groupEnd();
                this.uiManager.showNotification('操作失败: ' + error.message, 'error');
            } finally {
                this.uiManager.setLoading(false);
            }
        }

        waitForElement(selector, timeout = 10000) {
            return new Promise((resolve, reject) => {
                if (document.querySelector(selector)) {
                    return resolve();
                }

                const observer = new MutationObserver(() => {
                    if (document.querySelector(selector)) {
                        observer.disconnect();
                        resolve();
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });

                setTimeout(() => {
                    observer.disconnect();
                    reject(new Error('Timeout waiting for element: ' + selector));
                }, timeout);
            });
        }
    }

    // ==================== Initialize ====================
    const controller = new CloneOpenController();

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => controller.init());
    } else {
        controller.init();
    }

    // Handle page navigation (GitHub uses PJAX)
    let lastUrl = location.href;
    new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            // Re-initialize on navigation
            setTimeout(() => controller.init(), 500);
        }
    }).observe(document.body, { subtree: true, childList: true });

})();
