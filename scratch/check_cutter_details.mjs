import { createClient } from '@supabase/supabase-js';

const prodClient = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  { global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } } }
);

const stagingClient = createClient(
  'https://qpiysrkhvdgctaqmfsew.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaXlzcmtodmRnY3RhcW1mc2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
);

async function checkCutterInventoryDetails() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
  });

  console.log('=== PROD ===');
  const { data: pInv } = await prodClient
    .from('inventory')
    .select('id, name, warehouse, total_qty, reserved_qty, nomenclature_id')
    .ilike('name', '%2х3,175х10,5х38%');
  console.log('PROD 2х3,175х10,5х38 inventory rows:', pInv);

  console.log('=== STAGING ===');
  const { data: sInv } = await stagingClient
    .from('inventory')
    .select('id, name, warehouse, total_qty, reserved_qty, nomenclature_id')
    .ilike('name', '%2х3,175х10,5х38%');
  console.log('STAGING 2х3,175х10,5х38 inventory rows:', sInv);

  // Check how getStockForNom works when we filter vs find
  // What if there are multiple rows?
  // What if someone wrote warehouse: 'operational' vs 'Склад оперативний'?
  const { data: whNames } = await prodClient.from('inventory').select('warehouse');
  const uniqueWh = [...new Set(whNames.map(w => w.warehouse))];
  console.log('PROD unique warehouses:', uniqueWh);

  const { data: sWhNames } = await stagingClient.from('inventory').select('warehouse');
  const sUniqueWh = [...new Set(sWhNames.map(w => w.warehouse))];
  console.log('STAGING unique warehouses:', sUniqueWh);
}

checkCutterInventoryDetails().catch(console.error);
