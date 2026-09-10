# Windows 桌面版（开发预览）

Windows 版本使用 Electron 承载共享网页，macOS 继续使用原生 AppKit。

## 开发

安装 Node.js 24 或更新版本后，在仓库根目录运行：

```sh
npm ci
npm ci --prefix desktop/windows
npm run start:windows
```

在 Windows 上运行 `npm run build:windows` 生成 `dist/windows/Offer-Island-0.3.2-Windows-x64.exe` 安装包。GitHub Actions 的 Windows installer 工作流也会构建并保存安装包，尚未作为正式 Release 发布。

## 使用

- 顶部短横条可拖动，支持跨显示器；托盘菜单也可以选择显示器。
- 鼠标进入展开、离开收起；账号弹窗期间暂停自动收起。
- 点击收起按钮隐藏到托盘；点击托盘图标恢复，右键菜单可以彻底退出。
- 未登录默认本地 SQLite，位置为 `%APPDATA%\Offer Island\offer.sqlite`。升级和卸载安装包不主动删除数据。
- 本地工作台地址为 `http://127.0.0.1:18783`，需要 App 保持运行。
- 小岛、本地浏览器、在线网站的登录状态独立；需要云同步时在各入口使用同一受邀账号登录。导出、导入流程沿用网页版。
- Windows 不调用 macOS Vision。当前源码支持粘贴或上传截图，使用浏览器后台线程 OCR；受邀登录后可选 DeepSeek 云端识别。已有预览安装包需要重新构建更新。没有系统通知或自动提示音。

桌面外壳采用隔离的 preload 桥接，网页不能直接调用 Node；外部链接在默认浏览器打开。仅绑定本机回环地址，启动端口被占用时显示错误而不接管未知服务。

安装包尚未配置 Windows 代码签名。真实 Windows 的透明圆角、托盘、缩放、多屏拖动、安装升级和云登录需要实机验收；macOS 上的测试不能替代这些检查。
