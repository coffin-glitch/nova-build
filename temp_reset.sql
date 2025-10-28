UPDATE telegram_bids
SET archived_at = NULL
WHERE received_at::date = '2025-10-26';
SELECT COUNT(*) as reset_count FROM telegram_bids WHERE received_at::date = '2025-10-26' AND archived_at IS NULL;
