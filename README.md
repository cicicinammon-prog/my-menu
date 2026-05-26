# 家里饭桌

一个适合部署到 Vercel 的家庭点餐页面。页面会优先使用 Supabase 共享菜单和今日订单；如果 Supabase 未配置或网络失败，会自动退回本机浏览器缓存，避免白屏。

## Vercel 环境变量

在 Vercel Project Settings 中添加：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Supabase 初始化

在 Supabase SQL Editor 执行 `supabase-schema.sql`，创建：

- `dishes`
- `orders`

并启用 Realtime publication。

## 本地预览

静态预览可直接运行：

```bash
python3 -m http.server 8080
```

然后打开 `http://localhost:8080`。
