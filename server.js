require('dotenv').config(); // 加载环境变量

const WebSocket = require('ws');
const { Client } = require('ssh2');

// 正则表达式匹配ANSI颜色码
const removeAnsiCodes = (str) => {
    return str.replace(
        // 匹配ANSI颜色码的正则表达式
        /\x1B\[[0-9;]*[a-zA-Z]/g,
        ''
    );
};

// 用于存储每个客户端的SSH连接和流
const sessions = {};

// 从环境变量读取端口
const PORT = process.env.WS_PORT || 3255;

const wss = new WebSocket.Server({ port: PORT });

wss.on('connection', ws => {
    let clientId = null; // 保存客户端ID

    ws.on('message', message => {
        try {
            const { command, host, port, username, password, id, stopCommand } = JSON.parse(message);
            clientId = id;

            // 如果客户端发送的是停止命令
            if (stopCommand && sessions[clientId]?.sshStream) {
                sessions[clientId].sshStream.close(); // 关闭命令流
                ws.send('Command execution stopped.');
                return;
            }

            // // 如果已有SSH连接，则先关闭现有的
            // if (sessions[clientId]?.sshConnection) {
            //     sessions[clientId].sshConnection.end();
            // }

            // 创建新的SSH连接
            const sshConnection = new Client();
            sshConnection.on('ready', () => {
                sshConnection.exec(command, { pty: true }, (err, stream) => {
                    if (err) {
                        ws.send(`Error: ${err.message}`);
                        sshConnection.end();
                        return;
                    }

                    // 保存流和连接
                    sessions[clientId] = { sshConnection, sshStream: stream };

                    stream
                        .on('close', (code, signal) => {
                            ws.send(`Command executed with exit code ${code}`);
                            sshConnection.end();
                        })
                        .on('data', data => {
                            ws.send(removeAnsiCodes(data.toString())); // 实时发送命令输出
                        })
                        .stderr.on('data', data => {
                            ws.send(`STDERR: ${data.toString()}`); // 实时发送错误输出
                        });
                });
            }).connect({
                host,
                port,
                username,
                password
            });

        } catch (error) {
            ws.send(`Error: ${error.message}`);
        }
    });

    // 客户端断开连接时清理SSH会话
    ws.on('close', () => {
        if (clientId && sessions[clientId]) {
            if (sessions[clientId].sshStream) {
                sessions[clientId].sshStream.close(); // 关闭命令流
            }
            if (sessions[clientId].sshConnection) {
                sessions[clientId].sshConnection.end(); // 关闭SSH连接
            }
            delete sessions[clientId]; // 移除会话信息
        }
    });
});

console.log(`WebSocket server running on ws://localhost:${PORT}`);
