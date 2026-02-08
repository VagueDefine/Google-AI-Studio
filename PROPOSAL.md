
# 技术方案：Obsidian Git-AI 协同工作站

这是一个专门为 Obsidian 环境优化的单页 Web 应用（SPA），旨在无缝连接 GitHub 仓库并集成 Gemini AI。

## 核心架构方案

1.  **GitHub 集成层 (GitHub Integration Layer)**:
    *   **身份验证**: 使用 GitHub 个人访问令牌 (Personal Access Token, PAT) 进行通信。
    *   **动态配置**: 支持用户输入 Token 后，实时获取该用户权限下的所有仓库列表，并能深入选择特定仓库的所有分支。
    *   **持久化**: 配置信息（Token, Repo, Branch）存储在浏览器的 `localStorage` 中，确保在 Obsidian 中再次打开时无需重新配置。

2.  **AI 处理层 (Gemini AI Layer)**:
    *   **模型选择**: 默认使用 `gemini-3-flash-preview` 提供极速响应。
    *   *多模态支持*: 允许用户输入文字信息的同时上传文件（图片、文档等），并利用 Gemini 的长上下文能力进行分析。

3.  **UI/UX 设计 (User Interface)**:
    *   **Obsidian 适配**: 采用响应式设计，完美适配 Obsidian 的侧边栏（Sidebar）或浮窗模式。
    *   **深色模式优先**: 默认支持深色/浅色模式切换，与 Obsidian 主题高度协调。
    *   **组件化**: 使用 Tailwind CSS 构建精美的、类原生应用的界面。

4.  **技术栈**:
    *   **前端框架**: React 18 + TypeScript
    *   **样式方案**: Tailwind CSS
    *   **图标库**: Lucide React
    *   **API 客户端**: GitHub REST API + @google/genai SDK

## 功能模块分解

*   **Settings 模块**: 管理 GitHub 连接状态。
*   **Repo Selector**: 下拉式选择仓库与分支。
*   **Chat 模块**: 支持多轮对话、Markdown 渲染、文件预览。
*   **File Handler**: 能够读取并转换上传的文件为 Base64 以供 Gemini 分析。

## 如何在 Obsidian 中使用

1. 在 Obsidian 中安装插件（如 `Custom Frames` 或 `Surfing`）。
2. 将此应用的部署链接（或本地运行地址）填入。
3. 配置您的 GitHub Token，即可开始高效的 Git 与 AI 协同工作。
