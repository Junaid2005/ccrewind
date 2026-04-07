import { ParsedData, ComputedStats, DailyActivity, HistoryEntry } from "@/types";

export function computeStats(data: ParsedData): ComputedStats {
  const { statsCache, history, sessions } = data;

  // Hour Distribution
  const hourDistribution = new Array(24).fill(0);
  if (statsCache?.hourCounts) {
    for (const [hour, count] of Object.entries(statsCache.hourCounts)) {
      hourDistribution[parseInt(hour)] = count;
    }
  }
  for (const entry of history) {
    const hour = new Date(entry.timestamp).getHours();
    hourDistribution[hour]++;
  }
  for (const session of sessions) {
    for (const msg of session.messages) {
      if (msg.type === "user" && msg.timestamp) {
        const hour = new Date(msg.timestamp).getHours();
        hourDistribution[hour]++;
      }
    }
  }
  const peakHour = hourDistribution.indexOf(Math.max(...hourDistribution));
  const peakHourCount = hourDistribution[peakHour];

  // Delegator
  let totalMsgCount = 0;
  let sidechainMessages = 0;
  let agentToolCalls = 0;
  for (const session of sessions) {
    for (const msg of session.messages) {
      if (msg.type === "user" || msg.type === "assistant") {
        totalMsgCount++;
        if (msg.isSidechain) sidechainMessages++;
      }
      if (msg.type === "assistant" && msg.message?.content && Array.isArray(msg.message.content)) {
        for (const block of msg.message.content) {
          if (block.type === "tool_use" && block.name === "Agent") agentToolCalls++;
        }
      }
    }
  }
  const sidechainRatio = totalMsgCount > 0 ? sidechainMessages / totalMsgCount : 0;

  // Arsenal
  const toolCounts: Record<string, number> = {};
  for (const session of sessions) {
    for (const msg of session.messages) {
      if (msg.type === "assistant" && msg.message?.content && Array.isArray(msg.message.content)) {
        for (const block of msg.message.content) {
          if (block.type === "tool_use" && block.name) {
            toolCounts[block.name] = (toolCounts[block.name] || 0) + 1;
          }
        }
      }
    }
  }
  const topTools = Object.entries(toolCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const totalToolCalls = Object.values(toolCounts).reduce((a, b) => a + b, 0);

  // Token Furnace
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheCreationTokens = 0;
  if (statsCache?.modelUsage) {
    for (const usage of Object.values(statsCache.modelUsage)) {
      totalInputTokens += usage.inputTokens || 0;
      totalOutputTokens += usage.outputTokens || 0;
      totalCacheReadTokens += usage.cacheReadInputTokens || 0;
      totalCacheCreationTokens += usage.cacheCreationInputTokens || 0;
    }
  }
  if (totalOutputTokens === 0) {
    for (const session of sessions) {
      for (const msg of session.messages) {
        if (msg.type === "assistant" && msg.message?.usage) {
          totalInputTokens += msg.message.usage.input_tokens || 0;
          totalOutputTokens += msg.message.usage.output_tokens || 0;
          totalCacheReadTokens += msg.message.usage.cache_read_input_tokens || 0;
        }
      }
    }
  }
  const totalTokens = totalInputTokens + totalOutputTokens + totalCacheReadTokens + totalCacheCreationTokens;

  // Estimated Cost (USD) — per-model pricing from Anthropic docs
  const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
    "opus-4-6": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
    "opus-4-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
    "opus-4-1": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
    "opus-4": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
    "opus-3": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
    "sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    "sonnet-4-5": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    "sonnet-4": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    "sonnet-3-7": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    "haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
    "haiku-3-5": { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1.0 },
    "haiku-3": { input: 0.25, output: 1.25, cacheRead: 0.03, cacheWrite: 0.3 },
  };

  function matchPricing(modelId: string) {
    const lower = modelId.toLowerCase();
    for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
      if (lower.includes(key.replace(/-/g, "")) || lower.includes(key)) return pricing;
    }
    // Default to Sonnet 4 pricing
    return MODEL_PRICING["sonnet-4"];
  }

  let estimatedCostUSD = 0;
  const costByModel: Array<{ model: string; cost: number }> = [];

  if (statsCache?.modelUsage) {
    for (const [model, usage] of Object.entries(statsCache.modelUsage)) {
      if (usage.costUSD && usage.costUSD > 0) {
        estimatedCostUSD += usage.costUSD;
        costByModel.push({ model, cost: usage.costUSD });
      } else {
        const p = matchPricing(model);
        const cost =
          ((usage.inputTokens || 0) / 1_000_000) * p.input +
          ((usage.outputTokens || 0) / 1_000_000) * p.output +
          ((usage.cacheReadInputTokens || 0) / 1_000_000) * p.cacheRead +
          ((usage.cacheCreationInputTokens || 0) / 1_000_000) * p.cacheWrite;
        estimatedCostUSD += cost;
        costByModel.push({ model, cost });
      }
    }
  }
  if (estimatedCostUSD === 0 && totalTokens > 0) {
    // Fallback: estimate from aggregate tokens using Sonnet pricing
    const p = MODEL_PRICING["sonnet-4"];
    estimatedCostUSD =
      (totalInputTokens / 1_000_000) * p.input +
      (totalOutputTokens / 1_000_000) * p.output +
      (totalCacheReadTokens / 1_000_000) * p.cacheRead +
      (totalCacheCreationTokens / 1_000_000) * p.cacheWrite;
  }
  costByModel.sort((a, b) => b.cost - a.cost);

  // Loyalty Test
  const modelCounts: Record<string, number> = {};
  if (statsCache?.modelUsage) {
    for (const [model, usage] of Object.entries(statsCache.modelUsage)) {
      if (!model.startsWith("claude-")) continue;
      modelCounts[model] = usage.outputTokens || 0;
    }
  }
  for (const session of sessions) {
    for (const msg of session.messages) {
      if (msg.type === "assistant" && msg.message?.model) {
        const model = msg.message.model;
        if (!model.startsWith("claude-")) continue;
        modelCounts[model] = (modelCounts[model] || 0) + 1;
      }
    }
  }
  const modelEntries = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]);
  const totalModelUsage = modelEntries.reduce((a, b) => a + b[1], 0);
  const primaryModel = modelEntries[0]?.[0] || "unknown";
  const primaryModelPercentage = totalModelUsage > 0 ? (modelEntries[0]?.[1] || 0) / totalModelUsage : 0;
  const modelCount = modelEntries.length;

  // Thinking Hours
  let totalThinkingMs = 0;
  const responseTimes: number[] = [];
  for (const session of sessions) {
    const msgs = session.messages
      .filter((m) => (m.type === "user" || m.type === "assistant") && m.timestamp)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    for (let i = 0; i < msgs.length - 1; i++) {
      if (msgs[i].type === "user" && msgs[i + 1].type === "assistant") {
        const diff = new Date(msgs[i + 1].timestamp).getTime() - new Date(msgs[i].timestamp).getTime();
        if (diff > 0 && diff < 600000) {
          totalThinkingMs += diff;
          responseTimes.push(diff);
        }
      }
    }
  }
  const avgResponseTimeMs =
    responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
  const maxResponseTimeMs = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;

  // Commit History
  // Build slug→realPath lookup: history uses "/home/jjay786/dev/x", sessions use "-home-jjay786-dev-x"
  const slugToPath: Record<string, string> = {};
  const projectSet = new Set<string>();
  const branchSet = new Set<string>();
  const projectActivity: Record<string, number> = {};
  // Build slug→realPath from history so we can resolve session folder names.
  // Always replace \, / and : so Windows drive letters (C:\ or C:/) slug correctly
  // regardless of whether history.jsonl stores backslashes or forward slashes.
  const pathToSlug = (p: string) => p.replaceAll("\\", "-").replaceAll("/", "-").replaceAll(":", "-");
  for (const entry of history) {
    if (entry.project) {
      slugToPath[pathToSlug(entry.project)] = entry.project;
      projectSet.add(entry.project);
    }
  }
  const resolveProject = (sessionPath: string): string => slugToPath[sessionPath] || sessionPath;
  const projectTokens: Record<string, number> = {};
  const projectSessions: Record<string, number> = {};
  for (const session of sessions) {
    const proj = session.projectPath ? resolveProject(session.projectPath) : null;
    if (proj) {
      projectSet.add(proj);
      projectSessions[proj] = (projectSessions[proj] || 0) + 1;
    }
    for (const msg of session.messages) {
      if (msg.gitBranch && msg.gitBranch !== "HEAD") branchSet.add(msg.gitBranch);
      // Count user+assistant messages per project (same method as totalMsgCount)
      if (proj && (msg.type === "user" || msg.type === "assistant")) {
        projectActivity[proj] = (projectActivity[proj] || 0) + 1;
      }
      if (proj && msg.type === "assistant" && msg.message?.usage) {
        const u = msg.message.usage;
        projectTokens[proj] =
          (projectTokens[proj] || 0) +
          (u.input_tokens || 0) +
          (u.output_tokens || 0) +
          (u.cache_read_input_tokens || 0);
      }
    }
  }
  const topProjectStats = Array.from(projectSet)
    .map((fullPath) => ({
      name:
        fullPath
          .split(fullPath.includes("\\") ? "\\" : "/")
          .filter(Boolean)
          .at(-1) ?? fullPath,
      messages: projectActivity[fullPath] || 0,
      tokens: projectTokens[fullPath] || 0,
      sessions: projectSessions[fullPath] || 0,
    }))
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 5);

  // Sharpshooter
  const promptLengths = history.map((h) => h.display?.length || 0);
  const avgPromptLength =
    promptLengths.length > 0 ? promptLengths.reduce((a, b) => a + b, 0) / promptLengths.length : 0;
  const sortedLengths = [...promptLengths].sort((a, b) => a - b);
  const medianPromptLength = sortedLengths.length > 0 ? sortedLengths[Math.floor(sortedLengths.length / 2)] : 0;
  const sessionMessageCounts = sessions.map(
    (s) => s.messages.filter((m) => m.type === "user" || m.type === "assistant").length
  );
  const avgMessagesPerSession =
    sessionMessageCounts.length > 0 ? sessionMessageCounts.reduce((a, b) => a + b, 0) / sessionMessageCounts.length : 0;

  // Streak
  const dailyActivity: DailyActivity[] = statsCache?.dailyActivity || [];
  const activeDatesSet = new Set<string>();
  for (const day of dailyActivity) {
    if (day.messageCount > 0) activeDatesSet.add(day.date);
  }
  for (const entry of history) {
    activeDatesSet.add(new Date(entry.timestamp).toISOString().split("T")[0]);
  }
  for (const session of sessions) {
    for (const msg of session.messages) {
      if (msg.timestamp && (msg.type === "user" || msg.type === "assistant")) {
        activeDatesSet.add(new Date(msg.timestamp).toISOString().split("T")[0]);
      }
    }
  }
  const activeDates = Array.from(activeDatesSet).sort();
  const { longest, current } = computeStreaks(activeDates);

  // Stop Reason
  const stopReasonCounts: Record<string, number> = {};
  for (const session of sessions) {
    for (const msg of session.messages) {
      if (msg.type === "assistant" && msg.message?.stop_reason) {
        const reason = msg.message.stop_reason;
        stopReasonCounts[reason] = (stopReasonCounts[reason] || 0) + 1;
      }
    }
  }
  const totalStopReasons = Object.values(stopReasonCounts).reduce((a, b) => a + b, 0);
  const toolUseRatio = totalStopReasons > 0 ? (stopReasonCounts["tool_use"] || 0) / totalStopReasons : 0;
  const endTurnRatio = totalStopReasons > 0 ? (stopReasonCounts["end_turn"] || 0) / totalStopReasons : 0;

  // Retry Spiral Index
  const { rsi, clusters: retryClusters, totalRetries } = computeRSI(history);

  const totalSessions = statsCache?.totalSessions || sessions.length;
  const firstSessionDate = statsCache?.firstSessionDate || activeDates[0] || "";
  const lastSessionDate = activeDates[activeDates.length - 1] || "";
  const daysActive = activeDates.length;

  return {
    hourDistribution,
    peakHour,
    peakHourCount,
    totalMessages: totalMsgCount || statsCache?.totalMessages || 0,
    sidechainMessages,
    sidechainRatio,
    agentToolCalls,
    toolCounts,
    topTools,
    totalToolCalls,
    totalInputTokens,
    totalOutputTokens,
    totalCacheReadTokens,
    totalCacheCreationTokens,
    totalTokens,
    modelCounts,
    primaryModel,
    primaryModelPercentage,
    modelCount,
    estimatedThinkingTimeMs: totalThinkingMs,
    avgResponseTimeMs,
    maxResponseTimeMs,
    uniqueProjects: Array.from(projectSet),
    uniqueBranches: Array.from(branchSet),
    projectCount: projectSet.size,
    branchCount: branchSet.size,
    projectActivity,
    avgPromptLength,
    avgMessagesPerSession,
    medianPromptLength,
    longestStreak: longest,
    currentStreak: current,
    totalActiveDays: daysActive,
    dailyActivity: statsCache?.dailyActivity || [],
    activeDates,
    stopReasonCounts,
    toolUseRatio,
    endTurnRatio,
    totalSessions,
    firstSessionDate,
    lastSessionDate,
    daysActive,
    longestSessionMessages: statsCache?.longestSession?.messageCount || 0,
    longestSessionDurationMs: statsCache?.longestSession?.duration || 0,
    retrySpiral: rsi,
    retryClusters,
    totalRetries,
    topProjectStats,
    estimatedCostUSD: Math.round(estimatedCostUSD * 100) / 100,
    costByModel,
    username: extractUsername(history, sessions),
  };
}

