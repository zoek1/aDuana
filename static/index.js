/* global config, TTS */
'use strict';

let article;

let tts;

const args = new URLSearchParams(location.search);


const update = {
  async: () => {
    const prefs = config.prefs;
    let lh = 'unset';
    if (prefs['line-height']) {
      lh = prefs['font-size'] * (prefs['line-height'] === 32 ? 1.5 : 1.2) + 'px';
    }
    styles.internals.textContent = `body {
      font-size:  ${prefs['font-size']}px;
      font-family: ${getFont(prefs.font)};
      width: ${prefs.width ? prefs.width + 'px' : 'calc(100vw - 50px)'};
    }
    .page {
      line-height: ${lh};
    }
    h1, h2, h3 {
      line-height: initial;
    }`;
    document.querySelector('[data-id=no-height] input').checked = Boolean(prefs['line-height']) === false;
    document.querySelector('[data-id=full-width] input').checked = Boolean(prefs.width) === false;
    // as a CSS selector
    document.body.dataset.font = prefs.font;
    if (document) {
      document.body.dataset.font = prefs.font;
    }
  },
  images: () => {
    const bol = config.prefs['show-images'];
    const span = document.querySelector('[data-cmd="open-image-utils"]');
    if (bol) {
      span.classList.add('icon-picture-true');
      span.classList.remove('icon-picture-false');
    }
    else {
      span.classList.add('icon-picture-false');
      span.classList.remove('icon-picture-true');
    }
    document.body.dataset.images = bol;
  }
};

const iframe = document

const fontUtils = document.querySelector('#font-utils');
fontUtils.addEventListener('blur', () => {
  fontUtils.classList.add('hidden');
  window.focus();
});
const imageUtils = document.querySelector('#image-utils');
imageUtils.addEventListener('blur', () => {
  imageUtils.classList.add('hidden');
  window.focus();
});

const shortcuts = [];

/* printing */
{
  const span = document.createElement('span');
  span.title = 'Print in the Reader View (Meta + P)';
  span.classList.add('icon-print', 'hidden');
  span.id = 'printing-button';

  span.onclick = () => window.print();
  shortcuts.push({
    condition: e => e.code === 'KeyP' && (e.metaKey || e.ctrlKey),
    action: span.onclick
  });
  document.getElementById('toolbar').appendChild(span);
}
/* save as HTML*/
{
  const span = document.createElement('span');
  span.title = 'Save in HTML format (Meta + S)';
  span.classList.add('icon-save', 'hidden');
  span.id = 'save-button';
  span.onclick = () => {
    const content = document.documentElement.outerHTML;
    const blob = new Blob([content], {
      type: 'text/html'
    });
    const objectURL = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), {
      href: objectURL,
      type: 'text/html',
      download: article.title.replace( /[<>:"/\\|?*]+/g, '' ) + '.html'
    });
    link.dispatchEvent(new MouseEvent('click'));
    setTimeout(() => URL.revokeObjectURL(objectURL));
  };
  shortcuts.push({
    condition: e => e.code === 'KeyS' && (e.metaKey || e.ctrlKey) && !e.shiftKey,
    action: span.onclick
  });
  document.getElementById('toolbar').appendChild(span);
}
/* fullscreen */
{
  const span = document.createElement('span');
  span.title = 'Switch to the fullscreen reading (F9)';
  span.classList.add('icon-fullscreen', 'hidden');
  span.id = 'fullscreen-button';
  span.onclick = () => {
    if (iframe.requestFullscreen) {
      iframe.requestFullscreen();
    }
    else if (iframe.mozRequestFullScreen) {
      iframe.mozRequestFullScreen();
    }
    else if (iframe.webkitRequestFullScreen) {
      iframe.webkitRequestFullScreen();
    }
    else if (iframe.msRequestFullscreen) {
      iframe.msRequestFullscreen();
    }
  };
  shortcuts.push({
    condition: e => e.code === 'F9',
    action: span.onclick
  });
  document.getElementById('toolbar').appendChild(span);
}

/* images */
{
  const span = document.createElement('span');
  span.classList.add('hidden');
  span.id = 'images-button';
  span.title = 'Toggle images (Meta + Shift + I)';
  span.dataset.cmd = 'open-image-utils';
  shortcuts.push({
    condition: e => e.code === 'KeyI' && (e.metaKey || e.ctrlKey) && e.shiftKey,
    action() {
      localStorage.setItem('show-images', config.prefs['show-images'] === false);
    }
  });
  document.getElementById('toolbar').appendChild(span);
}

const styles = {
  top: document.createElement('style'),
  iframe: document.createElement('style'),
  internals: document.createElement('style')
};

function getFont(font) {
  console.log(font)
  switch (font) {
  case 'serif':
    return 'Georgia, "Times New Roman", serif';
  case 'sans-serif':
  default:
    return 'Helvetica, Arial, sans-serif';
  }
}

