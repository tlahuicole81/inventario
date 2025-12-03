// ===============================
// Inicialización Salidas
// ===============================

"use strict";
let preOrden = {}; // Para partidas seleccionadas codigo => [{pt,lote,preventa}]

function initSalidas(inventarioRaw) {
  // 1) Cargar catálogos desde localStorage
  cargarCatalogosLocales();

  // 2) Construir índice de stock por código a partir del inventario
  saStockIndex = buildStockIndexFromInventario(inventarioRaw);

  // 3) Poblar combos base
  poblarResponsables();
  poblarClientes();

  // 4) Listeners encadenados
  document.getElementById('saCliente').addEventListener('change', onClienteChange);
  document.getElementById('saCodigo').addEventListener('change', onCodigoChange);  
  document.getElementById('saBtnFinalizar').addEventListener('click', onFinalizarEvento);

  // Fecha por defecto = hoy
  const hoy = new Date().toISOString().slice(0, 10);
  document.getElementById('saFecha').value = hoy;
  //

}

// Cuando cambia cliente: 
// 1. llenar combo de códigos
// 2. Filtra los códigos del cliente.
function onClienteChange() {  
  const cliente = document.getElementById('saCliente').value;
  const selCodigo = document.getElementById('saCodigo');

  selCodigo.innerHTML = '<option value="">Seleccione código...</option>';
  selCodigo.disabled = !cliente;
  limpiarDetalleCodigo();
  limpiarTablaDisponibles();
  limpiarPreorden();

  if (!cliente) return;

  const lista = saClientesMap[cliente] || [];  
  // Para cada código del cliente, verificar:
  //  1. si hay stock en saStockIndex
  //  2. 
  lista.forEach(item => {
    const codigo = String(item.codigo).trim();
    if (!codigo) return;

    const tieneStock = !!(saStockIndex[codigo] && saStockIndex[codigo].length);
    const opt = document.createElement('option');
    opt.value = codigo;

    let label = codigo;
    let fl = false;
    if (item.precio != null && fl) {
      label += ` — $${item.precio}`;
    }
    if (!tieneStock) {
      label += ' (sin stock)';
      opt.disabled = true; // visible pero no seleccionable
    }

    opt.textContent = label;
    selCodigo.appendChild(opt);
  });
}

// Cuando cambia código: 
// 1. mostrar info + tabla por PT/lote
// 2. Revisar preOrden para saber si código->(pt y lote) tienen sacos reservados
function onCodigoChange() {
  const codigo = document.getElementById('saCodigo').value;
  limpiarDetalleCodigo();
  limpiarTablaDisponibles();

  if (!codigo) return;

  // Info catálogo
  const info = saCodigosMap[codigo] || {};
  document.getElementById('saCodCategoria').value = info.categoria || '';
  document.getElementById('saCodDescrip').value = info.descrip || '';
  document.getElementById('saCodSacoKg').value = info.saco_kg || '';

  // Disponibilidad en inventario
  const filas = saStockIndex[codigo] || [];

  const tbody = document.querySelector('#saTablaDisponibles tbody');
  const infoBadge = document.getElementById('saCodInfo');

  // Totales para badge
  const totalDispBase = filas.reduce((sum, f) => sum + f.disp, 0);

  const totalReservado = totalSacosReservados(codigo);
  const totalEfectivo = Math.max(0, totalDispBase - totalReservado);

  infoBadge.textContent = `Stock total: ${totalDispBase} sacos` + (totalReservado ? ` (reservados: ${totalReservado})` : '');
  infoBadge.dataset.architotal = totalDispBase;

  if (!filas.length) {
    infoBadge.textContent = 'Sin stock disponible para este código.';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" class="muted">No hay sacos disponibles en inventario.</td>`;
    tbody.appendChild(tr);
    return;
  }

  // LA RESERVA DE MATERIAL ES PARA UNA ÚNICA VENTA.
  // Si se cambia de cliente se eliminarán los datos previos.
  // Pintar filas aplicando reservas por PT/lote
  filas.forEach(f => {    
    const reservado = buscaSacosCodPT(codigo, f.lote)    
    const dispEfectivo = Math.max(0, f.disp - reservado);

    const tr = document.createElement('tr');
    tr.dataset.pt = f.pt;
    tr.dataset.lote = f.lote;
    tr.dataset.fecha = f.fechaPT;
    tr.dataset.inventariado = f.disp; // Guardamos el total
    tr.dataset.dispInventario = dispEfectivo; // <- el max disponible
    tr.dataset.reser = 0;   // <- los sacos reservados
    tr.innerHTML = `
      <td>PT ${f.pt}</td>
      <td>${f.fechaPT || ''}</td>
      <td>${f.lote}</td>
      <td class="saDispCell">
        ${dispEfectivo}
        ${reservado ? `<div class="inv-ev-label">(${reservado} reservados)</div>` : ''}
      </td>
      <td>
        <input type="number"
          class="input saQtyInput"
          style="padding:.25rem .35rem; font-size:11px;"
          min="0"
          max="${f.disp}"
          value="${reservado || 0}"
        >
      </td>
    `;    
    tbody.appendChild(tr);
  });

  // (Re)enganchar validación en vivo de cantidades o
  // Delegación para validar mientras escriben
  const dispTbody = document.querySelector('#saTablaDisponibles tbody');
  if (dispTbody && !dispTbody.dataset.hasValidation) {
    dispTbody.addEventListener('input', (e) => {
      if (e.target && e.target.classList.contains('saQtyInput')) {
        validateQtyInput(e.target);
      }
    });
    dispTbody.dataset.hasValidation = '1';
  }
}


// Finalizar evento (por ahora solo arma JSON)
function onFinalizarEvento() {
  const responsable = document.getElementById('saResp').value;
  const fechaSalida = document.getElementById('saFecha').value;  
  const fechaGas = formatearFechaParaGAS(fechaSalida);

  const evento = document.getElementById('saEvento').value.trim();
  const cliente = document.getElementById('saCliente').value;

  if (!responsable || !fechaSalida || !evento || !cliente) {
    toast('Completa responsable, fecha, evento, cliente y código antes de generar la pre-orden');
    return;
  }

  const payload = {
    destino: 'ventaMaterial',
    responsable,
    nombreEvento: evento,
    fechaEvento: fechaGas,
    cliente,
    material: preOrden
  };

  toast("Enviando el evento");
  enviaEvento(payload);
}

async function enviaEvento(payload) {
  const elBoton = document.getElementById('saBtnFinalizar');
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
      sessionStorage.setItem('elInventario', JSON.stringify(result.inventario));
      limpiarDEvento();
      renderAlInventario(result.inventario);
      mensajeInfo = "Evento enviado, inventario actualizado."
    }
  } catch (error) {
    console.error('Error:', error);
  }
  elBoton.disabled = false;
  elBoton.textContent = "Finalizar evento";
  toast(mensajeInfo);
}

function limpiarDEvento() {
  preOrden = {};
  limpiarDetallsEvento();
  limpiarDetalleCodigo();
  limpiarTablaDisponibles()
  limpiarPreorden();
}

function renderAlInventario(inv) {
  let invAct = JSON.stringify(inv);
  const inventarioRaw = JSON.parse(invAct);
  renderInventarioTabla(inventarioRaw);
  saStockIndex = buildStockIndexFromInventario(inventarioRaw);
}
