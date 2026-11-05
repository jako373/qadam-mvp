-- Center mode keeps historical payment rows but must not accept new orders.
revoke execute on function public.create_payment_order(text) from public, anon, authenticated;
revoke execute on function public.submit_payment_manual_review(uuid, text, text) from public, anon, authenticated;

drop policy if exists payment_receipts_insert_own on storage.objects;
