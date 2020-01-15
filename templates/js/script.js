function ocultar(){
  document.getElementById('donation').style.display = 'none';
}

function ocultar_filter(){
  document.getElementById('filter').style.display = 'none';
}

function mostrar_filter(){
  document.getElementById('filter').style.display = 'flex';
}

$(document).ready(function() {
  $('.dropdown-trigger').dropdown();

  $('.fixed-action-btn').floatingActionButton();

   $('.collapsible').collapsible();

})
