# 人工验收清单

自动测试只能检查结构、脚本和模板契约。PPT 是否真的好用，需要人工看生成结果。

## HTML PPT 验收

对 `$animated-html-deck` 生成的每份 HTML PPT 检查：

- 页数和 prompt 完全一致。
- 第一屏直接是演示稿，不是说明页或营销页。
- 每页 visible text 不溢出、不重叠。
- 每页都有 `<aside class="notes">` speaker notes。
- 默认 `data-motion-mode="static"`，除非 prompt 明确要求动画。
- 低信息请求（如“帮我做个 PPT”）首轮出现一个可点击 brief 弹窗，一次性覆盖核心字段；不应发送“请给我这 6 个信息”的纯文字列表。
- 左右方向键、空格键、Home/End 可用。
- Prev、Next、Cursor、Edit、A+/A-、Reset、Color、Mode、Template、Ratio、Publish/IP、Phone、Notes、Full 控件存在，底排不会被裁掉。
- Ratio 能在 16:9 和 9:16 真实画布之间切换。
- 打印预览是一页一 slide。
- 没有远程图片、CDN、远程字体、analytics。
- 手机 presenter URL 不使用 `localhost` 或 `127.0.0.1` 作为手机入口。

## Style Polish 验收

对 `$style-polish` 输出检查：

- 只选择一个 source style。
- 输出包含 source style、layout family、runtime template fallback、tokens、suitability、translation guidance。
- 如果是严肃报告场景，布局建议向 executive/consulting report 靠拢。
- 没有把整份 style catalog 塞进输出。

## Speaker Polish 验收

对 `$speaker-polish` 输出检查：

- 原始事实、数字、日期、人名、公司名没有被改写或编造。
- 每页都有 speaker notes、delivery cues、memory point。
- 风格是“inspired by” 的修辞策略，不是声称精确模仿真人。
- 没有复用名人标志性台词或 catchphrase。
- 中文讲稿读起来像可口播文本，不像书面报告。

## 外部用户反馈

至少找 2-3 个外部用户记录：

- 是否能看懂安装步骤。
- 是否知道应该复制哪个 prompt。
- 是否知道生成的 HTML PPT 在哪里。
- 是否知道怎么打开 notes 和 phone presenter。
- 哪一步最卡。
