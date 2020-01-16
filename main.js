const fs = require('fs');
const parse = require('url-parse');
const Hapi = require('@hapi/hapi');
const mongo = require('mongodb').MongoClient;
const CronJob = require('cron').CronJob;
const crypto = require("crypto");
const Boom = require('@hapi/boom')
const readingTime = require('reading-time');
const axios = require('axios');

const {initArweave, isTxSynced, dispatchTX} = require('./routines/arweave');
const {parseRSSFeed, getEntriesSince} = require('./routines/feeds');
const {sentimentRate} = require('./routines/analysis');
const {getContentFromBrowser} = require("./routines/content");
const {getContentEmbedded, getContentAndMetadataEmbedded, downloadRemote} = require("./routines/bundler")


const config_js = fs.readFileSync('static/config.js', {encoding: 'utf-8'})
const fontello_css = fs.readFileSync('static/fontello.css', {encoding: 'utf-8'})
const index_css = fs.readFileSync('static/index.css', {encoding: 'utf-8'})
const index_js = fs.readFileSync('static/index.js', {encoding: 'utf-8'})
const mini_dark = fs.readFileSync('node_modules/mini.css/dist/mini-dark.min.css')
const mini_default = fs.readFileSync('node_modules/mini.css/dist/mini-default.min.css')
const mini_nord = fs.readFileSync('node_modules/mini.css/dist/mini-nord.min.css')
const mili = fs.readFileSync('node_modules/milligram/dist/milligram.min.css')

const argv = require('yargs')
  .usage('Usage: $0 <command> [options]')
  .command('aduana', 'The line between the web and the permaweb')
  .option('port', {
    alias: 'p',
    nargs: 1,
    description: 'server port number',
    default: 1908,
    type: 'number'
  })
  .option('host', {
    alias: 'H',
    nargs: 1,
    description: 'server host address',
    default: 'localhost',
    type: 'string'
  })
  .option('arweave', {
    alias: 'a',
    nargs: 1,
    coerce: parse,
    description: 'Arweave URL host',
    default: 'https://arweave.net',
    type: 'string'
  })
  .option('wallet-file', {
    alias: 'w',
    nargs: 1,
    description: 'wallet to get ar tokens',
    demandOption: 'Specify a wallet file',
    type: 'string'
  })
  .help('help')
  .argv;


const raw_wallet = fs.readFileSync(argv.walletFile);
const wallet = JSON.parse(raw_wallet);

const arweave = initArweave(argv.arweave);

const url = 'mongodb://localhost:27017';

let client;
let db;

const APP_NAME = 'aDuana';
const APP_VERSION = '1.0';

const HOURLY = '0 0 */1 * * *';
const MINUTES = '30 * * * * *';

const getSiteDomain = (site_raw) => {
  console.log(site_raw)
  let site = parse(site_raw);
  let domain = site.host
  let protocol = site.protocol || 'http:'
  let path = site.pathname || '/'
  let fullsite = `${protocol}//${domain}${path}`

  return {
    fullsite,
    protocol,
    path,
    domain: site.host.split('.').slice(-2).join('.'),
    feedUrl: site_raw
  };
};


const build_document = async ({page}) => {
  let doc;
  if (page.type === 'text/html') {
    doc = {
      site: {
        title: page.resultMetadata.title,
        link: page.url,
        domain: page.site.domain,
        description: page.resultMetadata.description,
        sentiment_rate: page.resultMetadata.sentiment_rate,
        sentiment_group: page.resultMetadata.sentiment_group,
        language: page.resultMetadata.language,
        provider: page.resultMetadata.provider
      },
      stats: page.stats,
      type: 'text/html',
      item: {
        parser: page.parser,
        mode: page.mode,
        reset: page.reset,
        libstyle: page.libstyle,
        header: page.header,
        format: page.format,
        engine: page.engine,
        data: page.data,
        favicon: page.favicon,
        image: page.thumbnail
      },
      url: page.url,
      pubDateObj: new Date(),
      published: false, tx: null
    };
  } else {
    doc = {
      url: page.url,
      ref: page.ref,
      item: page.data,
      type: page.type
    }
  }

  return doc
};

const buildTxData = (next) => {
  console.log(next.url);
  if (next.type === 'text/html') {
    return next.item.data.content
  }

  return new Buffer(next.item, 'base64');
};

