import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveDefaultAgentWorkspaceDir,
  resolveDefaultEmbeddedPostgresDir,
  resolveDefaultSecretsKeyFilePath,
  resolveManagedProjectWorkspaceDir,
} from "../home-paths.js";

afterEach(() => vi.unstubAllEnvs());

describe("separate workspace storage", () => {
  it("keeps the existing layout when no workspace home is configured", () => {
    vi.stubEnv("PAPERCLIP_HOME", "/paperclip");
    vi.stubEnv("PAPERCLIP_INSTANCE_ID", "default");
    vi.stubEnv("PAPERCLIP_WORKSPACE_HOME", "");
    expect(resolveDefaultAgentWorkspaceDir("agent-1"))
      .toBe("/paperclip/instances/default/workspaces/agent-1");
    expect(resolveManagedProjectWorkspaceDir({ companyId: "company", projectId: "project", repoName: "repo" }))
      .toBe("/paperclip/instances/default/projects/company/project/repo");
  });

  it("relocates all managed checkouts while preserving instance, project and agent separation", () => {
    vi.stubEnv("PAPERCLIP_HOME", "/paperclip");
    vi.stubEnv("PAPERCLIP_WORKSPACE_HOME", "/Users/example/paperclip-workspaces");
    vi.stubEnv("PAPERCLIP_INSTANCE_ID", "one");
    const one = resolveManagedProjectWorkspaceDir({ companyId: "company", projectId: "project", repoName: "repo" });
    const sibling = resolveManagedProjectWorkspaceDir({ companyId: "company", projectId: "project-extra", repoName: "repo" });
    expect(one).toBe("/Users/example/paperclip-workspaces/instances/one/projects/company/project/repo");
    expect(sibling.startsWith(`${one}${path.sep}`)).toBe(false);
    expect(resolveDefaultAgentWorkspaceDir("agent-1"))
      .toBe("/Users/example/paperclip-workspaces/instances/one/workspaces/agent-1");
    expect(resolveDefaultEmbeddedPostgresDir()).toBe("/paperclip/instances/one/db");
    expect(resolveDefaultSecretsKeyFilePath()).toBe("/paperclip/instances/one/secrets/master.key");
    vi.stubEnv("PAPERCLIP_INSTANCE_ID", "two");
    expect(resolveManagedProjectWorkspaceDir({ companyId: "company", projectId: "project", repoName: "repo" }))
      .not.toBe(one);
  });

  it("rejects a relative workspace home before creating a checkout", () => {
    vi.stubEnv("PAPERCLIP_WORKSPACE_HOME", "relative/workspaces");
    expect(() => resolveDefaultAgentWorkspaceDir("agent-1")).toThrow("must be an absolute path");
    expect(() => resolveManagedProjectWorkspaceDir({ companyId: "company", projectId: "project" }))
      .toThrow("must be an absolute path");
  });
});
