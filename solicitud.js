
"use strict";

function initSolicitud() {
  const allCodigos = Object.keys(saCodigosMap || {}).sort();
  const sel = document.getElementById('soCodSelect');
  const inp = document.getElementById('soCodInput');
  const sug = document.getElementById('soCodSug');
  const btnAgregar = document.getElementById('soBtnAgregar');
  const btnEnviar = document.getElementById('soBtnEnviar');

  if (!sel || !inp || !btnAgregar || !btnEnviar) return;

  // Poblar combo con todos los códigos
  allCodigos.forEach(cod => {
    const opt = document.createElement('option');
    opt.value = cod;
    opt.textContent = cod;
    sel.appendChild(opt);
  });

  // select -> input + detalles
  sel.addEventListener('change', () => {
    const codigo = sel.value;
    if (codigo) {
      inp.value = codigo;
      actualizarDetalleSolicitud(codigo);
    } else {
      inp.value = '';
      actualizarDetalleSolicitud('');
    }
    limpiarSugerenciasSolicitud();
  });
  
  inp.addEventListener('input', () => {
    const q = inp.value.trim().toUpperCase();
    if (!q) {
      sel.value = '';
      actualizarDetalleSolicitud('');
      limpiarSugerenciasSolicitud();
      return;
    }

    // sincronizar select si coincide exacto
    if (saCodigosMap[q]) {
      sel.value = q;
      actualizarDetalleSolicitud(q);
    } else {
      sel.value = '';
      actualizarDetalleSolicitud('');
    }

    // sugerencias por aproximación
    const sugerencias = [];
    for (const cod of allCodigos) {
      if (cod.indexOf(q) !== -1) {
        sugerencias.push(cod);
        if (sugerencias.length >= 5) break;
      }
    }
    renderSugerenciasSolicitud(sugerencias);
  });

  // botón Agregar código
  btnAgregar.addEventListener('click', onSolicitudAgregarCodigo);
  // botón Enviar solicitud
  btnEnviar.addEventListener('click', onSolicitudEnviar);

  function limpiarSugerenciasSolicitud() {
    if (sug) sug.innerHTML = '';
  }

  function renderSugerenciasSolicitud(lista) {
    limpiarSugerenciasSolicitud();
    if (!lista.length) {
      return;
    }
    sug.innerHTML = lista.map(cod => `<span class="chip" data-cod="${cod}">${cod}</span>`).join(' ');
    sug.onclick = (e) => {
      const chip = e.target.closest('[data-cod]');
      if (!chip) return;
      const codigo = chip.dataset.cod;
      inp.value = codigo;
      sel.value = codigo;
      actualizarDetalleSolicitud(codigo);
      limpiarSugerenciasSolicitud();
    };
  }
}

function onSolicitudAgregarCodigo() {
  const codigo = document.getElementById('soCodInput').value.trim().toUpperCase();
  const cantidad = 1; 

  if (!codigo) {
    toast('Indica un código (combo o manual). error');
    return;
  }
  if (!saCodigosMap[codigo]) {
    toast('El código no existe en el catálogo. error');
    return;
  }

  const idx = soSolicitudes.findIndex(x => x.codigo === codigo);
  if (idx >= 0) {
    // Si ya existe el código en la solicitud, acumula
    soSolicitudes[idx].cantidad += cantidad;
  } else {
    // Si no existe el código en la solicitud, se crea
    soSolicitudes.push({ codigo, cantidad });
  }

  renderTablaSolicitud();
  console.log(`El array soSolicitudes ${JSON.stringify(soSolicitudes)}`);
  console.log(`El array soSolicitudes ${(soSolicitudes)}`);
  toast('Código agregado a la solicitud.');
}

