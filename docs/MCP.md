# MCP 接入

运行 `npm ci` 后，在支持 MCP 的 Agent 客户端添加一个 stdio server。下面路径需要替换为本机绝对路径：

```json
{
  "mcpServers": {
    "offer-island": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/offer-island/server/mcp.mjs"]
    }
  }
}
```

默认与桌面共用 `~/Library/Application Support/Offer Island/offer.sqlite`。若设置 `OFFER_DB`，确保两端一致。无需把服务暴露到互联网。

## 工具

| 工具 | 行为 |
| --- | --- |
| list_applications | 返回投递及 revision，可按公司 / 职位查询 |
| upsert_application | 写入投递；更新时传稳定 ID，保留未更改字段 |
| create_event | 写入带有已确认日期的日程；稳定 ID 支持重试 |
| list_today | 查询本机日期的日程，或显式指定 YYYY-MM-DD |
| preview_import | 验证结构化导入，返回新增、更新、重复和 revision |
| commit_import | 提交已核对的导入，默认不覆盖旧记录 |
| undo_last_change | 撤销最近一次操作 |

写入工具均要求 `expectedRevision`。冲突时重新读取并核对，不自动重试覆盖。Agent 记录以 actor=agent 写入历史。

## 截图工作流

1. 用户提供截图或原文，并授权整理。
2. Agent 提取以下 JSON，保存原文到 source；缺失信息留空。
3. 调用 preview_import；展示有歧义的状态与日期供核对。
4. 确认后调用 commit_import，传入返回的 revision。

```json
{
  "applications": [{
    "id": "example-software",
    "company": "示例科技",
    "role": "软件工程师",
    "status": "筛选中",
    "rawStatus": "简历初筛-进行中",
    "source": "用户提供截图，原文：简历初筛-进行中",
    "date": "",
    "notes": "",
    "next": "等待通知",
    "link": ""
  }],
  "events": [],
  "experiences": []
}
```

可用状态：已投递、筛选中、测评中、面试、Offer、拒绝/已结束、待确认。
不要将“测评已完成”推断为“笔试通过”，不要为“面试时间待定”创建虚构日程。
