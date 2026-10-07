# Codex ACP continuity through the native control plane

Date: 2026-10-07. Result: executable selection passed; session continuity failed.
The deployment was restored to its previous image and settings.

## Acceptance boundary

The operator accepted one new session when moving the executable path from the
host environment into `adapterConfig.env.CODEX_PATH`. Later runs with unchanged
settings had to reuse that new session, including after a service restart.
The candidate changed only the Codex host allowlist entry. It preserved the
existing engine, subscription connection, model, permissions, and other patches.

This qualification used native persisted agent settings, real heartbeat runs,
and two actual service recreations. It did not use a direct adapter invocation
as a substitute for control-plane acceptance. No wrapper, plugin, new account,
or external execution service was added.

## Controlled candidate

The saved runtime image was pinned before the test. A one-time candidate layer
replaced only `packages/adapter-utils/src/acpx-engine/execute.ts`. The candidate
removed the single local Codex host allowlist entry for `CODEX_PATH`.

| Input | Existing deployment | Candidate |
| --- | --- | --- |
| Execution module SHA-256 | `e676facc7114ecd663f74a2f934001e6f3bffa9d405112f29a21f1321867a26b` | `54cd57a1c9cba285b198bb25507a0c9d381ad5ea809ac702fa3439013fd45fb5` |
| Image SHA-256 | `d915162829939b4296420fdd888bece946d270960b9e9b42d4cab630fc7867b6` | `b592d98db05d7ac2e6c7c2a07f51e98766a1dbf8ede3dcb07a6780d390aa96fb` |
| Host `CODEX_PATH` | `/usr/local/bin/codex` | Absent |
| Native Codex agent environment | No explicit path | Explicit `/usr/local/bin/codex` on all six Codex roles |
| Engine | ACP | ACP |
| Installed Codex version | `0.160.1` | Same |

The candidate module matches upstream commit
`88ff98b83d15eaa6640ee1848df4f0ad9bc82af3` byte for byte. This statement applies
to the module, not to the whole image. All other runtime files remained from
the saved image.

The API hides plain environment values. API readbacks confirmed the binding
shape and all protected role fields. A read-only database check confirmed the
stored path on all six Codex roles. The two Claude roles stayed unchanged.
The actual child was the installed Codex native binary, started as `app-server`.
Its effective path was `/usr/local/bin/codex`. Provider turn records confirmed
`gpt-6.1-sol`, `xhigh`, `on-request`, `workspace-write`, and enabled network access.
The existing managed subscription remained the authentication source.

## Real task and continuation results

One bounded file task created `proof.txt`, then read and appended to that file.
Session letters below identify distinct actual ACP session IDs. They do not
identify separate issues. No run requested `forceFreshSession`.

| Phase | Saved session supplied | Actual ACP session | ACP fingerprint | Result |
| --- | --- | --- | --- | --- |
| Existing deployment | None | A | `30091f6e8a56bd4e` | Wrote `baseline` |
| First successful explicit-path run | A | B | `3e4fbe68e0e640d6` | Read the file and appended `explicit`; accepted first reset |
| Disposition-repair wake; role settings unchanged | B | C | `884f63086a207c5e` | Completed, but did not reuse B |
| After the second service recreation; disposition-repair wake | C | D | Not captured separately | Completed, but did not reuse C |
| Subsequent recovery-action wake | C | E | `21239227f8603880` | Verified the file and appended `resumed`; did not reuse C |

The last two runs both reported C as `sessionIdBefore`. The record does not
claim that E resumed or directly followed D's saved state. Both runs reported
`taskSessionReused=true`, `reset=false`, no changed config categories, and the
same native config fingerprint:
`v1:sha256:f2c8e48b50fb64cf7cf9d4b36bc46d79093208088f1eb4ea18184abddbcb97b8`.
The persisted task session snapshots for B, C, and E also retain that native
fingerprint. The ACP fingerprint and actual ACP session still changed.

