'use strict';
// Datos ficticios para evaluar el diseño. Sin conexión a GAS ni validación de vigencia.
const perfilesDemo = {
  una: {nombre:'María López Hernández', id:'DEMO-001', cursos:[{disciplina:'Senderismo', niveles:[{nombre:'Básico', anio:2024}]}]},
  varias: {nombre:'Alejandro Martínez Ruiz', id:'DEMO-002', cursos:[
    {disciplina:'Senderismo', niveles:[{nombre:'Básico', anio:2019},{nombre:'Intermedio', anio:2020}]},
    {disciplina:'Escalada en roca', niveles:[{nombre:'Nivel I', anio:2021},{nombre:'Nivel II', anio:2022}]},
    {disciplina:'Alta montaña', niveles:[{nombre:'Nivel I', anio:2022}]},
    {disciplina:'Primeros auxilios', niveles:[{nombre:'Básico', anio:2023},{nombre:'WFA', anio:2024}]}
  ]}
};
function elemento(tag, clase, texto){const nodo=document.createElement(tag);if(clase)nodo.className=clase;if(texto!==undefined)nodo.textContent=texto;return nodo;}
function mostrarPerfil(perfil){
 document.getElementById('nombre').textContent=perfil.nombre;
 document.getElementById('identificador').textContent=perfil.id;
 const destino=document.getElementById('cursos');destino.replaceChildren();destino.classList.toggle('single',perfil.cursos.length===1);
 for(const curso of perfil.cursos){
  const tarjeta=elemento('article','course');const cabecera=elemento('div','course-head');
  const marca=elemento('span','course-mark',curso.disciplina==='Primeros auxilios'?'+':'△');marca.setAttribute('aria-hidden','true');
  const titulo=elemento('div');titulo.append(elemento('h3','',curso.disciplina),elemento('p','','Capacitación registrada'));cabecera.append(marca,titulo);
  const lista=elemento('ul');for(const nivel of curso.niveles){const fila=elemento('li');const fecha=elemento('span','year');fecha.append(elemento('small','','Año'),document.createTextNode(String(nivel.anio)));fila.append(elemento('strong','',nivel.nombre),fecha);lista.append(fila);}
  tarjeta.append(cabecera,lista);destino.append(tarjeta);
 }
}
document.getElementById('ejemplo').addEventListener('change',event=>mostrarPerfil(perfilesDemo[event.target.value]));
mostrarPerfil(perfilesDemo.una);
