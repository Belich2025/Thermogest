export const SC_LIGHT = {
  nueva:               "#DC2626",
  nuevo:               "#DC2626",
  pendiente:           "#DC2626",
  en_reparacion:       "#EA580C",
  en_proceso:          "#EA580C",
  en_curso:            "#EA580C",
  pendiente_piezas:    "#EAB308",
  presupuesto_enviado: "#2563EB",
  enviado:             "#2563EB",
  pendiente_facturar:  "#7C3AED",
  cerrada:             "#16A34A",
  cerrado:             "#16A34A",
  completada:          "#16A34A",
  aceptado:            "#16A34A",
  facturado:           "#16A34A",
  facturada:           "#16A34A",
  rechazado:           "#64748B",
};

export const SC_DARK = {
  nueva:               "#f87171",
  nuevo:               "#f87171",
  pendiente:           "#f87171",
  en_reparacion:       "#fb923c",
  en_proceso:          "#fb923c",
  en_curso:            "#fb923c",
  pendiente_piezas:    "#facc15",
  presupuesto_enviado: "#fbbf24",
  enviado:             "#fbbf24",
  pendiente_facturar:  "#fbbf24",
  cerrada:             "#4ade80",
  cerrado:             "#4ade80",
  completada:          "#4ade80",
  aceptado:            "#4ade80",
  facturado:           "#4ade80",
  facturada:           "#4ade80",
  rechazado:           "#94a3b8",
};

export const mkBS = SC => ({
  nueva:               { label:"Nueva",           color:SC.nueva },
  en_reparacion:       { label:"En reparación",   color:SC.en_reparacion },
  pendiente_piezas:    { label:"Pend. piezas",    color:SC.pendiente_piezas },
  presupuesto_enviado: { label:"Presup. enviado", color:SC.presupuesto_enviado },
  cerrada:             { label:"Cerrada",         color:SC.cerrada },
  pendiente_facturar:  { label:"Pend. facturar",  color:SC.pendiente_facturar },
  facturado:           { label:"Facturado",       color:SC.facturado },
});

export const mkMS = SC => ({
  nuevo:              { label:"Nuevo",          color:SC.nuevo },
  en_proceso:         { label:"En proceso",     color:SC.en_proceso },
  cerrado:            { label:"Cerrado",        color:SC.cerrado },
  pendiente_facturar: { label:"Pend. facturar", color:SC.pendiente_facturar },
  facturado:          { label:"Facturado",      color:SC.facturado },
});

export const mkPS = SC => ({
  nuevo:     { label:"Nuevo",     color:SC.nuevo },
  enviado:   { label:"Enviado",   color:SC.enviado },
  aceptado:  { label:"Aceptado",  color:SC.aceptado },
  rechazado: { label:"Rechazado", color:SC.rechazado },
});

export const mkOB_ESTADOS = SC => ({
  pendiente:           { label:"Pendiente",         color:SC.pendiente },
  en_curso:            { label:"En curso",          color:SC.en_curso },
  completada:          { label:"Completada",        color:SC.completada },
  pendiente_facturar:  { label:"Pend. facturar",    color:SC.pendiente_facturar },
  facturada:           { label:"Facturada",         color:SC.facturada },
});

export const BS_ACTIVOS = ["nueva","en_reparacion","pendiente_piezas","presupuesto_enviado","cerrada"];
export const BS_ALL     = ["nueva","en_reparacion","pendiente_piezas","presupuesto_enviado","cerrada","pendiente_facturar","facturado"];
export const SO_B       = { nueva:0,en_reparacion:1,pendiente_piezas:2,presupuesto_enviado:3,cerrada:4,pendiente_facturar:5,facturado:10 };

export const MS_ACTIVOS = ["nuevo","en_proceso","cerrado"];
export const SO_M       = { nuevo:0,en_proceso:1,cerrado:2,pendiente_facturar:3,facturado:10 };

export const PS_ORDER = ["nuevo","enviado","aceptado","rechazado"];

export const MT_TIPOS = ["mensual","trimestral","semestral","anual"];
export const MT = {
  mensual:   { label:"Mensual",    color:"#0d9488", freq:30  },
  trimestral:{ label:"Trimestral", color:"#d97706", freq:90  },
  semestral: { label:"Semestral",  color:"#7c3aed", freq:180 },
  anual:     { label:"Anual",      color:"#dc2626", freq:365 },
};
