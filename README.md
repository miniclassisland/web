# MINI ClassIsland Web (`miniclassisland/web`)

<p align="center">
  <a href="https://miniclassisland.com" target="_blank" rel="noopener noreferrer">
    <img src="assets/miniclassisland.png" alt="MINI ClassIsland Logo" width="128" height="128" />
  </a>
</p>


> **MINI ClassIsland** 租户集控与教务管理工作台（`dash.miniclassisland.com`）  
> 基于 Next.js 16 + React 19 + Fluent UI v9 构建的现代化校园终端集中管控前端。

[![Next.js 16.2](https://img.shields.io/badge/Next.js-16.2-black)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.2-61DAFB)](https://react.dev/)
[![Fluent UI v9](https://img.shields.io/badge/Fluent%20UI-v9-0078D4)](https://react.fluentui.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6)](https://www.typescriptlang.org/)

---

## 1. 概述

**MINI ClassIsland Web** 是面向学校信息中心管理员、年级组长及教务老师的多租户集控管理面板（对应后端 **Management API `:27042`**）。用户可在同一账号下切换管理多个学校/校区租户，可视化编排 ClassIsland 的 7 类核心档案配置，管理教室终端准入，并实时向单个班级或全校广播通知与远程控制指令。

---

## 2. 核心功能模块

| 模块 | 路径 | 功能特性 |
| :--- | :--- | :--- |
| **认证与两步验证** | `/login` · `/register` · `/oobe` | 支持用户名/邮箱登录、新用户注册申请、TOTP 动态口令两步验证（2FA）与恢复码应急登录；支持从超管后台通过一次性 SSO 兑换码（`/token/redeem`）免密跨站接管租户。 |
| **集控总览仪表盘** | `/dashboard` | 实时展示当前租户在线/离线终端数量、配额使用率进度条、审计活动概览，并支持一键生成下载可直接导入教室终端的 `ManagementPreset.json`。 |
| **7 类配置资源可视化编辑器** | `/profiles` | 完整对齐上游 ClassIsland 数据结构，提供 **可视化表单 + 原始 JSON 双模式** 编辑与版本演进：<br>1. `Subjects`（科目表：名称、简称、任课教师、户外课标记）<br>2. `TimeLayout`（时间表：上课/课间/分割线时间点、行动组触发器）<br>3. `ClassPlan`（课表：周次轮换规则、时间表关联、节次科目编排）<br>4. `DefaultSettings`（终端默认外观、停靠位置、缩放与 NTP 设置）<br>5. `Policy`（集控安全策略：禁止篡改课表、禁止退出集控、禁用调试菜单等）<br>6. `Components`（主界面多行组件栏位配置）<br>7. `Credentials`（客户端本地管理密码与凭据配置） |
| **终端设备管控与远程日志** | `/clients` | 查看全校终端实时在线状态、IP 与硬件 MAC；支持单台或批量执行 **重启应用**、**强制同步配置**、**按班级分配独立档案（`ClientProfile`）**、**重置迁移设备绑定 IP**，以及向在线终端发起 **`GetClientConfig` 远程拉取完整 1,000 条运行日志快照或当前配置**。 |
| **校园通知与紧急广播** | `/notifications` | 支持向指定班级终端或全校所有在线终端推送横幅通知（支持遮罩标题、正文、语音播报 TTS、置顶闪烁音效、紧急通知模式、重复次数与持续时长实时预览）。 |
| **终端准入控制** | `/pairing` | 支持切换三种准入策略：`open`（开放自动准入）、`pairing`（6 位动态配对码人工审批）、`pre_reg`（预注册白名单模式，支持按班级标识 `ClientId` 或硬件 `MAC` 录入及 CSV 批量导入并绑定预设档案）。 |
| **安全审计日志** | `/audit` | 按事件类型（课表切换、授权成功/失败、设置修改等）与终端筛选查看解码后的 Protobuf 审计事件详情。 |
| **租户设置与成员协作** | `/settings` · `/members` | 管理学校名称、子域名标识（`slug`）、API Key 轮换、成员角色（`owner` / `admin` / `member`）及邀请链接，以及个人密码与 2FA TOTP 绑定。 |

---

## 3. 快速开始

### 3.1 环境要求

- Node.js `>= 20.0`
- npm `>= 10.0`

### 3.2 环境变量配置

复制 `.env.example` 为 `.env.local` 并按需修改后端 Management API 地址：

```bash
cp .env.example .env.local
```

| 变量名 | 默认值（生产环境） | 本地开发示例 | 说明 |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_BASE` | `https://api.miniclassisland.com` | `http://127.0.0.1:27042` | 后端 Management API (`:27042`) 根地址 |
| `NEXT_PUBLIC_ADMIN_URL` | `https://admin.miniclassisland.com` | `http://127.0.0.1:3001` | 超级管理员控制台跳转地址 |
| `NEXT_PUBLIC_BASE_DOMAIN` | `miniclassisland.com` | `miniclassisland.com` | 泛域名租户根域名（用于生成客户端接入地址 `https://<slug>.<domain>`） |

### 3.3 本地开发与静态导出构建

```bash
# 安装依赖
npm install

# 启动本地开发服务器 (默认 http://localhost:3000)
npm run dev

# 类型检查与代码规范检查
npx tsc --noEmit
npm run lint

# 构建生产环境静态导出产物 (输出至 ./out 目录，供 Nginx 直接托管)
npm run build
```

---

## 4. 贡献指南与开源协议

- 提交代码前请阅读 [`CONTRIBUTING.md`](CONTRIBUTING.md)。
- 所有 Git Commit 必须使用 SSH 或 GPG 密钥签名（`git commit -S`）。
- 本项目基于 GPL-3.0 协议开源。
