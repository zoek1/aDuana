const Axios = require('axios');
var cloudscraper = require('cloudscraper');

const context = require('inline-source/lib/context');
const parse = require('inline-source/lib/parse');
const run = require('inline-source/lib/run');
const {getContentFromBrowser} = require('./content')

var inlineSource = async (html, options) => {
  return new Promise(async (resolve, reject) => {
    const ctx = context.create(options);
    // Load html content

    ctx.html = html;

    try {
      await parse(ctx);
      if (ctx.sources.length > 0) {
        await run(ctx, ctx.sources, ctx.swallowErrors);
      }
    } catch (err) {
      return reject(err);
    }

    ctx.sources.forEach((source) => {
      source.size = {bytes: source.content ? source.content.length : 0};
      delete source.parentContext;
      delete source.fileContent;
      delete source.content;
      delete source.replace;
      delete source.stack
      if (!source.errors) {
        source.errors = [];
      }
    });

    try {
    ctx.errors = ctx.sources.reduce((carry, current) => carry || current.errored)
    } catch (e) {
      console.error(e)
    }
    resolve(ctx);
  });
}


const runner = async (entry, options) => {
  const build = await build(entry, options);
  return Buffer.from(build.html);
}

const build = async (entry, options) => {
  const build = await inlineSource(entry, {
    attribute: false,
    compress: true,
    saveRemote: false,
    svgAsImage: true,
    swallowErrors: true,
    ignore: [],
    handlers: [
      (async (source, context) => {
        if (!source.errors) {
          source.errors = [];
        }
        if (!source.subResources) {
          source.subResources = [];
        }
        if (source.type == 'image'){

          return await importRemoteImages(entry, source, context, logger);
        }
        if (source.fileContent && !source.content && source.type == 'css') {
          return await importCssUrls(entry, source, context, logger);
        }
      })
    ]
  });

  if (!build.html) {
    build.html = '';
  }

  build.sources.forEach(source => {
    if (source.errored && !source.errors.length) {
      source.errors.push({
        message: `Failed to import resource - Not found`,
      });
    }
  });

  return build;
}

const importRemoteImages = async (entry, source, context, logger) => {
  if (source.isRemote && source.type == 'image') {
    try {
      const response = await downloadRemote(source.sourcepath);
      source.fileContent = response.data;
    } catch (error) {
      console.log(error)
      source.errored = true;
      source.errors.push({
        message: `${error.message}`,
        response: {
          status: error.response ? error.response.status : null,
          statusText: error.response ? error.response.statusText : null,
          headers: error.response ? error.response.headers : null,
        }
      });
    }
  }
}

const importCssUrls = async (entry, source, context, logger) =>  {

  let css = source.fileContent;
  let output = `<style>\n${css}\n</style>`;

  const urlRegexGlobal = /.*url\(([^\)]+)\).*/gi;

  let match = null;

  while (match = urlRegexGlobal.exec(css)) {
    try {
      const cssLine = match[0];
      const cssUrl = match[1];

      // Remove any quotes or whitespace that might be encasing the path as it's perfectly valid in CSS
      // but we need clean path to work with. Remove any query params or # locations as they won't be valid paths.
      let path = cssUrl.replace(/^'\//g, '').replace(/('|")/g, '').trim();

      // Data urls don't need us to do anything as they're already inline
      if (path.startsWith('data:')) {
        continue;
      }

      if (path.startsWith('http://') || path.startsWith('https://')) {
        try {

          const response = await downloadRemote(path);
          const b64Encodded = response.data.toString('base64');

          output = output.replace(cssUrl, `data:${response.type};base64,${b64Encodded}`)

          source.subResources.push({
            type: response.type,
            path: path,
            isRemote: true,
            size: {
              bytes: b64Encodded.length
            },
            context: truncate(cssLine, 200)
          });

        } catch (error) {
          source.errored = true;
          source.errors.push({
            message: `File not found: ${path}`,
            path: path,
            context: {
              path: source.filepath,
              line: cssLine.trim()
            },
            response: {
              status: error.response ? error.response.status : null,
              statusText: error.response ? error.response.statusText : null,
              headers: error.response ? error.response.headers : null,
            }
          });
          continue;
        }

      }
    } catch (error) {
      source.errored = true;
      source.errors.push({
        message: `${error.message} ${error.stack}`,
        response: {
          status: error.response ? error.response.status : null,
          statusText: error.response ? error.response.statusText : null,
          headers: error.response ? error.response.headers : null,
        }
      });
    }
  }

  source.content = output;
}

