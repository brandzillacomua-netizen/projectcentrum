const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const headers = {
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json'
};

async function run() {
  const taskId = '81e570a6-92f6-4f1d-a030-d005d2460005';
  
  // 1. Fetch current task
  const taskRes = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/tasks?id=eq.${taskId}`, { headers });
  const tasks = await taskRes.json();
  const task = tasks[0];
  
  const currentSnapshot = task.plan_snapshot || {};
  
  // 2. Set new arrivals matching cutting surplus (from first shop)
  const newArrivals = [
    {
      "bz": 0,
      "id": "dcef3b2e-de4d-4540-90a5-63ebcbab1545",
      "name": "ІП-72-F5-Н-3-50",
      "semi": 300
    },
    {
      "bz": 15,
      "id": "90c17a0c-2c69-485e-a2cf-ed10909c816d",
      "name": "ІП-72-F5-В-3-45",
      "semi": 300
    },
    {
      "bz": 123,
      "id": "e32a6389-7dbf-4b3c-bc9d-06b2a3d0eec7",
      "name": "ІП-72-F5-П-5-147",
      "semi": 1200
    },
    {
      "bz": 1,
      "id": "17908962-8294-4809-b80c-b906fbca25a4",
      "name": "ІП-72-F5-Х-2-63",
      "semi": 300
    }
  ];
  
  const updatedSnapshot = {
    ...currentSnapshot,
    arrivals: newArrivals
  };
  
  console.log('Updating task plan_snapshot with cutting surplus arrivals...');
  const updateRes = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/tasks?id=eq.${taskId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ plan_snapshot: updatedSnapshot })
  });
  
  if (updateRes.ok) {
    console.log('Successfully updated task in database.');
  } else {
    console.error('Failed to update task:', await updateRes.text());
  }
}

run().catch(console.error);
