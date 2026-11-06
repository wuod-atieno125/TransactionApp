BEGIN;

ALTER TABLE welfare_ledger_entries
    ADD COLUMN IF NOT EXISTS source_transaction_id UUID
        REFERENCES transactions(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS source_payment_reference VARCHAR(100);

ALTER TABLE welfare_ledger_entries
    DROP CONSTRAINT IF EXISTS welfare_ledger_entry_type_check,
    DROP CONSTRAINT IF EXISTS welfare_ledger_entries_entry_type_check1,
    DROP CONSTRAINT IF EXISTS welfare_ledger_member_scope,
    DROP CONSTRAINT IF EXISTS welfare_ledger_balance_direction;

ALTER TABLE welfare_ledger_entries
    ADD CONSTRAINT welfare_ledger_entry_type_check
        CHECK (entry_type IN ('deposit', 'deduction', 'withdrawal', 'reversal')),
    ADD CONSTRAINT welfare_ledger_member_scope CHECK (
        (entry_type IN ('deposit', 'deduction', 'reversal') AND member_user_id IS NOT NULL)
        OR
        (entry_type = 'withdrawal' AND member_user_id IS NULL)
    ),
    ADD CONSTRAINT welfare_ledger_balance_direction CHECK (
        (entry_type = 'deposit' AND balance_after = balance_before + amount)
        OR
        (entry_type IN ('deduction', 'withdrawal', 'reversal')
         AND balance_after = balance_before - amount)
    );

CREATE UNIQUE INDEX IF NOT EXISTS welfare_ledger_source_transaction_unique
    ON welfare_ledger_entries (source_transaction_id)
    WHERE source_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS welfare_ledger_source_reference
    ON welfare_ledger_entries (source_payment_reference);

WITH ordered_transactions AS (
    SELECT
        t.*,
        COALESCE(
            SUM(t.amount)
            OVER (
                PARTITION BY t.member_user_id
                ORDER BY t.paid_at, t.created_at, t.id
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ),
            0
        ) AS balance_before
    FROM transactions t
    WHERE t.member_user_id IS NOT NULL AND t.status = 'active'
),
converted AS (
    SELECT
        id AS source_transaction_id,
        member_user_id,
        amount,
        balance_before,
        balance_before + amount AS balance_after,
        paid_at,
        mpesa_reference,
        created_by,
        entered_member_name
    FROM ordered_transactions
)
INSERT INTO welfare_ledger_entries (
    member_user_id,
    entry_type,
    amount,
    balance_before,
    balance_after,
    recorded_by,
    description,
    created_at,
    source_transaction_id,
    source_payment_reference
)
SELECT
    member_user_id,
    'deposit',
    amount,
    balance_before,
    balance_after,
    created_by,
    'Converted from legacy transaction: ' || entered_member_name,
    paid_at,
    source_transaction_id,
    mpesa_reference
FROM converted
ON CONFLICT DO NOTHING;

INSERT INTO welfare_ledger_entries (
    member_user_id, entry_type, amount, balance_before, balance_after,
    recorded_by, description, created_at
)
SELECT
    t.member_user_id,
    'deposit',
    t.amount,
    0,
    t.amount,
    t.created_by,
    'Original value of reversed legacy transaction: ' || t.entered_member_name,
    t.paid_at
FROM transactions t
WHERE t.member_user_id IS NOT NULL
  AND t.status = 'reversed'
  AND NOT EXISTS (
      SELECT 1
      FROM welfare_ledger_entries e
      WHERE e.description = 'Original value of reversed legacy transaction: ' || t.entered_member_name
        AND e.created_at = t.paid_at
  );

INSERT INTO welfare_ledger_entries (
    member_user_id, entry_type, amount, balance_before, balance_after,
    recorded_by, description, created_at, source_transaction_id, source_payment_reference
)
SELECT
    t.member_user_id,
    'reversal',
    t.amount,
    t.amount,
    0,
    t.created_by,
    'Reversal of legacy transaction: ' || t.entered_member_name,
    t.paid_at,
    t.id,
    t.mpesa_reference
FROM transactions t
WHERE t.member_user_id IS NOT NULL
  AND t.status = 'reversed'
ON CONFLICT DO NOTHING;

COMMIT;
