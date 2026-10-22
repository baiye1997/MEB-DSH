---
name: "MEB-DSH"
description: "中性灰白、石墨操作与连续工作表构成的本地工程桌面。"
colors:
  primary: "#242627"
  primary-hover: "#3b3e3f"
  accent: "#3478bd"
  focus: "#6495c7"
  canvas: "#f4f4f2"
  surface: "#fff"
  chrome: "#f7f7f5"
  quiet: "#f5f5f3"
  detail: "#fafafa"
  ink: "#242627"
  muted: "#666b70"
  rule: "#e5e6e5"
  grid-rule: "#ebedeb"
  hover: "#eeefed"
  selected: "#eaf1f8"
  row-selected: "#f5f8fb"
  selection: "#d9e8f7"
  selection-ink: "#203c57"
  dock: "#f2f3f4"
  dock-hover: "#e7eaed"
  dock-selected: "#e4e8ec"
  dock-ink: "#626b70"
  dock-selected-ink: "#242a2c"
  worksheet-selected: "#e7eaee"
  disabled-surface: "#eceef0"
  disabled-ink: "#6b7277"
  disabled-rule: "#dfe2e5"
  error: "#963e37"
  error-surface: "#f9eeec"
typography:
  headline:
    fontFamily: "-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif"
    fontSize: "24px"
    fontWeight: 650
    lineHeight: "34px"
    letterSpacing: "-.025em"
  title:
    fontFamily: "-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif"
    fontSize: "23px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "-.025em"
  project:
    fontFamily: "-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "26px"
  body:
    fontFamily: "-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif"
    fontSize: "13px"
    lineHeight: 1.5
  data:
    fontFamily: "-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif"
    fontSize: "12px"
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif"
    fontSize: "12px"
    lineHeight: "20px"
  support:
    fontFamily: "-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif"
    fontSize: "11px"
    lineHeight: "18px"
  summary:
    fontFamily: "-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif"
    fontSize: "27px"
    fontWeight: 600
    lineHeight: "34px"
    letterSpacing: "-.035em"
  code:
    fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace"
    fontSize: "11px"
rounded:
  square: "0"
  compact: "5px"
  button: "7px"
  dock: "8px"
  menu: "9px"
  section: "12px"
  dialog: "14px"
  pill: "18px"
spacing:
  tight: "4px"
  related: "6px"
  control-gap: "8px"
  group: "12px"
  pane: "16px"
  page: "20px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "4px 10px"
    height: "30px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface}"
  button-primary-disabled:
    backgroundColor: "{colors.disabled-surface}"
    textColor: "{colors.disabled-ink}"
  button-command:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "4px 7px"
    height: "30px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.button}"
    padding: "4px 8px"
    height: "30px"
  dock-item:
    backgroundColor: "{colors.dock}"
    textColor: "{colors.dock-ink}"
    rounded: "{rounded.dock}"
    padding: "7px 2px"
  dock-item-selected:
    backgroundColor: "{colors.dock-selected}"
    textColor: "{colors.dock-selected-ink}"
    rounded: "{rounded.dock}"
  worksheet-tab-selected:
    backgroundColor: "{colors.worksheet-selected}"
    textColor: "{colors.ink}"
    rounded: "{rounded.compact}"
    padding: "4px 9px"
    height: "28px"
  context-chip:
    backgroundColor: "{colors.quiet}"
    textColor: "{colors.ink}"
    rounded: "6px"
    padding: "6px 8px"
  summary-band:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.section}"
    padding: "18px 0"
  working-sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    rounded: "{rounded.square}"
  help-popover:
    backgroundColor: "{colors.surface}"
    textColor: "#303537"
    rounded: "{rounded.dock}"
    padding: "12px 14px"
    width: "280px"
  assistant-compose:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "8px 10px"
    height: "64px"
---

# Design System: MEB-DSH

## Overview

**Creative North Star: "安静的工程桌面"**

以中性浅灰画布、白色工作面和石墨色动作构成安静的工程桌面。项目身份清楚，数字与记录占据主要视野，克制蓝色只帮助定位数据、选区与焦点。层次来自文字、留白和细分隔，操作控件保持熟悉、紧凑、可发现。

视觉方向结合用户选定的 Payvora 仪表盘与 Notion、macOS 操作习惯，使用本项目自己的组件和业务内容。首页先呈现项目入口，用户明确打开项目后才出现左侧 Dock 与页面子标签；业务页以连续表格为中心，参数、说明和 AI 对话按需展开。

