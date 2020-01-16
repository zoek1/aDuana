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
  if (!url.match(regex)) {
    M.toast({html: 'URL invalid, please introduce one valid URL.'})
    return;
  }
  $('#preview').attr('src', document.location.origin + '/preview?site=' + url)

  // $("#preview").load(function() {
  //  $(this).height( $(this).contents().find("body").height() );
  // });
}

var expression = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi;
var regex = new RegExp(expression);

function save_page() {
  var url = $('#input_text').val();
  if (!url.match(regex)){
    M.toast({html: 'URL invalid, please introduce one valid URL.'})
  }
  $.post(document.location.origin + '/request?site=' + url).done(function (response) {
    console.log(response);
    M.toast({html: response.message})
  }).fail(function(e) {
    M.toast({
      html: response.message,
      classes: 'red darken-1 rounded'
  })
    // alert('Something went wrong, try later!')
  })
}

$(document).ready(function() {
  $('.dropdown-trigger').dropdown();

  $('.fixed-action-btn').floatingActionButton();

  $('.collapsible').collapsible();
  $('#save').on('click', save_page)
});