function renderTablaSolicitud() {
  const tbody = document.querySelector('#soTablaSolicitud tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!soSolicitudes.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="3" class="muted">Sin códigos en la solicitud.</td>`;
    tbody.appendChild(tr);
    return;
  }

  soSolicitudes.forEach(item => {
    const info = getCodInfo(item.codigo);
    const tr = document.createElement('tr');
    tr.dataset.codigo = item.codigo; // por si lo quieres usar después
    tr.innerHTML = `
      <td>${item.codigo}</td>
      <td>${info.categoria || ''}</td>
      <!--<td>${item.cantidad}</td>-->
      <td style="text-align:right;">        
         <input type="number"
               class="input saPedQtyInput"
               style="padding:.25rem .35rem; font-size:11px;"
               min="0"
               max="500"
               value="${item.cantidad || 0}" <!-- Cuando se modifique de acá modificar objt -->
        >
      <button class="btn-icon soDel" data-cod="${item.codigo}" title="Quitar de la solicitud">✕</button>
      </td>
    `;
    tbody.appendChild(tr);    
  });

  // Delegar eventos de click para quitar (solo se engancha una vez)
  if (!tbody.dataset.hasDeleteHandler) {
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('.soDel');
      if (!btn) return;

      const codigo = btn.dataset.cod; // El código está enbebido en la X
      if (!codigo) return;
      // Eliminar del array soSolicitudes
      const idx = soSolicitudes.findIndex(x => x.codigo === codigo);
      if (idx >= 0) {
        soSolicitudes.splice(idx, 1);
        renderTablaSolicitud();
        toast(`Se eliminó el código ${codigo} de la solicitud.`);
      }
    });
    tbody.dataset.hasDeleteHandler = '1';
  }
  if (tbody && !tbody.dataset.hasValidation) {
    tbody.addEventListener('input', (e) => {
      if (e.target && e.target.classList.contains('saPedQtyInput')) {
        const _row = e.target.closest('tr');
        const _cod = _row.dataset.codigo;
        const idx = soSolicitudes.findIndex(x => x.codigo === _cod);
        soSolicitudes[idx].cantidad = e.target.value;        
      }
    })
  }
}

function actualizarDetalleSolicitud(codigo) {
  const info = codigo ? getCodInfo(codigo) : { categoria: '', descrip: '', saco_kg: '' };
  document.getElementById('soCategoria').value = info.categoria || '';
  document.getElementById('soSacoKg').value = info.saco_kg || '';
  document.getElementById('soDescrip').value = info.descrip || '';
}

// ===============================
// SOLICITUD DE MATERIAL
// ===============================

let soSolicitudes = []; // [{codigo, cantidad}]

// Helper: buscar info del catálogo (ya tenemos saCodigosMap de Salidas)
function getCodInfo(codigo) {
  return saCodigosMap?.[codigo] || { categoria: '', descrip: '', saco_kg: '' };
}

function onSolicitudEnviar() {
  const elDestino = document.getElementById('soDesti');
  const destVal = elDestino.value;
  const textoDestino = elDestino.options[elDestino.selectedIndex].text;
  console.log(`El destino es: ${textoDestino}`);

  if (!soSolicitudes.length || destVal === "") {
    toast('No hay códigos en la solicitud o falta el destino');
    return;
  }

  soSolicitudes.forEach((fila, indice) => {    
    const info = getCodInfo(fila.codigo);
    fila.categoria = info.categoria;
    fila.saco_kg = info.saco_kg;
    fila.descrip = info.descrip;
  })

  const fechaSolicitud = new Date().toISOString().slice(0, 10);
  const fechaGas = formatearFechaParaGAS(fechaSolicitud);

  const payload = {
    destino: 'solicitarMaterial',
    responsable: "",
    fechaSolicitud: fechaGas,
    lugarDest: textoDestino,
    detalle: soSolicitudes
  };
    
  enviaEvento(payload);

}

async function enviaEvento(payload) {
  const elBoton = document.getElementById('soBtnEnviar');
  elBoton.disabled = true;
  elBoton.textContent = "Esperando respuesta...";
  let mensaje = "";
  // 

  try {
    const response = await fetch(URL_ACTIVA, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)  // Convertir a JSON explícitamente
    });
    const result = await response.json();
    console.log(`Respuesta: Success: ${result.success}`);
    if (result.success) {
      //
      console.log(`Enviados a: ${result.destina}`);
      mensaje = result.message;
      resetearPedidos();
    }
  } catch (error) {
    console.error('Error:', error);

  }
  toast(mensaje);
  elBoton.disabled = false;
  elBoton.textContent = 'Enviar solicitud';
}

function resetearPedidos() {
  soSolicitudes = [];
  renderTablaSolicitud();
  document.getElementById('soCategoria').value = '';
  document.getElementById('soSacoKg').value = '';
  document.getElementById('soDescrip').value = '';
}
