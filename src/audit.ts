import { Pool } from "pg";

export interface AuditEntry {
  tool: string;
  inputs: Record<string, unknown>;
  outcome: "success" | "error";
  error?: string;
  actor: string;
}

export type AuditLogger = (entry: AuditEntry) => Promise<void>;

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS audit_log (
    id         BIGSERIAL PRIMARY KEY,
    tool_name  TEXT        NOT NULL,
    inputs     JSONB       NOT NULL,
    outcome    TEXT        NOT NULL,
    error_msg  TEXT,
    actor      TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

const INSERT_SQL = `
  INSERT INTO audit_log (tool_name, inputs, outcome, error_msg, actor)
  VALUES ($1, $2, $3, $4, $5)
`;

export interface AuditRow {
  id: string;
  tool_name: string;
  inputs: Record<string, unknown>;
  outcome: string;
  error_msg: string | null;
  actor: string;
  created_at: string;
}

export type AuditDashboard = (limit: number) => Promise<AuditRow[]>;

export async function createAuditLogger(databaseUrl: string | undefined): Promise<{ log: AuditLogger; dashboard: AuditDashboard }> {
  if (!databaseUrl) {
    return {
      log: async () => {},
      dashboard: async () => [],
    };
  }

  const pool = new Pool({ connectionString: databaseUrl });
  await pool.query(CREATE_TABLE_SQL);

  const log: AuditLogger = async (entry: AuditEntry) => {
    await pool.query(INSERT_SQL, [
      entry.tool,
      JSON.stringify(entry.inputs),
      entry.outcome,
      entry.error ?? null,
      entry.actor,
    ]);
  };

  const dashboard: AuditDashboard = async (limit: number) => {
    const result = await pool.query<AuditRow>(
      "SELECT id, tool_name, inputs, outcome, error_msg, actor, created_at FROM audit_log ORDER BY created_at DESC LIMIT $1",
      [limit],
    );
    return result.rows;
  };

  return { log, dashboard };
}
