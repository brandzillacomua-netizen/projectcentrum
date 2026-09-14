-- Revoke anonymous access from VKYA classification queue changes RPC
revoke execute on function public.vkya_classification_queue_changes(bigint) from anon;
