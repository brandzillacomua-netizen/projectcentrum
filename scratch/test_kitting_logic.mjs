import { createClient } from '@supabase/supabase-js';

const stagingClient = createClient(
  'https://qpiysrkhvdgctaqmfsew.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaXlzcmtodmRnY3RhcW1mc2V3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODg5NzEzNSwiZXhwIjoyMTA0NDczMTM1fQ.VrtSmhZNBpPjOolQk9wML9ImpfD4mB4yyEJxF_AvAKE'
);

async function test() {
  const { data: task } = await stagingClient
    .from('tasks')
    .select('*')
    .eq('id', '80c9ae5a-12d7-430b-86d5-2b50a4a1f5b9')
    .single();

  const { data: reqs } = await stagingClient
    .from('material_requests')
    .select('*')
    .eq('task_id', task.id);

  const { data: noms } = await stagingClient
    .from('nomenclatures')
    .select('*');

  console.log('Task plan_snapshot keys:', Object.keys(task.plan_snapshot || {}));

  // Find the part 3-39 in snapshot
  let partNomId = null;
  let partEntry = null;
  for (const [k, v] of Object.entries(task.plan_snapshot || {})) {
    if (v?.name?.includes('3-39')) {
      partNomId = k;
      partEntry = v;
      break;
    }
  }

  console.log('Part in snapshot:', { partNomId, partEntry });
  const partNom = noms.find(n => String(n.id) === String(partNomId)) || { id: partNomId, ...partEntry };

  // Replicate getKittingSheets logic:
  const snapMat = (task.plan_snapshot || {})[String(partNom?.id)]?.material;
  const baseMat = snapMat || partNom?.material_type || '';
  console.log('baseMat:', baseMat);

  const extractThickness = (str) => {
    const match = String(str || '').match(/(\d+(?:[.,]\d+)?)\s*мм/);
    return match ? parseFloat(match[1].replace(',', '.')) : null;
  };
  const extractGrade = (str) => {
    const match = String(str || '').toLowerCase().match(/[tт]\s*(300|700)/);
    return match ? match[1] : null;
  };
  const baseThickness = extractThickness(baseMat);
  const baseGrade = extractGrade(baseMat);
  console.log('baseThickness:', baseThickness, 'baseGrade:', baseGrade);

  const matchesBaseMaterial = (candidate) => {
    const candidateLower = String(candidate || '').toLowerCase();
    const candidateThickness = extractThickness(candidateLower);
    const candidateGrade = extractGrade(candidateLower);
    console.log('Checking candidate:', candidateLower, { candidateThickness, candidateGrade });
    if (baseThickness !== null && candidateThickness !== null && baseThickness !== candidateThickness) {
      console.log('Thickness mismatch');
      return false;
    }
    if (baseGrade !== null && candidateGrade !== null && baseGrade !== candidateGrade) {
      console.log('Grade mismatch');
      return false;
    }
    if (baseThickness !== null && candidateThickness !== null) {
      console.log('Thickness matched!');
      return true;
    }
    const activeMaterials = baseMat.split('+').map(m => m.trim().toLowerCase()).filter(Boolean);
    const matched = activeMaterials.some(act => candidateLower.includes(act) || act.includes(candidateLower));
    console.log('activeMaterials matched:', matched);
    return matched;
  };

  const sheetReqs = reqs.filter(r => {
    const rNom = (noms || []).find(n => n.id === r.nomenclature_id);
    const rName = `${rNom?.name || ''} ${rNom?.material_type || ''} ${r.details || ''}`;
    const lowerName = rName.toLowerCase();
    const isSheet = lowerName.includes('лист') || lowerName.includes('sheet');
    console.log(`Req ${r.id}: rName="${rName}", isSheet=${isSheet}`);
    if (!isSheet) return false;
    return matchesBaseMaterial(lowerName);
  });

  console.log('Filtered sheetReqs count:', sheetReqs.length);
  const getRequestQty = (req) => Number(req.qty) || Number(req.quantity) || 0;
  const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
    .reduce((sum, r) => sum + getRequestQty(r), 0);
  console.log('issued result:', issued);
}

test().catch(console.error);
