#!/usr/bin/env node

'use strict';
/**
 * Sample of using leveldb to store fetched torrent info.
 */
var Spider = require('../lib');
var level = require('level');

var db = level('./leveldb');

var spider = new Spider({
  nodesMaxSize: 200,
  maxConnections: 100,
  timeout: 5000
});

spider.ignore(function (infoHash, rinfo, callback) {
  db.get(infoHash, (err, value) => {
    callback(value);
  });
});

spider.dht.on('node', () => {
  //console.log(`${spider.dht.nodes.count()} nodes found`);
})

spider.on('metadata', function (metadata) {
  var data = {};
  data.magnet = metadata.magnet;
  data.name = metadata.info.name ? metadata.info.name.toString() : '';
  data.fetchedAt = new Date().getTime();
  db.put(metadata.infohash, JSON.stringify(data), function (err) {
    if (!err) {
      console.log(data.name);
    }
  });
});

spider.start(20000, () => {
  const { address, port } = spider.dht.address()
  console.log('UDP Server listening on %s:%s', address, port);
})

setInterval(() => spider.sniff(), 1000)

process.on('SIGINT', function () {
  db.close(function (err) {
    console.log("DB closed!");
    process.exit();
  });
});
