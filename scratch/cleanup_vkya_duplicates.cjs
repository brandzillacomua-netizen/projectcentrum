const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function findAndCleanupDuplicates(dryRun = true) {
  console.log(`Starting duplicate history check (dryRun = ${dryRun})...`);

  const { data: history, error } = await supabase
    .from('work_card_history')
    .select('id, card_id, stage_name, scrap_qty, created_at, qc_scrap_comment')
    .gt('scrap_qty', 0)
    .order('created_at', { ascending: true }); // oldest first

  if (error) {
    console.error('Error fetching history:', error);
    return;
  }

  const idsToDelete = [];
  const seenMap = new Map();

  for (const h of history) {
    if (!h.card_id) continue;
    // Skip rows that have already been classified by VKYA
    if (h.qc_scrap_comment && h.qc_scrap_comment.includes('SCRAP_CAT:')) continue;

    const key = `${h.card_id}_${h.stage_name || ''}_${h.scrap_qty}`;
    const existing = seenMap.get(key);

    if (existing) {
      const timeDiffMs = Math.abs(new Date(h.created_at).getTime() - new Date(existing.created_at).getTime());
      if (timeDiffMs < 10 * 60 * 1000) { // 10 minutes window
        idsToDelete.push(h.id);
        continue;
      }
    }

    seenMap.set(key, h);
  }

  console.log(`Found ${idsToDelete.length} unclassified duplicate history entries to clean up.`);

  if (!dryRun && idsToDelete.length > 0) {
    // Delete in batches of 50
    for (let i = 0; i < idsToDelete.length; i += 50) {
      const batch = idsToDelete.slice(i, i + 50);
      const { error: delErr } = await supabase
        .from('work_card_history')
        .delete()
        .in('id', batch);
      if (delErr) {
        console.error('Error deleting batch:', delErr);
      } else {
        console.log(`Deleted batch of ${batch.length} rows.`);
      }
    }
  }
}

// First dry run
findAndCleanupDuplicates(false);
