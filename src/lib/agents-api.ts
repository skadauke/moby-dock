/**
 * Agent discovery API client
 *
 * Fetches the list of configured OpenClaw agents and their identity info.
 *
 * @module lib/agents-api
 */

import { useState, useEffect } from "react";

export interface AgentInfo {
  id: string;
  name: string;
  workspace: string;
  emoji?: string;
  isDefault: boolean;
}

interface AgentsResponse {
  agents: AgentInfo[];
}

export async function fetchAgents(): Promise<AgentInfo[]> {
  const res = await fetch("/api/agents", {
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || "Failed to fetch agents");
  }

  const data: AgentsResponse = await res.json();
  return data.agents;
}

/**
 * React hook to fetch and cache the agent list.
 * Returns { agents, loading, error }.
 */
export function useAgents() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchAgents()
      .then((data) => {
        if (!cancelled) {
          setAgents(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { agents, loading, error };
}

/**
 * Find an agent by id from a list.
 */
export function getAgentById(
  agents: AgentInfo[],
  agentId: string
): AgentInfo | undefined {
  return agents.find((a) => a.id === agentId);
}

/**
 * Get the default agent from a list.
 */
export function getDefaultAgent(agents: AgentInfo[]): AgentInfo | undefined {
  return agents.find((a) => a.isDefault) ?? agents[0];
}
