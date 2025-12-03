function cargarCatalogosLocales() {
  try {
    const codigosRaw = sessionStorage.getItem('codigosJSON');
    if (codigosRaw) {
      //console.log("Cargando los códigos raw");  // ok
      const codigosJson = JSON.parse(codigosRaw);
      saCodigosMap = flattenCodigos(codigosJson);
    }
  } catch(e) { console.error('Error codigosJSON', e); }

  try {
    const respRaw = localStorage.getItem('responsablesJSON') || localStorage.getItem('responsables');
    if (respRaw) {
      const r = JSON.parse(respRaw);
      saResponsables = r.responsables || [];
    }
  } catch(e) { console.error('Error responsablesJSON', e); }

  try {
    const cliRaw = sessionStorage.getItem('clientesCodigos');
    if (cliRaw) {
      saClientesMap = JSON.parse(cliRaw);
    }
  } catch(e) { console.error('Error clientesJSON', e); }
}

// Poblar select de responsables
function poblarResponsables() {
  const sel = document.getElementById('saResp');
  if (!sel) return;
  saResponsables.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.nombre;
    opt.textContent = r.nombre;
    sel.appendChild(opt);
  });
}

// Poblar select de clientes
function poblarClientes() {
  const sel = document.getElementById('saCliente');
  if (!sel) return;
  const nombres = Object.keys(saClientesMap).sort();
  nombres.forEach(nombre => {
    const opt = document.createElement('option');
    opt.value = nombre;
    opt.textContent = nombre;
    sel.appendChild(opt);
  });
}

// Limpiezas
function limpiarDetalleCodigo() {
  document.getElementById('saCodCategoria').value = '';
  document.getElementById('saCodDescrip').value = '';
  document.getElementById('saCodSacoKg').value = '';
  const infoBadge = document.getElementById('saCodInfo');
  if (infoBadge) infoBadge.textContent = '';
}

function limpiarTablaDisponibles() {
  const tbody = document.querySelector('#saTablaDisponibles tbody');
  if (tbody) tbody.innerHTML = '';
}

function limpiarPreorden() {  
  const tbody = document.querySelector('#saTablaPreorden tbody');
  if (tbody) tbody.innerHTML = '';
}

/* Pone en modo (sin value) "Seleccione cliente" y borra el nombre del evento*/
function limpiarDetallsEvento(){
  document.getElementById('saCliente').value = '';
  const selCodigo = document.getElementById('saCodigo');
  selCodigo.innerHTML = '<option value="">Seleccione código...</option>';
  selCodigo.disabled = !(document.getElementById('saCliente').value);
  document.getElementById('saEvento').value = "";  
}

function toast(mensaje, duracion = 3000) {
  const toast = document.getElementById("toast");
  toast.textContent = mensaje;
  toast.className = "toast show";
  setTimeout(() => {
    toast.className = "toast"; // quita la clase .show
  }, duracion);
}

function validateQtyInput(inp){  
  const row = inp.closest('tr');
  const max = Number(inp.getAttribute('max') || row?.dataset.dispInventario || 0);
  const min = Number(inp.getAttribute('min') || 0);

  const pt = row.dataset.pt;     // PT (declarado en el render)
  const lote = row.dataset.lote; // lote
  const ptFecha = row.dataset.fecha;

  const cell = row.querySelector('.saDispCell');
  if (!cell) {
    console.log("No se encuentra");
    return;}
  
  let val = inp.value.trim();

  // 1. REVISIÓN DE CANTIDAD ENVIADA
  if (val === '') { 
    console.log("Valor inválido...");
    inp.classList.remove('invalid');
    delete inp.dataset.warned;      
    inp.value = 0;  
    val = 0;
    //return;
  }
  
  let num = Number(val);
  if (Number.isNaN(num)) num = min;

  if (num < min) {
    num = min;
    inp.value = String(num);
  }
  if(num > max){
    num = max;
    inp.value = String(num);
    toast(`Se ajustó al máximo disponible (${max}).`);
  }

  const wasInvalid = inp.classList.contains('invalid');
  const over = num > max;

  if (over) {
    inp.classList.add('invalid');    
    if (!wasInvalid && !inp.dataset.warned) {
      toast(`Máximo ${max} sacos para PT ${pt} / lote ${lote}`);
      inp.dataset.warned = '1';
    }
  } else {    
    inp.classList.remove('invalid');
    delete inp.dataset.warned;
  }
  // 
  const reservado = crearObjectPreOrden(pt, lote, ptFecha, num);
  
  const dispEfectivo = Math.max(0, row.dataset.inventariado - reservado);
  if (reservado > 0) {
    cell.innerHTML = `
      ${dispEfectivo}
      <div class="inv-ev-label">(${reservado} reservados)</div>
    `;
  } else {
    cell.innerHTML = `${dispEfectivo}`;
  }
  actualizaInfoBadge(document.getElementById('saCodigo').value);
  //
  dibujarPreOrden();
}

