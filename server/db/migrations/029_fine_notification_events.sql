BEGIN;

ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_event_type_check;

ALTER TABLE public.notifications
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
        'welfare_withdrawal_executed',
        'fine_issued',
        'fine_payment_recorded',
        'fine_withdrawal_pending',
        'fine_withdrawal_approved',
        'fine_withdrawal_rejected',
        'fine_withdrawal_completed'
    ));

COMMIT;
