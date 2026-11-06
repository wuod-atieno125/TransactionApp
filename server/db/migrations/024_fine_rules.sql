
BEGIN;

CREATE TABLE IF NOT EXISTS public.fine_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    rule_code VARCHAR(50) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,

    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    conditions TEXT NOT NULL,

    fine_amount NUMERIC(14,2) NOT NULL
        CHECK (fine_amount > 0),

    currency CHAR(3) NOT NULL DEFAULT 'KES',

    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ,

    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'retired')),

    supersedes_rule_id UUID
        REFERENCES public.fine_rules(id),

    created_by UUID NOT NULL REFERENCES public.users(id),
    updated_by UUID REFERENCES public.users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_fine_rule_version
        UNIQUE (rule_code, version),

    CONSTRAINT chk_fine_rule_dates
        CHECK (
            effective_to IS NULL
            OR effective_to > effective_from
        ),

    CONSTRAINT chk_fine_rule_supersedes
        CHECK (
            supersedes_rule_id IS NULL
            OR supersedes_rule_id <> id
        )
);

CREATE INDEX IF NOT EXISTS idx_fine_rules_code
    ON public.fine_rules(rule_code);

CREATE INDEX IF NOT EXISTS idx_fine_rules_status
    ON public.fine_rules(status);

CREATE INDEX IF NOT EXISTS idx_fine_rules_effective_dates
    ON public.fine_rules(effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_fine_rules_created_by
    ON public.fine_rules(created_by);

CREATE INDEX IF NOT EXISTS idx_fine_rules_supersedes
    ON public.fine_rules(supersedes_rule_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fine_rules_one_active_version
    ON public.fine_rules(rule_code)
    WHERE status = 'active';

COMMIT;