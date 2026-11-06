
BEGIN;

CREATE TABLE IF NOT EXISTS public.fine_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    withdrawal_number VARCHAR(50) NOT NULL UNIQUE,

    amount NUMERIC(14,2) NOT NULL
        CHECK (amount > 0),

    currency CHAR(3) NOT NULL DEFAULT 'KES',

    purpose TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'approved',
                'rejected',
                'completed'
            )
        ),

    initiated_by UUID NOT NULL
        REFERENCES public.users(id),

    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    approved_by UUID
        REFERENCES public.users(id),

    approved_at TIMESTAMPTZ,

    rejected_by UUID
        REFERENCES public.users(id),

    rejected_at TIMESTAMPTZ,

    rejection_reason TEXT,

    completed_by UUID
        REFERENCES public.users(id),

    completed_at TIMESTAMPTZ,

    payment_reference VARCHAR(150),

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_withdrawal_approval
        CHECK (
            (approved_by IS NULL AND approved_at IS NULL)
            OR
            (approved_by IS NOT NULL AND approved_at IS NOT NULL)
        ),

    CONSTRAINT chk_withdrawal_rejection
        CHECK (
            (rejected_by IS NULL AND rejected_at IS NULL)
            OR
            (rejected_by IS NOT NULL AND rejected_at IS NOT NULL)
        ),

    CONSTRAINT chk_withdrawal_completion
        CHECK (
            (completed_by IS NULL AND completed_at IS NULL)
            OR
            (completed_by IS NOT NULL AND completed_at IS NOT NULL)
        )
);

CREATE INDEX IF NOT EXISTS idx_fine_withdrawals_status
    ON public.fine_withdrawals(status);

CREATE INDEX IF NOT EXISTS idx_fine_withdrawals_initiated_by
    ON public.fine_withdrawals(initiated_by);

CREATE INDEX IF NOT EXISTS idx_fine_withdrawals_approved_by
    ON public.fine_withdrawals(approved_by);

CREATE INDEX IF NOT EXISTS idx_fine_withdrawals_initiated_at
    ON public.fine_withdrawals(initiated_at DESC);

CREATE INDEX IF NOT EXISTS idx_fine_withdrawals_completed_at
    ON public.fine_withdrawals(completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_fine_withdrawals_status_date
    ON public.fine_withdrawals(status, initiated_at DESC);

CREATE INDEX IF NOT EXISTS idx_fine_withdrawals_payment_reference
    ON public.fine_withdrawals(payment_reference);

COMMIT;