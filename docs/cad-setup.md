# CAD 环境配置

DWG 识图调用本机 LibreDWG 的 `dwg2dxf`，并使用能导入 `ezdxf` 的 Python。缺少这些工具只影响 DWG 解析，不影响台账和工程计算。npm 包不包含这些系统工具或 Python 虚拟环境。

## macOS

已安装 Homebrew 和 Python 3 时，可在终端运行：

```sh
brew install libredwg
python3 -m venv "$HOME/.local/share/meb-cad"
"$HOME/.local/share/meb-cad/bin/python" -m pip install ezdxf==1.4.4
```

MEB 会自动查找这个虚拟环境。安装完成后重新上传 DWG 即可；无需修改系统 Python 或重启 DSH。

## Windows 与 Linux

安装适合本系统的 [LibreDWG](https://www.gnu.org/software/libredwg/) 和 [Python 3](https://www.python.org/downloads/)。在选定的 Python 环境中运行：

```sh
python -m pip install ezdxf==1.4.4
```

确保 DSH 的启动环境能从 `PATH` 找到 `dwg2dxf`。如果系统里有多个 Python，将 `MEB_PYTHON` 环境变量设为已安装 `ezdxf` 的 Python 可执行文件完整路径，然后重新启动 DSH。使用系统 Python 受限制时，可先创建虚拟环境，在虚拟环境中安装。

## 检查环境

在对应 Python 环境中运行：

```sh
dwg2dxf --help
python -c "import ezdxf; print(ezdxf.__version__)"
```

macOS 使用上面的虚拟环境时，将第二条命令中的 `python` 换成 `"$HOME/.local/share/meb-cad/bin/python"`。

终端可用但工作台仍提示缺少依赖，请核对 Python 解释器和 `dwg2dxf`。macOS 会额外查找 Apple Silicon 与 Intel 的 Homebrew 默认路径；按上述默认路径安装时可直接重试。自定义 `PATH` 或 `MEB_PYTHON` 后，需要完全退出并重新启动 DSH。

## 图纸核对

导入前保留原图。导入后核对图纸单位、候选轮廓、标段、楼栋身份、跨图坐标和层高。候选仅供审阅，模型是可编辑的建筑体量，不能替代施工级 BIM 或完整原图。天正代理对象、绑定图和二维图纸缺失的信息可能无法可靠解析。

外部工具的来源和许可证见 [第三方声明](../THIRD-PARTY-NOTICES.md)。
