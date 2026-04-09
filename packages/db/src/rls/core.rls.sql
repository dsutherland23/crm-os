-- ============================================================
-- CORE RLS POLICIES
-- ============================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_outbox ENABLE ROW LEVEL SECURITY;

-- Helper function: get current tenant from session config
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid AS $$
  SELECT current_setting('app.current_tenant_id', true)::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- companies: tenant can only see their own company
CREATE POLICY companies_tenant_isolation ON companies
  FOR ALL USING (id = current_tenant_id());

-- branches: scoped to tenant
CREATE POLICY branches_tenant_isolation ON branches
  FOR ALL USING (tenant_id = current_tenant_id());

-- users: scoped to tenant
CREATE POLICY users_tenant_isolation ON users
  FOR ALL USING (tenant_id = current_tenant_id());

-- feature_flags: scoped to tenant
CREATE POLICY feature_flags_tenant_isolation ON feature_flags
  FOR ALL USING (tenant_id = current_tenant_id());

-- audit_logs: SELECT only; NO UPDATE/DELETE (append-only)
CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY audit_logs_no_update ON audit_logs
  FOR UPDATE USING (false);

CREATE POLICY audit_logs_no_delete ON audit_logs
  FOR DELETE USING (false);

-- event_outbox: service role only (backend manages via service_role key)
CREATE POLICY event_outbox_service_role ON event_outbox
  FOR ALL USING (tenant_id = current_tenant_id());
