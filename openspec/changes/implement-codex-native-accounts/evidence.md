# 验证状态与支持边界

## 当前实现

- 正式 home 固定；最多一个受管官方后台，包括认证 staging。
- 切换进入 changing，停止受管及当次检测到的其他 Codex 后端，安装凭据、重启并验证。Host 设置页添加／重新登录、受控退出也直接停止受管后端，但不主动停止外部后端；Desktop 原生认证直接转发，不进入这些事务。账号操作不扫描或追踪会话、不采集设置快照；旧 RPC 明确失败，新工作立即拒绝。busy 反映在途请求及未完成原生认证写入，额度本地超时或客户端分离不单独使 Codex unavailable；退出证明与 Host 任务收尾独立保留。
- v2 Vault 保存包括当前账号在内的完整凭据副本，不持久化 current；当前身份从官方实际凭据推导，启动／列表刷新同步外部登录、退出及 Token 轮换。旧缺失副本的条目保留重新登录入口。
- Vault、Journal 和登录 candidate 使用私有明文文件。旧密文通过已有 OS 密钥进行可恢复的原地转换；明文库不访问密钥。
- 启动允许与其他 Codex 客户端共存。布局、来源、自身进程退出、凭据身份和 CAS 仍约束恢复及写入。
- 账号规格见 [全局账号](specs/codex-native-global-accounts/spec.md) 和 [凭据生命周期](specs/codex-native-credential-lifecycle/spec.md)，实现设计见 [原生账号管理](../../../docs/codex-native-account-switching-design.md)。

## 原生认证解耦增量验证

- 删除原生认证业务拦截、透传开关、严格登录参数 schema、Host 原生 loginId 替换及完成事件重建。设置页设备代码登录与显式切换／恢复保留；旧 staging 激活意图兼容恢复。
- 原生通知先转发，再异步收集凭据；收藏失败不关闭官方准入。仅观察原生认证写入来防止冲突切换，Host 更换后台后的 Desktop 身份更新继续保留。
- TypeScript 构建、插件打包通过；最终聚焦 Vitest 显式启用隔离官方 CLI 与真实 helper：16 个文件、313 个用例全部通过，无跳过。覆盖原生参数／结果／错误／通知透传、认证与切换冲突、备份失败隔离、切换后的身份显示、Settings 登录、旧 staging 恢复、凭据集合与删除保护。
- 其中真实官方 CLI 的 2 个用例覆盖 explicit-file 与 native-default。未登录临时 home 中，原生 OAuth 开始／取消及 logout 均经原生客户端直接执行，后台 generation 保持不变、无 Host staging，登录期间冲突切换被拒绝。未打开认证 URL，网络使用拒绝代理，未执行推理。
- `npm run typecheck`、`npm run lint`（含 Workspace 边界）、变更文件 Prettier、OpenSpec strict 校验与 `git diff --check` 通过。
- 本轮未操作真实用户账号登录／退出或执行真实 A→B→A；未重启 Desktop，未运行完整仓库测试。

## 凭据集合调整验证

- 聚焦 Vitest：18 个文件、344 个用例全部通过。覆盖集合同步、v1 Vault／Journal 和密文迁移、未决事务中的未知身份拒绝、切换／回滚／登录确认丢失、无额度依赖、Host 列表刷新及缺失凭据 UI。真实 helper 与官方 CLI 的 opt-in 用例已显式启用；官方 CLI 使用隔离且未登录的临时 home，未执行推理或真实登录。
- `npm run typecheck`、变更 TypeScript 文件 ESLint／Prettier、变更文档格式、Workspace 边界检查、`git diff --check` 通过。`npm start` 完成 TypeScript、Renderer、Rust 构建并启动源码 Desktop。
- macOS 实际 Desktop 启动后，通过 CDP 确认已填充页面的 Composer 数为 1，Renderer Adapter 为 `ready`。只读检查正式 Vault：v2、无 current 字段、全部已保存账号均有副本、当前副本与原生文件一致、文件权限为 `0600`。诊断仅记录结构和布尔值，不记录凭据或身份。
- 本次未运行完整仓库测试或完整 Playwright；未执行真实多账号 A→B→A，也未完成跨平台与多客户端验收。

## 非当前账号删除修复验证

- 现场设置页显示 `Codex is busy`；合成账号复现确认删除被普通原生在途请求误拦截。删除改用集合变更准入，不停止后台、不清空请求租约；独立 Host OAuth 写入仍阻挡删除，结束后允许显式重试。
- 聚焦 Vitest：10 个文件、243 个用例通过，保留原有准入发布／恢复测试，并覆盖普通请求期间删除、真实 Host OAuth 刷新期间拒绝删除、现有原生 RPC 正常完成及切换退出保护。
- Playwright：确认删除非当前账号、删除后的迟到额度响应、busy 后显式重试，共 3 个用例通过。类型检查、变更文件 ESLint／Prettier、Workspace 边界检查通过。
- `npm start` 完成构建和源码 Desktop 重启，CDP 确认 Composer 为 1、Adapter 为 `ready`。自动验证未删除真实账号；人工删除结果尚未确认。未运行完整仓库测试。

## 既有实现自动化验证

| 检查                                                               | 结果               |
| ------------------------------------------------------------------ | ------------------ |
| `npm run typecheck`                                                | 通过               |
| `npm run lint`（含 Workspace 边界）                                | 通过               |
| `npm run test:typescript`：构建、插件打包及完整 Vitest，333 个文件 | 3861 通过，35 跳过 |
| Playwright：账号设置与跨 Host 账号隔离，2 个文件                   | 48 通过            |
| macOS Rust：旧密钥 IPC／校验、进程枚举及批次终止                   | 9 通过             |
| `cargo fmt --all --check`、`git diff --check`                      | 通过               |
| `openspec validate implement-codex-native-accounts --strict`       | 通过               |

Vitest 使用 `tests/vitest.config.js`，Playwright 使用 `tests/e2e/playwright.config.js`。跳过项受真实 Harness／CLI／helper 的 opt-in 环境或平台条件限制。测试使用合成凭据、临时目录、协议 peer 或模拟页面；Rust 进程测试只操作其合成进程。上述既有自动化结果不等于全平台或真实多客户端切换验收；本次凭据集合调整的增量验证范围见上一节。

## 待验证边界

- 当前停止策略在真实 Desktop 中的 A→B→A，以及同一 Thread 后续请求的认证、上下文和页面连续性。
- VS Code／CLI 后端的 PID／启动身份退出证据，以及编辑器自动重启后共享凭据的行为。
- Desktop／Host PID 连续性和其他 Harness 的流式输出、审批、取消与保存。
- Windows／Linux 的实际文件权限、进程树退出、Desktop 联合运行；编译检查不能替代运行验证。
- 旧密钥的授权拒绝、锁定及 helper 异常生命周期；自动化测试不访问真实 OS 密钥或真实认证网络。

版本范围为 `0.153.4`、`0.154.0-alpha.6.2` 的文件式 ChatGPT 认证，不代表所有平台和配置均已验收。切换可能丢失临时内容及运行时设置，不承诺多客户端原子切换。此能力尚未完成发布验收。
