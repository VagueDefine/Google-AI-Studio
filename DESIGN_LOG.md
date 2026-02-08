# Obsidian Git-AI Nexus 设计开发日志

本文档旨在记录 Obsidian Git-AI Nexus 应用的迭代过程、核心设计决策及技术演进。

---

## [v1.0.0] - [v1.6.0]
... (之前版本的记录保持不变)

---

## [v1.7.0] - 文件夹深度扫描与原生资源管理器视图 (2024-05-20)

### 设计目标
模拟用户提供的文件管理器截图逻辑，支持通过上传“整个项目文件夹”来自动识别内部的 `.git` 配置，并提供一致的列表视图。

### 核心更新
1.  **项目文件夹上传 (Project Folder Upload)**:
    *   **新入口**: 登录门户增加了“上传本地项目文件夹”选项。
    *   **深度扫描**: 利用 `webkitdirectory` 属性，应用可以递归读取文件夹结构，自动寻找 `path/to/.git/config`。
    *   **自动解析**: 一旦找到 `.git/config`，立即提取远程仓库 URL、Owner 和 Repo 名称，极大减少手动输入。
2.  **仿原生列表视图 (Classic Explorer View)**:
    *   **布局重构**: 将网格卡片替换为标准的“名称、修改日期、类型、大小”四列列表。
    *   **样式同步**: 参照用户截图，调整图标间距、字体及列头对齐方式。
    *   **交互细化**: 列表支持行高亮和点击预览。
3.  **增强配置引导**:
    *   如果在上传的文件夹中同时发现 `.env` 或 `.env.local`，也会尝试提取其中的 API Token。

### 技术说明
*   使用 `input[webkitdirectory]` 获取文件流。
*   通过 `file.webkitRelativePath` 过滤目标配置文件。
*   使用标准 HTML Table 结构配合 Tailwind 实现稳健的资源管理器列表。

---
*记录人：Senior Frontend Engineer (AI Assistant)*