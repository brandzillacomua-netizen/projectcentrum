import { createClient } from '@supabase/supabase-js';
import { buildLegacyRecoverableInventoryItems } from '../src/modules/VKYA/quality-hold/qualityHoldModel.js';

const prodClient = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  { global: { headers: { 'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE' } } }
);

async function verifyVkya() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: 'REVOKED_AUDIT_PASSWORD_DO_NOT_USE'
  });

  const { data: inventory } = await prodClient
    .from('inventory')
    .select('*');

  const { data: recoverableScrapLots } = await prodClient
    .from('vkya_recoverable_scrap_lots')
    .select('*');

  const legacyItems = buildLegacyRecoverableInventoryItems(inventory, recoverableScrapLots);

  const krItem = legacyItems.find(i => i.nomenclature_id === '2f2969aa-c07e-46cf-95b4-ff532e8022cc');
  console.log('Legacy VKYA item for KR-385-П-10-28:', krItem);
  console.log('Total legacy aggregate items remaining in VKYA:', legacyItems.length);
}

verifyVkya().catch(console.error);
