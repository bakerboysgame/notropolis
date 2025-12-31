-- 0013_create_security.sql
CREATE TABLE building_security (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL UNIQUE,

  has_cameras INTEGER DEFAULT 0,
  has_guard_dogs INTEGER DEFAULT 0,
  has_security_guards INTEGER DEFAULT 0,
  has_sprinklers INTEGER DEFAULT 0,

  -- Costs tracked for monthly deduction
  monthly_cost INTEGER DEFAULT 0,

  installed_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (building_id) REFERENCES building_instances(id)
);

CREATE INDEX idx_security_building ON building_security(building_id);
