# 验证记录

最后验证：2026-10-22。

## 自动检查

在 `workbench` 目录执行：

```sh
npm ci --ignore-scripts
npm run verify:release
```

结果：

- 129 项逻辑测试通过
- 渲染检查通过
- 生产构建通过
- npm 包结构检查通过，14 个发布文件
- `npm ci` 正常安装
- 生产依赖审计 0 漏洞
- `git diff --check` 通过

## 发布包检查

0.1.1 补充 DWG 运行时回归：选中的 Python 路径必须同时传入轮廓解析和审图板回调；临时文件在解析结束后清理，缺少 `dwg2dxf` 时返回依赖安装提示。测试使用合成输入和临时替代命令，不代表真实 DWG 识别质量验收。

`npm pack --dry-run` 确认包内包含：

- `dsh.bundle.patch`
- `lib/index.js`
- `lib/client.js`
- `lib/model-embed.html`
- `lib/excel-worker.html`
- MIT License 与 README

包内不包含 `node_modules`、Python 虚拟环境、缓存、导出文件或本机业务数据。

## DSH Desktop 隔离验证

使用 DSH Desktop 自带 CLI 和临时 `DSH_HOME`：

1. 安装 npm tarball 到 `desktop` profile。
2. 确认 profile bundle 清单含 `meb-workbench`。
3. 确认 `--dump-config` 输出 MEB bundle patch。

没有修改用户当前 Desktop profile，也没有发送真实项目数据。

## 当前界面与安装验证

- 当前布局完成 1000px、390px 浏览器截图及 DSH 1280×840 普通窗口检查。
- 1000px 内容区检查批量参数侧栏、表格水平滚动、独立滚动的字段列表和固定的应用按钮。
- 浏览器多行批量参数、独立工作表与保存重载验证。
- DSH 普通窗口、宿主左侧导航展开时检查表格和批量侧栏；非相邻行批量更新并保存。
- 已发布的 `meb-workbench@0.1.3` 在干净 npm 目录与隔离 DSH profile 安装通过。
- 新版截图全部采用合成演示数据。
- 5000 行隔离页面编辑和参数修改，本轮开发构建交互峰值 88ms；该测量不代表其他机器或生产性能保证。
- 项目切换及经过首页后，未发送的助手问题和范围按项目恢复；字段即时设置使用「完成」退出。
- 取消拖选的源码路径与 Escape 回归通过；未合成 pointercancel 或触摸拖选事件。
- 本地 CAD 合成回归通过，原图只读；真实图纸和原始验收记录保留在仓库外。

GitHub Actions 仅运行源码隐私检查、构建与包结构检查；全量逻辑和渲染测试在本地运行。候选 0.1.4 未发布。

## 尚未覆盖

- Windows 原生环境
- LibreDWG、Python `ezdxf` 在其他机器上的安装差异
- 大型真实 DWG 的识别质量
