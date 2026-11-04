# MINI ClassIsland Web 贡献指南 (`CONTRIBUTING.md`)

感谢你为 **MINI ClassIsland Web (`miniclassisland-web`)** 贡献代码！本文档说明了前端项目的技术规范、安全要求与提交流程。

---

## 1. 技术栈与项目结构

- **框架**：Next.js `16.2`（采用 `output: 'export'` 纯静态导出模式，兼容 Nginx 零 Node 进程直接托管）。
- **UI 组件库**：Fluent UI React Components v9 (`@fluentui/react-components`、`@fluentui/react-icons`)。
- **源码结构**：
  - `src/app/`：Next.js App Router 页面路由（`/dashboard`、`/profiles`、`/clients`、`/notifications`、`/pairing`、`/audit`、`/settings` 等）。
  - `src/components/`：公共导航框架、档案可视化编辑器与弹窗组件。
  - `src/lib/api.ts`：统一封装面向 Management API (`:27042`) 的类型安全 HTTP 客户端与会话管理。

---

## 2. 开发与设计规范

1. **静态导出兼容性**：
   - 由于生产环境通过 Nginx 直接托管 `out/` 目录，所有页面必须兼容 Next.js 静态导出，避免使用仅限 SSR 运行时的服务端专属特性。
2. **上游 ClassIsland 数据格式严格对齐**：
   - 修改 `/profiles` 下的 7 类资源编辑器（`Subjects`、`TimeLayout`、`ClassPlan` 等）时，生成的 JSON 字段命名（PascalCase，如 `TimeLayouts`、`ClassPlans`、`StartSecond`、`EndSecond`）必须与上游 ClassIsland 客户端及后端 `normalize_resource_payload` 保持严格一致。
3. **XSS 与凭据防护**：
   - 严禁使用未经消毒的 `dangerouslySetInnerHTML`。
   - 跨站 SSO 跳转（超管“进入集控编辑”）一律使用后端签发的 30 秒一次性 `exchange_code` 通过 POST `/token/redeem` 兑换会话，严禁在 URL Query 中直接明文传递长期 `session_token`。
4. **敏感文件隔离**：
   - 严禁提交 `.env`、`.env.local`、编辑器私有目录（`.vscode/`、`.idea/`）或任何私钥证书文件。

---

## 3. 提交前必跑检查

在提交任何更改前，必须在 `web/` 目录下执行并通过以下验证：

```bash
# 1. TypeScript 严格类型检查
npx tsc --noEmit

# 2. ESLint 检查
npm run lint

# 3. 验证生产环境静态导出构建成功
npm run build
```

---

## 4. 强制提交签名 (`git commit -S`)

所有 Commit 必须附带经过 GitHub 登记的 SSH 或 GPG 签名，并遵循 Conventional Commits 规范：

```bash
git config gpg.format ssh
git config user.signingkey "~/.ssh/id_ed25519.pub"
git config commit.gpgsign true

git commit -S -m "feat(web): enhance remote log viewer and notification preview"
```
