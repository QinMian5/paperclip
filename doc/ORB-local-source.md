# ORB 本地源码部署

ORB 的 Paperclip 服务运行在本机 OrbStack 中，Tailscale 提供现有访问地址。
源码位于 `/Users/mianqin/Code/paperclip`；部署配置和登录密钥仍由
`/Users/mianqin/Code/docker-services/docker/paperclip` 管理。

## 构建与更新

在源码仓库根目录运行：

```sh
export PAPERCLIP_SOURCE_COMMIT="$(git rev-parse HEAD)"
export PAPERCLIP_CLI_TOOLS_CACHE_EPOCH="$(date -u +%Y%m%d%H%M%S)"
export PAPERCLIP_RUNTIME_TOOLS_IMAGE=paperclip-local:orb-runtime-tools-candidate
export PAPERCLIP_APPLICATION_IMAGE=paperclip-local:orb-application-candidate
export PAPERCLIP_RUNTIME_IMAGE=paperclip-local:orb-runtime-candidate
docker compose \
  --env-file /Users/mianqin/Code/docker-services/docker/paperclip/.env \
  -f /Users/mianqin/Code/docker-services/docker/paperclip/docker-compose.yml \
  --profile runtime-build --project-name paperclip build runtime-tools
docker compose \
  --env-file /Users/mianqin/Code/docker-services/docker/paperclip/.env \
  -f /Users/mianqin/Code/docker-services/docker/paperclip/docker-compose.yml \
  --profile runtime-build --project-name paperclip build application
docker compose \
  --env-file /Users/mianqin/Code/docker-services/docker/paperclip/.env \
  -f /Users/mianqin/Code/docker-services/docker/paperclip/docker-compose.yml \
  --project-name paperclip build paperclip
```

先按 docker-services 的 `docker/paperclip/RUNTIME.md` 隔离验证候选环境并保存
回退镜像。构建成功、验证通过、备份现有实例，并确认已有发布权限和 agent
空闲窗口后，才用同一组配置更新服务：

```sh
docker compose \
  --env-file /Users/mianqin/Code/docker-services/docker/paperclip/.env \
  -f /Users/mianqin/Code/docker-services/docker/paperclip/docker-compose.yml \
  --project-name paperclip up -d --no-deps --no-build --pull never paperclip
```

以上构建与更新命令使用 docker-services 管理的工具基础镜像、本地源码构建的
`production` 镜像与保留角色 Skill 的最终派生镜像，沿用 `paperclip-data`
持久卷、原身份认证配置及 Tailscale 地址。更新源码后重复以上流程。
`PAPERCLIP_SOURCE_COMMIT` 标识源码基线；未提交的本地修改也进入镜像。

## Codex 与角色规则

本地部署安装 `@openai/codex@latest`，并通过 `CODEX_PATH` 让 ACP
桥接器启动该版本的 **app-server**。每次重新构建前刷新
`PAPERCLIP_CLI_TOOLS_CACHE_EPOCH`，让 Docker 重新安装工具的最新发布版本。
Agent 的执行引擎继续使用 ACP，
模型及订阅连接沿用原配置。Runner 的远程 provider 依赖资格版本保留上游设置。
本地 ACP 的环境变量投影允许 Codex 接收 `CODEX_PATH`；该变量不会传给
其他 provider，也不会自动传入远程执行环境。

本地部署的最终派生镜像在上游构建校验完成后，将 docker-services 中维护的
`role-config/paperclip-SKILL.md` 覆盖到运行时的 `skills/paperclip/SKILL.md`。
源码中原有的 `PAPERCLIP_ORB_ROLE_OPERATIONS` 兼容开关继续保留，角色 Skill
迁移不属于本次工具迁移。源码中的授权判断
与 Agent 详情保留 `canAssignTasks=false` 的服务端限制；CEO 和已有招聘
授权沿用原有规则。Agent 创建无负责人任务的授权检查已包含在本次上游源码中。
角色的专属指令、权限、订阅连接和项目工作区保存在持久卷中。

## 修改理由

| 文件 | 依据 |
| --- | --- |
| `server/src/services/authorization.ts` | 原部署的 `role-config/prepare-runtime.py` 已补充显式禁止派工的判断；迁入源码以保留现有权限效果。 |
| `server/src/routes/agents.ts` | 原部署同样修改了 Agent 详情的权限计算，避免界面与服务端判定不一致。 |
| `server/src/__tests__/authorization-service.test.ts` | 验证显式禁止派工、允许派工及原有 CEO/创建 Agent 权限。 |
| `packages/adapter-utils/src/acpx-engine/execute.ts` | 实际重试证明：宿主配置的 `CODEX_PATH` 被过滤，ACP 因此继续启动内置旧版 Codex。增加 Codex 本地继承项。 |
| `packages/adapter-utils/src/acpx-engine/execute-identity.test.ts` | 验证路径只传给本地 Codex，其他 provider 和远程执行环境保持原边界。 |
| `Dockerfile`、`docker/orb/paperclip-SKILL.md` | 默认恢复上游 slim Node 工具配置；`PAPERCLIP_RUNTIME_BASE_IMAGE` 可选择部署工具基础镜像。角色操作指令兼容开关继续保留。Codex 安装仍使用上游原有的 `@latest`。 |
| `.dockerignore` | 排除本地实例备份和运行文件，避免密钥、登录状态和数据进入构建上下文。 |
| `docker-services/docker/paperclip/docker-compose.yml` | 在唯一的 Compose 文件内声明部署工具、应用及角色 Skill 三层构建，沿用现有卷、认证和网络配置。 |
| 本文档 | 提供可重复的构建、更新与回退步骤，记录每处改动依据。 |

