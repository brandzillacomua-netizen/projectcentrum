const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const baseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';

async function fix() {
  const update1 = await fetch(baseUrl + '/rest/v1/nomenclatures_v2?id=eq.50e63438-9c91-475a-af63-15ac30ff609a', {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      rule_params: {
        name: '(RND230) Рама JET 13"',
        customName: 'Рама (RND230) Рама JET 13"',
        projNum: '230',
        projType: 'SERIAL',
        unit: 'шт'
      }
    })
  });
  console.log('Update 1 status:', update1.status, await update1.json());

  const update2 = await fetch(baseUrl + '/rest/v1/nomenclatures_v2?id=eq.11371d1a-9db4-4de1-93ea-d44ccb604543', {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      rule_params: {
        name: 'Комплект карбонової рами',
        customName: 'Комплект карбонової рами',
        projType: 'SERIAL',
        unit: 'шт'
      }
    })
  });
  console.log('Update 2 status:', update2.status, await update2.json());
}
fix();
