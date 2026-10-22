# Third-party notices

MEB 自身代码使用 MIT License。以下组件随源码或发布包使用；各组件的原始许可证和版权声明保留在依赖包、源码文件或本文件所指向的 notice 中。

## Direct runtime dependencies

| Component | Version | License |
| --- | ---: | --- |
| `@radix-ui/react-popover` | 1.1.23 | MIT |
| `@radix-ui/react-select` | 2.3.7 | MIT |
| `@radix-ui/react-tabs` | 1.1.21 | MIT |
| `cfb` | 1.2.2 | Apache-2.0 |
| `codepage` | 1.15.0 | Apache-2.0 |
| `exceljs` | 4.4.0 | MIT |
| `motion` | 13.4.0 | MIT |
| `polygon-clipping` | 0.15.x | MIT |
| `react-data-grid` | 7.0.0-beta.47 | MIT |
| `react-day-picker` | 10.0.1 | MIT |
| `ssf` | 0.11.2 | Apache-2.0 |
| `three` | 0.170.x | MIT |
| `zod` | 4.x | MIT |

DSH host packages are peer/dev dependencies supplied by DSH:

| Component | Version | License |
| --- | ---: | --- |
| `@deepseek-ai/dsh-storage-domain` | 0.1.5-rc.2 | MIT |
| `@deepseek-ai/dsh-tools` | 0.1.5-rc.2 | MIT |

React and React DOM are host-provided MIT-licensed peers. `esbuild` is a MIT-licensed development dependency.

## Source components

- `src/rare-ui/` adapts Rare UI components under the included MIT notice at [`workbench/src/rare-ui/LICENSE`](workbench/src/rare-ui/LICENSE).
- `src/daily-intro-glyphs.js` and its bundled font notice follow the SIL Open Font License 1.1. The complete text is in [`workbench/src/daily-intro-font-license.txt`](workbench/src/daily-intro-font-license.txt).

## Transitive dependencies

The npm lockfile records exact transitive versions. npm packages retain their own license files under `node_modules`; published MEB artifacts do not remove those package notices. Run `npm ci` before inspecting a dependency's full license text.

## Optional external CAD tools

These tools are installed separately by users and are not included in the npm tarball:

| Component | License | Source |
| --- | --- | --- |
| LibreDWG (`dwg2dxf`) | GPL-3.0-or-later | [GNU LibreDWG](https://www.gnu.org/software/libredwg/) |
| `ezdxf` | MIT | [ezdxf](https://github.com/mozman/ezdxf) |
| Python | Python Software Foundation License | [Python license](https://docs.python.org/3/license.html) |
