
// Aplana codigos.json a mapa por código
function flattenCodigos(codigosJson) {
  const map = {};  
  Object.entries(codigosJson).forEach(([categoria, lista]) => {    
    if (!Array.isArray(lista)) return;
    lista.forEach(item => {
      if (!item.codigo) return;
      const cod = String(item.codigo).trim();
      if (!map[cod]) {
        map[cod] = {
          categoria,
          descrip: item.descrip || item.descripcion || '',
          saco_kg: item.saco_kg || item.presentacion || ''
        };
      }
    });
  });  
  return map;
}

function buildStockIndexFromInventario(invRaw) {
  const idx = {};
  if (!invRaw) return idx;

  const data = invRaw; // puede venir ya como { "PT 1661": {...}, ... }

  Object.entries(data).forEach(([ptKey, ptObj]) => {
    if (!ptObj || !Array.isArray(ptObj.lotes)) return;
    const pt = ptKey.replace('PT','').trim();
    const fechaPT = ptObj.fecha || '';

    ptObj.lotes.forEach(l => {
      const codigo = (l.codigo || '').trim();
      if (!codigo) return;

      // sRestantes si existe; si no, calculamos
      const rec = Number(l.sRecibidos || 0);
      const ven = Number(l.sVendidos || 0);
      const rest = l.sRestantes != null ? Number(l.sRestantes) : (rec - ven);
      const disp = rest > 0 ? rest : 0;

      if (disp > 0) {
        if (!idx[codigo]) idx[codigo] = [];
        idx[codigo].push({
          pt,
          fechaPT,
          lote: l.lote || '',
          disp
        });
      }
    });
  });
  
  Object.values(idx).forEach(arr => {
    arr.sort((a,b) => Number(a.pt) - Number(b.pt));
  });  
  return idx;
}
