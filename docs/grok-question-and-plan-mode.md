# Grok 选择题与计划确认

Grok Build ACP 通过私有 Client 扩展方法 `_x.ai/ask_user_question` 和 `_x.ai/exit_plan_mode`（同时接受不带下划线前缀的 `x.ai/...`）向 Host 发起交互。codexhost 在 Grok Adapter 内把这两类 RPC 映射成既有的 Host Question，再由 Protocol Core 投影为 Codex Desktop 的 `item/tool/requestUserInput` 卡片。Host、Renderer 和公共契约不增加 Grok 专用分支。

## 选择题

Grok 调用 `ask_user_question` 时，Adapter 展示原生问题正文和选项，而不是普通工具的 Allow / Deny：

- 回答信封使用 Grok 内部 tagged enum：`{ outcome: "accepted", answers, annotations }`。`answers` 的键是问题正文；单选值为字符串，多选值为字符串数组。`annotations` 必须是对象（`{}`），不能是数组。
- 用户取消或 Turn 被取消时返回 `{ outcome: "skip_interview" }`，而不是 JSON-RPC 错误，避免挂起原生 Turn。
- initialize 通过 `clientCapabilities._meta` 声明 `x.ai/ask_user_question` 和 `x.ai/exit_plan_mode`。不要声明 ACP `elicitation.form`：Grok 会因此从模型工具表中拿掉 `ask_user_question`。

Codex Desktop 的选择题卡片在点击一个选项后即提交。Adapter 会把 `multiSelect` 记到 Host Question 的 `multiple`，但 Desktop 当前不投影该字段，因此多选在产品上只能回传被点中的那一项。

## 计划确认

Grok 调用 `exit_plan_mode` 时，codexhost 展示独立的 **Review plan** 选择式确认，而不是普通工具的“允许一次”审批：

- 展示 Grok 提供的完整计划正文，不套用普通工具审批的描述截断。
- **Approve plan and exit plan mode（批准计划并退出规划）** 位于第一个选项，仅在计划正文非空时出现。Codex Desktop 单选会预选第一项，Enter / Continue 因此提交批准。
- **Stay in plan mode（保持规划）** 位于第二个选项，拒绝本次退出规划请求。无计划正文时只提供这一项。
- Desktop 提交的是选项 label。Host 把 JSON-RPC 成功回包（含 `error: null`）交给 `parseResponse` 映射成 `approve`，不得当成取消。Adapter 同时接受 `approve` 与该 label。
- Grok `ExitPlanModeExtResponse` 的字段是 `outcome`，不是 `approved`。批准返回 `{ outcome: "approved" }`；取消确认、缺少计划正文、或选择保持规划返回 `{ outcome: "cancelled" }`。未知 `outcome` 会被 Grok 当成 cancelled，模型会收到 “The user wants to revise the plan…”。
- Adapter 不读取 `planFilePath` 自行补全文案，也不会在无正文时批准退出。

确认文案目前使用英文，与 Claude Code 计划确认和其他 Adapter 固定交互文案保持一致。

## 所有权与投影

- `packages/adapters/grok/src/acp-transport.ts` 实现 ACP `Client.extMethod`，并在 initialize 时广告 Grok 原生交互能力。
- `packages/adapters/grok/src/grok-question.ts` 解析选择题参数，并构造 Grok 可反序列化的回答信封。
- `packages/adapters/grok/src/grok-plan-review.ts` 将计划退出转换成封闭的 Host Question，并把经过验证的回答转换回 `{ outcome: "approved" | "cancelled" }`。
- 这两类交互都不是 ACP `requestPermission`，也不会写入普通工具审批的 `answers` 参数。

## 验证

定向回归覆盖方法识别、camelCase/snake_case 解析、接受/跳过/取消信封、无计划时禁止批准，以及未知扩展方法不挂起 Turn：

```sh
npx vitest run --config tests/vitest.config.js \
  packages/adapters/grok/test/grok-question.test.ts \
  packages/adapters/grok/test/grok-plan-review.test.ts \
  packages/adapters/grok/test/grok-adapter.test.ts
```