The final file contained exactly 26 bytes:

```text
baseline
explicit
resumed
```

This proves successful file execution. It does not prove conversation reuse.
The restart at 18:54:33 UTC retained the candidate image, persisted agent path
settings, data volume, and healthy existing credential provider.

The first explicit-path attempt stopped before provider work with
`configuration_incomplete` and a reported missing master key. The original key
was present, and the provider health check passed as the runtime user. A retry
completed without any key replacement, credential rotation, or account change.
The cause of that initial error was not established.

The first settings readback expected a literal path, but the API returned its
redacted binding. Only one role had changed when the first service recreation
ran. The operator then held admission again, confirmed zero active runs and
pending wakes, and completed all six updates and readbacks before any test run.
The partial state did not affect an active task. This execution error was
reported and corrected; it is not counted as a successful atomic migration.

## Source diagnosis and repair boundary

`server/src/services/ai-connection-runtime.ts` creates a random managed home for
each run. It supplies `HOME`, `CODEX_HOME`, and related provider/config paths in
the effective adapter environment. Its native config fingerprint helper already
normalizes these paths and uses the stable credential session identity.

The lower ACP engine builds `adapterEnvHash` from resolved environment values.
Its Codex Skill identity also includes the effective Codex home and Skill home.
The managed provider paths change between real runs and enter this lower
fingerprint without the native normalization. This explains the observed
identity mismatch despite unchanged native config categories and credentials.
It does not establish a complete repair.

The managed home cleanup also removes the provider directory after a run.
A repair must verify durable provider conversation state and credential owner,
grant, and revocation boundaries. Ignoring changing paths in one hash alone
does not prove that the old provider session can load. Such a repair changes
shared runtime behavior beyond the allowlist-only candidate tested here.

## Rollback and final state

Before each service recreation, an operator-owned task drain held new work.
The drain counters and company live-run list confirmed no active work.
The rollback removed only the six task-owned native path entries, then restored
the exact saved image and original Compose service `CODEX_PATH`.
The source allowlist and its original tests remain in place.

Post-rollback checks confirmed all eight roles matched their original protected
fields, all six explicit native path entries were absent, and the runtime module
and image matched the existing-deployment hashes above. The original service
path was present. The data volume, mounts, network, resource settings, model
bindings, and permissions were preserved. The restored service started at
19:22:01 UTC. Its task drain was clear, with no active runs or pending wakes.
Rollback does not merge model histories from different ACP sessions.

Private snapshots and resolved Compose files remain outside Git. They are not
publication artifacts. The final change consists of documentation and evidence.
It does not approve the migration or remove the host-inheritance patch.

## Repository validation

- Candidate focused tests passed: 219 tests across the ACP execution and
  execution identity suites. The final identity fixture check passed 8 tests.
- Candidate adapter-utils and codex-local typechecks passed.
- `pnpm test:run` failed in its first general-server group: 768 passed files,
  7 failed files, 5 skipped files; 15,572 passed tests, 50 failed tests,
  91 skipped tests; 1 unhandled error. Duration: 2,319.03 seconds. Later groups
  did not run.
- The log includes the 49 Teams/Cursor failure cases previously reproduced on
  the clean pre-change baseline. Long failure headers were compared by their
  visible case-name prefixes. An additional heartbeat comment wake batching
  case timed out. Its focused rerun on unchanged tracked source passed 1 test
  with 27 other cases skipped in 12.91 seconds. The full-run timeout remains an
  unresolved intermittent result, not a reproduced baseline failure.
- Full typecheck and build failed on the existing `plugin-workspace-diff` type
  errors: `PatchDiffProps` requires two type arguments, and a required
  `editStateKey` is missing. These errors were reproduced on the earlier clean
  baseline and the affected source is unchanged.

The full checks do not pass. Focused test success and file task success do not
override the failed real session-continuity requirement.
