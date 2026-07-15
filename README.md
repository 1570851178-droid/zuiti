# AI嘴替 — 部署到 Vercel

## 一键部署步骤

### 1. 上传到 GitHub
把这个文件夹上传到你的 GitHub 仓库（新建一个 public 或 private 仓库都行）

### 2. 部署到 Vercel
1. 打开 https://vercel.com，用 GitHub 账号登录
2. 点击 "Add New Project"
3. 选择你刚上传的仓库
4. **Framework Preset 选 "Other"**
5. 点击 "Deploy"

### 3. 配置环境变量（重要！）
部署完成后：
1. 进入项目 → Settings → Environment Variables
2. 添加以下变量：

| 变量名 | 值 |
|--------|-----|
| `AI_API_KEY` | 你的硅基流动 API Key |
| `AI_BASE_URL` | `https://api.siliconflow.cn/v1` |
| `AI_MODEL` | `Qwen/Qwen3-8B` |

3. 保存后点击 "Redeploy"

### 4. 访问
Vercel 会给你一个 `xxx.vercel.app` 的域名，直接访问即可。

## 模型推荐

| 模型 | 价格 | 适用 |
|------|------|------|
| `Qwen/Qwen3-8B` | 免费 | 日常够用 |
| `Qwen/Qwen3-32B` | ¥0.14/百万token | 效果更好 |
| `deepseek-ai/DeepSeek-V3` | ¥2/百万token | 最佳效果 |
