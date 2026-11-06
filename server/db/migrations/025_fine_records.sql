
BEGIN;

CREATE TABLE IF NOT EXISTS public.fines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    fine_number VARCHAR(50) NOT NULL UNIQUE,

    fine_rule_id UUID NOT NULL
        REFERENCES public.fine_rules(id),

    member_id UUID NOT NULL
        REFERENCES public.users(id),

    -- Historical snapshot of the rule at the time the fine is issued.
    rule_code VARCHAR(50) NOT NULL,
    rule_version INTEGER NOT NULL,
    rule_title VARCHAR(150) NOT NULL,
    rule_description TEXT NOT NULL,
    rule_conditions TEXT NOT NULL,

    assessed_amount NUMERIC(14,2) NOT NULL
        CHECK (assessed_amount > 0),

    currency CHAR(3) NOT NULL DEFAULT 'KES',

    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date DATE,

    status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
        CHECK (
            status IN ('unpaid', 'partially_paid', 'paid')
        ),

    recorded_by UUID NOT NULL
        REFERENCES public.users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fines_member
    ON public.fines(member_id);

CREATE INDEX IF NOT EXISTS idx_fines_rule
    ON public.fines(fine_rule_id);

CREATE INDEX IF NOT EXISTS idx_fines_status
    ON public.fines(status);

CREATE INDEX IF NOT EXISTS idx_fines_issued_at
    ON public.fines(issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_fines_due_date
    ON public.fines(due_date);

CREATE INDEX IF NOT EXISTS idx_fines_recorded_by
    ON public.fines(recorded_by);

CREATE INDEX IF NOT EXISTS idx_fines_member_status
    ON public.fines(member_id, status);

CREATE INDEX IF NOT EXISTS idx_fines_rule_version
    ON public.fines(rule_code, rule_version);

COMMIT;