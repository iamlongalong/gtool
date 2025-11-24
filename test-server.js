#!/usr/bin/env node

/**
 * 测试脚本 - 验证服务器功能
 */

const http = require('http');

const API_URL = 'http://localhost:8080/api/v1/exec';

/**
 * 发送测试请求
 */
function sendRequest(payload, testName) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        console.log(`\n${'='.repeat(60)}`);
        console.log(`Test: ${testName}`);
        console.log('='.repeat(60));
        console.log('Request:', JSON.stringify(payload, null, 2));

        const req = http.request(API_URL, options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                console.log('\nResponse Status:', res.statusCode);
                try {
                    const result = JSON.parse(responseData);
                    console.log('Response Data:', JSON.stringify(result, null, 2));

                    if (result.stdout) {
                        console.log('\n--- STDOUT ---');
                        console.log(result.stdout);
                    }

                    if (result.stderr) {
                        console.log('\n--- STDERR ---');
                        console.log(result.stderr);
                    }

                    resolve(result);
                } catch (e) {
                    console.log('Raw Response:', responseData);
                    resolve({ error: 'Failed to parse response' });
                }
            });
        });

        req.on('error', (error) => {
            console.error('Request Error:', error.message);
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

/**
 * 运行所有测试
 */
async function runTests() {
    console.log('\n🧪 Starting Server Tests...\n');

    try {
        // Test 1: Simple echo command
        await sendRequest({
            command: 'echo',
            args: ['Hello from GitHub Clone & Open!'],
            workdir: '/tmp'
        }, 'Simple Echo Command');

        // Test 2: List current directory
        await sendRequest({
            command: 'ls',
            args: ['-la'],
            workdir: process.cwd()
        }, 'List Directory');

        // Test 3: Print working directory
        await sendRequest({
            command: 'pwd',
            args: [],
            workdir: process.cwd()
        }, 'Print Working Directory');

        // Test 4: Shell script with git commands (simulation)
        await sendRequest({
            command: 'bash',
            args: ['-c', `
echo "Simulating git clone..."
echo "Repository: https://github.com/example/repo.git"
echo "Target: /tmp/example/repo"
echo "Branch: main"
echo "Done!"
            `.trim()],
            workdir: '/tmp'
        }, 'Simulated Git Clone Script');

        // Test 5: Dangerous command (should be rejected)
        console.log('\n⚠️  Testing Security: Attempting dangerous command...');
        await sendRequest({
            command: 'rm',
            args: ['-rf', '/tmp/test'],
            workdir: '/tmp'
        }, 'Dangerous Command (Should Fail)');

        // Test 6: Command with dangerous content in bash script
        console.log('\n⚠️  Testing Security: Attempting rm in bash script...');
        await sendRequest({
            command: 'bash',
            args: ['-c', 'rm -rf /tmp/test && echo "deleted"'],
            workdir: '/tmp'
        }, 'Bash Script with RM (Should Fail)');

        console.log('\n' + '='.repeat(60));
        console.log('✅ All tests completed!');
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Check if server is running
http.get('http://localhost:8080/health', (res) => {
    if (res.statusCode === 200) {
        runTests();
    } else {
        console.error('❌ Server is not responding correctly');
        process.exit(1);
    }
}).on('error', (error) => {
    console.error('❌ Cannot connect to server. Please start the server first:');
    console.error('   npm start');
    console.error('\nError:', error.message);
    process.exit(1);
});