**Key Characteristics:**

- 中性灰白色面与石墨主操作，少量蓝色强调数据。
- 项目身份、主功能 Dock、页面子标签各自分工。
- 连续白色工作表、共享工作表标签与平实的相邻明细区。
- 右侧助手默认保持侧栏，用户可主动展开阅读。

实现依据：[应用布局](workbench/src/work-layout.css)、[最终主题](workbench/src/workspace-theme.css)、[控件系统](workbench/src/design-system.css)、[业务页层级](workbench/src/page-hierarchy.css)、[表格格式](workbench/src/sheet-format.css)、[工作表标签](workbench/src/worksheet-tabs.css)、[助手](workbench/src/assistant-ui.css)、[动效](workbench/src/workspace-motion.css)。前置令牌记录已实现的重复规则；侧车文件补充状态、动效和独立组件预览。产品与公开数据边界见 [PRODUCT.md](PRODUCT.md)。

## Colors

前置令牌是规范值。主操作与正文共享石墨色，但承担不同语义；工作画布略暖，白色数据工作面保持清楚。颜色用于操作和状态，不用于给每块业务内容分配一个亮色背景。

### Primary

- **石墨主操作 / primary、primary-hover**：新增、保存、应用等主要任务。禁用态使用 disabled-surface、disabled-ink 与 disabled-rule，仍保持可辨认的文字与边界。
- **克制数据蓝 / accent、focus**：复选框、选区、数据定位与键盘焦点。selected 和 row-selected 分别承载轻选区与已选行；浏览器文字选区使用 selection 与 selection-ink。

### Neutral

- **暖灰画布 / canvas**：本地工作空间底色。
- **白色工作面 / surface**：表格、输入、项目列表与对话内容。
- **轻灰工具面 / chrome、quiet、detail**：上下文、格式与状态区域，以及安静的明细侧栏。
- **正文与辅助文字 / ink、muted**：主要记录与次级说明；弱化层次不能依靠透明度让禁用操作消失。
- **细分隔 / rule、grid-rule**：分隔任务区和数据行列，避免再给同一工作面重复套框。
- **Dock 状态 / dock、dock-hover、dock-selected**：侧边模块的位置反馈；dock-ink 与 dock-selected-ink 表达默认和当前状态。
- **工作表当前项 / worksheet-selected**：与 Dock 一致的中性灰选择语言。
- **问题反馈 / error、error-surface**：只用于实际错误和恢复说明，不作为常规强调色。

**The Quiet Action Rule.** 石墨色承载主要动作；蓝色用于数据定位、选择与焦点。状态必须同时具有文字或控件形态，不能只靠颜色。

## Typography

**Display Font:** 无独立展示字体。页面标题沿用系统文字，优先服务操作与阅读。

**Body Font:** `-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`。中文通过平台的系统字形回退渲染；不强制加载展示字体。

**Label/Mono Font:** 标注与数据仍使用系统无衬线。显式代码字族为 `ui-monospace,SFMono-Regular,Menlo,monospace`，当前用于依赖说明中的代码；它不是表格或普通输入的字体。需要逐字符核对的公式可以使用代码角色，常规公式说明沿用正文。

**Character:** 安静、紧凑、熟悉。使用少量稳定尺寸和清楚字重，金额、计数、参数与结果采用 `font-variant-numeric: tabular-nums`；不要把等宽数字误解为整页等宽字体。

### Hierarchy

- **Headline**：项目目录和空工作区标题（24px / 34px）；目录标题字重为 650。
- **Title**：业务页标题（23px / 32px，600）；展开助手标题使用其自身的 22px / 30px 层级。
- **Project**：顶部项目身份（17px / 26px，600），窄容器缩小到 14px。
- **Body**：说明和对话正文（13px，默认 1.5 倍行高）；助手回复使用 1.75 倍行高。
- **Data**：基础工作表文字（12px，1.5 倍行高）；实际计算输入使用 13px / 20px。
- **Label / Support**：命令与参数名使用 12px / 20px，状态与补充说明常用 11px / 18px；Dock 标签为 10px / 15px。
- **Summary**：来自当前数据的摘要数值（27px / 34px，600），窄目录收为 20px / 28px。
- **Code**：依赖说明中的短代码（11px），使用前述代码字族。

