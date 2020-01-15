let Parser = require('rss-parser');

const parser = new Parser();

const parseRSSFeed = async (url) => {
  let feed = await parser.parseURL(url);
  return feed;
};

const getLastEntry = (feed) => {
  let res = feed.items.map(item => [new Date(item.pubDate), item]).reduce((prev, current)  => {
    if (prev === null || prev[0] <= current[0]) return current;
    return prev;
  }, null);

  return res[1]
};

const getEntriesSince = (feed, date) => {
  return feed.items.filter(item => new Date(item.pubDate) > date);
};


const parseDateName = (dateName) => {
  let date = new Date();

  if (dateName === 'yesterday') date.setDate(date.getDate() - 1);
  else if (dateName === 'week') date.setDate(date.getDate() - 7);
  else if (dateName === 'month') date.setDate(date.getDate() - 30);

  return date;
};

if (require.main === module) {

  const argv = require('yargs')
    .usage('Usage: $0 <command> [options]')
    .command('parse', 'Parse feed', (yargs) => {
      yargs.positional('feedUrl', {
        alias: 'f',
        description: 'Feed URL to parse',
        type: 'string'
      }).option('last', {
        alias: 'l',
        description: 'Display the last entry',
        type: 'bool',
      }).option('since', {
        alias: 's',
        description: 'Display since the provided date',
        nargs: 1,
        choices: ['yesterday', 'month', 'week'],
        type: 'string'
      })

    })
    .help('help')
    .argv;

  if (argv.feedUrl) {
    parseRSSFeed(argv.feedUrl).then((r) => {
      console.log(`Title: ${r.title}`);
      console.log(`Description: ${r.description}`);
      console.log(`Link: ${r.link}`);
      console.log(`Items: ${r.items.length}`);
      console.log(parseDateName(argv.since))
      if (argv.since) getEntriesSince(r, parseDateName(argv.since)).forEach(e => {
        console.log(`[${e.pubDate}] ${e.title} `);
      });
      else if (argv.last) console.log(getLastEntry(r));

    })
  }
}

module.exports = {
  parseRSSFeed,
  getEntriesSince
};