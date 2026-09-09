import { createClient } from '@supabase/supabase-js';

const prodClient = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  {
    global: {
      headers: {
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
      }
    }
  }
);

async function testFix() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
  });

  const taskId = 'a33b29a4-d783-45dd-a88b-92c8150320eb';
  const { data: task } = await prodClient.from('tasks').select('*').eq('id', taskId).single();
  const { data: allReqs } = await prodClient.from('material_requests').select('*');
  const { data: noms } = await prodClient.from('nomenclatures').select('*');

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

  const partNom = noms.find(n => String(n.id) === String(partNomId)) || { id: partNomId, ...partEntry };

  // Improved getKittingSheets
  const getRequestQty = (req) => Number(req.qty) || Number(req.quantity) || 0;

  const getKittingSheetsImproved = (taskObj, pNom) => {
    if (!taskObj || !pNom) return { issuedSheets: 0, pendingSheets: 0, hasKittingReqs: false };
    const snapPart = (taskObj?.plan_snapshot || {})[String(pNom?.id)] || {};
    const snapMat = snapPart?.material;
    const baseMat = snapMat || pNom?.material_type || '';
    const partName = pNom?.name || snapPart?.name || '';

    // Match by task_id OR order_id
    const taskReqs = (allReqs || []).filter(r =>
      String(r.task_id) === String(taskObj?.id) ||
      (r.order_id && taskObj?.order_id && String(r.order_id) === String(taskObj?.order_id))
    );

    const extractThickness = (str) => {
      const match = String(str || '').match(/(\d+(?:[.,]\d+)?)\s*мм/);
      return match ? parseFloat(match[1].replace(',', '.')) : null;
    };
    const extractGrade = (str) => {
      const match = String(str || '').toLowerCase().match(/[tт]\s*(300|700)/);
      return match ? match[1] : null;
    };
    const baseThickness = extractThickness(baseMat);
    let baseGrade = extractGrade(baseMat);
    if (Number(snapPart?.sheets_t700) > 0 && !Number(snapPart?.sheets_t300)) {
      baseGrade = '700';
    } else if (Number(snapPart?.sheets_t300) > 0 && !Number(snapPart?.sheets_t700)) {
      baseGrade = '300';
    }

    const matchesBaseMaterial = (candidate, reqObj) => {
      // 1. Direct explicit mention in details: e.g. "(Для: Київ К-ІП9...: 100шт)"
      if (partName && reqObj?.details && reqObj.details.includes(partName)) {
        return true;
      }

      const candidateLower = String(candidate || '').toLowerCase();
      const candidateThickness = extractThickness(candidateLower);
      const candidateGrade = extractGrade(candidateLower);
      if (baseThickness !== null && candidateThickness !== null && baseThickness !== candidateThickness) return false;
      if (baseGrade !== null && candidateGrade !== null && baseGrade !== candidateGrade) return false;
      if (baseThickness !== null && candidateThickness !== null) return true;
      const activeMaterials = baseMat.split('+').map(m => m.trim().toLowerCase()).filter(Boolean);
      return activeMaterials.some(act => candidateLower.includes(act) || act.includes(candidateLower));
    };

    const sheetReqs = taskReqs.filter(r => {
      const rNom = (noms || []).find(n => n.id === r.nomenclature_id);
      const rName = `${rNom?.name || ''} ${rNom?.material_type || ''} ${r.details || ''}`;
      const lowerName = rName.toLowerCase();
      const isSheet = lowerName.includes('лист') || lowerName.includes('sheet');
      if (!isSheet) return false;
      return matchesBaseMaterial(lowerName, r);
    });

    const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
      .reduce((sum, r) => sum + getRequestQty(r), 0);
    const pending = sheetReqs.filter(r => r.status === 'pending')
      .reduce((sum, r) => sum + getRequestQty(r), 0);

    return {
      issuedSheets: issued,
      pendingSheets: pending,
      hasKittingReqs: sheetReqs.length > 0
    };
  };

  const res = getKittingSheetsImproved(task, partNom);
  console.log('Result with improved logic:', res);
}

testFix().catch(console.error);
