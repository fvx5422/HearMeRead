// Levenshtein + fuzzy
function levenshtein(a,b){
  if(a===b) return 0;
  if(a.length===0) return b.length;
  if(b.length===0) return a.length;
  const dp = Array.from({length: a.length+1}, ()=> new Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++) dp[i][0]=i;
  for(let j=0;j<=b.length;j++) dp[0][j]=j;
  for(let i=1;i<=a.length;i++){
    for(let j=1;j<=b.length;j++){
      const cost = a[i-1]===b[j-1]?0:1;
      dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
    }
  }
  return dp[a.length][b.length];
}
function fuzzyEqual(a,b,tolerance=0.4){
  if(!a && !b) return true;
  const dist = levenshtein(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  if(maxLen===0) return true;
  return (dist / maxLen) <= tolerance;
}

const openBtn = document.getElementById('open');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const exportBtn = document.getElementById('export');
const expectedEl = document.getElementById('expected');
const transcriptEl = document.getElementById('transcript');
const flagsEl = document.getElementById('flags');
const pdfContainer = document.getElementById('pdf');

let recognition = null;
let transcriptText = '';
let session = {start: null, end: null, fileName: '', mispronounced: []};

function updateTranscriptDisplay(){
  transcriptEl.textContent = transcriptText || '';
}

function updateFlagsDisplay(){
  if(session.mispronounced.length===0){
    flagsEl.innerHTML = '<em class=\"muted\">No issues detected yet.</em>';
    return;
  }
  flagsEl.innerHTML = '';
  session.mispronounced.forEach((m,i)=>{
    const div = document.createElement('div');
    div.className = 'flag';
    const left = document.createElement('div');
    left.innerHTML = '<strong>'+m.expected+'</strong> — heard: <em>'+m.observed+'</em>';
    const right = document.createElement('div');
    const btn = document.createElement('button');
    btn.textContent = 'Play Correct';
    btn.onclick = ()=> {
      const u = new SpeechSynthesisUtterance(m.expected);
      speechSynthesis.speak(u);
    };
    right.appendChild(btn);
    div.appendChild(left);
    div.appendChild(right);
    flagsEl.appendChild(div);
  });
}

function analyzePronunciation(observed, expected){
  const obsTokens = observed.split(/\\s+/).filter(Boolean).map(s=>s.replace(/[^a-zA-Z]/g,''));
  const expTokens = expected.split(/\\s+/).filter(Boolean).map(s=>s.replace(/[^a-zA-Z]/g,''));
  const flagged = [];
  for(let i=0;i<Math.min(obsTokens.length, expTokens.length); i++){
    const o = obsTokens[i]||'';
    const e = expTokens[i]||'';
    if(!fuzzyEqual(o,e)){
      flagged.push({expected: e, observed: o});
    }
  }
  session.mispronounced = flagged;
  updateFlagsDisplay();
}

openBtn.onclick = async ()=>{
  const res = await window.hearme.openEbook();
  if(!res || res.canceled) return;
  session.fileName = res.filePath;
  transcriptText = '';
  session.mispronounced = [];
  updateTranscriptDisplay();
  updateFlagsDisplay();

  if(res.ext === '.txt'){
    const text = atob(res.base64);
    expectedEl.value = text.slice(0, 3000);
    pdfContainer.innerHTML = '<div class=\"muted\" style=\"padding:12px\">Loaded TXT. (No page preview)</div>';
  } else if (res.ext === '.pdf'){
    const raw = Uint8Array.from(atob(res.base64), c => c.charCodeAt(0));
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = '../node_modules/pdfjs-dist/build/pdf.worker.min.js';
    const loadingTask = pdfjsLib.getDocument({data: raw});
    const pdf = await loadingTask.promise;
    pdfContainer.innerHTML = '';
    const firstText = [];
    const maxPages = Math.min(pdf.numPages, 3);
    for(let p=1;p<=maxPages;p++){
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({scale: 1.2});
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      pdfContainer.appendChild(canvas);
      await page.render({canvasContext: ctx, viewport}).promise;
      if(p===1){
        const textContent = await page.getTextContent();
        firstText.push(...textContent.items.map(it => it.str));
      }
    }
    const expected = firstText.join(' ').replace(/\s+/g,' ').trim();
    if(expected.length>0) expectedEl.value = expected.slice(0, 4000);
  } else {
    expectedEl.value = 'Unsupported file type. Please open PDF or TXT.';
  }
};

startBtn.onclick = ()=>{
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRecognition){ alert('SpeechRecognition not available.'); return; }
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (ev)=>{
    const text = Array.from(ev.results).map(r=>r[0].transcript).join('\\n');
    transcriptText = (transcriptText? transcriptText + ' ' : '') + text;
    updateTranscriptDisplay();
    analyzePronunciation(transcriptText, expectedEl.value);
  };
  recognition.onend = ()=>{
    stopBtn.disabled = true;
    startBtn.disabled = false;
  };
  recognition.onerror = (e)=> console.error('Recognition error', e);
  recognition.start();
  session.start = session.start || Date.now();
  startBtn.disabled = true;
  stopBtn.disabled = false;
};

stopBtn.onclick = ()=>{
  if(recognition) recognition.stop();
  session.end = Date.now();
  startBtn.disabled = false;
  stopBtn.disabled = true;
};

exportBtn.onclick = ()=>{
  const report = {
    fileName: session.fileName,
    start: session.start,
    end: session.end,
    transcript: transcriptText,
    mispronounced: session.mispronounced,
    generatedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'hearme_report.json'; a.click();
  URL.revokeObjectURL(url);
};
