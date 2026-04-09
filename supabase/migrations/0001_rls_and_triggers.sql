-- ============================================================
-- CRM OS — RLS Policies + DB Triggers
-- Apply this AFTER the main schema migration (0000_*)
-- Run in Supabase SQL Editor or via supabase db push
-- ============================================================

-- Helper function: get current tenant from session config
-- Called by all RLS policies (set by API middleware per request)
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid AS $$
  SELECT current_setting('app.current_tenant_id', true)::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- CORE RLS POLICIES
-- ============================================================

ALTER TABLE companies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_outbox     ENABLE ROW LEVEL SECURITY;

-- companies: tenant sees only their own row
CREATE POLICY companies_tenant_isolation ON companies
  FOR ALL USING (id = current_tenant_id());

-- branches
CREATE POLICY branches_tenant_isolation ON branches
  FOR ALL USING (tenant_id = current_tenant_id());

-- users
CREATE POLICY users_tenant_isolation ON users
  FOR ALL USING (tenant_id = current_tenant_id());

-- feature_flags
CREATE POLICY feature_flags_tenant_isolation ON feature_flags
  FOR ALL USING (tenant_id = current_tenant_id());

-- audit_logs: SELECT + INSERT only — NO UPDATE or DELETE (append-only)
CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY audit_logs_no_update ON audit_logs
  FOR UPDATE USING (false);

CREATE POLICY audit_logs_no_delete ON audit_logs
  FOR DELETE USING (false);

-- event_outbox
CREATE POLICY event_outbox_tenant_isolation ON event_outbox
  FOR ALL USING (tenant_id = current_tenant_id());

-- ============================================================
-- CRM RLS
-- ============================================================

ALTER TABLE customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notes  ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_tenant_isolation ON customers
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY customer_notes_tenant_isolation ON customer_notes
  FOR ALL USING (tenant_id = current_tenant_id());

-- ============================================================
-- PRODUCTS + INVENTORY RLS
-- ============================================================

ALTER TABLE categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements  ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_tenant_isolation ON categories
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY products_tenant_isolation ON products
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY product_variants_tenant_isolation ON product_variants
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY suppliers_tenant_isolation ON suppliers
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY inventory_tenant_isolation ON inventory
  FOR ALL USING (tenant_id = current_tenant_id());

-- inventory_movements: append-only (no UPDATE/DELETE)
CREATE POLICY inventory_movements_select ON inventory_movements
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY inventory_movements_insert ON inventory_movements
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY inventory_movements_no_update ON inventory_movements
  FOR UPDATE USING (false);

CREATE POLICY inventory_movements_no_delete ON inventory_movements
  FOR DELETE USING (false);

-- ============================================================
-- FINANCE RLS
-- ============================================================

ALTER TABLE chart_of_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;

CREATE POLICY coa_tenant_isolation ON chart_of_accounts
  FOR ALL USING (tenant_id = current_tenant_id());

-- journal_entries: immutable ledger — INSERT + SELECT only
CREATE POLICY journal_entries_select ON journal_entries
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY journal_entries_insert ON journal_entries
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY journal_entries_no_update ON journal_entries
  FOR UPDATE USING (false);

CREATE POLICY journal_entries_no_delete ON journal_entries
  FOR DELETE USING (false);

-- journal_lines: immutable
CREATE POLICY journal_lines_select ON journal_lines
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY journal_lines_insert ON journal_lines
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY journal_lines_no_update ON journal_lines
  FOR UPDATE USING (false);

CREATE POLICY journal_lines_no_delete ON journal_lines
  FOR DELETE USING (false);

CREATE POLICY invoices_tenant_isolation ON invoices
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY payments_tenant_isolation ON payments
  FOR ALL USING (tenant_id = current_tenant_id());

-- ============================================================
-- POS + PRICING RLS
-- ============================================================

ALTER TABLE pos_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transaction_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_rules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_price_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY pos_sessions_tenant_isolation ON pos_sessions
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY pos_transactions_tenant_isolation ON pos_transactions
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY pos_transaction_items_tenant_isolation ON pos_transaction_items
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY price_rules_tenant_isolation ON price_rules
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY customer_price_overrides_tenant_isolation ON customer_price_overrides
  FOR ALL USING (tenant_id = current_tenant_id());

-- ============================================================
-- DOUBLE-ENTRY ACCOUNTING ENFORCEMENT TRIGGER
-- Fires AFTER each journal_line INSERT (deferred) — last line of defense
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_double_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_debit_sum  BIGINT;
  v_credit_sum BIGINT;
BEGIN
  SELECT
    COALESCE(SUM(debit_cents), 0),
    COALESCE(SUM(credit_cents), 0)
  INTO v_debit_sum, v_credit_sum
  FROM journal_lines
  WHERE journal_entry_id = NEW.journal_entry_id;

  IF v_debit_sum <> v_credit_sum THEN
    RAISE EXCEPTION
      'Double-entry violation on journal_entry (%): debit=% credit=%',
      NEW.journal_entry_id, v_debit_sum, v_credit_sum;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE CONSTRAINT TRIGGER enforce_double_entry_trigger
  AFTER INSERT ON journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION enforce_double_entry();

-- ============================================================
-- GENERIC AUDIT TRIGGER
-- SELECT create_audit_trigger('table_name') to enable on any table
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

-- Enable audit triggers on the most sensitive tables
SELECT create_audit_trigger('customers');
SELECT create_audit_trigger('invoices');
SELECT create_audit_trigger('payments');
SELECT create_audit_trigger('journal_entries');
SELECT create_audit_trigger('feature_flags');
