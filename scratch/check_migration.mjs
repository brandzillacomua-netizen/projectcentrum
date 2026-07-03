import('@supabase/supabase-js').then(async ({ createClient }) => {
  const s = createClient(
    'https://hurzutjytlcvtbvihnry.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
    {global:{headers:{'x-mes-secret':'CentrumMES2026SecretKey_a9f8'}}}
  );

  // 1. Check current type
  const { data: tasks, error: fetchErr } = await s.from('tasks').select('id,warehouse_conf').limit(3);
  if (fetchErr) { console.log('Fetch error:', fetchErr.message); return; }
  console.log('Sample warehouse_conf values:', tasks.map(t => ({ id: t.id.slice(0,8), wc: t.warehouse_conf, type: typeof t.warehouse_conf })));

  // 2. Try setting 'partial' string on test task
  const testTask = tasks[0];
  if (!testTask) { console.log('No tasks found'); return; }

  const { error: patchErr } = await s.from('tasks').update({ warehouse_conf: 'partial' }).eq('id', testTask.id);
  if (patchErr) {
    console.log('MIGRATION NEEDED — column is still BOOLEAN');
    console.log('Error code:', patchErr.code, '| Message:', patchErr.message);
    console.log('\nGo to Supabase SQL Editor and run:');
    console.log("ALTER TABLE tasks ALTER COLUMN warehouse_conf TYPE TEXT USING CASE WHEN warehouse_conf = true THEN 'true' WHEN warehouse_conf = false THEN 'false' ELSE null END;");
  } else {
    console.log('OK — column already accepts TEXT values!');
    // Revert test
    const orig = testTask.warehouse_conf;
    const revertVal = orig === true ? 'true' : (orig === false ? 'false' : null);
    await s.from('tasks').update({ warehouse_conf: revertVal }).eq('id', testTask.id);
    console.log('Test reverted to original:', revertVal);
  }
});
