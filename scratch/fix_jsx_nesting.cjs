const fs = require('fs');
let code = fs.readFileSync('a:\\centrum\\src\\modules\\KanbanModule.jsx', 'utf8');

const target = '          {showEditControls && (\r\n            <button type="button" className="check-remove" onClick={() => onRemove(item.id)}>\r\n              <X size={11} />\r\n            </button>\r\n        </div>\r\n      </div>';

const replacement = '          {showEditControls && (\r\n            <button type="button" className="check-remove" onClick={() => onRemove(item.id)}>\r\n              <X size={11} />\r\n            </button>\r\n          )}\r\n        </div>';

if (code.includes(target)) {
  code = code.replace(target, replacement);
  console.log("Success! Replaced block using string index.");
} else {
  console.log("Block with exact CRLF not found, checking without indentation/carriage returns...");
}

fs.writeFileSync('a:\\centrum\\src\\modules\\KanbanModule.jsx', code, 'utf8');
