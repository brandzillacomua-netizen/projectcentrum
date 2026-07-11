const fs = require('fs');

let code = fs.readFileSync('src/modules/ChatModule.jsx', 'utf8');

const unreadMapRegex = /const threadsWithUnread = await Promise\.all\(\(threadRows \|\| \[\]\)\.map\(async thread => \{([\s\S]*?)return \{\s*\.\.\.thread,\s*unreadCount\s*\}\s*\}\)\)/;

const unreadMapMatch = code.match(unreadMapRegex);

if (unreadMapMatch) {
  const content = unreadMapMatch[1];
  const newContent = content + `
        let lastMessageSenderId = null
        const { data: lastMsgData } = await supabase
          .from('chat_messages')
          .select('sender_id')
          .eq('thread_id', thread.id)
          .order('created_at', { ascending: false })
          .limit(1)
        
        if (lastMsgData && lastMsgData.length > 0) {
          lastMessageSenderId = lastMsgData[0].sender_id
        }
`;
  const replacement = `const threadsWithUnread = await Promise.all((threadRows || []).map(async thread => {${newContent}        return {
          ...thread,
          unreadCount,
          lastMessageSenderId
        }
      }))`;
  
  code = code.replace(unreadMapRegex, replacement);
  
  // Now update the UI part
  const threadLastRegex = /<div className="thread-last">\{thread\.last_message \|\| \`\$\{rows\.length\} учасн\.\`\}<\/div>/;
  const newThreadLast = `
                    <div className="thread-last">
                      {thread.lastMessageSenderId === me.id && (
                        <span style={{ marginRight: 4, color: (rows.find(p => p.user_id !== me.id)?.last_read_at && new Date(rows.find(p => p.user_id !== me.id).last_read_at).getTime() >= new Date(thread.last_message_at || thread.updated_at).getTime()) ? '#3b82f6' : '#888' }}>
                          {(rows.find(p => p.user_id !== me.id)?.last_read_at && new Date(rows.find(p => p.user_id !== me.id).last_read_at).getTime() >= new Date(thread.last_message_at || thread.updated_at).getTime()) ? <CheckCheck size={14} /> : <Check size={14} />}
                        </span>
                      )}
                      {thread.last_message || \`\${rows.length} учасн.\`}
                    </div>`;
  
  code = code.replace(threadLastRegex, newThreadLast);
  
  fs.writeFileSync('src/modules/ChatModule.jsx', code);
  console.log('Update success');
} else {
  console.log('Could not find match');
}
