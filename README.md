# aDuana


## Install dependencies

```
yarn install
```

The project stores info about the sites to haverst its feed, So we need to up mongo to store such data as following:
```
docker run -d -p 127.0.0.1:27017:27017 --name mongo mongo
```

## Run the server
Before start the permafeed agregator/app ensure you have enough funds to save posts/news to Arwaeave!
```
node main.js -w wallet.json -p 80 -H 0.0.0.0
```

If you have some error with respect to insecure content I recommend use certbot and nginx to configure ssl certificates. Go this site for more details: https://certbot.eff.org/lets-encrypt/ubuntubionic-nginx
Also, you can open an issue in this repo to provide this configuration.


## Requirements
All requirements MUST be met for the entry to be eligible.

### Basic Requirements
- [ ] Build an HTTP Service & UI to be hosted and run in the standard way (FaaS, Container, Server, it's your choice), that allows users to paste a URL and have a readable version of the content archived onto the Arweave Permaweb.
- [ ] The code must be publicly available on GitHub with an open-source license.
- [ ] The service should inform users that they are responsible for the content they archive and they should not archive copyrighted content that they do not own.

### Functional Requirements
- [ ] Users are able to paste in a URL and see a preview of the readable content.
- [X] Users are able to publish the readable content to the permaweb and get back a permaweb link.

- [X] The published permaweb content should not link or reference any content that is not on the permaweb, for example, any images, if included, must be saved on the permaweb.
Favicon, thumbnail are deployed is its own transaction due to render and spec limitation, all the contect as images, fonts, and so on are injected into the main document.
- **Article**: https://viewblock.io/arweave/tx/NiFui2fT7CsWrLznIfseHJ8YNWPq4PwVrkywnKajh-M
- **Thumbnail**: https://viewblock.io/arweave/tx/8sA9U2OPsCsgZ7KbKZpJo9AWDuy-jfz0YBGUTR94fdY
- **favicon**: https://viewblock.io/arweave/tx/7fbtOpELEf5DFYEF_Cx2z0pj4JdjPM6Rjnk7P74Zir4

- [X] The published permaweb content should contain open graph meta tags, for example, title, description, image, so that posting to social media & messengers shows a preview card of the content.
![screenshots](/screenshots/fb.png)
![screenshots](/screenshots/twitter.png)
- [X] The original URL must be included in the tag of the transaction. Other metadata included in tags is a plus.
Reading time, Sentiment analisis, and the URL are included as tags:
![screenshots](/screenshots/tags.png)


### Deployment & Running Requirements
- [X] The service should use a wallet stored on the server to post content. This wallet will be funded by donations, so the wallet address should be made public. Arweave can donate some AR to the wallet to keep the service running initially.
At the bottom on each page one leged request the use consider donate, the address is provided to receive donations.
Match the following address [](https://viewblock.io/arweave/address/3X2TcbNZHoMcqZKlEupwH_KcoTlCgNTW0KUXq1dL998)
- [X] The service should not depend on any third-party APIs that may disappear.
No 3rd party APIs are used in the project.
- [X] The service should be deployed and publicly usable on completion of the bounty.
See [](https://aduana.gordian.dev/)
- [X] It should be reasonably easy to deploy the service again for another developer.
See Install dependencies and Run the server sections


## Opportunities to improve

## License
See [LICENSE](/LICENSE)
