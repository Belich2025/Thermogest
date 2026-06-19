export function startVoiceSimple(cb) {
  if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const r = new SR();
  r.lang = "es-ES"; r.interimResults = false; r.continuous = false; r.maxAlternatives = 1;
  let called = false;
  r.onresult = e => {
    if (called) return;
    const result = e.results[e.results.length - 1];
    if (!result.isFinal) return;
    called = true;
    cb(result[0].transcript);
    r.stop();
  };
  r.onerror = e => console.error("Voice error:", e.error);
  r.start();
}