助手展开阅读的消息内容最大 78ch，解释性帮助沿用业务页中已有的 75ch 限制；工作数据按列宽组织。

**The Data Type Rule.** 正文与操作使用系统无衬线；金额和参数使用等宽数字。等宽字体只用于代码或需要逐字符核对的公式，不作为页面风格。

## Layout

首页不选择项目，也不显示项目选择器和项目 Dock。没有任何项目时显示轻量空工作区，提供新建与恢复入口；已有项目时显示真实统计和项目列表。用户明确打开项目后，左侧 Dock 依次为：项目总览、造价档案、模型配置、工作台、计算台、附件库。计算记录属于工作台子功能；材料价格库与设置、备份放在公用“更多”菜单。

桌面 Dock 宽 68px，项目上下文行高至少 48px；后加载主题中的页面子标签高 41px，以细底线表达当前项。上下文只保留“回到首页”、项目身份、独立搜索、AI 入口和“更多”。项目名称不搭配重复建筑图标，首页使用简洁品牌文字。macOS 宿主额外保留 42px 窗口拖动区。

目录页外边距为 22px；三项统计放在同一白色摘要带中，用一像素竖线分隔。目录主列表与辅助列相隔 24px，辅助列宽 220px；内容容器不超过 1000px 时隐藏辅助列。目录在 780px 附近压缩列宽，在 580px 以下将摘要转为分隔行，并减少项目行的次要字段。

业务页以命令栏、格式栏、白色工作表、汇总与底部工作表标签组成连续区域。数据行高为 32px，表头由共享表格组件显式设为 38px；序号居中。单元格矩形拖选、整行与整列格式作用范围都可见；非连续复选行选择独立保留。格式刷、对齐、清除格式和条件规则不改变数据值。宽表保留横向滚动，并在需要时提供可见的左右查看列操作。

计算参数侧栏使用 370px，台账明细使用 380px；窄工作区改为覆盖面板。计算表的紧凑列保留事项最小 110px、规格 140px、长度 68px、两期铜价各 94px，重要价格列可直接比较，剩余字段横向查看。批量参数列表独立滚动，应用动作留在可见区域。

AI 助手默认是 400px 右侧栏，可调整宽度；只有用户主动操作才展开阅读。展开时保持项目 Dock 与上下文，阅读区按会话、消息和项目背景分工；较窄容器先隐藏右侧背景列，再隐藏历史栏。工作区不超过 760px 时 Dock 缩为 58px，搜索等上下文操作收紧；小屏助手作为右侧覆盖面板，宽度不超过 400px。响应式判断使用 workbench 与 workarea 容器，保留 DSH 左侧导航展开时的操作空间。

## Elevation & Depth

固定工作表、侧栏与模型工作区保持平实，以背景和一条细边界建立关系。首页允许一个圆角白色摘要带和白色项目列表，但业务页不重复套入摘要卡片。只有帮助、菜单、编辑器与搜索等临时浮动表面使用柔和、有方向的阴影。

### Shadow Vocabulary

- **帮助浮层**（`0 8px 24px #2426271c`）：跟随问号触发器，保持正文可读。
- **格式面板与会话菜单**（`0 8px 24px #26324718`）：临时设置与选择。
- **工作表编辑器**（`0 -8px 24px #24262714`）：位于底部工作表条上方。
- **搜索面板**（`0 18px 60px #0002`）：需要完整输入与结果浏览的搜索任务。
- **窄屏助手**（`-8px 0 20px #24262710`）：提示其覆盖下方工作区。

**The Continuous Surface Rule.** 固定工作表和相邻侧栏使用连续色面与一条分隔；只有脱离文档流的临时面板需要浮动阴影。

## Shapes

以小圆角控件和直角工作面为主。普通按钮与输入默认使用 7px；紧凑工作表标签使用 5px；Dock、帮助和工作表编辑器使用 8px；格式浮层使用 9px。首页摘要带与项目列表使用 12px，搜索面板使用 14px。新建项目可用 18px 圆角的小胶囊形主操作，表格本身不套圆角卡片。

图标使用本项目统一 SVG 路径，24×24 视框、无填充、1.5px 圆头圆角描边；常用尺寸 15–20px。中性问号、关闭、搜索、格式与导航图标保持一致，不以字符或表情替代。

## Components

### Buttons

主要动作清楚，辅助命令保持轻量。

