
"use strict";

let saResponsables = [
    {
      "codigo": 0,
      "nombre": "Rogelio Rodríguez"
    },
    {
      "codigo": 1,
      "nombre": "Yair García"
    }
  ]; 

let saClientesMap;
let saStockIndex = {};
let saCodigosMap = {};

window.addEventListener('DOMContentLoaded', () => {  
  const stored = sessionStorage.getItem('elInventario');
  if(!stored){    
      window.location.href = 'login2.html';
      return;
  }
  
  const elCatalogo = sessionStorage.getItem('codigosJSON');
  const _saResponsables = sessionStorage.getItem('losResponsables');
  const _saClientesMap = sessionStorage.getItem('clientesCodigos');  
  let elInventario;  
  try {
    elInventario = JSON.parse(stored);
    //console.log(`"Procesando el inventario: ${stored}`);
  } catch(e){

  }  
  renderInventarioTabla(elInventario);  
  //
  initSalidas(elInventario);
  initSolicitud();
  initEntrada();
});

function normalizarInventario(data){
  const pts = [];

  for(const [ptKey, ptData] of Object.entries(data)){
    const ptNum = ptKey.replace('PT ','').trim();
    const lotes = ptData.lotes || [];

    let totalRec = 0;
    let totalVen = 0;
    let totalEv = 0;

    const lotesNorm = lotes.map(l => {
      const rec = +l.sRecibidos || 0;
      const ven = +l.sVendidos || 0;
      const evs = Array.isArray(l.eventos) ? l.eventos : [];
      totalRec += rec;
      totalVen += ven;
      totalEv += evs.length;

      return {
        pt: ptNum,
        fechaPT: ptData.fecha,
        lote: l.lote,
        codigo: l.codigo,
        sRecibidos: rec,
        sVendidos: ven,
        disponibles: rec - ven,
        eventos: evs
      };
    });

    pts.push({
      pt: ptNum,
      fecha: ptData.fecha,
      totalRec,
      totalVen,
      totalDisp: totalRec - totalVen,
      totalEv,
      lotes: lotesNorm
    });
  }

  // Opcional: ordenar por PT o fecha
  pts.sort((a,b)=> Number(a.pt) - Number(b.pt));
  return pts;
}

