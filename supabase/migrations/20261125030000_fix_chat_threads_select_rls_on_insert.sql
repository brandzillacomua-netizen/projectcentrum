-- Allow INSERT ... RETURNING * on chat_threads to pass SELECT RLS immediately
-- because chat_can_access_thread() is STABLE and cannot see the newly inserted row
-- inside the same statement's RETURNING clause.

DROP POLICY IF EXISTS chat_threads_member_select ON public.chat_threads;
CREATE POLICY chat_threads_member_select ON public.chat_threads
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      created_by = public.mes_current_system_user_id()
      OR public.chat_can_access_thread(id)
    )
  );
