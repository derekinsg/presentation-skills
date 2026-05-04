# 快速开始：安装并使用这组三个 Skill

这份文档给第一次使用的人看。目标是从 GitHub 下载这组三个 skill，然后在 Codex 或 ChatGPT Skills 里调用它们来做演示稿。

## 1. 下载仓库

```bash
git clone https://github.com/<your-org>/<your-repo>.git
cd <your-repo>
```

如果你还没有推到 GitHub，也可以先在本机用当前目录测试：

```bash
cd /path/to/presentation-skills
npm test
```

## 2. 先跑健康检查

```bash
npm test
```

看到类似下面的结果，说明 repo 结构、脚本、模板和发布风险扫描都通过了：

```text
15 smoke checks passed.
```

## 3. 安装到 Codex 本地 Skill 目录

如果你使用 Codex CLI 或支持本地 skills 的 Codex 环境：

```bash
mkdir -p "$CODEX_HOME/skills"
cp -R animated-html-deck style-polish speaker-polish "$CODEX_HOME/skills/"
```

为了做干净测试，可以临时使用一个新的 `CODEX_HOME`，避免旧版本同名 skill 干扰：

```bash
export CODEX_HOME="$(mktemp -d)"
mkdir -p "$CODEX_HOME/skills"
cp -R animated-html-deck style-polish speaker-polish "$CODEX_HOME/skills/"
```

## 4. 在新会话里调用

新开一个 Codex 会话，然后复制下面任意 prompt：

```text
Use $animated-html-deck to create an 8-slide Chinese investor pitch HTML deck about an AI customer service product. Seriousness 9/10. Style like Vercel. Include speaker notes.
```

```text
Use $style-polish to resolve a PPT theme for a boardroom strategy report. The visual direction should feel like a high-end developer tool, seriousness 8/10.
```

```text
Use $speaker-polish to rewrite these slide notes in a Steve Jobs inspired product-launch style. Preserve every fact and give speaker notes, delivery cues, and memory points.
```

更多测试 prompt 见 [`examples/prompts.md`](../examples/prompts.md)。

## 5. 第一次使用时怎么回答 Brief 弹窗

如果你只说：

```text
帮我做个 PPT
```

`$animated-html-deck` 应该先弹出一个可点击 brief 弹窗，而不是直接生成，也不是发一长串文字问题。这个弹窗会在第一轮一次性覆盖主题/材料、源文件、用途、听众、长度、风格、讲稿和输出比例/Phone 模式；每个问题都可以选常用项，也可以用 Other 自由输入。

如果你不想点弹窗，也可以一次性写完整 brief：

```text
主题：AI 客服产品融资介绍
用途：路演
听众：早期投资人
长度：8 页，10 分钟
风格：正式、科技感、偏 Vercel，严肃度 9/10
讲稿：需要，每页写 speaker notes、转场提示和记忆点
素材：暂时没有 logo 和图片，可以用 HTML/CSS 图表和占位示意
```

也可以直接写进 prompt：

```text
使用 $animated-html-deck 生成一个 8 页中文融资路演 HTML PPT，主题是 AI 客服产品，听众是早期投资人，用于 10 分钟演讲，严肃度 9/10，风格像 Vercel，需要每页 speaker notes、转场提示和 memory point，不要远程图片。
```

如果你要复刻已有 PPT/PDF，把源文件放在项目根目录，或直接告诉 Codex 文件路径；这种情况下页数会跟源文件锁定，不需要重新回答主题和页数。

## 6. 检查生成的 PPT

对于 `$animated-html-deck` 生成的 HTML PPT，至少检查：

- 页数是否和 prompt 一致。
- 每页是否有 speaker notes。
- 左右方向键、空格键、Home/End 是否能切页。
- Notes、Phone、Full、Template 等控件是否存在。
- 默认是否静态，除非 prompt 明确要求动画。
- 是否没有远程图片、CDN、远程字体依赖。
- 如果要求演讲稿，每页 notes 是否包含口播稿、转场提示、delivery cue 和 memory point。
- 如果要求手机口播同步，局域网 URL 和 QR 是否可用。

## 7. ChatGPT Skills 使用方式

如果要给 ChatGPT Skills 用户使用：

1. 从 GitHub release 下载 zip。
2. 在 ChatGPT Skills UI 上传对应 skill 文件夹。
3. 分别测试 `$animated-html-deck`、`$style-polish`、`$speaker-polish` 的示例 prompt。

OpenAI Skills 的产品支持范围可能变化，以上传和分享能力的最新说明以 OpenAI 官方文档为准。
