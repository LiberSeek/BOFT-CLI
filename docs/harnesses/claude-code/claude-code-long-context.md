# Claude Code 1M 上下文开关

Claude CLI 在自定义 `ANTHROPIC_BASE_URL` 下，会把 `claude-opus-5-5` 的本地窗口显示成 200k。给会话模型加上 `[1m]` 后缀后，CLI 把本地窗口开到 1M，并在发给网关前去掉这个后缀。HTTP 请求里的模型 id 仍是原来的 `claude-opus-5-5` 或 `claude-opus-5.5`。

## 用户可见行为

连接设置里，Claude 这一行的操作位置：

- 本机还没有 Claude CLI 时，显示蓝色下载按钮。
- 已经检测到 Claude CLI，并且当前不是“正在检查”时，显示 **1M** 开关。默认开启。开关本身不带边框。鼠标悬停或键盘聚焦时，说明按这三部分显示：开启后 Claude 模型使用 1M 上下文，Claude CLI 在本地按这个窗口工作；关闭后使用 200k 窗口；下面是适配模型列表。
- 其他 Harness 不显示这个开关。

适配模型目前是 `claude-opus-5-5 (1M)`。新增一个 1M 模型时，在 `CLAUDE_LONG_CONTEXT_MODELS` 追加一项，并在 `MILLION_CONTEXT_MODELS` 追加同一个 id。`claude-opus-5.5` 是同一模型的另一种写法，会同样加上后缀，但不单独占一行。Sonnet 以及其他模型的会话模型字符串保持原样。Host 里保存的模型引用也不带 `[1m]`。

关闭开关后，下一次启动会话或切换模型会使用不带后缀的 id。空闲中的已打开会话会立刻改用新的会话模型。正在生成的回合不会被打断；这一回合结束后，同一会话要等到下一次选择模型或新开会话，才会跟上开关。

偏好写在 `CODEXHOST_DATA_DIR`（没有该变量时是 `~/.codexhost`）下的 `claude-code-long-context.json`。文件不存在或读不出来时视为开启。

## 所有权

- 后缀规则和偏好文件属于 `packages/adapters/claude-code`。Host 只通过 `getLongContext` / `setLongContext` 调用，不导入 Claude Adapter。
- 设置页通过 `codexhost/harness/long-context/get` 和 `codexhost/harness/long-context/set` 读写。控制台可以使用这两条方法。
- 经 Broker 转发的远程 macOS Host 目前不转发这个开关。本机 Desktop 直接使用 Claude Adapter。

直接运行 Claude CLI、不经过 BOFT CLI 的用户不在这个开关的范围内。

## 验证

```sh
npx vitest run --config tests/vitest.config.js \
  packages/adapters/claude-code/test/long-context.test.ts \
  packages/adapters/claude-code/test/claude-code-adapter.test.ts \
  packages/host-runtime/test/app-server-host.long-context.test.ts \
  packages/renderer-extension/test/settings/pages.test.ts \
  packages/renderer-extension/test/renderer-model-client.test.ts \
  packages/renderer-extension/test/console/connection-diagnostics.test.ts
```
