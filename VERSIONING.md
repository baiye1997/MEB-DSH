# 版本与回退

## 版本对应

npm 包使用 `meb-workbench`，GitHub 仓库使用 `MEB-DSH`。正式发布以 npm 版本号与 GitHub Release 标签对应，例如 `0.1.2` 对应 `v0.1.2`。最新版本与更新内容见 [Releases](https://github.com/baiye1997/MEB-DSH/releases)。

## 升级与回退

1. 在工作台「备份与设置」导出完整备份。
2. 按 DSH 当前界面的提示卸载已安装版本。
3. 在「添加插件」中输入目标版本，例如 `meb-workbench@0.1.1`；也可使用该版本 Release 附带的 `.tgz` 文件。
4. 按 DSH 提示刷新或重启，核对项目数据后继续使用。

插件版本只决定代码，业务数据由 DSH 保存。旧版本可能不支持较新版本保存的数据；需要恢复备份时，先备份当前数据，再在工作台中导入目标备份。

## 源码开发

开发环境的构建和检查方法见 [开发指南](CONTRIBUTING.md)。需要核对历史版本时，使用 Release 对应的 Git 标签。撤销已公开提交可使用 `git revert` 保留后续历史。
