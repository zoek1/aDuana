const JSDOM = require('jsdom').JSDOM;
const Readability = require('readability-nodejs').Readability;
const createDOMPurify = require('dompurify');
const axios = require('axios');
const Mercury = require('@postlight/mercury-parser');
const {getMetadata} = require('page-metadata-parser');
const {
  extract
} = require('article-parser');
const domino = require('domino');
const puppeteer = require('puppeteer');
const fs = require('fs');
const readabilityJsStr = fs.readFileSync('node_modules/readability/Readability.js', {encoding: 'utf-8'})
const meta = fs.readFileSync('static/page-metadata-parser.bundle.js', {encoding: 'utf-8'})
const mercury = fs.readFileSync('node_modules/@postlight/mercury-parser/dist/mercury.web.js', {encoding: 'utf-8'})

function executor() {
  return new Readability(document).parse();
}

function retrieveMetadata(){
  return metadataparser.getMetadata(window.document, window.location);
}

function runMercury() {
  return Mercury.parse()
}

const runnner = async (page, script, executor, name) => await page.evaluate(`
    (function(){
      ${script}
      ${executor}
      return ${name}();
    }())
  `);

async function getContentFromBrowser(site, parser, format, engine){
  let response;
  let html;
  let browser;
  let resultArticle;
  let resultMetadata;

  if (engine == 'simple' && (parser !== '' && parser !== 'readability')) {
    console.log('Simple Access')
    response = await axios.get(site);
    html = await response.data;
  }

  if (html === undefined) {
    console.log('Browser access')
    // based on this snippet https://gist.github.com/MrOrz/fb48f27f0f21846d0df521728fda19ce
    browser = await puppeteer.launch();
    html = await browser.newPage();

    try {
      await html.goto(site);
    } catch(e) {
      console.error(e);
      return null;
    }
  }

  if (parser == 'mercury') {
    if (engine == 'simple') {
      let options = {
        contentType: format || 'html',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1',
        },
        html: html
      };

      let c = await Mercury.parse(site, options);

      const doc = domino.createWindow(html).document;
      resultMetadata = getMetadata(doc, site);
      resultArticle = {content: c.content, title: c.title, excerpt:c.excerpt}
    } else {
      let c = await (runnner(html, mercury, runMercury, 'runMercury'))
      resultArticle = {content: c.content, title: c.title, excerpt:c.excerpt}
      resultMetadata = await runnner(html, meta, retrieveMetadata, 'retrieveMetadata')
    }
  } else if (parser == 'article-parser') {
    let c = await extract(site)
    if (engine == 'simple') {
      const doc = domino.createWindow(html).document;
      resultMetadata = getMetadata(doc, site);
    } else {
      resultMetadata = await runnner(html, meta, retrieveMetadata, 'retrieveMetadata')
    }

    resultArticle = {content: c.content, title: c.title, excerpt:c.description}
    resultMetadata.url = c.url
    resultMetadata.title = c.title
    resultMetadata.description = c.description
    resultMetadata.author = c.author

  } else {
    let c = await runnner(html, readabilityJsStr, executor, 'executor');
    resultMetadata = await runnner(html, meta, retrieveMetadata, 'retrieveMetadata')
    if (format == 'text') {
      resultArticle = {content: c.textContent, title: c.title, excerpt:c.excerpt}
    } else {
      resultArticle = {content: c.content, title: c.title, excerpt:c.excerpt}
    }

  }

  if (engine == 'browser') { browser.close(); }

  return {resultArticle, resultMetadata};
}


const generateJSONContent = (url, raw_content) => {
    let window = new JSDOM('').window;
    const DOMPurify = createDOMPurify(window);
    const clean = DOMPurify.sanitize(raw_content);
    let reader = new Readability(new JSDOM(clean, {url}).window.document);
    return reader.parse();
};

const getContent = async (url) => {
  try {
    let res =  await axios.get(url);
    if (res.status === 200) return generateJSONContent(url, res.data);
  } catch (e) {
    console.log(`No accesible: ${url}`);
  }

  return null;
};

if (require.main === module) {
  const argv = require('yargs')
    .usage('Usage: $0 <command> [options]')
    .command('clean', 'Get reader view of the articles', (yargs) => {
      yargs.positional('url', {
        alias: 'u',
        description: 'URL to get content',
        type: 'string'
      })
    })
    .help('help')
    .argv;
  console.log(argv)
  if (argv.url) {
    getContentFromBrowser(argv.url).then((r) => r && console.log(r.textContent))
  }
}

module.exports = {
  getContent,
  getContentFromBrowser
};
