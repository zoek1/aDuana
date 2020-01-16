function ocultar(){
  document.getElementById('donation').style.display = 'none';
}

function ocultar_filter(){
  document.getElementById('filter').style.display = 'none';
}

function mostrar_filter(){
  document.getElementById('filter').style.display = 'flex';
}

function refresh_preview() {
  var url = $('#input_text').val();
  $('#preview').attr('src', document.location.origin + '/preview?site=' +url)

  $("#preview").load(function() {
    $(this).height( $(this).contents().find("body").height() );
  });
}

$(document).ready(function() {
  $('.dropdown-trigger').dropdown();

  $('.fixed-action-btn').floatingActionButton();

   $('.collapsible').collapsible();

})
