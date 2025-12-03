// ===============================
// ENTRADA DE MATERIAL
// ===============================

let entItems = [];
let entIdCounter = 1;

function initEntrada() {
  const allCodigos = Object.keys(saCodigosMap || {}).sort();
  const sel = document.getElementById('entCodSelect');
  const inp = document.getElementById('entCodInput');
  const sug = document.getElementById('entCodSug');

  if (!sel || !inp) return;

  // Poblar combo con todos los códigos
  allCodigos.forEach(cod => {
    const opt = document.createElement('option');
    opt.value = cod;
    opt.textContent = cod;
    sel.appendChild(opt);
  });

  // select -> input + detalle
  sel.addEventListener('change', () => {
    const codigo = sel.value;
    if (codigo) {
      inp.value = codigo;
      actualizarDetalleEntrada(codigo);
    } else {
      inp.value = '';
      actualizarDetalleEntrada('');
    }
    limpiarSugerenciasEntrada();
  });

  // input -> autocompletar + sincronizar select
  inp.addEventListener('input', () => {
    const q = inp.value.trim().toUpperCase();
    if (!q) {
      sel.value = '';
      actualizarDetalleEntrada('');
      limpiarSugerenciasEntrada();
      return;
    }

    if (saCodigosMap[q]) {
      sel.value = q;
      actualizarDetalleEntrada(q);
    } else {
      sel.value = '';
      actualizarDetalleEntrada('');
    }

    const sugerencias = [];
    for (const cod of allCodigos) {
      if (cod.indexOf(q) !== -1) {
        sugerencias.push(cod);
        if (sugerencias.length >= 5) break;
      }
    }
    renderSugerenciasEntrada(sugerencias);
  });

  document.getElementById('entBtnAgregar')
    .addEventListener('click', onEntradaAgregar);

  document.getElementById('agrBtnEnviar')
    .addEventListener('click', onEntradaEnviar);

  function limpiarSugerenciasEntrada() {
    if (sug) sug.innerHTML = '';
  }

  function renderSugerenciasEntrada(lista) {
    limpiarSugerenciasEntrada();
    if (!lista.length) return;
    sug.innerHTML = lista.map(c => `<span class="chip" data-cod="${c}">${c}</span>`).join(' ');
    sug.onclick = (e) => {
      const chip = e.target.closest('[data-cod]');
      if (!chip) return;
      const codigo = chip.dataset.cod;
      inp.value = codigo;
      sel.value = codigo;
      actualizarDetalleEntrada(codigo);
      limpiarSugerenciasEntrada();
    };
  }

  const hoy = new Date().toISOString().slice(0, 10);
  document.getElementById('entFecha').value = hoy;
  
  initEntradaTableHandlers();
}

function actualizarDetalleEntrada(codigo) {
  const info = codigo ? (saCodigosMap[codigo] || {}) : {};
  document.getElementById('entCategoria').value = info.categoria || '';
  document.getElementById('entSacoKg').value = info.saco_kg || '';
  document.getElementById('entDescrip').value = info.descrip || '';
}

function initEntradaTableHandlers() {
  const tbody = document.querySelector('#entTablaSolicitud tbody');
  if (!tbody) return;

  // Editar campos
  tbody.addEventListener('input', (e) => {
    const tr = e.target.closest('tr');
    if (!tr || !tr.dataset.id) return;
    const id = Number(tr.dataset.id);
    const item = entItems.find(x => x.id === id);
    if (!item) return;

    if (e.target.classList.contains('ent-pt')) {
      item.pt = e.target.value.trim();
    }
    if (e.target.classList.contains('ent-cod')) {
      const cod = e.target.value.trim().toUpperCase();
      item.codigo = cod;
      // Opcional: validar contra catálogo o mostrar detalle en otra parte
    }
    if (e.target.classList.contains('ent-lote')) {
      item.lote = e.target.value.trim();
    }
    if (e.target.classList.contains('ent-cant')) {
      let n = Number(e.target.value || 0);
      if (Number.isNaN(n) || n < 1) n = 1;
      item.cantidad = n;
      e.target.value = String(n);
    }
  });

  // Reagrupar cuando se termine de editar PT (blur)
  tbody.addEventListener('blur', (e) => {
    if (e.target.classList.contains('ent-pt')) {
      renderEntradaTabla(); // reordena y regenera encabezados por PT
    }
  }, true);

  // Eliminar fila
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.ent-del');
    if (!btn) return;
    const tr = btn.closest('tr');
    if (!tr || !tr.dataset.id) return;
    const id = Number(tr.dataset.id);

    const idx = entItems.findIndex(x => x.id === id);
    if (idx >= 0) {
      entItems.splice(idx, 1);
      renderEntradaTabla();
      toast('Producto eliminado de la entrada.', 'info');
    }
  });
}

