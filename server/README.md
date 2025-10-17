# Server (Express)

## 启动

```bash
npm run dev --workspace=server
```

默认监听 `5174` 端口，可通过 `.env` 指定。

## 环境变量

请参考 `server/.env.example`，主要包含：

- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
- `LLM_API_URL` / `LLM_API_KEY` / `LLM_MODEL`
- `VOICE_API_URL` / `VOICE_API_KEY` / `VOICE_SECRET_KEY`
- `AMAP_API_KEY`
- `SERVE_CLIENT`（可选，设为 `true` 时会回源托管 `client/dist` 静态文件）

## Supabase 表结构示例

建议在 Supabase 中创建 `itineraries` 表：

| 字段名     | 类型      | 说明                 |
| ---------- | --------- | -------------------- |
| id         | uuid      | 主键，默认 `gen_random_uuid()` |
| user_id    | uuid      | 关联 `auth.users`    |
| request    | jsonb     | 原始行程请求         |
| itinerary  | jsonb     | 大模型生成的行程结构 |
| budget     | jsonb     | 预算估算             |
| created_at | timestamptz | 默认 `now()`        |

## API 概览

| Method & Path                  | 描述                     |
| ------------------------------ | ------------------------ |
| `POST /api/auth/register`      | 注册用户（Supabase）     |
| `POST /api/auth/login`         | 登录，返回 `session`     |
| `GET /api/itineraries`         | 查询历史行程（需 `userId`）|
| `POST /api/itineraries`        | 根据请求生成新行程       |
| `POST /api/itineraries/:id/budget` | 重新估算预算（`id` 可传 `preview` 并附带 `itinerary`） |
| `POST /api/voice/transcribe`   | 语音转文字（需 Base64 音频）|
| `GET /api/config/status`       | 返回服务配置状态         |
| `GET /api/config/map-key`      | 返回高德地图 Key（前端运行时动态请求） |

当未配置外部服务时，接口会返回示例数据，方便本地调试。

## 日志与错误

统一使用 `errorHandler` 中间件返回 JSON 格式的 500 错误。（实际部署时建议接入更完善的日志系统并隐藏敏感信息。）
