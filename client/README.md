# Client (React + Vite)

## 开发

```bash
npm run dev --workspace=client
```

访问 <http://localhost:5173>，Vite 会将 `/api` 请求代理到 <http://localhost:5174>。

## 主要功能

- 语音输入：优先使用浏览器 Web Speech API，不支持的环境会退化到后端语音转写接口。
- 行程表单：支持目的地、日期、预算、偏好、补充需求等字段。
- 地图渲染：在设置面板中填入高德地图 Key 后动态加载脚本并展示每日景点标记。
- 预算展示：展示后端返回的费用拆分，支持重新估算。
- 历史行程：登录后展示 Supabase 中保存的行程记录。

## 本地存储的 Key

前端会将以下字段以 JSON 形式保存在 `localStorage`：

- `llmUrl` / `llmKey` / `llmModel`
- `voiceUrl` / `voiceKey`
- `mapKey`

这些数据只保存在浏览器端，用于运行时调用，切勿提交到版本库。
