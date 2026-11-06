BEGIN;

CREATE TEMP TABLE welfare_ledger_transaction_backfill
ON COMMIT DROP AS
WITH unlinked_deposits AS (
    SELECT entry.*,
           ROW_NUMBER() OVER (
               PARTITION BY entry.member_user_id, entry.amount, entry.created_at
               ORDER BY entry.id
           ) AS matching_rank
    FROM welfare_ledger_entries entry
    WHERE entry.entry_type = 'deposit'
      AND entry.source_transaction_id IS NULL
),
matching_reversals AS (
    SELECT member_user_id, amount, created_at, COUNT(*) AS reversal_count
    FROM welfare_ledger_entries
    WHERE entry_type = 'reversal'
    GROUP BY member_user_id, amount, created_at
)
SELECT
    entry.id AS ledger_entry_id,
    gen_random_uuid() AS transaction_id,
    entry.member_user_id,
    entry.amount,
    entry.created_at,
    entry.source_payment_reference,
    entry.recorded_by,
    entry.description,
    member.full_name AS entered_member_name
FROM unlinked_deposits entry
JOIN users member ON member.id = entry.member_user_id
LEFT JOIN matching_reversals reversal
  ON reversal.member_user_id = entry.member_user_id
 AND reversal.amount = entry.amount
 AND reversal.created_at = entry.created_at
WHERE entry.matching_rank > COALESCE(reversal.reversal_count, 0);

WITH ranked_entries AS (
    SELECT backfill.*,
           CASE
             WHEN source_payment_reference IS NOT NULL
               THEN UPPER(BTRIM(source_payment_reference))
             ELSE NULL
           END AS normalized_reference,
           ROW_NUMBER() OVER (
             PARTITION BY UPPER(BTRIM(source_payment_reference))
             ORDER BY created_at, ledger_entry_id
           ) AS reference_rank
    FROM welfare_ledger_transaction_backfill backfill
)
INSERT INTO welfare_transactions (
    id, member_user_id, entered_member_name, amount, paid_at,
    mpesa_reference, normalized_mpesa_reference, status, notes,
    created_by, updated_by, created_at, updated_at
)
SELECT ranked.transaction_id,
       ranked.member_user_id,
       ranked.entered_member_name,
       ranked.amount,
       ranked.created_at,
       ranked.source_payment_reference,
       CASE
         WHEN ranked.normalized_reference IS NOT NULL
          AND ranked.reference_rank = 1
          AND NOT EXISTS (
              SELECT 1
              FROM welfare_transactions existing
              WHERE existing.normalized_mpesa_reference = ranked.normalized_reference
          )
         THEN ranked.normalized_reference
         ELSE NULL
       END,
       'active',
       ranked.description,
       ranked.recorded_by,
       ranked.recorded_by,
       ranked.created_at,
       ranked.created_at
FROM ranked_entries ranked;

UPDATE welfare_ledger_entries entry
SET source_transaction_id = backfill.transaction_id
FROM welfare_ledger_transaction_backfill backfill
WHERE entry.id = backfill.ledger_entry_id;

COMMIT;