const buildTxTags = (next) => {
  let tags;

  if (next.type === 'text/html') {
    tags = {
      'Feed-Name': APP_NAME,
      'Feed-Version': APP_VERSION,
      'Sentiment-Rate': Math.round(next.site.sentiment_rate),
      'Sentiment-Group': next.site.sentiment_group,
      'Publication-Date': next.pubDateObj.toISOString().slice(0,10),
      'Publication-Time': next.pubDateObj.toISOString().slice(11,16),
      'Publication-Domain': next.site.domain,
      'Publication-Provider': next.site.provider,
      'Publication-URL': next.url,
      'Publication-Lang': next.site.language ? next.site.language.split('-')[0].toUpperCase() : '',
      'Site-Title': next.site.title,
      'Content-Type': next.type,
      'Reading-Time': Math.round(next.stats.minutes),
    }
  } else {
    tags = {
      'Content-Type': next.type,
      'Publication-Date': next.pubDateObj.toISOString().slice(0,10),
      'Publication-Time': next.pubDateObj.toISOString().slice(11,16),
      'Publication-URL': next.url,
      'Reference-Page': next.url
    }
  }

  // if (next.item.categories !== null && next.item.categories !== undefined &&
  //    next.item.categories.length > 0) {
  //  for (let i=0; i<5; i++) {
  //    if (next.item.categories[i] !== undefined && next.item.categories[i] !== null) {
  //      tags[`Category_${i}`] = next.item.categories[i].toLowerCase();
  //    }
  //  }
  // }

  console.log(tags)
  return tags;
};

const start_jobs = async () => {
  console.log(`Start jobs`);

  // Deploy next entry
  let deployEntries = new CronJob(MINUTES, async function(){
    let collection = db.collection('entries');
    console.log(`== Check sincronization`);
    let last = await collection.findOne({published: false, tx: {$ne: null}});
    if (last !== undefined && last !== null && last !== '') {
      console.log(`== Active Tx: _id: ${last._id} td: ${last.tx}`);
      let synced = await isTxSynced(arweave, last.tx);
      console.log(synced.confirmed)
      console.log(`Transaction status: ${synced.status} - ${synced.confirmed}`);
      if (synced.confirmed !== null && typeof  synced.confirmed === 'object' && synced.confirmed.number_of_confirmations > 1) {
        console.log(`Liberando: ${last.tx}`);
        collection.update({_id: last._id}, {$set: { published: true }})
      }
    } else {
      console.log(`== Select next entry`);
      let next = await db.collection('entries').findOne({tx: null});
      if (next === undefined || next === null || next === '') {
        console.log('--- No task exists')
	      return;
      }
      console.log(next)
      console.log(`${next._id} : ${next.item.title}`);

      let {response, tx} = await dispatchTX(arweave, buildTxData(next), buildTxTags(next), wallet)
      console.log(response.data)
      if (response.status === 200) {
        console.log(`New pending transaction: ${tx.get('id')}`);
        collection.update({_id: next._id}, {$set: {'tx': tx.get('id'), published: false }})
      }
    }
  });

  deployEntries.start()
};

