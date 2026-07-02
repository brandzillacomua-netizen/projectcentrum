async function run() {
  try {
    const response = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=Europe/Kyiv');
    const json = await response.json();
    console.log(json);
  } catch (e) {
    console.error(e);
  }
}
run();
