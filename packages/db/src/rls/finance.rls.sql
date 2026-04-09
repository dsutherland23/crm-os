-- ============================================================
-- FINANCE RLS POLICIES
-- ============================================================

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- chart_of_accounts
CREATE POLICY coa_tenant_isolation ON chart_of_accounts
  FOR ALL USING (tenant_id = current_tenant_id());

-- journal_entries: insert + select only
CREATE POLICY journal_entries_select ON journal_entries
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY journal_entries_insert ON journal_entries
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY journal_entries_no_update ON journal_entries
  FOR UPDATE USING (false);

CREATE POLICY journal_entries_no_delete ON journal_entries
  FOR DELETE USING (false);

-- journal_lines: immutable ledger
CREATE POLICY journal_lines_select ON journal_lines
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY journal_lines_insert ON journal_lines
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY journal_lines_no_update ON journal_lines
  FOR UPDATE USING (false);

CREATE POLICY journal_lines_no_delete ON journal_lines
  FOR DELETE USING (false);

-- invoices
CREATE POLICY invoices_tenant_isolation ON invoices
  FOR ALL USING (tenant_id = current_tenant_id());

-- payments
CREATE POLICY payments_tenant_isolation ON payments
  FOR ALL USING (tenant_id = current_tenant_id());
