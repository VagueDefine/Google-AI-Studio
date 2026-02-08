# Obsidian Git-AI Nexus 设计开发日志

本文档记录了 Obsidian Git-AI Nexus 应用从初期构思到多轮迭代的技术演进与设计决策。

---

## [v1.0.0 - v1.9.3] 初始阶段与核心功能构建
*   **GitHub REST API 集成**: 实现了文件推送、仓库校验和分支获取。
*   **本地文件监控**: 引入 File System Access API 实现对本地文件夹的监控。
*   **AI 助手集成**: 对接 Gemini API，支持基于仓库上下文的智能问答。
*   **基础 UI**: 构建了响应式的移动端优先界面，支持 Obsidian 侧边栏适配。

---

## [v1.9.4] - 登录引导与权限提示恢复 (2024-05-27)
### UI/UX 改进
*   **权限引导回归**: 在登录界面重新添加了 `ShieldAlert` 提示框，为用户提供如何生成正确权限 Token 的指南。
*   **内容说明**: 明确区分了 Fine-grained Token（需开启 Contents 读写）和 Classic Token（需勾选 repo 范围）的设置方法。

---

## [v1.9.5] - 托管项目状态指示器 (2024-05-27)
### UI/UX 改进
*   **实时状态反馈**: 为每个托管项目卡片增加了状态标签（Status Label），显示“已是最新”、“同步中”、“配置错误”等状态。
*   **布局优化**: 状态标签放置在同步按钮的正上方，并配合彩色 Badge 提升视觉识别度。

---

## [v1.9.6] - 解决权限失效与安全稳定性 (2024-05-27)
### 技术修复
*   **权限校验逻辑**: 修复了浏览器关闭或长时间静置后，`FileSystemDirectoryHandle` 权限失效导致的 `NotReadableError` 错误。
*   **verifyPermission 实现**: 增加了专门的权限检查函数，利用 `queryPermission` 和 `requestPermission` API。

---

## [v1.9.7] - 深度修复 File NotReadableError (2024-05-27)
### 问题修复
*   **读取时机捕获**: 在 `syncFile` 的 `file.text()` 调用处增加了 try-catch。这是捕获由于浏览器安全策略导致句柄失效的最有效位置。
*   **状态文案更新**: `permission-required` 的文案从“需要重新授权”改为“授权已失效”。

---

## [v1.9.8] - 自定义定时同步功能 (2024-05-27)
### 新增功能
*   **频率选择器**: 在项目卡片中增加了“同步周期”下拉框，支持：仅手动、1分钟、5分钟、15分钟、30分钟和1小时。
*   **差异化定时逻辑**: 每个项目会根据其独立的 `syncInterval` 计算是否需要执行自动同步。
*   **状态持久化**: 项目配置（包括同步间隔和最后同步时间）现在会实时持久化到 `localStorage`。

---

## [v1.9.9] - 强化权限恢复与文件读取稳定性 (2024-05-27)
### 技术改进
*   **重构同步逻辑**: 移除了 `syncSingleFolder` 中的 side-effect-in-setter 模式。现在它是一个标准的、线程安全的 async 函数，直接操作最新的状态快照。
*   **文件句柄重刷**: 在目录权限被授予后，显式重新迭代 `handle.values()`，解决某些浏览器中“句柄在授权后仍短暂不可读”的边界问题。
*   **错误穿透捕获**: 确保 `syncFile` 抛出的 `NotReadableError` 能够被外层 `syncSingleFolder` 捕获并正确触发 UI 状态变更。

---
*记录人：Senior Frontend Engineer (AI Assistant)*