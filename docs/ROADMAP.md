# 路线图

以下为计划，未标注完成的能力均未实现。

## v0.1 — 可独立使用

- [x] 日程月历、浏览器保存和日程 JSON 导入导出
- [x] 独立仓库、空白初始化和虚构演示
- [ ] 职位手动新增、编辑、删除、搜索和筛选
- [ ] 将内联逻辑拆分为数据层与视图层
- [ ] 统一 Application、Event、StatusHistory、Source 模型
- [ ] 全量备份恢复、迁移校验和跨标签页冲突处理

## v0.2 — Agent 接入

- [ ] MCP：list_applications、upsert_application、create_event、list_today、preview_import
- [ ] 粘贴文本、截图解析、CSV / JSON 导入进入待核对收件箱
- [ ] 幂等写入、去重、变更预览、来源和撤销
- [ ] 保留招聘平台原文状态；不推断缺失日期

## v0.3 — macOS 桌面陪伴

- [ ] 评估 SwiftUI + AppKit NSPanel 或 Tauri + 原生面板
- [ ] 桌面主界面与小岛共用本地 SQLite 数据服务
- [ ] 左侧可爱电子木鱼：点击动画、声音开关
- [ ] 右侧今日待办：下一项优先，轮播可暂停，临近事项固定展示
- [ ] 展开卡片、会议链接、倒计时、免打扰、无刘海显示器支持

网页与桌面共享数据模型，不假设桌面端能直接读取网页 localStorage。
跨设备同步、邮件账号接入和内置 AI 聊天不纳入首版。
