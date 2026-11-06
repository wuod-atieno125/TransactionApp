BEGIN;

CREATE TABLE IF NOT EXISTS welfare_contribution_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    reason TEXT,
    set_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS welfare_one_active_requirement
    ON welfare_contribution_requirements ((ended_at IS NULL))
    WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS welfare_withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_amount NUMERIC(12, 2) NOT NULL CHECK (requested_amount > 0),
    purpose TEXT NOT NULL CHECK (length(trim(purpose)) BETWEEN 3 AND 1000),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ,
    review_reason TEXT,
    executed_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    executed_at TIMESTAMPTZ,
    requester_snapshot JSONB NOT NULL,
    reviewer_snapshot JSONB,
    CONSTRAINT welfare_withdrawal_review_consistency CHECK (
        (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
        OR
        (status IN ('approved', 'rejected', 'executed')
         AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    ),
    CONSTRAINT welfare_withdrawal_execution_consistency CHECK (
        (status <> 'executed' AND executed_by IS NULL AND executed_at IS NULL)
        OR
        (status = 'executed' AND executed_by IS NOT NULL AND executed_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_welfare_withdrawal_status_created
    ON welfare_withdrawal_requests (status, requested_at DESC);

-- A previous development attempt may have created this table with a
-- different shape. Preserve it and create the canonical welfare ledger.
DO $$
BEGIN
    IF to_regclass('public.welfare_ledger_entries') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM unnest(ARRAY[
               'id', 'member_user_id', 'entry_type', 'amount',
               'balance_before', 'balance_after',
               'welfare_withdrawal_request_id', 'recorded_by',
               'description', 'created_at'
           ]) AS required(column_name)
           WHERE NOT EXISTS (
               SELECT 1
               FROM information_schema.columns
               WHERE table_schema = 'public'
                 AND table_name = 'welfare_ledger_entries'
                 AND column_name = required.column_name
           )
       ) THEN
        ALTER TABLE welfare_ledger_entries
            RENAME TO welfare_ledger_entries_legacy;
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS welfare_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    entry_type VARCHAR(20) NOT NULL
        CHECK (entry_type IN ('deposit', 'deduction', 'withdrawal')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    balance_before NUMERIC(12, 2) NOT NULL CHECK (balance_before >= 0),
    balance_after NUMERIC(12, 2) NOT NULL CHECK (balance_after >= 0),
    welfare_withdrawal_request_id UUID
        REFERENCES welfare_withdrawal_requests(id) ON DELETE RESTRICT,
    recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT welfare_ledger_member_scope CHECK (
        (entry_type IN ('deposit', 'deduction') AND member_user_id IS NOT NULL)
        OR
        (entry_type = 'withdrawal' AND member_user_id IS NULL)
    ),
    CONSTRAINT welfare_ledger_balance_direction CHECK (
        (entry_type = 'deposit' AND balance_after = balance_before + amount)
        OR
        (entry_type IN ('deduction', 'withdrawal')
         AND balance_after = balance_before - amount)
    )
);

CREATE INDEX IF NOT EXISTS idx_welfare_ledger_member_created
    ON welfare_ledger_entries (member_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_welfare_ledger_withdrawal
    ON welfare_ledger_entries (welfare_withdrawal_request_id);

ALTER TABLE notifications
    DROP CONSTRAINT IF EXISTS notifications_event_type_check;

ALTER TABLE notifications
    ADD CONSTRAINT notifications_event_type_check
    CHECK (event_type IN (
        'transaction_created',
        'transaction_updated',
        'pending_approval',
        'member_deletion_requested',
        'member_deletion_approved',
        'member_deletion_rejected',
        'transaction_reversal_requested',
        'app_update_announcement',
        'official_role_removal_request',
        'user_role_changed',
        'audit_logs_cleared',
        'welfare_contribution_recorded',
        'welfare_requirement_changed',
        'welfare_withdrawal_requested',
        'welfare_withdrawal_decided',
        'welfare_withdrawal_executed'
    ));

COMMIT;
