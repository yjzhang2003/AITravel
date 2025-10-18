# Client (React + Vite)

## 开发

```bash
npm run dev --workspace=client
```

访问 <http://localhost:5173>，Vite 会将 `/api` 请求代理到 <http://localhost:5174>。

## 主要功能

- 语音输入：优先使用浏览器 Web Speech API，不支持的环境会退化到后端语音转写接口。
- 独立登录页：登录页与主页分离，未配置认证时可直接体验演示模式。
- LLM 对话：左侧面板提供与 AI 的聊天体验，引导收集旅行需求并实时刷新行程。
- 地图渲染：前端会自动使用后端提供的高德地图 Key 加载脚本并展示每日景点标记。
- 预算展示：展示后端返回的费用拆分，支持重新估算。
- 历史行程：登录后展示 Supabase 中保存的行程记录。

> 提示：所有第三方 API Key 均需在 `server/.env` 中配置，前端不会暴露或提供编辑入口。
