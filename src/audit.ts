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

export async function createAuditLogger(databaseUrl: string | undefined): Promise<AuditLogger> {
  if (!databaseUrl) {
    return async () => {};
  }

  const pool = new Pool({ connectionString: databaseUrl });
  await pool.query(CREATE_TABLE_SQL);

  return async (entry: AuditEntry) => {
    await pool.query(INSERT_SQL, [
      entry.tool,
      JSON.stringify(entry.inputs),
      entry.outcome,
      entry.error ?? null,
      entry.actor,
    ]);
  };
}
