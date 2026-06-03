async function test() {
  console.log('Invoking send-push edge function via direct native fetch to read error body...')
  const response = await fetch('https://hurzutjytlcvtbvihnry.supabase.co/functions/v1/send-push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
    },
    body: JSON.stringify({
      user_id: 46,
      title: 'Test Notification',
      body: 'Hello, this is a manual test push notification!',
      path: '/manager'
    })
  })

  console.log('Status:', response.status)
  const bodyText = await response.text()
  console.log('Body:', bodyText)
}

test()
