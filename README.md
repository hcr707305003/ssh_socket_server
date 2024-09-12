# 控制台实时输出服务

#### 介绍
控制台实时输出服务,支持多人同时连接服务输出不同命令(通过websocket连接实时获取当前控制台输出、支持top命令等)

#### 包依赖
 - ws
 - ssh2
 - dotenv

#### 安装&启动
```shell
# 克隆配置文件
cp .env.example .env

# 安装依赖包
npm i

# 启动服务
node server.js
```