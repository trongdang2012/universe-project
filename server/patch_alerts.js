const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../client/src/App.jsx');
let content = fs.readFileSync(appPath, 'utf8');

const globalStateInjection = `
  const [globalAlert, setGlobalAlert] = useState(null);
  const showAlert = (msg) => { 
    if(typeof msg === 'object') msg = JSON.stringify(msg);
    setGlobalAlert(msg); 
  };
`;

if (!content.includes('const [globalAlert, setGlobalAlert]')) {
  // Inject state
  content = content.replace('const [showCheckInWarning, setShowCheckInWarning] = useState(false);', 
    'const [showCheckInWarning, setShowCheckInWarning] = useState(false);\n' + globalStateInjection);

  // Inject UI
  const globalModalInjection = `
      {/* GLOBAL ALERT MODAL */}
      {globalAlert && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
          <div className={\`p-6 rounded-2xl max-w-sm w-full shadow-2xl animate-slide-up \${panicMode ? 'bg-slate-800 text-white border border-gray-700' : 'bg-white text-black border border-gray-200'}\`}>
            <h3 className="text-xl font-bold mb-3 text-rose-600 flex items-center gap-2">🔔 Thông báo hệ thống</h3>
            <p className="mb-6 text-sm whitespace-pre-line">{globalAlert}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setGlobalAlert(null)} className="px-5 py-2 font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition w-full">Đã hiểu</button>
            </div>
          </div>
        </div>
      )}
  `;
  content = content.replace('      {/* CHECK-IN WARNING MODAL */}', globalModalInjection + '\n      {/* CHECK-IN WARNING MODAL */}');
}

// Replace window.alert
content = content.replace(/window\.alert\(/g, 'showAlert(');

// Replace alert( but not showAlert(
content = content.replace(/(?<!show)alert\(/g, 'showAlert(');

fs.writeFileSync(appPath, content);
console.log("Replaced alerts with showAlert globally in App.jsx!");
