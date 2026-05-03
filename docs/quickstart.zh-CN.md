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
13 smoke checks passed.
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

## 5. 检查生成的 PPT

对于 `$animated-html-deck` 生成的 HTML PPT，至少检查：

- 页数是否和 prompt 一致。
- 每页是否有 speaker notes。
- 左右方向键、空格键、Home/End 是否能切页。
- Notes、Phone、Full、Template 等控件是否存在。
- 默认是否静态，除非 prompt 明确要求动画。
- 是否没有远程图片、CDN、远程字体依赖。
- 如果要求手机口播同步，局域网 URL 和 QR 是否可用。

## 6. ChatGPT Skills 使用方式

如果要给 ChatGPT Skills 用户使用：

1. 从 GitHub release 下载 zip。
2. 在 ChatGPT Skills UI 上传对应 skill 文件夹。
3. 分别测试 `$animated-html-deck`、`$style-polish`、`$speaker-polish` 的示例 prompt。

OpenAI Skills 的产品支持范围可能变化，以上传和分享能力的最新说明以 OpenAI 官方文档为准。
