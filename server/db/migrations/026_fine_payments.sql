
BEGIN;

CREATE TABLE IF NOT EXISTS public.fine_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    payment_number VARCHAR(50) NOT NULL UNIQUE,

    fine_id UUID NOT NULL
        REFERENCES public.fines(id),

    member_id UUID NOT NULL
        REFERENCES public.users(id),

    amount NUMERIC(14,2) NOT NULL
        CHECK (amount > 0),

    currency CHAR(3) NOT NULL DEFAULT 'KES',

    payment_method VARCHAR(30) NOT NULL
        CHECK (
            payment_method IN (
                'cash',
                'bank',
                'mpesa',
                'other'
            )
        ),

    payment_reference VARCHAR(150),

    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    recorded_by UUID NOT NULL
        REFERENCES public.users(id),

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fine_payments_fine
    ON public.fine_payments(fine_id);

CREATE INDEX IF NOT EXISTS idx_fine_payments_member
    ON public.fine_payments(member_id);

CREATE INDEX IF NOT EXISTS idx_fine_payments_recorded_by
    ON public.fine_payments(recorded_by);

CREATE INDEX IF NOT EXISTS idx_fine_payments_payment_date
    ON public.fine_payments(payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_fine_payments_method
    ON public.fine_payments(payment_method);

CREATE INDEX IF NOT EXISTS idx_fine_payments_reference
    ON public.fine_payments(payment_reference);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fine_payments_reference
    ON public.fine_payments(LOWER(payment_reference))
    WHERE payment_reference IS NOT NULL
      AND payment_reference <> '';

CREATE INDEX IF NOT EXISTS idx_fine_payments_fine_date
    ON public.fine_payments(fine_id, payment_date DESC);

-- A fine payment must not exceed the outstanding fine balance.
CREATE OR REPLACE FUNCTION public.validate_fine_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_assessed_amount NUMERIC(14,2);
    v_paid_amount NUMERIC(14,2);
    v_fine_member UUID;
BEGIN
    SELECT assessed_amount, member_id
    INTO v_assessed_amount, v_fine_member
    FROM public.fines
    WHERE id = NEW.fine_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fine record does not exist';
    END IF;

    IF NEW.member_id <> v_fine_member THEN
        RAISE EXCEPTION 'Payment member does not match fine member';
    END IF;

    SELECT COALESCE(SUM(amount), 0)
    INTO v_paid_amount
    FROM public.fine_payments
    WHERE fine_id = NEW.fine_id;

    IF v_paid_amount + NEW.amount > v_assessed_amount THEN
        RAISE EXCEPTION 'Payment exceeds outstanding fine balance';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_fine_payment
    ON public.fine_payments;

CREATE TRIGGER trg_validate_fine_payment
BEFORE INSERT ON public.fine_payments
FOR EACH ROW
EXECUTE FUNCTION public.validate_fine_payment();

-- Update fine payment status after a payment is recorded.
CREATE OR REPLACE FUNCTION public.update_fine_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_assessed_amount NUMERIC(14,2);
    v_paid_amount NUMERIC(14,2);
BEGIN
    SELECT assessed_amount
    INTO v_assessed_amount
    FROM public.fines
    WHERE id = NEW.fine_id;

    SELECT COALESCE(SUM(amount), 0)
    INTO v_paid_amount
    FROM public.fine_payments
    WHERE fine_id = NEW.fine_id;

    UPDATE public.fines
    SET
        status = CASE
            WHEN v_paid_amount >= v_assessed_amount THEN 'paid'
            WHEN v_paid_amount > 0 THEN 'partially_paid'
            ELSE 'unpaid'
        END,
        updated_at = NOW()
    WHERE id = NEW.fine_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_fine_payment_status
    ON public.fine_payments;

CREATE TRIGGER trg_update_fine_payment_status
AFTER INSERT ON public.fine_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_fine_payment_status();

CREATE OR REPLACE VIEW public.fine_balances AS
SELECT
    f.id AS fine_id,
    f.fine_number,
    f.member_id,
    f.assessed_amount,
    COALESCE(SUM(fp.amount), 0)::NUMERIC(14,2) AS amount_paid,
    (
        f.assessed_amount - COALESCE(SUM(fp.amount), 0)
    )::NUMERIC(14,2) AS outstanding_balance,
    f.currency,
    f.status,
    f.issued_at,
    f.due_date
FROM public.fines f
LEFT JOIN public.fine_payments fp
    ON fp.fine_id = f.id
GROUP BY f.id;

COMMIT;