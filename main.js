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
const {getContentEmbedded, getContentAndMetadataEmbedded} = require("./routines/bundler")


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
  .command('relevant', 'The permafeed indexer')
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
const MINUTES = '0 */3 * * * *';

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


const build_document = async (feed, entry, url) => {
  // TODO: add sentiment analisys
  let browser = !entry['dc:content'] && !entry['content:encoded'];
  let lang = feed.language ? feed.language.split('-')[0].toUpperCase() : ''
  const {sentiment_rate, sentiment_tokens, sentiment_group} = await sentimentRate(entry.link || entry.url, browser, lang);

  let data = {
    site: {
      title: feed.title,
      link: feed.link,
      date: feed.pubDate,
      description: feed.description,
      sentiment_rate: sentiment_rate,
      sentiment_group: sentiment_group,
      copyright: feed.copyright,
      language: feed.language
    },
    stats: {
     text: 'No estimated',
     minutes: 0,
     time: 0,
     words: 0
    },
    item: entry,
    feedUrl: url,
    pubDateObj: new Date(entry.pubDate),
    published: false, tx: null
  };


  if (browser) {
    let content = await getContentFromBrowser(entry.guid || entry.link);
    if (content !== null) {
      data.item.content = content.content;
      data.stats = readingTime(content.content)
    } else {
      data.item['dc:content'] = ''
    }
  } else {
    data.stats = readingTime(entry['dc:content'] || entry['content:encoded'])
  }
  // console.log(data)

  return data
};

const buildTxData = (next) => {
  console.log(next.item);
  let item = next.item;
  return {
    title: item.title,
    link: item.link,
    guid: item.guid,
    publicationDate: item['isoDate'],
    author: (item['dc:creator'] || item['creator'].trim() || '').trim(),
    description: (item['description'] || item['contentSnippet'] || '').trim(),
    categories: next.item.categories || [],
    language: next.site.language ? next.site.language.split('-')[0].toUpperCase() : '',
    site: {
      description: next.site.description,
      title: next.site.title,
      copyright: next.site.copyright || ""
    },
    readingStats: next.stats,

    sentiment: {
      rate: next.site.sentiment_rate,
      group: next.site.sentiment_group, // Implement this
    },
    content: (item['content:encoded'] || item['content:encoded'] || item.content).trim(), // Check other content tags
    media: item.enclosure || {},
  };
};

const buildTxTags = (next) => {
  let tags = {
    'Feed-Name': APP_NAME,
    'Feed-Version': APP_VERSION,
    'Sentiment-Rate': Math.round(next.site.sentiment_rate),
    'Sentiment-Group': next.site.sentiment_group,
    'Publication-Date': next.pubDateObj.toISOString().slice(0,10),
    'Publication-Time': next.pubDateObj.toISOString().slice(11,16),
    'Publication-Feed': next.feedUrl,
    'Publication-URL': next.item.guid || next.item.link,
    'Publication-Lang': next.site.language ? next.site.language.split('-')[0].toUpperCase() : '',
    'Publication-Author': (next.item['dc:creator'] || next.item['creator'] || '').trim(),
    'Site-Title': next.site.title,
    'Copyright': next.site.copyright !== undefined && next.site.copyright !== null && next.site.copyright !== '',
    'Content-Type': 'application/json',
    'Reading-Time': Math.round(next.stats.minutes),
  };

  if (next.item.categories !== null && next.item.categories !== undefined &&
      next.item.categories.length > 0) {
    for (let i=0; i<5; i++) {
      if (next.item.categories[i] !== undefined && next.item.categories[i] !== null) {
        tags[`Category_${i}`] = next.item.categories[i].toLowerCase();
      }
    }
  }

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

  // deployEntries.start()
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
