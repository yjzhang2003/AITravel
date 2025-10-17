# AI Travel Planner (Web)

轻量级全栈 Web 项目，旨在根据用户偏好自动生成行程规划、预算建议，并提供语音输入和地图展示功能。项目前端基于 React + Vite，后端基于 Express，支持对接 Supabase、通用大语言模型 API、科大讯飞等语音识别服务以及高德/百度地图。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `server/.env.example` 为 `server/.env`，填入自己的 Supabase、LLM、语音识别、地图等密钥（切记不要将密钥提交至代码库；所有密钥都只保存在服务端）。

### 3. 启动开发环境

```bash
npm run dev
```

前端默认运行在 <http://localhost:5173>，后端 API 默认运行在 <http://localhost:5174>。

### 4. Docker 部署

```bash
docker build -t ai-travel-planner .
docker run -p 5174:5174 --env-file server/.env ai-travel-planner
```

将 `SERVE_CLIENT=true` 写入环境变量后，容器会同时托管 `client/dist` 静态资源。

### 5. GitHub Actions 持续集成

仓库中提供 `.github/workflows/docker-publish.yml`，需要在仓库 Secrets 中配置：

- `ALIYUN_REGISTRY`（例如 `registry.cn-hangzhou.aliyuncs.com`）
- `ALIYUN_USERNAME` / `ALIYUN_PASSWORD`
- `ALIYUN_REPOSITORY`（例如 `your-namespace/ai-travel-planner`）

工作流会在 push `main` 或手动触发时构建镜像并推送到阿里云镜像仓库。

## 环境变量

在 `server/.env` 中维护所有第三方服务密钥，主要字段包括：

- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
- `LLM_API_URL` / `LLM_API_KEY` / `LLM_MODEL`
- `VOICE_API_URL` / `VOICE_API_KEY`（如使用科大讯飞，可填写自建转写服务地址与凭证）
- `AMAP_API_KEY`（高德 Web JS API Key）

前端会通过受控接口读取必要信息，但不会显示或缓存任何密钥。

## 关键特性

- ✅ 语音行程需求输入：前端内置浏览器 Web Speech API 方案，并可通过后端代理接入科大讯飞等服务。
- ✅ 智能行程规划：后端通过可配置的大模型 API 生成行程草案，并在无密钥时自动返回示例数据。
- ✅ 费用预算管理：支持按行程生成费用估算，并允许在前端手动调整、保存预算方案。
- ✅ 用户认证与云端数据：集成 Supabase Auth 与数据库表结构示例，可保存多份行程。
- ✅ 地图为主的交互展示：后端托管高德地图 Key，前端自动加载并依据行程落点展示地点标记。
- ✅ DevOps 友好：附带 Dockerfile 与 GitHub Actions CI/CD 模板，可将镜像推送到阿里云镜像仓库。

## 项目结构

```
.
├── client               # React + Vite 前端
├── server               # Express 后端
├── package.json         # 顶层 workspace 管理
└── README.md
```

## 安全注意事项

- 所有 API Key 通过环境变量或运行时输入，不要写死在仓库中。
- 建议在部署环境中使用密钥管理服务（如阿里云 KMS、Vault、Supabase Secrets 等）。

## 后续步骤

- 阅读 `client/README.md` 了解前端语音、地图配置。
- 查看 `server/README.md` 获取 Supabase 表结构及 API 说明。
