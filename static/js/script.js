function ocultar(){
  document.getElementById('donation').style.display = 'none';
}

$(document).ready(function() {
  M.AutoInit();
  $('.materialboxed').materialbox();
  $('.fixed-action-btn').floatingActionButton();
  $('.tooltipped').tooltip();
});
