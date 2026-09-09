import { createClient } from '@supabase/supabase-js';

const prodUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const prodAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const client = createClient(prodUrl, prodAnonKey);

async function check() {
  // Find nomenclature
  const { data: noms } = await client
    .from('nomenclatures')
    .select('id, name, material_type, units_per_sheet')
    .ilike('name', '%3-39%');
  console.log('Noms:', noms);

  if (!noms || noms.length === 0) return;
  const nomId = noms[0].id;

  // Find tasks that contain this nomenclature or recent tasks
  const { data: tasks } = await client
    .from('tasks')
    .select('id, task_id, status, plan_snapshot, order_id')
    .order('created_at', { ascending: false })
    .limit(20);

  const matchingTask = tasks?.find(t => {
    const snap = t.plan_snapshot || {};
    return Object.keys(snap).some(k => k === nomId || snap[k]?.name?.includes('3-39'));
  });

  console.log('Matching Task:', matchingTask ? { id: matchingTask.id, task_id: matchingTask.task_id } : 'Not found');

  if (matchingTask) {
    const { data: reqs } = await client
      .from('material_requests')
      .select('*')
      .eq('task_id', matchingTask.id);
    console.log('Material requests for task:', reqs);

    const { data: allTaskReqs } = await client
      .from('material_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    console.log('Recent material requests in prod:', allTaskReqs?.map(r => ({ id: r.id, task_id: r.task_id, nom_id: r.nomenclature_id, status: r.status, qty: r.quantity, details: r.details })));
  }
}

check().catch(console.error);
