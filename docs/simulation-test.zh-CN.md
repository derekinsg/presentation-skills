# 仿真测试流程：像真实用户一样验证 Skill

仿真测试的目标不是证明当前对话里能用，而是证明一个完全没参与开发的人，从 GitHub 下载以后也能安装、触发、生成可用 PPT。

## 一、发布前本地检查

在当前 repo 根目录运行：

```bash
npm test
git status --short --ignored
```

验收标准：

- `npm test` 输出 `15 smoke checks passed.`。
- 根目录生成的 HTML PPT 出现在 ignored 区域，不会被提交。
- 没有 `.env`、真实客户 PPT、API key、私有图片准备进入 git。

## 二、推到 GitHub

```bash
git add .
git commit -m "Prepare public presentation skills release"
git remote add origin <your-github-repo-url>
git push -u origin main
```

如果已经设置过 remote，跳过 `git remote add origin ...`，改用：

```bash
git remote -v
git push -u origin main
```

## 三、新目录黑盒 clone

换一个全新目录，模拟别人第一次下载：

```bash
mkdir -p ~/tmp/skill-e2e-test
cd ~/tmp/skill-e2e-test
git clone <your-github-repo-url>
cd <repo-name>
npm test
```

这一步只验证 repo 包本身是否完整，还没有验证 AI 生成效果。

## 四、安装到干净 Skill 环境

推荐先用临时 `CODEX_HOME` 做黑盒测试：

```bash
export CODEX_HOME="$(mktemp -d)"
mkdir -p "$CODEX_HOME/skills"
cp -R animated-html-deck style-polish speaker-polish "$CODEX_HOME/skills/"
```

然后新开 Codex 会话，确认不会读到你平时环境里的旧 skill。

## 五、真实生成测试

至少跑这三类：

```text
Use $animated-html-deck to create an 8-slide Chinese investor pitch HTML deck about an AI customer service product. Seriousness 9/10. Style like Vercel. Include speaker notes.
```

```text
Use $style-polish to resolve a PPT theme for a boardroom strategy report. The visual direction should feel like a high-end developer tool, seriousness 8/10.
```

```text
Use $speaker-polish to rewrite these slide notes in a Steve Jobs inspired product-launch style. Preserve every fact and give speaker notes, delivery cues, and memory points.
```

然后继续跑 [`examples/prompts.md`](../examples/prompts.md) 里的边界和负例 prompt：

- 缺少主题或页数。
- 要求直接链接远程图片。
- 要求精确模仿名人声音或复用名人标志性表达。
- 要求手机 presenter notes 和 QR。

## 六、人工验收记录

每次真实生成后，记录这些结果：

```text
Prompt ID:
Host: Codex CLI / Codex Desktop / ChatGPT Skills
Install source: GitHub clone / release zip
Triggered correct skill: yes/no
Output created: yes/no
Deck opens locally: yes/no/not applicable
Slide count correct: yes/no/not applicable
Notes present: yes/no/not applicable
No remote assets: yes/no/not applicable
Phone presenter works: yes/no/not requested
Main issue:
```

## 七、Beta 发布标准

可以发 `v0.1.2-beta`，当满足：

- 新 clone 后 `npm test` 全绿。
- 干净环境里 3 个 skill 都能被 `$skill-name` 触发。
- `$animated-html-deck` 能生成可打开、可演示的单文件 HTML PPT。
- 至少 2-3 个外部用户只看 README 或快速开始文档，也能完成第一次生成。
- 主要卡点已经记录到 GitHub issue。
