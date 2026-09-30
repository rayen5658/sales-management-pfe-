-- ===============================================
-- DASHBOARD MONTHLY GOAL
-- ===============================================
-- Singleton row (id=1) storing a recurring monthly revenue target,
-- shown as a progress bar on the dashboard.
-- ===============================================

CREATE TABLE IF NOT EXISTS dashboard_goal (
  id INTEGER PRIMARY KEY DEFAULT 1,
  monthly_target NUMERIC(12,2) NOT NULL,
  updated_by INTEGER REFERENCES app_user(id),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT dashboard_goal_singleton CHECK (id = 1)
);
