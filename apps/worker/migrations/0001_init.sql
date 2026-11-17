-- Elementos orbitais mais recentes por satélite (formato OMM, do CelesTrak).
CREATE TABLE elements (
  norad_id     INTEGER PRIMARY KEY,
  omm_json     TEXT    NOT NULL,
  epoch_ms     INTEGER NOT NULL,
  fetched_at   INTEGER NOT NULL
);

-- Eventos pré-calculados por célula. O id é estável entre recálculos.
CREATE TABLE events (
  id             TEXT PRIMARY KEY,
  cell_id        TEXT    NOT NULL,
  kind           TEXT    NOT NULL CHECK (kind IN ('pass', 'solar_eclipse')),
  norad_id       INTEGER,
  starts_at      INTEGER NOT NULL,
  peak_at        INTEGER NOT NULL,
  ends_at        INTEGER NOT NULL,
  payload        TEXT    NOT NULL,
  geom_score     REAL    NOT NULL,
  quiet          INTEGER NOT NULL DEFAULT 0,  -- 1 = cai no horário de silêncio (23h às 6h)
  night_key      TEXT    NOT NULL,            -- data local da "noite" a que o evento pertence
  elements_epoch INTEGER,
  computed_at    INTEGER NOT NULL
);
CREATE INDEX events_cell_start ON events (cell_id, starts_at);
CREATE INDEX events_start ON events (starts_at);

-- Único dado pessoal do sistema: a inscrição de push de um dispositivo e a célula (~28 km).
CREATE TABLE subscriptions (
  id           TEXT PRIMARY KEY,
  secret       TEXT    NOT NULL,
  endpoint     TEXT    NOT NULL UNIQUE,
  p256dh       TEXT    NOT NULL,
  auth         TEXT    NOT NULL,
  cell_id      TEXT    NOT NULL,
  min_index    INTEGER NOT NULL DEFAULT 50,
  lead_minutes INTEGER NOT NULL DEFAULT 15,
  allow_night  INTEGER NOT NULL DEFAULT 0,
  weekly_cap   INTEGER NOT NULL DEFAULT 3,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  fail_count   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX subscriptions_cell ON subscriptions (cell_id);

-- Decisão de última hora (20 a 120 min antes): nuvens, índice final, avisar ou não.
CREATE TABLE decisions (
  event_id      TEXT PRIMARY KEY,
  clouds        TEXT,
  quality_index INTEGER NOT NULL,
  decision      TEXT    NOT NULL CHECK (decision IN ('alert', 'skip')),
  reason        TEXT,
  decided_at    INTEGER NOT NULL
);

-- Fila de envio. A chave primária impede alerta duplicado.
CREATE TABLE deliveries (
  event_id        TEXT    NOT NULL,
  subscription_id TEXT    NOT NULL,
  night_key       TEXT    NOT NULL,
  send_at         INTEGER NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'queued', 'sent', 'failed', 'expired')),
  sent_at         INTEGER,
  PRIMARY KEY (event_id, subscription_id)
);
CREATE INDEX deliveries_due ON deliveries (status, send_at);
CREATE INDEX deliveries_sub ON deliveries (subscription_id, night_key);

CREATE TABLE feedback (
  event_id        TEXT    NOT NULL,
  subscription_id TEXT    NOT NULL,
  saw             INTEGER NOT NULL,
  reason          TEXT,
  created_at      INTEGER NOT NULL,
  PRIMARY KEY (event_id, subscription_id)
);

CREATE TABLE weather_cache (
  cell_id    TEXT    NOT NULL,
  hour       INTEGER NOT NULL,   -- hora UTC desde a época (ms / 3.600.000)
  low        REAL    NOT NULL,
  mid        REAL    NOT NULL,
  high       REAL    NOT NULL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (cell_id, hour)
);

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