## Agent 基础工具

所有当前 ORB Agent 都使用容器中的 `Local` 执行环境，以 `node` 用户启动。
部署工具基础镜像使用官方 `mcr.microsoft.com/devcontainers/javascript-node:24-trixie`
合集，沿用 Node 24 和 Debian Trixie，支持当前 ARM64 主机。它已包含
Common Utilities、Git、文件/压缩工具、进程/网络工具和 C/C++ 编译工具，
减少单独维护通用工具清单。

工具配置由 docker-services 的 `runtime-tools.Dockerfile` 维护：安装 pnpm 12.9.1，
从按 digest 固定的官方 uv 镜像复制 `uv`、`uvx`，并从固定的 Docker CLI
镜像复制 Docker、Compose 与 Buildx。它们供所有本地 Agent 使用；项目依赖仍由
各仓库的锁文件和初始化命令管理。应用构建继续使用上游的 slim Node 基础镜像
和仓库声明的 package manager；默认生产构建也使用上游工具配置。

这次工具调整的依据：

- `uv`：当前运行环境没有安装，用户要求预装最新稳定版。
- `pnpm`：原环境通过 Corepack 使用 Paperclip 源码声明的旧版；用户要求更新运行工具。
  只调整部署工具基础镜像，源码构建阶段仍遵循仓库的 `packageManager` 声明。
- `unzip`：ORB-20 的 Claude run 在读取审核证据时已报 `unzip: command not found`。
- 工具合集：按用户要求用上述官方 Node 开发镜像替换通用工具的手工安装清单。
  额外补充合集缺少的 CMake/Ninja、DNS/netcat、SQLite CLI 和 Media Go 的
  `ffmpeg`/`ffprobe`。各项目的测试、框架和其他依赖由项目声明管理。
- 兼容现有部署：合集默认 npm 全局路径不同，安装时显式使用 `/usr/local`，
  保持 `CODEX_PATH=/usr/local/bin/codex` 有效；将该路径置于 PATH 首位，
  并卸载合集自带的旧 pnpm，避免登录 Shell 的 PATH 再次选中旧版本。
  移除合集给 `node` 的免密 sudo 授权，保留现有运行用户和 Docker socket 权限。

构建、隔离验收、生产空闲窗口与回退步骤见 docker-services 的
`docker/paperclip/RUNTIME.md`。共享部署配置只修改本票的构建部分。

Python 虚拟环境和项目依赖优先使用 uv。用户允许合集自带 pip，因此不作额外删除。

托管 AI 连接会给一次运行分配临时 `HOME`，结束后清理。将基础工具安装到
`/usr/local/bin` 可避免工具随着临时登录目录一起消失。

## 自动初始化工作区

当前源码已有工作区准备命令，Git worktree 在创建、恢复或复用时执行
`workspaceStrategy.provisionCommand`。命令应可重复执行；初始化失败会阻止本次启动。
项目的 Execution workspace policy 可统一设置规则，单个执行工作区的
Lifecycle commands 可覆盖 `Provision command`。

例如 Python 接收器可使用以下项目策略（示例，不代表已应用到 ORB-20）：

```json
{
  "executionWorkspacePolicy": {
    "enabled": true,
    "defaultMode": "isolated_workspace",
    "workspaceStrategy": {
      "type": "git_worktree",
      "provisionCommand": "cd receiver && uv sync --frozen"
    }
  }
}
```

Node 项目可将命令改成 `pnpm install --frozen-lockfile`，或调用仓库已有的
初始化脚本。只安装该工作区声明的依赖。

目前 Media Go 使用共享项目目录；本地共享目录准备路径不会执行上述
Git worktree provision hook。Project workspace 页面的 `Setup command` 字段
在当前源码中仅保存和返回，未接入启动执行路径。`runtimeProvisionCommand`
则在需要启动运行服务时执行，不等同于每次 Agent 启动前初始化。

## 备份与回退

升级前同时保存逻辑数据库备份和实例文件，实例文件包括加密密钥、上传文件、
登录状态及工作区。数据库备份本身无法恢复这些文件。

本次升级前备份位于 `.paperclip-local/backups/2026-10-06-before-source/`，
该目录已排除出 Git，文件仅本机用户可读。旧镜像
`paperclip-local:roles-2026-10-05-native-subagents` 保留用于回退。
数据库发生迁移后，回退须恢复对应备份并使用旧镜像；单独切换旧镜像不足以回退数据库。
