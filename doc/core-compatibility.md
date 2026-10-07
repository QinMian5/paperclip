# Local core compatibility

This maintenance contract covers explicit task-assignment denial and separate
workspace storage. Keep both local patches until an unpatched upstream revision
passes the same behavior checks. Configuration, stored fields, and plugins are
not evidence of equivalent enforcement.

## Compared revisions

- Local source before this verification change:
  `6ff544028d99c0d6281949bdcc53b16390528489`.
- Upstream `master`, fetched on 2026-10-07:
  [`ceabc3bc880676c49eee907a8d736f961a1358eb`](https://github.com/paperclipai/paperclip/commit/ceabc3bc880676c49eee907a8d736f961a1358eb).
  The server package version is `0.3.1`; use the commit to identify the source.
- The upstream checks use a complete `git archive` of that commit. Only the four
  verification test files are copied from the local tree. No local production
  patch is applied to the upstream copy. Installed external dependencies are
  reused; workspace package links resolve inside that copy, and its shared and
  plugin SDK packages are built from upstream source.

## Main-branch integration

The remote fork baseline is `59015846ae02f935411afc620e0867ce812378fb`. It
does not contain either retained patch. The main-branch delivery includes the
same assignment guards and workspace-root helper together with these tests.
It does not require the broader local upstream synchronization. The delivery
PR records fresh checks against this remote baseline.

## Task-assignment contract

An active ordinary company agent with `permissions.canAssignTasks: false`
cannot assign work. An active membership, a broad `tasks:assign` grant, or a
matching `tasks:assign_scope` grant cannot override that denial. Agents with
`canAssignTasks: true`, and legacy agents without that field, keep the existing
default-open assignment behavior. The CEO and the existing
`permissions.canCreateAgents: true` exception keep assignment authority.

| Active actor | Grant | Local authorization | Local detail capability | Unpatched upstream |
| --- | --- | --- | --- | --- |
| Ordinary; field absent | None | Allow | `true`, `simple_default` | Allow |
| Ordinary; explicit `false` | None | Deny | `false`, `none` | Allow; capability `true` |
| Ordinary; explicit `false` | Broad | Deny | `false`, `none` | Allow; capability `true` |
| Ordinary; explicit `false` | Matching scoped | Deny | Denial precedes grants | Allow |
| Ordinary; explicit `true` | None / broad | Allow | `true`, default / explicit grant | Allow |
| CEO; explicit `false` | None | Allow | `true`, `ceo_role` | Allow |
| Legacy hiring permission; explicit `false` | None | Allow | `true`, `agent_creator` | Allow |

Authorization is tested through `authorizationService.decide` with an isolated
embedded PostgreSQL database. The detail projection is tested through
`GET /api/agents/:id`, the capability consumed by the board UI. These capability
checks cover active standard agents; the summary is not a promise that every
target or execution context is authorized. Company boundaries, target policies,
responsible-user ceilings, trust restrictions, and lifecycle gates still apply.

Native assignment grants constrain protected targets, but the default-open
standard-agent path does not make absence of a grant a denial. A target's
`authorizationPolicy.protectedAgent.blockAssignment` blocks assignment to that
target; it does not express this per-caller permission. Removing membership
also changes unrelated access and execution behavior. None is a replacement for
the explicit-denial contract.

The related open upstream [PR #12356](https://github.com/paperclipai/paperclip/pull/12356)
proposes denying non-CEO agents even when they have hiring authority. It is not
merged into the compared revision, and its proposed hiring behavior differs
from this compatibility contract. Do not adopt it without a separate decision.

## Workspace-storage contract

`PAPERCLIP_WORKSPACE_HOME` is an optional absolute host path. It is trimmed and
supports the existing `~` expansion. Relative paths fail before either default
workspace resolver returns a path. An unset, empty, or whitespace-only value
falls back to the existing instance root.

| Resource | With a workspace home |
| --- | --- |
| Default agent workspace | `<workspaceHome>/instances/<instance>/workspaces/<agentId>` |
| Automatic managed project checkout | `<workspaceHome>/instances/<instance>/projects/<companyId>/<projectId>/<repoName-or-_default>` |
| Config, database, secrets key, attachments, backups, logs | Existing `<PAPERCLIP_HOME>/instances/<instance>/...` paths |

Instance IDs, company IDs, project IDs, and distinct agent IDs retain their
separation. Prefix-related project IDs remain siblings. Agent IDs are globally
unique; the existing agent path does not add a company segment.

Native `PAPERCLIP_HOME` relocates both workspace defaults and application data.
It cannot independently move workspaces. Native adapter `cwd` and project
workspace `cwd` can select explicit directories, but they do not change both
automatic defaults or provide global instance/company/project separation.
Execution-worktree policies govern derived worktrees, not these two root
defaults. The unpatched upstream ignores `PAPERCLIP_WORKSPACE_HOME`, including
relative values, and clones automatic projects under the application-data root.

Path tests use temporary test roots. The managed-checkout test clones a local
Git repository across two instances, companies, and projects, verifies its
contents and origin, and keeps an application-config sentinel in place. It
never clones from the network or touches an online workspace.

The current deployment keeps application data at `/paperclip` and binds the
configured workspace directory at the same absolute path on the host and in
the container. An isolated Docker check uses the existing local image, no
network, and a temporary bind mount. It checks both workspace resolvers and the
database resolver, writes one agent-workspace marker in the container, and reads
that marker on the host. No production volume, database, credential, or
attachment is moved or deleted.

## Retained patches and upstream requirements

- `server/src/services/authorization.ts`: retain the explicit ordinary-agent
  denial before the default-open assignment path, preserving CEO and hiring
  exceptions.
- `server/src/routes/agents.ts`: retain the corresponding capability denial
  after those exceptions and before grants or membership defaults.
- `server/src/home-paths.ts`: retain the workspace-only instance-root helper
  and its use by both automatic path resolvers. Application-data resolvers stay
  on the shared native home functions.

Upstream needs an enforced per-caller assignment permission with the agreed
legacy exceptions and a workspace-only root setting shared by agent defaults,
managed checkout creation, and project codebase metadata. Both require negative
tests on an unpatched baseline. There is no replacement plugin, broader
permission rewrite, scheduler change, or global pull-request completion gate.

## Repeatable verification

Run the full four suites on the local source:

```sh
pnpm exec vitest run \
  server/src/__tests__/authorization-service.test.ts \
  server/src/__tests__/agent-permissions-routes.test.ts \
  server/src/__tests__/home-paths.test.ts \
  server/src/__tests__/heartbeat-managed-clone-credentials.test.ts
```

For the comparison, export the pinned upstream commit into a new temporary
directory and copy only those four test files into it. Install its dependencies
without changing the maintained lockfile, then prepare its SDK:

```sh
pnpm install --no-frozen-lockfile --lockfile=false
pnpm --filter @paperclipai/plugin-sdk ensure-build-deps
```

Run the same files with this filter in the upstream directory:

```sh
--testNamePattern 'honors explicit assignment permissions|reports assignment capability consistent with enforcement|separate workspace storage|clones automatic project checkouts'
```

The 24 selected cases pass locally. On the pinned upstream, 14 pass and 10 fail:
three authorization denials, two capability denials, four workspace-path checks,
and the real automatic checkout. These are expected compatibility failures,
not missing test dependencies. This evidence requires retaining both patches.
The delivery PR records the complete suite, typecheck, build, and Docker-check
results, including any limitations.
