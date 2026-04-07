import { computeStats } from "@/lib/stats";
import { ParsedData } from "@/types";

const emptyData: ParsedData = {
  statsCache: null,
  history: [],
  sessions: [],
};

const richData: ParsedData = {
  statsCache: {
    version: 1,
    lastComputedDate: "2024-02-01",
    dailyActivity: [
      { date: "2024-01-01", messageCount: 20, sessionCount: 2, toolCallCount: 10 },
      { date: "2024-01-02", messageCount: 15, sessionCount: 1, toolCallCount: 5 },
      { date: "2024-01-03", messageCount: 30, sessionCount: 3, toolCallCount: 20 },
    ],
    dailyModelTokens: [],
    modelUsage: {
      "claude-sonnet-4": {
        inputTokens: 500_000,
        outputTokens: 200_000,
        cacheReadInputTokens: 100_000,
        cacheCreationInputTokens: 50_000,
        webSearchRequests: 0,
        costUSD: 0,
        contextWindow: 200_000,
        maxOutputTokens: 8192,
      },
    },
    totalSessions: 10,
    totalMessages: 65,
    longestSession: { sessionId: "abc", duration: 3600000, messageCount: 30, timestamp: "2024-01-03T14:00:00Z" },
    firstSessionDate: "2024-01-01",
    hourCounts: { "9": 20, "14": 30, "22": 15 },
    totalSpeculationTimeSavedMs: 0,
  },
  history: [
    {
      display: "Write a function to parse JSON",
      timestamp: 1704067200000,
      project: "/home/user/project-a",
      sessionId: "s1",
      pastedContents: {},
    },
    {
      display: "Fix the bug in auth module",
      timestamp: 1704153600000,
      project: "/home/user/project-a",
      sessionId: "s2",
      pastedContents: {},
    },
    {
      display: "Help me design a database schema",
      timestamp: 1704240000000,
      project: "/home/user/project-b",
      sessionId: "s3",
      pastedContents: {},
    },
  ],
  sessions: [
    {
      sessionId: "s1",
      projectPath: "-home-user-project-a",
      messages: [
        {
          uuid: "m1",
          parentUuid: null,
          isSidechain: false,
          type: "user",
          timestamp: "2024-01-01T09:00:00Z",
          gitBranch: "main",
        },
        {
          uuid: "m2",
          parentUuid: "m1",
          isSidechain: false,
          type: "assistant",
          timestamp: "2024-01-01T09:00:05Z",
          message: {
            role: "assistant",
            content: "Here is your function.",
            model: "claude-sonnet-4",
            stop_reason: "end_turn",
            usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 20 },
          },
        },
        {
          uuid: "m3",
          parentUuid: "m2",
          isSidechain: false,
          type: "assistant",
          timestamp: "2024-01-01T09:01:00Z",
          message: {
            role: "assistant",
            content: [{ type: "tool_use", name: "Bash", id: "t1", input: { command: "ls" } }],
            model: "claude-sonnet-4",
            stop_reason: "tool_use",
            usage: { input_tokens: 80, output_tokens: 30 },
          },
        },
      ],
    },
  ],
};

describe("computeStats", () => {
  it("handles empty data without throwing", () => {
    expect(() => computeStats(emptyData)).not.toThrow();
  });

  it("returns zero counts for empty data", () => {
    const stats = computeStats(emptyData);
    expect(stats.totalMessages).toBe(0);
    expect(stats.projectCount).toBe(0);
    expect(stats.totalToolCalls).toBe(0);
    expect(stats.longestStreak).toBe(0);
  });

  it("counts totalMessages from session JSONLs (user+assistant)", () => {
    const stats = computeStats(richData);
    // 1 user + 2 assistant messages in the session data
    expect(stats.totalMessages).toBe(3);
  });

  it("reads totalSessions from statsCache", () => {
    const stats = computeStats(richData);
    expect(stats.totalSessions).toBe(10);
  });

  it("computes token totals from statsCache modelUsage", () => {
    const stats = computeStats(richData);
    expect(stats.totalInputTokens).toBe(500_000);
    expect(stats.totalOutputTokens).toBe(200_000);
    expect(stats.totalCacheReadTokens).toBe(100_000);
  });

  it("computes hourDistribution from statsCache hourCounts", () => {
    const stats = computeStats(richData);
    expect(stats.peakHour).toBe(14);
    expect(stats.hourDistribution[14]).toBeGreaterThan(0);
  });

  it("computes projectActivity from history", () => {
    const stats = computeStats(richData);
    expect(stats.projectCount).toBeGreaterThanOrEqual(2);
    // projectActivity now counts user+assistant messages from session JSONLs
    // Session s1 has 3 messages (1 user + 2 assistant) in project-a
    expect(stats.projectActivity["/home/user/project-a"]).toBe(3);
  });

  it("detects branch from session messages", () => {
    const stats = computeStats(richData);
    expect(stats.uniqueBranches).toContain("main");
  });

  it("resolves session slug paths to real project paths", () => {
    const stats = computeStats(richData);
    // -home-user-project-a should resolve to /home/user/project-a, displayed as basename
    const projectNames = stats.topProjectStats.map((p) => p.name);
    expect(projectNames).toContain("project-a");
  });

  it("counts tool calls from session messages", () => {
    const stats = computeStats(richData);
    expect(stats.toolCounts["Bash"]).toBe(1);
    expect(stats.totalToolCalls).toBeGreaterThanOrEqual(1);
  });

  it("counts stop reasons from session messages", () => {
    const stats = computeStats(richData);
    expect(stats.stopReasonCounts["end_turn"]).toBeGreaterThanOrEqual(1);
    expect(stats.stopReasonCounts["tool_use"]).toBeGreaterThanOrEqual(1);
  });

  it("hourDistribution has 24 entries", () => {
    const stats = computeStats(richData);
    expect(stats.hourDistribution).toHaveLength(24);
  });

  it("topProjectStats is sorted by messages descending", () => {
    const stats = computeStats(richData);
    const msgs = stats.topProjectStats.map((p) => p.messages);
    for (let i = 1; i < msgs.length; i++) {
      expect(msgs[i]).toBeLessThanOrEqual(msgs[i - 1]);
    }
  });
});
