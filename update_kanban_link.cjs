const fs = require('fs');

// Update ChatModule.jsx
let chatCode = fs.readFileSync('src/modules/ChatModule.jsx', 'utf8');
chatCode = chatCode.replace(
  '<div className="task-sys-message">', 
  '<div className="task-sys-message" style={{ cursor: "pointer" }} onClick={() => navigate(`/tasks?taskId=${message.attachment_url}`)}>'
);
fs.writeFileSync('src/modules/ChatModule.jsx', chatCode);

// Update KanbanModule.jsx
let kanbanCode = fs.readFileSync('src/modules/KanbanModule.jsx', 'utf8');

kanbanCode = kanbanCode.replace(
  "import { Link } from 'react-router-dom'",
  "import { Link, useSearchParams } from 'react-router-dom'"
);

const kanbanStartRegex = /const KanbanModule = \(\) => \{\n  const \{ managementTasks[^\n]*\n/;
const kanbanStartMatch = kanbanCode.match(kanbanStartRegex);
if (kanbanStartMatch) {
  kanbanCode = kanbanCode.replace(kanbanStartRegex, kanbanStartMatch[0] + '  const [searchParams, setSearchParams] = useSearchParams()\n');
}

const handleOpenTaskRegex = /const handleOpenTask = \(task\) => \{\n    setSelectedTask\(task\)\n    setDetailTab\('desc'\)\n    setDetailOpen\(true\)\n  \}\n/;
const handleOpenTaskMatch = kanbanCode.match(handleOpenTaskRegex);
if (handleOpenTaskMatch) {
  const newEffect = `
  useEffect(() => {
    const tId = searchParams.get('taskId')
    if (tId && managementTasks && managementTasks.length > 0) {
      const task = managementTasks.find(t => String(t.id) === String(tId))
      if (task) {
        handleOpenTask(task)
        setSearchParams({}, { replace: true })
      }
    }
  }, [searchParams, managementTasks, setSearchParams])
`;
  kanbanCode = kanbanCode.replace(handleOpenTaskRegex, handleOpenTaskMatch[0] + newEffect);
}

fs.writeFileSync('src/modules/KanbanModule.jsx', kanbanCode);
console.log('Update successful');