- **Primary**：石墨底白字，通常 30px 高、`4px 10px` 内边距；悬停使用 primary-hover。禁用态有明确灰底、边界和可读标签。
- **Secondary / Ghost**：中性文字与透明背景，命令行常用 `4px 7px` 内边距；悬停出现浅灰或轻蓝灰反馈，不把所有辅助命令画成独立主按钮。
- **Focus**：通用焦点为 2px 的 focus 轮廓，偏移 1px；表格输入为 1px 内轮廓。局部格式、选择控件沿用其明确的作用范围提示。

### Chips

附件、批次与对话上下文采用安静灰底的小标签区（6px 圆角，`6px 8px` 内边距）。状态文字说明真实范围，移除操作保持可见；标签只承载上下文，不承担页面标题。

### Cards / Containers

首页摘要共享一个白色区域（`18px 0` 内边距），各统计区左右留 24px，以细分隔组织。项目列表为一个白色列表区域（`20px 24px 6px` 内边距），每行至少 82px。业务内容保持连续白面；没有模型或旧模型不可用时，使用浅灰空状态和明确的配置操作。

### Inputs / Fields

普通单行字段白底、细边界、7px 小圆角，常用 30px 高与 `4px 8px` 内边距。表格输入填满单元格，去掉重复边界和圆角。输入光标与选区沿用蓝色；占位文字使用 muted。字段管理器内名称与位置操作同一行，退出操作明确命名为“完成”。

### Navigation

左侧 Dock 负责六个项目主功能，图标与短标签竖排，当前项用中性灰背景和略强字重。顶部子标签保持平直，以一像素底线表达当前任务。底部业务与计算工作表均使用 [WorksheetTabs](workbench/src/worksheet-tabs.jsx)：当前项中性灰底、28px 标签高，支持横向滚动、箭头键与 Home / End 切换；新建与重命名紧邻表条。

### Help and Assistant

帮助使用 [HelpNote](workbench/src/help-note.jsx) 的中性问号与 Radix 锚定浮层。浮层采用端部对齐、7px 间距和 12px 碰撞留白，并按真实工作区边界避让；不能假定插件在宿主视口原点。

助手默认在右侧，消息区独立滚动，底部保留当前作用范围、输入与发送操作。用户草稿、会话和范围保持独立；分析与建议以真实项目内容为依据，写入前保留审阅步骤。展开阅读后历史、消息与背景信息各司其职，快捷任务只出现于需要的位置。

临时面板使用 180ms、菜单和短编辑器使用 120ms 的 `cubic-bezier(.16,1,.3,1)` 进入动效；侧栏从已可见的浅淡状态横移 12px，菜单纵移 3px。控件色彩过渡使用 120ms，表格编辑、拖选、格式变化与滚动保持即时。调整助手宽度期间停止进入动画。

## Do's and Don'ts

### Do:

- **Do** 让项目名称与当前任务明确可见，主功能放在左侧 Dock，子功能放在页面顶部。
- **Do** 使用共享的 WorksheetTabs 组件组织业务与计算工作表，保留各表独立的记录、参数、字段和格式。
- **Do** 维持 32px 数据行、居中序号和可发现的横向滚动；核对两期铜价及当前作用范围。
- **Do** 让格式操作只改变格式，清楚显示单元格、行或列的作用范围；取消拖动不提交格式。
- **Do** 将说明挂在中性问号图标旁，用跟随触发器且能避让边界的浮层展示。
- **Do** 默认使用右侧 AI 侧栏，保留会话、草稿和作用范围，再由用户主动展开阅读。
- **Do** 让正式插件从空项目列表开始；文档与测试示例明确使用合成数据。
- **Do** 让表格编辑、拖选和滚动立即响应，把短动效留给临时面板。

### Don't:

- **Don't** 在首页预选项目、显示项目选择器或项目 Dock。
- **Don't** 用大面积黄色、紫色、绿色或高饱和撞色组织工作台。
- **Don't** 用嵌套卡片、重复边框、重复标题或重复快捷任务挤占工作表。
- **Don't** 在助手打开时默认展开阅读，也不要在多个栏重复同一组快捷任务。
- **Don't** 让帮助浮层假定插件位于宿主视口原点。
- **Don't** 以黑色空模型视图、失效查看控件或内置演示工程填充正式初始状态。
- **Don't** 为格式变化、单元格编辑或表格滚动加入进出场动画。
- **Don't** 把项目内的计算记录提升为 Dock 主功能，或把公用材料价格与设置混入项目子标签。
