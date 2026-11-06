BEGIN;

-- Tracks which fine-payment collections funded a withdrawal.
CREATE TABLE IF NOT EXISTS public.fine_withdrawal_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    withdrawal_id UUID NOT NULL
        REFERENCES public.fine_withdrawals(id),

    fine_payment_id UUID NOT NULL
        REFERENCES public.fine_payments(id),

    allocated_amount NUMERIC(14,2) NOT NULL
        CHECK (allocated_amount > 0),

    allocated_by UUID NOT NULL
        REFERENCES public.users(id),

    allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_withdrawal_payment_allocation
        UNIQUE (withdrawal_id, fine_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_allocations_withdrawal
    ON public.fine_withdrawal_allocations(withdrawal_id);

CREATE INDEX IF NOT EXISTS idx_withdrawal_allocations_payment
    ON public.fine_withdrawal_allocations(fine_payment_id);

CREATE INDEX IF NOT EXISTS idx_withdrawal_allocations_allocated_by
    ON public.fine_withdrawal_allocations(allocated_by);

CREATE INDEX IF NOT EXISTS idx_withdrawal_allocations_date
    ON public.fine_withdrawal_allocations(allocated_at DESC);

-- Records all fine-fund inflows and outflows.
CREATE TABLE IF NOT EXISTS public.fine_fund_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    movement_type VARCHAR(20) NOT NULL
        CHECK (movement_type IN ('credit', 'debit')),

    amount NUMERIC(14,2) NOT NULL
        CHECK (amount > 0),

    currency CHAR(3) NOT NULL DEFAULT 'KES',

    fine_payment_id UUID
        REFERENCES public.fine_payments(id),

    withdrawal_id UUID
        REFERENCES public.fine_withdrawals(id),

    description TEXT,

    recorded_by UUID NOT NULL
        REFERENCES public.users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_fine_fund_movement_source
        CHECK (
            (
                movement_type = 'credit'
                AND fine_payment_id IS NOT NULL
                AND withdrawal_id IS NULL
            )
            OR
            (
                movement_type = 'debit'
                AND withdrawal_id IS NOT NULL
                AND fine_payment_id IS NULL
            )
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fine_fund_credit_payment
    ON public.fine_fund_movements(fine_payment_id)
    WHERE fine_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fine_fund_debit_withdrawal
    ON public.fine_fund_movements(withdrawal_id)
    WHERE withdrawal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fine_fund_movements_type
    ON public.fine_fund_movements(movement_type);

CREATE INDEX IF NOT EXISTS idx_fine_fund_movements_date
    ON public.fine_fund_movements(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fine_fund_movements_recorded_by
    ON public.fine_fund_movements(recorded_by);

CREATE INDEX IF NOT EXISTS idx_fine_fund_movements_payment
    ON public.fine_fund_movements(fine_payment_id);

CREATE INDEX IF NOT EXISTS idx_fine_fund_movements_withdrawal
    ON public.fine_fund_movements(withdrawal_id);

CREATE OR REPLACE VIEW public.fine_fund_balance AS
SELECT
    COALESCE(
        SUM(
            CASE
                WHEN movement_type = 'credit' THEN amount
                WHEN movement_type = 'debit' THEN -amount
                ELSE 0
            END
        ),
        0
    )::NUMERIC(14,2) AS available_balance
FROM public.fine_fund_movements;

COMMIT;