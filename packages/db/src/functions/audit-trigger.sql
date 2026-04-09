-- ============================================================
-- GENERIC AUDIT TRIGGER
-- Apply to any sensitive table with: SELECT create_audit_trigger('table_name');
-- ============================================================

CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    tenant_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    occurred_at
  ) VALUES (
    COALESCE(current_setting('app.current_tenant_id', true)::uuid, '00000000-0000-0000-0000-000000000000'),
    COALESCE(current_setting('app.current_user_id', true)::uuid,   '00000000-0000-0000-0000-000000000000'),
    COALESCE(current_setting('app.current_user_role', true), 'system'),
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_audit_trigger(p_table text)
RETURNS void AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I
     FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn()',
    p_table, p_table
  );
END;
$$ LANGUAGE plpgsql;