document.addEventListener('click', e => {
  const target = e.target.closest('[data-cmd]');
  if (!target) {
    return;
  }
  const cmd = target.dataset.cmd;
  console.log(cmd)
  if (cmd) {
    e.target.classList.add('active');
  }

  if (cmd.startsWith('font-type-')) {

    localStorage.setItem(
      'font', cmd.replace('font-type-', '')
    );
    config.prefs.font = cmd.replace('font-type-', '')
    update.async();

  }
  else if (cmd === 'font-decrease' || cmd === 'font-increase') {
    const size = config.prefs['font-size'];
    localStorage.setItem(
      'font-size', cmd === 'font-decrease' ? Math.max(9, size - 1) : Math.min(33, size + 1)
    );
    update.async();

  }
  else if (cmd === 'width-decrease' || cmd === 'width-increase') {
    const width = config.prefs.width;
    if (width) {
      localStorage.setItem(
        width, cmd === 'width-decrease' ? Math.max(300, width - 50) : Math.min(1000, width + 50)
      );
    }
    else {
      localStorage.setItem({
        width: 600
      });
    }
  }
  else if (cmd === 'full-width') {
    localStorage.setItem(
      'width', e.target.parentElement.querySelector('input').checked ? 600 : 0
    );
  }
  else if (cmd === 'line-height-type-1' || cmd === 'line-height-type-2') {
    localStorage.setItem(
      'line-height', cmd === 'line-height-type-1' ? 28.8 : 32
    );
  }
  else if (cmd === 'no-height') {
    localStorage.setItem(
      'line-height', e.target.parentElement.querySelector('input').checked ? 28.8 : 0
    );
  }
  else if (cmd.startsWith('color-mode-')) {
    localStorage.setItem(
      'mode', cmd.replace('color-mode-', '')
    );
    document.body.dataset.mode = document.body.dataset.mode = cmd.replace('color-mode-', '') || config.prefs.mode;

  }
  else if (cmd === 'open-font-utils') {
    fontUtils.classList.remove('hidden');
    fontUtils.focus();
    update.async();

  }
  else if (cmd === 'open-image-utils') {
    imageUtils.classList.remove('hidden');
    imageUtils.focus();
    update.async();
  }
  else if (cmd === 'image-increase' || cmd === 'image-decrease') {
    [...document.images].forEach(img => {
      const {width} = img.getBoundingClientRect();
      if (width >= 32) {
        const scale = cmd === 'image-increase' ? 1.1 : 0.9;
        img.width = Math.max(width * scale, 32);
        img.height = 'auto';
      }
    });
    update.async();
  }
  else if (cmd === 'image-show' || cmd === 'image-hide') {
    localStorage.setItem(
      'show-images',cmd === 'image-show'
    );
    update.async();

  }
});
/* transition */
document.getElementById('toolbar').addEventListener('transitionend', e => {
  e.target.classList.remove('active');
});

const render = () => {
  document.body.dataset.images = config.prefs['show-images'];
  document.body.dataset.mode = config.prefs.mode;

  // automatically detect ltr and rtl
  [...document.querySelectorAll('article>*')]
    .forEach(e => e.setAttribute('dir', 'auto'));


  document.head.appendChild(styles.internals);
  document.head.appendChild(styles.iframe);
  iframe.addEventListener('load', () => {
    // apply transition after initial changes
    document.body.dataset.loaded = document.body.dataset.loaded = true;
  });

  document.body.dataset.font = config.prefs.font;
};

// pref changes
config.onChanged.push(ps => {
  if (ps['top-css']) {
    styles.top.textContent = config.prefs['top-css'];
  }
  if (ps['user-css']) {
    styles.iframe.textContent = config.prefs['user-css'];
  }
  if (ps['font-size'] || ps['font'] || ps['line-height'] || ps['width']) {
    update.async();
  }
  if (ps['show-images']) {
    update.images();
  }
  if (ps['mode']) {
  }
});

// load
config.load(() => {
  document.body.dataset.mode = config.prefs.mode;
  if (config.prefs['printing-button']) {
    document.getElementById('printing-button').classList.remove('hidden');
  }
  if (config.prefs['save-button']) {
    document.getElementById('save-button').classList.remove('hidden');
  }
  if (config.prefs['fullscreen-button']) {
    document.getElementById('fullscreen-button').classList.remove('hidden');
  }
  if (config.prefs['speech-button']) {
    document.getElementById('speech-button').classList.remove('hidden');
  }
  if (config.prefs['images-button']) {
    document.getElementById('images-button').classList.remove('hidden');
  }
  update.images();
  update.async();

  styles.top.textContent = config.prefs['top-css'];
  document.appendChild(styles.top);
  styles.textContent = config.prefs['user-css'];

  if (config.prefs['navigate-buttons']) {
    document.getElementById('navigate').classList.remove('hidden');
  }

  render();
});
