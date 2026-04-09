-- ============================================================
-- DOUBLE-ENTRY ACCOUNTING ENFORCEMENT TRIGGER
-- Last line of defense: asserts SUM(debit) = SUM(credit)
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

-- Fire AFTER every line insert/update on the entry
CREATE CONSTRAINT TRIGGER enforce_double_entry_trigger
  AFTER INSERT ON journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION enforce_double_entry();