const init = async () => {
  const server = Hapi.server({
    port: argv.port,
    host: argv.host
  });

  await server.register(require('@hapi/vision'));
  server.views({
    engines: {
      html: require('ejs')
    },
    relativeTo: __dirname,
    path: 'templates'
  });

  server.route({
    method: 'GET',
    path: '/',
    handler: async (request, h) => {
      try {
        const address = await arweave.wallets.jwkToAddress(wallet);
        const balance = await arweave.wallets.getBalance(address);

        return h.view('index', {address, balance});
      } catch(e){console.log(e)}
    }
  });

  server.route({
    method: 'GET',
    path: '/activity',
    handler: async (request, h) => {
      try {
        const address = await arweave.wallets.jwkToAddress(wallet);
        const balance = await arweave.wallets.getBalance(address);

        return h.view('feed', {address, balance});
      } catch(e){console.log(e)}
    }
  });

  server.route({
    method: 'GET',
    path: '/migration',
    handler: async (request, h) => {
      try {
        const address = await arweave.wallets.jwkToAddress(wallet);
        const balance = await arweave.wallets.getBalance(address);

        return h.view('preview', {address, balance});
      } catch(e){console.log(e)}
    }
  });

  server.route({
    method: 'GET',
    path: '/preview',
    handler: async (request, h) => {
      try{
        let sites = db.collection('entries');
        let site_raw = request.query.site;
        let parser = request.query.parser;
        let mode = request.query.mode || 'sepia';
        let reset = request.query.reset === 'on';
        let libstyle = request.query.libstyle === 'on';
        let header = request.query.header === 'on';
        let format = request.query.format || 'html';
        let engine = request.query.engine || 'browser';
        let obj_site = parse(site_raw);
        let domain = obj_site.host;

        if (domain === '' || domain === undefined) {
          return Boom.badData('Url format must be protocol://domain/path');
        }

        const address = await arweave.wallets.jwkToAddress(wallet);
        let {resultArticle, resultMetadata} = await getContentAndMetadataEmbedded(site_raw, parser, format, engine);
        let stats = readingTime(resultArticle.content)

        return h.view('template', {
          header,
          address,
          config_js,
          fontello_css,
          index_css,
          index_js,
          mini_dark,
          mini_default,
          mini_nord,
          mini: libstyle,
          mili,
          reset,
          libstyle,
          stats,
          mode,
          content: resultArticle.content,
          metadata: resultMetadata,
          author: resultMetadata.author || ""
        });
      } catch(e){
        console.log(e);
        return Boom.badImplementation(`${e}`);
      }
    }
  });

  server.route({
    method: 'GET',
    path: '/request',
    handler: async (request, reply) => {
      try{
        let sites = db.collection('entries');
        let site_raw = request.query.site;
        let parser = request.query.parser;
        let format = request.query.format || 'html';
        let engine = request.query.engine || 'browser';
        let obj_site = parse(site_raw);
        let domain = obj_site.host;

        if (domain === '' || domain === undefined) {
          return Boom.badData('Url format must be protocol://domain/path');
        }

        let site = await sites.findOne({url: site_raw});
        if (site === null) {
          let {resultArticle, resultMetadata} = await getContentAndMetadataEmbedded(site_raw, parser, format, engine);
          let stats = readingTime(resultArticle.content)

          return {
            status: 'ok',
            data: resultArticle,
            metadata: resultMetadata,
            stats
          };
        } else {
          console.log('** URL Saved');

          return {
            status: 'ok',
            message: 'Site already exists'
          };
        }
      } catch(e){
        console.log(e);
        return Boom.badImplementation(`${e}`);
      }
    }
  });

  server.route({
    method: 'POST',
    path: '/request',
    handler: async (request, h) => {
      try{
        let sites = db.collection('entries');
        let site_raw = request.query.site;
        let parser = request.query.parser;
        let mode = request.query.mode || 'sepia';
        let reset = request.query.reset === 'on';
        let libstyle = request.query.libstyle === 'on';
        let header = request.query.header === 'on';
        let format = request.query.format || 'html';
        let engine = request.query.engine || 'browser';
        let obj_site = parse(site_raw);
        let domain = obj_site.host;

        if (domain === '' || domain === undefined) {
          return Boom.badData('Url format must be protocol://domain/path');
        }

        let site = await sites.findOne({url: site_raw});
        if (site === null) {
          const address = await arweave.wallets.jwkToAddress(wallet);
          let {resultArticle, resultMetadata} = await getContentAndMetadataEmbedded(site_raw, parser, format, engine);
          let stats = readingTime(resultArticle.content)

          var favicon = { _id: null };
          var thumbnail = { _id: null };

          if (resultMetadata.icon) {
            let icon = await downloadRemote(resultMetadata.icon)
            favicon = await sites.insertOne(build_document({
              url: resultMetadata.icon,
              data: icon.data.toString('base64'),
              type: icon.data.type,
              ref: site_raw
            }));
          }
          if (resultMetadata.image) {
            let image = await downloadRemote(resultMetadata.image);
            thumbnail = await sites.insertOne(build_document({
              url: resultMetadata.image,
              data: image.data.toString('base64'),
              type: image.data.type,
              ref: site_raw
            }));
          }

          const new_site = await sites.insertOne(build_document({
            url: site_raw,
            site: getSiteDomain(site_raw),
            stats,
            type: 'text/html',
            parser,
            mode,
            reset,
            libstyle,
            header,
            format,
            engine,
            data: resultArticle,
            resultMetadata,
            favicon: favicon._id,
            image: thumbnail._id
          }));

          return {
            status: 'ok',
            message: 'The site will be available at https://generator.gordian.dev/redirect?id=' + new_site._id
          };

        }  else {
          console.log('** URL Saved');

          return {
            status: 'ok',
            message: 'Site already exists'
          };
        }

      } catch(e){
        console.log(e);
        return Boom.badImplementation(`${e}`);
      }
    }
  });


  client = await mongo.connect(url, {useNewUrlParser: true});
  db = client.db('aduana');

  await start_jobs();
  await server.start();
  console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

process.on('uncaughtException', function (err) {
  console.log(err);
  process.exit(1);

});

init();
