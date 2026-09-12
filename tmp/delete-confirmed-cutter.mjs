import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
const client = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})
const { error: authError } = await client.auth.signInWithPassword({ email: process.env.AUDIT_EMAIL, password: process.env.AUDIT_PASSWORD })
if (authError) throw authError
const inventoryId = '9d8271f8-ebea-4a38-880c-50a5674afaa9'
const requestId = 'a5c8a7aa-0d81-46a5-8a3e-3b6c5ae9c09f'
const { data: stock, error: stockError } = await client.from('inventory').select('*').eq('id', inventoryId).single()
if (stockError) throw stockError
const { data: requests, error: reqError } = await client.from('material_requests').select('*').eq('inventory_id', inventoryId)
if (reqError) throw reqError
if (stock.warehouse !== 'operational' || Number(stock.total_qty) !== 999 || Number(stock.reserved_qty) !== 0 || requests.length !== 1 || requests[0].id !== requestId || requests[0].status !== 'cancelled') throw new Error('Data changed; stopped before modifying anything')
writeFileSync('tmp/deleted-cutter-backup.json', JSON.stringify({ savedAt: new Date().toISOString(), stock, requests }, null, 2), { flag: 'wx' })
let arg = 'sql_query'
let probe = await client.rpc('exec_sql', { [arg]: 'SELECT 1 AS ok' })
if (probe.error?.code === 'PGRST202') {
  arg = 'sql'
  probe = await client.rpc('exec_sql', { [arg]: 'SELECT 1 AS ok' })
}
if (probe.error) throw probe.error
const sql = `DO $$
DECLARE affected integer;
BEGIN
  PERFORM 1 FROM public.inventory WHERE id = '${inventoryId}' AND warehouse = 'operational'
    AND name = 'Фреза 6мм твердосплавна HRC55 (Тайвань)' AND total_qty = 999 AND COALESCE(reserved_qty, 0) = 0 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory changed; deletion aborted'; END IF;
  IF EXISTS (SELECT 1 FROM public.material_requests WHERE inventory_id = '${inventoryId}' AND (id <> '${requestId}' OR status IS DISTINCT FROM 'cancelled'))
    THEN RAISE EXCEPTION 'Request dependencies changed; deletion aborted'; END IF;
  UPDATE public.material_requests SET inventory_id = NULL WHERE id = '${requestId}' AND inventory_id = '${inventoryId}' AND status = 'cancelled';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Cancelled request changed; deletion aborted'; END IF;
  DELETE FROM public.inventory WHERE id = '${inventoryId}';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Inventory not deleted'; END IF;
END $$;`
const result = await client.rpc('exec_sql', { [arg]: sql })
if (result.error) throw result.error
const [stockCheck, requestCheck] = await Promise.all([
  client.from('inventory').select('id').eq('id', inventoryId),
  client.from('material_requests').select('id,status,inventory_id,nomenclature_id,details,quantity').eq('id', requestId).single()
])
if (stockCheck.error || requestCheck.error) throw new Error('Verification failed')
if (stockCheck.data.length || requestCheck.data.inventory_id !== null || requestCheck.data.status !== 'cancelled') throw new Error('Unexpected verification result')
console.log(JSON.stringify({ deletedInventoryId: inventoryId, preservedRequest: requestCheck.data }))
