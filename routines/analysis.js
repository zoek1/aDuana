
const { getContent, getContentFromBrowser } = require('./content');



var natural = require('natural');
var sw = require('stopword')
var Analyzer = natural.SentimentAnalyzer;
var stemmer = natural.PorterStemmer;
var analyzer = new Analyzer("English", stemmer, "afinn");
var Sentiment = require('sentiment');

function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}


function sentimentGroup(rate) {
  console.log(`+++++++++ ${rate}`)
  if (rate > 0.05) return 'Optimistic';
  if (rate < -0.05) return 'Pessimistic';
  return 'Neutral';
}

const sentimentRate = async (content, lang) => {
  natural.PorterStemmer.attach();

  try {
    let _analyzer;
    let _tokenizer;

    if (lang === 'ES') {
      _analyzer = new Analyzer("Spanish", stemmer, "afinn");
      _tokenizer = (text) => {
        return sw.removeStopwords(text.split(' '), sw.es)
      }
    }
    if (lang === 'FR') {
      _analyzer = new Analyzer("French", stemmer, "pattern");
      _tokenizer = (text) => {
        return sw.removeStopwords(text.split(' '), sw.fr)
      }
    }
    if (lang === 'IT') {
      _analyzer = new Analyzer("Italian", stemmer, "pattern");
      _tokenizer = (text) => {
        return sw.removeStopwords(text.split(' '), sw.it)
      }
    }
    if (lang === 'EN' || !lang) {
      _analyzer = new Analyzer("English", stemmer, "afinn");
      _tokenizer = (text) => {
        return  sw.removeStopwords(text.split(' '), sw.en)
      }
    }

    sentences = new natural.SentenceTokenizer().tokenize(content);

    var accum = 0;
    for (let index=0; index < sentences.length; index++) {
      var result = _tokenizer(sentences[index]);
      accum += _analyzer.getSentiment(result.words || result);
      // console.log(`${accum}: ${result}`)
    }
    let sentiment_rate = accum / sentences.length;
    return {
      sentiment_rate: sentiment_rate,
      sentiment_tokens: [],
      sentiment_group: sentimentGroup(sentiment_rate),
    }
  } catch (e) {
    console.log(e)
    return {
      sentiment_rate: 0,
      sentiment_tokens: [],
      sentiment_group: 'Unknown',
    }
  }
};

module.exports = {
  sentimentRate
};

if (require.main === module) {
  (async () => {
    natural.PorterStemmer.attach();
    let content = await getContent('https://cointelegraph.com/news/crypto-exchange-btse-eyes-50m-for-exchange-token-sale-on-liquid-network');

    var sentiment = new Sentiment();
    var result = sentiment.analyze(content.textContent);

    let tokens = content.textContent.tokenizeAndStem()
    console.log(analyzer.getSentiment(tokens));
    console.log(analyzer.getSentiment(result.words));

  })();
};