function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(
    a
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
  const wordsB = new Set(
    b
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  const union = wordsA.size + wordsB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function computeRSI(history: HistoryEntry[]): { rsi: number; clusters: number; totalRetries: number } {
  const meaningful = history.filter((h) => (h.display?.length || 0) > 5);
  if (meaningful.length < 2)
    return { rsi: 1.0, clusters: Math.max(1, meaningful.length), totalRetries: meaningful.length };

  const sorted = [...meaningful].sort((a, b) => a.timestamp - b.timestamp);
  const clusterSizes: number[] = [];
  let currentSize = 1;

  for (let i = 1; i < sorted.length; i++) {
    const timeDiff = sorted[i].timestamp - sorted[i - 1].timestamp;
    const textA = sorted[i - 1].display || "";
    const textB = sorted[i].display || "";

    const withinTime = timeDiff < 20 * 60 * 1000; // 20 minutes
    const similarity = jaccardSimilarity(textA, textB);

    if (withinTime && similarity > 0.3) {
      currentSize++;
    } else {
      clusterSizes.push(currentSize);
      currentSize = 1;
    }
  }
  clusterSizes.push(currentSize);

  const rsi = clusterSizes.reduce((a, b) => a + b, 0) / clusterSizes.length;
  return { rsi: Math.round(rsi * 10) / 10, clusters: clusterSizes.length, totalRetries: sorted.length };
}

function computeStreaks(sortedDates: string[]): { longest: number; current: number } {
  if (sortedDates.length === 0) return { longest: 0, current: 0 };

  let longest = 1;
  let streakLength = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      streakLength++;
    } else {
      streakLength = 1;
    }
    if (streakLength > longest) longest = streakLength;
  }

  let current = 1;
  for (let i = sortedDates.length - 1; i > 0; i--) {
    const curr = new Date(sortedDates[i]);
    const prev = new Date(sortedDates[i - 1]);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      current++;
    } else {
      break;
    }
  }

  return { longest, current };
}

function extractUsername(history: HistoryEntry[], sessions: { messages: { cwd?: string }[] }[]): string {
  // Try cwd from sessions first, then project paths from history
  for (const session of sessions) {
    for (const msg of session.messages) {
      if (msg.cwd) {
        // /home/username/... or /Users/username/... or C:\Users\username\...
        const match = msg.cwd.match(/^(?:\/(?:home|Users)\/|[A-Za-z]:\\[Uu]sers\\)([^/\\]+)/);
        if (match) return match[1];
      }
    }
  }
  for (const entry of history) {
    if (entry.project) {
      const match = entry.project.match(/^(?:\/(?:home|Users)\/|[A-Za-z]:\\[Uu]sers\\)([^/\\]+)/);
      if (match) return match[1];
    }
  }
  return "";
}