function actualizaInfoBadge(codigo){
  const iBadge = document.getElementById('saCodInfo');
  const total = iBadge.dataset.architotal;
  const totalReservado = totalSacosReservados(codigo);
  iBadge.textContent =`Stock total: ${total} sacos` + (totalReservado ? ` (reservados: ${totalReservado})` : '');
}

function crearObjectPreOrden(pt, lote, ptFecha, nuevaCant){    
  const codigo = document.getElementById('saCodigo').value;  
  if(codigo in preOrden) {    
    for (const [t_codigo, items] of Object.entries(preOrden)){       
      const encontrado = items.find(item => item.pt === pt && item.lote === lote);      
        if (encontrado) {                    
          // PT y lote corresponden          
          if(nuevaCant === 0) {
            console.log(`Eliminando PT${pt} con lote ${lote}`);
            preOrden[codigo] = preOrden[codigo].filter(item => item.lote !== lote);            
            if (preOrden[codigo].length === 0) {
              console.log(`También se elimina la clave para el código: ${codigo}`);
              delete preOrden[codigo];
            }
            return 0;
          }
          encontrado.cantidad = nuevaCant;
          return nuevaCant;          
        }        
    }
    preOrden[codigo].push({
      pt, lote, ptFecha, cantidad: nuevaCant
    });                         
    return nuevaCant;
  } else {

    preOrden[codigo] = [
    {
      pt, lote, ptFecha, cantidad: nuevaCant
    }];
    return nuevaCant;
  }      
}

function totalSacosReservados(codigo){
  if(codigo in preOrden){
    
    const suma = preOrden[codigo].reduce((total, item) => {
        return total + item.cantidad;
    }, 0);    
    return suma;
  } else{    
    return 0;
  }
}

function buscaSacosCodPT(codigo, lote){
  
    if (!preOrden[codigo]) {
        return 0; // Código no encontrado
    }
        
    const elemento = preOrden[codigo].find(item => item.lote === lote);    
    if (!elemento) {
        return 0;
    }
    return elemento.cantidad;
}

function muestraDatosLn(inp){  
  const row = inp.closest('tr'); // ← sube hasta la fila contenedora
  const pt = row.dataset.pt;     // PT (declarado en el render)
  const lote = row.dataset.lote; // lote
  const disp = Number(row.dataset.dispInventario); // disponible efectivo
  const reser = row.dataset.reser;

  const nuevaCant = Number(inp.value);

  const celdas = row.querySelectorAll('td');
  const fechaPT = celdas[1].textContent;
  const codigo = document.getElementById('saCodigo').value;
  
  if(codigo in preOrden){    
    let fl = false;    
    for (const [t_codigo, items] of Object.entries(preOrden)){      
      const encontrado = items.find(item => item.pt === pt);
        if (encontrado) {                    
          console.log(`El usuario ha modificado la cantidad del PT ${pt}, lote ${lote} de ${encontrado.cantidad} a ${inp.value}`);
          if(nuevaCant === 0) {            
            preOrden[codigo] = preOrden[codigo].filter(item => item.lote !== lote);            
            if (preOrden[codigo].length === 0) {              
              delete preOrden[codigo];
            }
          }
          encontrado.cantidad = nuevaCant
          fl = true;
        }
    }
    if(!fl){      
      console.log(`El usuario ha agregado ${nuevaCant} sacos de ${codigo} ya usado`);
      preOrden[codigo].push({
      pt, lote, cantidad: nuevaCant
      });
    }           
  } else {    
    console.log("Creando pre orden para código: ", codigo);
    preOrden[codigo] = [
    {
      pt, lote, cantidad: nuevaCant
    }];
  }
}

// 
function dibujarPreOrden(){  
  const tbodyPre = document.querySelector('#saTablaPreorden tbody');
  tbodyPre.innerHTML = '';

  for (const codigo in preOrden) {
        console.log(`\n🔑 CÓDIGO: ${codigo}`);
        console.log(`   Elementos: ${preOrden[codigo].length}`);
        
        preOrden[codigo].forEach((item, index) => {
          console.log(`   ${index + 1}. PT: ${item.pt}, Lote: ${item.lote}, PreOrden: ${item.cantidad}`);
          const tr = document.createElement('tr');
          tr.innerHTML = `
          <td>PT ${item.pt}</td>          
          <td>${item.ptFecha}</td>
          <td>${item.lote}</td>
          <td>${codigo}</td>                              
          <td>${item.cantidad}</td>
        `;
    tbodyPre.appendChild(tr);
        });
    }
}

function formatearFechaParaGAS(yyyy_mm_dd) {
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun",
                 "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const [yyyy, mm, dd] = yyyy_mm_dd.split('-');
  const mesAbrev = meses[parseInt(mm) - 1];

  return `${dd}-${mesAbrev}-${yyyy}`;
}
