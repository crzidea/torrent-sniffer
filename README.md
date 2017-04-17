## Introduction
p2pspider is a crawler combined with DHT Spider and BitTorrent Client.

It crawls what people are downloading on the worldwide DHT Network, and `metadata` (the core data of a torrent) from remote BitTorrent Clients. p2pspider also generates magnet URLs, you can import the URLs to your local BitTorrent Client in order to download the resources you want.

You can also use p2pspider to build your own torrents database(e.g: The Pirate Bay) for data mining and analyzing.

## Install
```
git clone https://github.com/dontcontactme/p2pspider
```

## Usage

Before using this, please ensure your `node` version `>=0.12.0`.

```js
'use strict';

var P2PSpider = require('../lib');

var p2p = P2PSpider({
    nodesMaxSize: 200,   // be careful
    maxConnections: 400, // be careful
    timeout: 5000
});

p2p.ignore(function (infohash, rinfo, callback) {
    // false => always download the metadata even though the metadata exists.
    var theInfohashIsExistsInDatabase = false;
    callback(theInfohashIsExistsInDatabase);
});

p2p.on('metadata', function (metadata) {
    // At this point, you can extract data and save into database.
    console.log(metadata);
});

p2p.listen(6881, '0.0.0.0');
```

## Contribute
After forking the code, use ```npm install``` to install required packages. Run ```node test/index.js``` to review results.

## Protocols
[bep_0005](http://www.bittorrent.org/beps/bep_0005.html), [bep_0003](http://www.bittorrent.org/beps/bep_0003.html), [bep_0010](http://www.bittorrent.org/beps/bep_0010.html), [bep_0009](http://www.bittorrent.org/beps/bep_0009.html)

## Thanks
When I was developing this project, I referenced some code from [bittorrent-protocol](https://github.com/feross/bittorrent-protocol) and  [ut_metadata](https://github.com/feross/ut_metadata), thanks to their author,  [@feross](https://github.com/feross)'s pointing.

## Notice
Please don't share the data p2pspider crawled to the internet. Because sometimes it crawls sensitive/copyrighted/porn data.

## License
MIT
