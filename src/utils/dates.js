export function todayStr() { return new Date().toISOString().slice(0,10); }
export function addDays(d,n) { const dt=new Date(d+"T12:00:00"); dt.setDate(dt.getDate()+n); return dt.toISOString().slice(0,10); }
export function urgInfo(prox) {
  if (!prox) return { level:"none", label:"Sin programar", days:null };
  const d = Math.round((new Date(prox+"T12:00:00")-new Date())/86400000);
  if (d<0)   return { level:"urgente", label:`Vencida hace ${Math.abs(d)}d`, days:d };
  if (d===0) return { level:"hoy",     label:"Hoy", days:0 };
  if (d<=7)  return { level:"semana",  label:`En ${d}d`, days:d };
  if (d<=30) return { level:"prox",    label:`En ${d}d`, days:d };
  return { level:"ok", label:`En ${d}d`, days:d };
}
