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
  query = {
    site: url,
    reset: document.getElementById('reset').checked ? "on" : 'off',
    libstyle: document.getElementById('libstyle').checked ? "on" : 'off',
    header: document.getElementById('header').checked ? "on" : 'off',
    parser: document.getElementById('parser').value,
    engine: document.getElementById('engine').value,
    mode: document.getElementById('mode').value,
    format: document.getElementById('format').value,
  };

  $('#preview').attr('src', document.location.origin + '/preview?' + $.param( query ));
  document.getElementById('loader').style.display = 'block';
  document.getElementById("preview").onload = function() {
  //  $(this).height( $(this).contents().find("body").height() );
    document.getElementById('loader').style.display = 'none';
  };
}

var expression = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi;
var regex = new RegExp(expression);

function save_page() {
  var url = $('#input_text').val();
  if (!url.match(regex)){
    M.toast({html: 'URL invalid, please introduce one valid URL.'})
    return;
  }
  document.getElementById('loader').style.display = 'block';

  var query = {
    site: url,
    reset: document.getElementById('reset').checked ? "on" : 'off',
    libstyle: document.getElementById('libstyle').checked ? "on" : 'off',
    header: document.getElementById('header').checked ? "on" : 'off',
    parser: document.getElementById('parser').value,
    engine: document.getElementById('engine').value,
    mode: document.getElementById('mode').value,
    format: document.getElementById('format').value,
  };

  $.post(document.location.origin + '/request?' + $.param( query )).done(function (response) {
    console.log(response);
    M.toast({
      html: response.message,
      displayLength: 10000
    })
    document.getElementById('loader').style.display = 'none';
  }).fail(function(e) {
    M.toast({
      html: response.message,
      displayLength: 10000
  })
    document.getElementById('loader').style.display = 'none';
    // alert('Something went wrong, try later!')
  })
}

$(document).ready(function() {
  $('.dropdown-trigger').dropdown();

  $('.fixed-action-btn').floatingActionButton();

  $('.collapsible').collapsible();
  $('#save').on('click', save_page)
  $('.tooltipped').tooltip();
  $('.sidenav').sidenav();
});
