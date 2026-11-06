BEGIN;

ALTER TABLE IF EXISTS transactions
    RENAME TO welfare_transactions;

ALTER TABLE IF EXISTS transaction_reversal_requests
    RENAME TO welfare_reversal_requests;

ALTER INDEX IF EXISTS idx_transactions_member_paid_at
    RENAME TO idx_welfare_transactions_member_paid_at;

ALTER INDEX IF EXISTS idx_transactions_paid_at
    RENAME TO idx_welfare_transactions_paid_at;

ALTER INDEX IF EXISTS idx_transactions_status_paid_at
    RENAME TO idx_welfare_transactions_status_paid_at;

ALTER INDEX IF EXISTS idx_transactions_created_by_created_at
    RENAME TO idx_welfare_transactions_created_by_created_at;

CREATE OR REPLACE VIEW transactions AS
SELECT * FROM welfare_transactions;

CREATE OR REPLACE VIEW transaction_reversal_requests AS
SELECT * FROM welfare_reversal_requests;

CREATE OR REPLACE FUNCTION welfare_transactions_compat_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO welfare_transactions
    SELECT NEW.*;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION welfare_transactions_compat_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE welfare_transactions
    SET member_user_id = NEW.member_user_id,
        entered_member_name = NEW.entered_member_name,
        amount = NEW.amount,
        paid_at = NEW.paid_at,
        mpesa_reference = NEW.mpesa_reference,
        normalized_mpesa_reference = NEW.normalized_mpesa_reference,
        status = NEW.status,
        notes = NEW.notes,
        created_by = NEW.created_by,
        updated_by = NEW.updated_by,
        created_at = NEW.created_at,
        updated_at = NEW.updated_at
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION welfare_reversal_requests_compat_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO welfare_reversal_requests
    SELECT NEW.*;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION welfare_reversal_requests_compat_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE welfare_reversal_requests
    SET status = NEW.status,
        reviewed_by = NEW.reviewed_by,
        reviewed_at = NEW.reviewed_at,
        treasurer_reviewed_by = NEW.treasurer_reviewed_by,
        treasurer_reviewed_at = NEW.treasurer_reviewed_at
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_compat_insert ON transactions;
CREATE TRIGGER transactions_compat_insert
INSTEAD OF INSERT ON transactions
FOR EACH ROW EXECUTE FUNCTION welfare_transactions_compat_insert();

DROP TRIGGER IF EXISTS transactions_compat_update ON transactions;
CREATE TRIGGER transactions_compat_update
INSTEAD OF UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION welfare_transactions_compat_update();

DROP TRIGGER IF EXISTS transaction_reversal_requests_compat_insert
    ON transaction_reversal_requests;
CREATE TRIGGER transaction_reversal_requests_compat_insert
INSTEAD OF INSERT ON transaction_reversal_requests
FOR EACH ROW EXECUTE FUNCTION welfare_reversal_requests_compat_insert();

DROP TRIGGER IF EXISTS transaction_reversal_requests_compat_update
    ON transaction_reversal_requests;
CREATE TRIGGER transaction_reversal_requests_compat_update
INSTEAD OF UPDATE ON transaction_reversal_requests
FOR EACH ROW EXECUTE FUNCTION welfare_reversal_requests_compat_update();

COMMIT;
