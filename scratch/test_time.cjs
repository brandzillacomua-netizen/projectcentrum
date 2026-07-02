async function testTime() {
  const apis = [
    {
      name: 'worldtimeapi',
      url: 'https://worldtimeapi.org/api/timezone/Europe/Kyiv',
      parse: (json) => json.unixtime * 1000
    },
    {
      name: 'timeapi.io',
      url: 'https://timeapi.io/api/Time/current/zone?timeZone=Europe/Kyiv',
      parse: (json) => new Date(json.dateTime).getTime()
    }
  ];

  for (const api of apis) {
    try {
      const start = Date.now();
      const response = await fetch(api.url);
      const json = await response.json();
      const serverTimeMs = api.parse(json);
      const latency = (Date.now() - start) / 2;
      const drift = (serverTimeMs + latency) - Date.now();
      console.log(`${api.name}: serverTime=${new Date(serverTimeMs).toISOString()}, drift=${drift}ms`);
    } catch (e) {
      console.error(`${api.name} failed:`, e.message);
    }
  }

  // Supabase test
  try {
    const start = Date.now();
    const response = await fetch('https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/', {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
      }
    });
    const serverDate = response.headers.get('date');
    const serverTimeMs = new Date(serverDate).getTime();
    const latency = (Date.now() - start) / 2;
    const drift = (serverTimeMs + latency) - Date.now();
    console.log(`supabase: serverTime=${new Date(serverTimeMs).toISOString()}, drift=${drift}ms`);
  } catch (e) {
    console.error('supabase failed:', e.message);
  }
}

testTime();
