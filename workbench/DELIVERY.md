# 交付边界

MEB 是 DSH 的本机工程造价工作台插件。当前交付包含台账、计算、材料价格、文件引用、模型预览、DWG 候选审阅和 DSH 项目助手。

## 发布形态

- npm 包：`meb-workbench`
- DSH bundle patch：`dsh.bundle.patch`
- 前端入口：`main` 与 `sidebar.panellist`
- 数据领域：`meb_workbench`
- MIT License

## 数据边界

- 业务数据由 DSH 宿主保存。
- 原始文件可作为本机引用；引用路径不会同步到 WebDAV。
- 导出、备份和同步文件写入 DSH 数据目录，不写入 npm 包目录。
- DSH 建议只生成可审阅、可撤销的修改建议；保存由用户明确触发。
- 模型和 DWG 轮廓需要人工核对，不能视为施工级 BIM。

## CAD 依赖

DWG 功能需要：

- LibreDWG 的 `dwg2dxf`
- 可导入 `ezdxf` 的 Python

npm 包不携带虚拟环境。缺少依赖时，工作台保留其他功能，并提示安装 CAD 依赖；可用 `MEB_PYTHON` 指定 Python 路径。
