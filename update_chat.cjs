const fs = require('fs');
let code = fs.readFileSync('src/modules/ChatModule.jsx', 'utf8');

const onCreatedRegex = /onCreated=\{\(\) => \{\s*\/\/[^\n]*\s*\}\}/;
const newOnCreated = `onCreated={async (data) => {
            const task = Array.isArray(data) ? data[0] : data
            if (task && activeThreadId) {
              try {
                await supabase.from('chat_messages').insert([{
                  thread_id: activeThreadId,
                  sender_id: me.id || null,
                  sender_login: me.login,
                  sender_name: me.name,
                  body: \`Нове завдання: \${task.title}\`,
                  attachment_type: 'system_task',
                  attachment_name: task.title,
                  attachment_url: task.id?.toString(),
                  attachment_path: task.deadline || null
                }])
              } catch(e) {}
            }
          }}`;
code = code.replace(onCreatedRegex, newOnCreated);

const bubbleRegex = /<div className="message-bubble">([\s\S]*?)<\/div>\s*\{\(showMeta/;
const match = code.match(bubbleRegex);
if (match) {
  const oldBubbleContent = match[1];
  const newBubble = `
                          <div className={\`message-bubble \${message.attachment_type === 'system_task' ? 'sys-task-bubble' : ''}\`}>
                            {message.attachment_type === 'system_task' ? (
                              <div className="task-sys-message">
                                <div className="tsm-icon"><CheckSquare size={22} /></div>
                                <div className="tsm-content">
                                  <h4><b>{message.sender_name}</b> створив(ла) для вас завдання</h4>
                                  <div className="tsm-card">
                                    <div className="tsm-title">{message.attachment_name}</div>
                                    {message.attachment_path && <div className="tsm-deadline">Дедлайн: {new Date(message.attachment_path).toLocaleDateString('uk-UA')}</div>}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>${oldBubbleContent}</>
                            )}
                          </div>
                          {(showMeta`;
  code = code.replace(match[0], newBubble);
} else {
  console.log('Bubble not found');
}

const styles = `
        .sys-task-bubble { background: transparent !important; border: none !important; padding: 0 !important; }
        .task-sys-message {
          display: flex;
          gap: 12px;
          background: rgba(255, 144, 0, 0.1);
          border: 1px solid rgba(255, 144, 0, 0.2);
          padding: 14px 18px;
          border-radius: 12px;
          margin-top: 4px;
        }
        .mine .task-sys-message {
           background: rgba(255, 144, 0, 0.15);
        }
        .tsm-icon {
          color: #ff9000;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px; height: 38px;
          background: rgba(255, 144, 0, 0.15);
          border-radius: 10px;
          flex-shrink: 0;
        }
        .tsm-content h4 {
          margin: 0 0 6px 0;
          font-size: 0.85rem;
          color: #bbb;
          font-weight: 500;
        }
        .tsm-content h4 b {
          color: #fff;
          font-weight: 700;
        }
        .tsm-card {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 10px 14px;
        }
        .tsm-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #ff9000;
        }
        .tsm-deadline {
          margin-top: 4px;
          font-size: 0.75rem;
          color: #888;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
`;
code = code.replace('</style>', styles + '</style>');

fs.writeFileSync('src/modules/ChatModule.jsx', code);
console.log('Success');
