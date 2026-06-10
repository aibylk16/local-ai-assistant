import type { DB } from './types.js'

export const SCHEMA_VERSION = 1

export function applySchema(db: DB): void {
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS permissions (
      category TEXT PRIMARY KEY,
      granted INTEGER NOT NULL DEFAULT 0,
      granted_at TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      actor TEXT NOT NULL,        -- 'user' | 'agent' | 'background'
      action TEXT NOT NULL,       -- e.g. 'permission.grant', 'tool.exec', 'email.send'
      risk TEXT NOT NULL,         -- 'low' | 'medium' | 'high'
      detail TEXT,                -- JSON
      result TEXT                 -- 'ok' | 'denied' | 'error'
    );
    CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts DESC);

    CREATE TABLE IF NOT EXISTS memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      kind TEXT NOT NULL,         -- 'preference' | 'contact' | 'workflow' | 'note' | 'pending'
      key TEXT,                   -- optional dedup key
      title TEXT NOT NULL,
      body_encrypted INTEGER NOT NULL DEFAULT 0,
      body TEXT NOT NULL,         -- encrypted if body_encrypted = 1
      source TEXT,                -- e.g. 'user', 'email', 'chat'
      tags TEXT,                  -- JSON array
      reviewed INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_memory_kind ON memory(kind);
    CREATE INDEX IF NOT EXISTS idx_memory_updated ON memory(updated_at DESC);

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,       -- 'open' | 'in_progress' | 'done' | 'cancelled'
      due_at TEXT,
      detail TEXT
    );

    CREATE TABLE IF NOT EXISTS connector_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,         -- 'email.gmail' | 'email.graph' | 'email.imap' | 'whatsapp.business' | etc
      label TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      config_encrypted INTEGER NOT NULL DEFAULT 0,
      config TEXT NOT NULL,       -- encrypted JSON
      last_sync TEXT
    );

    CREATE TABLE IF NOT EXISTS message_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      external_id TEXT NOT NULL,
      kind TEXT NOT NULL,         -- 'email' | 'whatsapp'
      subject TEXT,
      participants TEXT,          -- JSON
      last_message_at TEXT,
      last_message_from TEXT,
      snippet TEXT,
      state TEXT NOT NULL,        -- 'no_action' | 'needs_reply' | 'waiting' | 'replied' | 'follow_up'
      UNIQUE(account_id, external_id),
      FOREIGN KEY(account_id) REFERENCES connector_accounts(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_thread_state ON message_threads(state);

    CREATE TABLE IF NOT EXISTS pending_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      kind TEXT NOT NULL,         -- 'email.reply' | 'whatsapp.reply' | 'task.follow_up' | etc
      thread_id INTEGER,
      title TEXT NOT NULL,
      summary TEXT,
      suggested_draft TEXT,
      risk TEXT NOT NULL,         -- 'low' | 'medium' | 'high'
      status TEXT NOT NULL,       -- 'pending' | 'approved' | 'sent' | 'dismissed'
      FOREIGN KEY(thread_id) REFERENCES message_threads(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_actions(status);
  `)

  const current = db
    .prepare(`SELECT value FROM schema_meta WHERE key = 'version'`)
    .get() as { value: string } | undefined

  if (!current) {
    db.prepare(`INSERT INTO schema_meta(key, value) VALUES ('version', ?)`).run(
      String(SCHEMA_VERSION),
    )
  }
}