async function downloadRemote(url) {
  const response = await Axios.get(url, {
    responseType: 'arraybuffer'
  });

  // console.log(response)
  // if (response.headers.server == 'cloudflare') {
  //  throw new Error('Cloudfare is blocking the resource')
  // }


  return {
    data: response.data,
    type: response.headers['content-type']
  }
}

function truncate(string, length){
  let trimmed = string.trim();
  return trimmed.length > length ? trimmed.substring(0, 100) + '...' : trimmed;
}

const getContentEmbedded = async (url, parser, format, engine) => {
  let {resultArticle, resultMetadata} = await getContentFromBrowser(url, parser, format, engine);

  if (resultArticle)  {
    inlineSource(resultArticle.content, {
      attribute: false,
      compress: true,
      saveRemote: false,
      svgAsImage: true,
      swallowErrors: true,
      ignore: [],
      handlers: [
        (async (source, context) => {
          if (!source.errors) {
            source.errors = [];
          }
          if (!source.subResources) {
            source.subResources = [];
          }
          if (source.type == 'image'){
            return await importRemoteImages(resultArticle.content, source, context);
          }
          if (source.fileContent && !source.content && source.type == 'css') {
            return await importCssUrls(resultArticle.content, source, context);
          }
        })
      ]
    }).then((c) => { // console.log(c)
    })
  }

  return {resultArticle, resultMetadata}
};


const getContentAndMetadataEmbedded = async (url, parser, format, engine) => {
  let {resultArticle, resultMetadata} = await getContentEmbedded(url, parser, format, engine);

  let content = await inlineSource(resultArticle.content, {
    attribute: false,
    compress: true,
    saveRemote: false,
    svgAsImage: true,
    swallowErrors: true,
    ignore: [],
    handlers: [
      (async (source, context) => {

        if (!source.errors) {
          source.errors = [];
        }
        if (!source.subResources) {
          source.subResources = [];
        }
        if (source.type == 'image'){
          return await importRemoteImages(resultArticle.content, source, context);
        }
        if (source.fileContent && !source.content && source.type == 'css') {
          return await importCssUrls(resultArticle.content, source, context);
        }
      })
    ]
  })
  resultArticle.content = content.html;
  // if (resultMetadata.icon) {
  //  resultMetadata.iconData = (await downloadRemote(resultMetadata.icon)).toString('base64')
  // }
  // if (resultMetadata.image) {
  //  resultMetadata.imageData = (await downloadRemote(resultMetadata.image)).toString('base64')
  // }

  return {resultArticle, resultMetadata};
};

if (require.main === module) {
  var { inlineSource } = require('inline-source');

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
    let res = getContentFromBrowser(argv.url);
    res.then(({resultArticle, resultMetadata}) => resultArticle && inlineSource(resultArticle.content, {
      attribute: false,
      compress: true,
      saveRemote: false,
      svgAsImage: true,
      swallowErrors: true,
      ignore: [],
      handlers: [
        (async (source, context) => {
          if (!source.errors) {
            source.errors = [];
          }
          if (!source.subResources) {
            source.subResources = [];
          }
          if (source.type == 'image'){
            return await importRemoteImages(resultArticle.content, source, context);
          }
          if (source.fileContent && !source.content && source.type == 'css') {
            return await importCssUrls(resultArticle.content, source, context);
          }
        })
      ]
    }).then((c) => { // console.log(c)
    }))
    res.then(async ({resultArticle, resultMetadata}) => {
      if (resultMetadata.icon) {
        resultMetadata.iconData = (await downloadRemote(resultMetadata.icon)).toString('base64')
      }
      if (resultMetadata.image) {
        resultMetadata.imageData = (await downloadRemote(resultMetadata.image)).toString('base64')
      }
      console.log(resultMetadata);
    });
  }
}

module.exports = {
  getContentEmbedded,
  getContentAndMetadataEmbedded,
  downloadRemote
};