function parseSpecNameRobust(line) {
  // Match "Специфікація " case-insensitively and grab everything after it
  const match = line.match(/Специфікація\s+(.*)/i);
  if (!match) return "Нова специфікація";
  
  let content = match[1].trim();
  
  // Remove trailing commas (e.g. ,,,)
  content = content.replace(/,+$/, '').trim();
  
  // Remove outer quotes that wrap the whole name, including doubled quotes
  // We want to handle:
  // ""Name"" -> Name
  // "Name" -> Name
  // ""Name""""" -> Name
  while (content.startsWith('"') || content.endsWith('"')) {
    if (content.startsWith('"')) content = content.substring(1);
    if (content.endsWith('"')) content = content.slice(0, -1);
    content = content.trim();
  }
  
  // If there are doubled double quotes inside (e.g. from Excel), replace with a single quote
  content = content.replace(/""/g, '"');
  
  return content;
}

const tests = [
  `"Специфікація ""Рама (інд.проект 24), F610, Київ К""",,,,,,,`,
  `Специфікація "Рама (інд.проект 24), F610, Київ К",,,,,,`,
  `Специфікація Рама (інд.проект 24), F610, Київ К,,,,,,`,
  `"Специфікація ""Рама (ін проект 72), F5, Київ К""",,,,,,,`,
  `Специфікація ""Рама (інд.проект 24), F610, Київ К"",,,,,,`
];

tests.forEach(t => {
  console.log(`Input: ${t}`)
  console.log(`Parsed Name: "${parseSpecNameRobust(t)}"`)
  console.log('---')
});