function onEntradaAgregar() {
  const pt = document.getElementById('entPTId').value.trim();
  const lote = document.getElementById('entLoteId').value.trim();
  const codigo = document.getElementById('entCodInput').value.trim().toUpperCase();
  const cantidad = Number(document.getElementById('entCantidad').value || 0);

  if (!pt) {
    toast('Indica el PT. error');
    return;
  }
  if (!codigo) {
    toast('Indica un código (select o manual). error');
    return;
  }
  if (!saCodigosMap[codigo]) {
    toast('El código no existe en el catálogo. error');
    return;
  }
  if (!lote) {
    toast('Indica el lote. error');
    return;
  }
  if (cantidad <= 0) {
    toast('La cantidad debe ser mayor que cero. error');
    return;
  }

  entItems.push({
    id: entIdCounter++,
    pt,
    codigo,
    lote,
    cantidad
  });

  renderEntradaTabla();
  toast('Producto agregado a la entrada.', 'ok');
}

function renderEntradaTabla() {
  const tbody = document.querySelector('#entTablaSolicitud tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!entItems.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" class="muted">Sin productos en la entrada.</td>`;
    tbody.appendChild(tr);
    return;
  }

  // Ordenar por PT (numérico si aplica)
  const sorted = [...entItems].sort((a, b) => {
    const pa = Number(a.pt) || a.pt;
    const pb = Number(b.pt) || b.pt;
    if (pa < pb) return -1;
    if (pa > pb) return 1;
    return 0;
  });

  let currentPT = null;

  for (const item of sorted) {
    if (item.pt !== currentPT) {
      currentPT = item.pt;
      // Fila de encabezado de sección PT
      const hdr = document.createElement('tr');
      hdr.className = 'ent-pt-header';
      hdr.innerHTML = `<td colspan="5"><strong>PT ${currentPT}</strong></td>`;
      tbody.appendChild(hdr);
    }

    const tr = document.createElement('tr');
    tr.dataset.id = item.id;

    tr.innerHTML = `
      <td>
        <input class="input ent-pt" type="text" value="${item.pt}">
      </td>
      <td>
        <input class="input ent-cod" type="text" value="${item.codigo}">
      </td>
      <td>
        <input class="input ent-lote" type="text" value="${item.lote}">
      </td>
      <td>
        <input class="input ent-cant" type="number" min="1" value="${item.cantidad}">
      </td>
      <td style="text-align:right;">
        <button class="btn-icon ent-del" title="Eliminar">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}


function onEntradaEnviar() {
  if (!entItems.length) {
    toast('No hay productos en la entrada.', 'error');
    return;
  }
  
  const fechaEntrada = document.getElementById('entFecha').value;
  const fechaGas = formatearFechaParaGAS(fechaEntrada);  

  const payload = {
    destino: 'entradaMaterial',
    fechaSolicitud: fechaGas,
    nuevoMaterial: entItems.map(it => ({
      pt: it.pt,
      codigo: it.codigo,
      lote: it.lote,
      cantidad: it.cantidad
    }))
  };
  
  toast('Enviando nuevo material al inventario.');
  enviaNuevaEntrada(payload);
}

async function enviaNuevaEntrada(payload) {
  const elBoton = document.getElementById('agrBtnEnviar');
  elBoton.disabled = true;
  elBoton.textContent = "Esperando respuesta.";
  let mensajeInfo = "";
  try {
    const response = await fetch(URL_ACTIVA, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)  // Convertir a JSON explícitamente
    });    
    const result = await response.json();
    if (result.success) {
      // Actualizar el inventario recibido
      sessionStorage.setItem('elInventario', JSON.stringify(result.inventario));
      renderAlInventario(result.inventario);
      limpiarEntradas()
      mensajeInfo = result.message + " inventario actualizado";
      console.log(`Mensaje GAS: ${result.message} +  inventario actualizado.`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
  elBoton.disabled = false;
  elBoton.textContent = "Agregar material";
  toast(mensajeInfo);
}

function limpiarEntradas() {
  entItems = [];
  document.getElementById('entCategoria').value = '';
  document.getElementById('entSacoKg').value = '';
  document.getElementById('entDescrip').value = '';
  renderEntradaTabla();

}
