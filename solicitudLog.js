'use strict';

    //
    const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbzRVYCDFPeudz0hhr7GWuCmGE2pr-2BpYqrGmSRw_RFjHu401L82GZIj58iMToLNaO9/exec';

    // Catálogo tal cual lo regresa GAS: { categoria: [ { codigo, descrip, saco_kg, ... } ] }
    let CATALOGO_POR_CATEGORIA = {};
    // Mapa auxiliar: codigo -> { codigo, descrip, saco_kg, dosis, tiempo, categoria }
    let PRODUCTOS_POR_CODIGO = {};

    function showToast(message, type = 'info') {
      const container = document.getElementById('toastContainer');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = 'toast toast-' + type;
      toast.textContent = message;

      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('hide');
      }, 3200);

      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 3600);
    }

    function actualizarContadores() {
      const tbody = document.getElementById('detalleTabla').querySelector('tbody');
      const filas = Array.from(tbody.rows).filter(r => r.dataset.codigo);
      const totalCodigos = filas.length;
      let totalKilos = 0;

      filas.forEach(row => {
        const kilos = parseFloat(row.cells[3].textContent) || 0;
        totalKilos += kilos;
      });

      document.getElementById('totalCodigosLabel').textContent = totalCodigos;
      document.getElementById('totalKilosLabel').textContent = totalKilos.toFixed(2);
    }

    async function cargarCatalogo() {
      const select = document.getElementById('codigoSelect');
      const laURL = API_BASE_URL+"?accion=catalogo";
      console.log(`La URL a solicitar es: ${laURL}`)
      try {
        select.innerHTML = '<option value="">Cargando catálogo...</option>';
        const resp = await fetch(API_BASE_URL, {
          method: 'GET',
          credentials: 'include' // para usar sesión de Google del usuario
        });

        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();

        if (data.status !== 'ok' || !data.catalogo) {
          throw new Error('Respuesta inválida de servidor');
        }        

        procesarCatalogo(data.catalogo);
        showToast('Catálogo cargado.', 'success');
      } catch (err) {
        console.error(err);
        select.innerHTML = '<option value="">Error al cargar catálogo</option>';
        showToast('No se pudo cargar el catálogo.', 'error');
      }
    }

    function procesarCatalogo(catalogo) {
      CATALOGO_POR_CATEGORIA = catalogo || {};
      PRODUCTOS_POR_CODIGO = {};

      Object.keys(CATALOGO_POR_CATEGORIA).forEach(function(categ) {
        const lista = CATALOGO_POR_CATEGORIA[categ] || [];
        lista.forEach(function(prod) {
          if (prod && prod.codigo) {
            PRODUCTOS_POR_CODIGO[prod.codigo] = {
              codigo:   prod.codigo,
              descrip:  prod.descrip,
              saco_kg:  prod.saco_kg,
              dosis:    prod.dosis,
              tiempo:   prod.tiempo,
              categoria: categ
            };
          }
        });
      });

      rellenarComboCodigos();
    }

    function rellenarComboCodigos() {
      const select = document.getElementById('codigoSelect');
      select.innerHTML = '<option value="">-- Selecciona código --</option>';

      const codigos = Object.keys(PRODUCTOS_POR_CODIGO).sort();
      if (codigos.length === 0) {
        select.innerHTML = '<option value="">Sin datos de catálogo</option>';
        return;
      }

      codigos.forEach(function(cod) {
        const prod = PRODUCTOS_POR_CODIGO[cod];
        const opt = document.createElement('option');
        opt.value = cod;
        opt.textContent = cod + ' · ' + prod.descrip;
        select.appendChild(opt);
      });
    }

    function onCodigoSelectChange(e) {
      const codigo = e.target.value;
      const inputCodigo = document.getElementById('codigoInput');
      inputCodigo.value = codigo;
      actualizarInfoProducto(codigo);
    }

    function onCodigoInputBlur() {
      const codigo = document.getElementById('codigoInput').value.trim();
      const select = document.getElementById('codigoSelect');

      if (PRODUCTOS_POR_CODIGO[codigo]) {
        select.value = codigo;
        actualizarInfoProducto(codigo);
      } else {
        select.value = "";
        actualizarInfoProducto(null);
      }
    }

    function actualizarInfoProducto(codigo) {
      const descripLabel = document.getElementById('descripLabel');
      const sacoKgLabel  = document.getElementById('sacoKgLabel');

      if (codigo && PRODUCTOS_POR_CODIGO[codigo]) {
        const prod = PRODUCTOS_POR_CODIGO[codigo];
        descripLabel.textContent = prod.descrip;
        sacoKgLabel.textContent  = prod.saco_kg;
      } else {
        descripLabel.textContent = 'Selecciona un código';
        sacoKgLabel.textContent  = '—';
      }
    }

    function limpiarFilaVacia() {
      const tbody = document.getElementById('detalleTabla').querySelector('tbody');
      const filas = Array.from(tbody.rows);
      if (filas.length === 1 && !filas[0].dataset.codigo) {
        tbody.innerHTML = '';
      }
    }

    function restaurarMensajeTablaVaciaSiEsNecesario() {
      const tbody = document.getElementById('detalleTabla').querySelector('tbody');
      if (tbody.rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Aún no has agregado productos. Usa el botón <strong>Agregar</strong>.</td></tr>';
      }
    }

    function onAgregarCodigo() {
      const codigo   = document.getElementById('codigoInput').value.trim();
      const sacosStr = document.getElementById('sacosInput').value;
      const sacos    = parseInt(sacosStr, 10);

      if (!codigo || !PRODUCTOS_POR_CODIGO[codigo]) {
        showToast('Selecciona o escribe un código válido.', 'error');
        return;
      }
      if (!Number.isInteger(sacos) || sacos <= 0) {
        showToast('Ingresa un número de sacos mayor que cero.', 'error');
        return;
      }

      const prod  = PRODUCTOS_POR_CODIGO[codigo];
      const tbody = document.getElementById('detalleTabla').querySelector('tbody');

      limpiarFilaVacia();

      let existingRow = null;
      Array.from(tbody.rows).forEach(function(row) {
        if (row.dataset.codigo === codigo) {
          existingRow = row;
        }
      });

      if (existingRow) {
        const sacosInput = existingRow.querySelector('input[type="number"]');
        const sacosActual = parseInt(sacosInput.value, 10) || 0;
        const nuevoTotal = sacosActual + sacos;
        sacosInput.value = nuevoTotal;
        actualizarKilosFila(existingRow, nuevoTotal);
        showToast('Cantidad actualizada para ' + codigo + '.', 'info');
      } else {
        const tr = document.createElement('tr');
        tr.dataset.codigo = codigo;
        tr.dataset.sacoKg = prod.saco_kg;

        const tdCodigo = document.createElement('td');
        tdCodigo.textContent = codigo;
        tr.appendChild(tdCodigo);

        const tdDescrip = document.createElement('td');
        tdDescrip.textContent = prod.descrip;
        tr.appendChild(tdDescrip);

        const tdSacos = document.createElement('td');
        const sacosInput = document.createElement('input');
        sacosInput.type = 'number';
        sacosInput.min  = '0';
        sacosInput.step = '1';
        sacosInput.value = sacos;

        sacosInput.addEventListener('input', function() {
          const valor = parseInt(this.value, 10);
          if (!Number.isInteger(valor) || valor < 0) return;
          if (valor === 0) {
            tr.remove();
            restaurarMensajeTablaVaciaSiEsNecesario();
            actualizarContadores();
          } else {
            actualizarKilosFila(tr, valor);
          }
        });
        tdSacos.appendChild(sacosInput);
        tr.appendChild(tdSacos);

        const tdKilos = document.createElement('td');
        tr.appendChild(tdKilos);

        tbody.appendChild(tr);
        actualizarKilosFila(tr, sacos);
        showToast('Producto agregado a la solicitud.', 'success');
      }

      actualizarContadores();
    }

    function actualizarKilosFila(tr, sacos) {
      const sacoKg = parseFloat(tr.dataset.sacoKg) || 0;
      const kilos  = sacos * sacoKg;
      const tdKilos = tr.cells[3];
      tdKilos.textContent = kilos.toFixed(2);
      actualizarContadores();
    }

    /* */
    async function onEnviarSolicitud() {
      const origen = document.getElementById('origenSelect').value;
      const tbody  = document.getElementById('detalleTabla').querySelector('tbody');
      const filas  = Array.from(tbody.rows).filter(r => r.dataset.codigo);
      const enviarBtn = document.getElementById('enviarBtn');

      if (filas.length === 0) {
        showToast('No hay códigos en la solicitud.', 'error');
        return;
      }

      const detalle = filas.map(function(row) {
        const codigo = row.dataset.codigo;
        const prod   = PRODUCTOS_POR_CODIGO[codigo];
        const sacosInput = row.querySelector('input[type="number"]');
        const sacos = parseInt(sacosInput.value, 10) || 0;
        const kilos = parseFloat(row.cells[3].textContent) || 0;
        
        return {
          codigo:   codigo,
          descrip:  prod ? prod.descrip : '',
          saco_kg:  prod ? prod.saco_kg : null,
          categoria: prod ? prod.categoria : '',
          cantidad: sacos,
          kilos:    kilos
        };
      });

      const mensaje = document.getElementById('mensajeInput').value.trim();
      //console.log(`El material a enviar: ${JSON.stringify(detalle)}`);
      
      const payload = {
        accion: 'solicitud',
        lugarDest: origen,
        mensaje: mensaje,
        detalle: detalle
      };
      //console.log(`La payload completa: ${JSON.stringify(payload)}`);
      
      enviarBtn.disabled = true;
      const textoOriginal = enviarBtn.textContent;
      enviarBtn.textContent = 'Enviando...';

      try {
        const resp = await fetch(API_BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();

        if (data.status !== 'ok') {
          throw new Error(data.message || 'Error en servidor');
        }

        // Limpiar interfaz
        tbody.innerHTML = '';
        restaurarMensajeTablaVaciaSiEsNecesario();
        document.getElementById('origenSelect').value = 'ALMACEN';
        document.getElementById('codigoSelect').value = '';
        document.getElementById('codigoInput').value = '';
        document.getElementById('sacosInput').value = 1;
        document.getElementById('descripLabel').textContent = 'Selecciona un código';
        document.getElementById('sacoKgLabel').textContent  = '—';
        document.getElementById('mensajeInput').value = '';
        document.getElementById('mensajeCounter').textContent = '0 / 300';
        actualizarContadores();

        showToast('Solicitud enviada correctamente.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Error al enviar la solicitud.', 'error');
      } finally {
        enviarBtn.disabled = false;
        enviarBtn.textContent = textoOriginal;
      }
    }

    // Inicialización
    window.addEventListener('load', function() {
      cargarCatalogo();

      document.getElementById('codigoSelect')
        .addEventListener('change', onCodigoSelectChange);

      document.getElementById('codigoInput')
        .addEventListener('blur', onCodigoInputBlur);

      document.getElementById('agregarBtn')
        .addEventListener('click', onAgregarCodigo);

      document.getElementById('enviarBtn')
        .addEventListener('click', onEnviarSolicitud);

      document.getElementById('mensajeInput')
        .addEventListener('input', function() {
          const len = this.value.length;
          document.getElementById('mensajeCounter').textContent = len + ' / 300';
        });

    });

