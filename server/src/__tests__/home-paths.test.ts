import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveDefaultAgentWorkspaceDir,
  resolveDefaultBackupDir,
  resolveDefaultConfigPath,
  resolveDefaultEmbeddedPostgresDir,
  resolveDefaultLogsDir,
  resolveDefaultSecretsKeyFilePath,
  resolveDefaultStorageDir,
  resolveManagedProjectWorkspaceDir,
} from "../home-paths.js";

let testRoot: string;

beforeEach(async () => {
  testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-workspace-home-"));
  vi.stubEnv("PAPERCLIP_HOME", path.join(testRoot, "app-data"));
  vi.stubEnv("PAPERCLIP_INSTANCE_ID", "default");
  vi.stubEnv("PAPERCLIP_WORKSPACE_HOME", undefined);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(testRoot, { recursive: true, force: true });
});

describe("separate workspace storage", () => {
  it.each([undefined, "", "   "])("keeps the existing layout for an absent or blank workspace home: %s", (home) => {
    vi.stubEnv("PAPERCLIP_WORKSPACE_HOME", home);
    expect(resolveDefaultAgentWorkspaceDir("agent-1"))
      .toBe(`${testRoot}/app-data/instances/default/workspaces/agent-1`);
    expect(resolveManagedProjectWorkspaceDir({ companyId: "company", projectId: "project", repoName: "repo" }))
      .toBe(`${testRoot}/app-data/instances/default/projects/company/project/repo`);
  });

  it("relocates workspaces while preserving instance, company, project and agent separation", () => {
    vi.stubEnv("PAPERCLIP_WORKSPACE_HOME", `  ${testRoot}/workspaces  `);
    vi.stubEnv("PAPERCLIP_INSTANCE_ID", "one");
    const one = resolveManagedProjectWorkspaceDir({ companyId: "company", projectId: "project", repoName: "repo" });
    const sibling = resolveManagedProjectWorkspaceDir({ companyId: "company", projectId: "project-extra", repoName: "repo" });
    expect(one).toBe(`${testRoot}/workspaces/instances/one/projects/company/project/repo`);
    expect(sibling.startsWith(`${one}${path.sep}`)).toBe(false);
    expect(resolveManagedProjectWorkspaceDir({ companyId: "other-company", projectId: "project", repoName: "repo" }))
      .toBe(`${testRoot}/workspaces/instances/one/projects/other-company/project/repo`);
    expect(resolveDefaultAgentWorkspaceDir("agent-1"))
      .toBe(`${testRoot}/workspaces/instances/one/workspaces/agent-1`);
    expect(resolveDefaultAgentWorkspaceDir("agent-2"))
      .toBe(`${testRoot}/workspaces/instances/one/workspaces/agent-2`);
    expect(resolveDefaultConfigPath()).toBe(`${testRoot}/app-data/instances/one/config.json`);
    expect(resolveDefaultEmbeddedPostgresDir()).toBe(`${testRoot}/app-data/instances/one/db`);
    expect(resolveDefaultSecretsKeyFilePath()).toBe(`${testRoot}/app-data/instances/one/secrets/master.key`);
    expect(resolveDefaultStorageDir()).toBe(`${testRoot}/app-data/instances/one/data/storage`);
    expect(resolveDefaultBackupDir()).toBe(`${testRoot}/app-data/instances/one/data/backups`);
    expect(resolveDefaultLogsDir()).toBe(`${testRoot}/app-data/instances/one/logs`);
    vi.stubEnv("PAPERCLIP_INSTANCE_ID", "two");
    expect(resolveManagedProjectWorkspaceDir({ companyId: "company", projectId: "project", repoName: "repo" }))
      .toBe(`${testRoot}/workspaces/instances/two/projects/company/project/repo`);
    expect(resolveDefaultAgentWorkspaceDir("agent-1"))
      .toBe(`${testRoot}/workspaces/instances/two/workspaces/agent-1`);
  });

  it("preserves a host-identical absolute workspace path without container remapping", () => {
    vi.stubEnv("PAPERCLIP_WORKSPACE_HOME", "/Users/example/paperclip-workspaces");
    expect(resolveDefaultAgentWorkspaceDir("agent-1"))
      .toBe("/Users/example/paperclip-workspaces/instances/default/workspaces/agent-1");
  });

  it("shows that PAPERCLIP_HOME alone also relocates application data", () => {
    vi.stubEnv("PAPERCLIP_HOME", `${testRoot}/native-home`);
    expect(resolveDefaultAgentWorkspaceDir("agent-1"))
      .toBe(`${testRoot}/native-home/instances/default/workspaces/agent-1`);
    expect(resolveDefaultEmbeddedPostgresDir()).toBe(`${testRoot}/native-home/instances/default/db`);
    expect(resolveDefaultSecretsKeyFilePath()).toBe(`${testRoot}/native-home/instances/default/secrets/master.key`);
    expect(resolveDefaultStorageDir()).toBe(`${testRoot}/native-home/instances/default/data/storage`);
  });

  it.each(["relative/workspaces", "../workspaces"])("rejects a relative workspace home before creating a checkout: %s", (home) => {
    vi.stubEnv("PAPERCLIP_WORKSPACE_HOME", home);
    expect(() => resolveDefaultAgentWorkspaceDir("agent-1")).toThrow("must be an absolute path");
    expect(() => resolveManagedProjectWorkspaceDir({ companyId: "company", projectId: "project" }))
      .toThrow("must be an absolute path");
  });
});
