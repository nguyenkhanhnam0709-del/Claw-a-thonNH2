/**
 * AgentBase Memory Service
 * Handles conversation events and long-term memory records
 */

import axios from 'axios';

const MEMORY_API_BASE = 'https://agentbase.api.vngcloud.vn/memory';
const MEMORY_ID = process.env.GREENNODE_MEMORY_ID || 'memory-e286f773-3e70-441b-8638-77bec098e47a';
const STRATEGY_ID = process.env.GREENNODE_MEMORY_STRATEGY_ID || 'ltms-9e897de9-e633-4e47-8de4-bf7806277d64';

// Get token from environment (injected by AgentBase Runtime) or use configured credentials
function getAuthHeaders(): Record<string, string> {
  const clientId = process.env.GREENNODE_CLIENT_ID;
  const clientSecret = process.env.GREENNODE_CLIENT_SECRET;

  if (clientId && clientSecret) {
    // Runtime mode - credentials injected by AgentBase
    return {
      'X-GreenNode-Client-Id': clientId,
      'X-GreenNode-Client-Secret': clientSecret,
    };
  }

  // Local development - use token from script (for manual testing only)
  // In production, always use the injected credentials
  console.warn('[Memory] Warning: Using local token. In production, use GREENNODE_CLIENT_ID/SECRET env vars.');
  return {};
}

// Get token for API calls (handles both runtime and local)
async function getToken(): Promise<string> {
  const clientId = process.env.GREENNODE_CLIENT_ID;
  const clientSecret = process.env.GREENNODE_CLIENT_SECRET;

  if (clientId && clientSecret) {
    // Runtime mode - use IAM token endpoint
    const response = await axios.post(
      'https://signin.vngcloud.vn/realms/iam/protocol/openid-connect/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return response.data.access_token;
  }

  // Fallback: use token script for local development
  // This is a workaround - in production, credentials should be injected
  return '';
}

/**
 * Create a conversation event (user or assistant message)
 */
export async function createEvent(
  actorId: string,
  sessionId: string,
  role: 'user' | 'assistant',
  message: string
): Promise<any> {
  try {
    const token = await getToken();
    const response = await axios.post(
      `${MEMORY_API_BASE}/memories/${MEMORY_ID}/actors/${actorId}/sessions/${sessionId}/events`,
      {
        payload: {
          type: 'conversational',
          role: role,
          message: message,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-GreenNode-AgentBase-User-Id': actorId,
          'X-GreenNode-AgentBase-Session-Id': sessionId,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('[Memory] Error creating event:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Search memory records (long-term facts) by natural language query
 */
export async function searchMemoryRecords(
  actorId: string,
  query: string,
  limit: number = 10
): Promise<any[]> {
  try {
    const token = await getToken();
    const namespace = `/strategies/${STRATEGY_ID}/actors/${actorId}`;

    const response = await axios.post(
      `${MEMORY_API_BASE}/memories/${MEMORY_ID}/memory-records:search?namespace=${encodeURIComponent(namespace)}`,
      {
        query: query,
        limit: limit,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data || [];
  } catch (error: any) {
    console.error('[Memory] Error searching records:', error.response?.data || error.message);
    return [];
  }
}

/**
 * List memory records for an actor
 */
export async function listMemoryRecords(
  actorId: string,
  limit: number = 100
): Promise<any[]> {
  try {
    const token = await getToken();
    const namespace = `/strategies/${STRATEGY_ID}/actors/${actorId}`;

    const response = await axios.get(
      `${MEMORY_API_BASE}/memories/${MEMORY_ID}/memory-records?namespace=${encodeURIComponent(namespace)}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data?.list_data || [];
  } catch (error: any) {
    console.error('[Memory] Error listing records:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Generate memory records from a session (extract facts)
 */
export async function generateMemoryRecordsFromSession(
  actorId: string,
  sessionId: string
): Promise<any> {
  try {
    const token = await getToken();
    const response = await axios.post(
      `${MEMORY_API_BASE}/memories/${MEMORY_ID}/memory-records:generate-from-session?actorId=${actorId}&sessionId=${sessionId}&longTermMemoryStrategyId=${STRATEGY_ID}`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('[Memory] Error generating records:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Insert a memory record directly (for explicit knowledge)
 */
export async function insertMemoryRecordDirectly(
  actorId: string,
  memory: string,
  metadata?: Record<string, any>
): Promise<any> {
  try {
    const token = await getToken();
    const namespace = `/strategies/${STRATEGY_ID}/actors/${actorId}`;

    const response = await axios.post(
      `${MEMORY_API_BASE}/memories/${MEMORY_ID}/memory-records:insert-directly?namespace=${encodeURIComponent(namespace)}`,
      {
        memory: memory,
        metadata: metadata || {},
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('[Memory] Error inserting record:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get session events for context
 */
export async function getSessionEvents(
  actorId: string,
  sessionId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const token = await getToken();
    const response = await axios.get(
      `${MEMORY_API_BASE}/memories/${MEMORY_ID}/actors/${actorId}/sessions/${sessionId}/events?page=1&size=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data?.list_data || [];
  } catch (error: any) {
    console.error('[Memory] Error getting events:', error.response?.data || error.message);
    return [];
  }
}

export default {
  createEvent,
  searchMemoryRecords,
  listMemoryRecords,
  generateMemoryRecordsFromSession,
  insertMemoryRecordDirectly,
  getSessionEvents,
};