function renderInventarioTabla(rawData){
  const pts = normalizarInventario(rawData);
  const tbody = document.getElementById('invBody');
  const search = document.getElementById('invSearch');
  const filtro = document.getElementById('invFiltro');

  function aplicaFiltros(){
    const q = (search.value || '').trim().toLowerCase();
    const f = filtro.value;
    tbody.innerHTML = '';

    pts.forEach(pt => {
      // Si el filtro global no coincide con ningún lote/código/PT, lo ocultamos
      const coincidePT =
        !q ||
        pt.pt.includes(q) ||
        pt.lotes.some(l =>
          (l.lote && l.lote.toLowerCase().includes(q)) ||
          (l.codigo && l.codigo.toLowerCase().includes(q))
        );

      if(!coincidePT) return;

      // Filtros extra
      if(f === 'sinStock' && pt.totalDisp <= 0) return;
      if(f === 'conEventos' && pt.totalEv <= 0) return;

      // ─ Nivel 1: fila PT
      const tr = document.createElement('tr');
      tr.className = 'inv-pt-row';
      tr.dataset.pt = pt.pt;

      tr.innerHTML = `
        <td>
          <div class="inv-pt-label">
            <button class="inv-pt-toggle" aria-expanded="false">+</button>
            <div>
              <div><strong>PT ${pt.pt}</strong></div>
            </div>
          </div>
        </td>
        <td>${pt.fecha || ''}</td>
        <td>${pt.totalRec}</td>
        <td>${pt.totalVen}</td>
        <td>${pt.totalDisp}</td>
        <td>${pt.totalEv}</td>
      `;
      tbody.appendChild(tr);

      // ─ Nivel 2: fila detalle con tabla de lotes (inicialmente oculta)
      const trDet = document.createElement('tr');
      trDet.className = 'inv-pt-detail-row';
      trDet.dataset.pt = pt.pt;
      trDet.hidden = true;

      // Tabla anidada de lotes
      const inner = document.createElement('td');
      inner.colSpan = 6;

      const tbl = document.createElement('table');
      tbl.className = 'inv-lotes-table';
      tbl.innerHTML = `
        <thead>
          <tr class="inv-lotes-head">
            <th>Lote</th>
            <th>Código</th>
            <th>Recib.</th>
            <th>Vend.</th>
            <th>Disp.</th>
            <th>Eventos</th>
          </tr>
        </thead>
        <tbody>
          ${pt.lotes.map(l => `
            <tr>
              <td>${l.lote}</td>
              <td>${l.codigo}</td>
              <td>${l.sRecibidos}</td>
              <td>${l.sVendidos}</td>
              <td>${l.disponibles}</td>
              <td>
                <button
                  class="inv-ev-btn ${l.eventos.length ? 'has':''}"
                  data-pt="${pt.pt}"
                  data-lote="${l.lote}"
                  data-codigo="${l.codigo}"
                >
                  ${l.eventos.length ? l.eventos.length + ' ver' : '—'}
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      `;
      inner.appendChild(tbl);
      trDet.appendChild(inner);
      tbody.appendChild(trDet);
    });
  }

  // Toggle de filas PT
  tbody.onclick = (e)=>{
    const toggle = e.target.closest('.inv-pt-toggle');
    if(toggle){
      const tr = toggle.closest('.inv-pt-row');
      const pt = tr.dataset.pt;
      const detail = tbody.querySelector(`.inv-pt-detail-row[data-pt="${pt}"]`);
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.textContent = expanded ? '+' : '–';
      toggle.setAttribute('aria-expanded', String(!expanded));
      detail.hidden = expanded;
      return;
    }

    const evBtn = e.target.closest('.inv-ev-btn');
    if(evBtn){
      const pt = evBtn.dataset.pt;
      const lote = evBtn.dataset.lote;
      const codigo = evBtn.dataset.codigo;
      const ptData = pts.find(p=>p.pt===pt);
      if(!ptData) return;
      const loteData = ptData.lotes.find(l=>l.lote===lote && l.codigo===codigo);
      if(!loteData || !loteData.eventos.length) return;
      abrirModalEventos(ptData, loteData);
    }
  };

  // Filtros
  invSearch.addEventListener('input', debounce(aplicaFiltros, 250));
  invFiltro.addEventListener('change', aplicaFiltros);

  aplicaFiltros(); // primera construcción
}

/* Modal de eventos: nivel 3 */
function abrirModalEventos(pt, lote){
  const modal = document.getElementById('modalEventos');
  const sub = document.getElementById('modalEventosSub');
  const body = document.getElementById('modalEventosBody');

  sub.textContent = `PT ${pt.pt} • Lote ${lote.lote} • Código ${lote.codigo}`;

  if(!lote.eventos.length){
    body.innerHTML = '<div class="inv-ev-item">Sin eventos registrados.</div>';
  }else{
    body.innerHTML = lote.eventos.map(ev => `
      <div class="inv-ev-item">
        <div class="inv-ev-head">
          <div><strong>${ev.evento || 'Venta'}</strong></div>
          <div>${(ev.fecha||'').slice(0,10)}</div>
        </div>
        <div><span class="inv-ev-label">Cliente:</span> ${ev.cliente || '-'}</div>
        <div><span class="inv-ev-label">Responsable:</span> ${ev.responsable || '-'}</div>
        <div><span class="inv-ev-label">Sacos vendidos:</span> ${ev.sVendidos || 0}</div>
        <div><span class="inv-ev-label">Kg vendidos:</span> ${ev.kg_vendidos || 0}</div>
        <div><span class="inv-ev-label">Importe:</span> ${ev.total != null ? '$' + ev.total : '-'}</div>
      </div>
    `).join('');
  }

  modal.hidden = false;
}

(function initModalEventos(){
  const modal = document.getElementById('modalEventos');
  const closeBtn = document.getElementById('modalEventosClose');
  const backdrop = modal.querySelector('.inv-modal-backdrop');

  function close(){ modal.hidden = true; }
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
})();

/* Utilidad debounce */
function debounce(fn, ms){
  let t; return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), ms); };
}
