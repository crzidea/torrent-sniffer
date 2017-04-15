#!/usr/bin/env node

'use strict';
/**
 * Sample of using leveldb to store fetched torrent info.
 */
var P2PSpider = require('../lib');
var level = require('level');

var db = level('./leveldb');

var spider = P2PSpider({
  nodesMaxSize: 200,
  maxConnections: 400,
  timeout: 5000
});

spider.ignore(function (infohash, rinfo, callback) {
  db.get(infohash, function (err, value) {
    callback(!!err);
  });
});

spider.listen()

setInterval(() => spider.fetch(), 1000)

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

process.on('SIGINT', function () {
  db.close(function (err) {
    console.log("DB closed!");
    process.exit();
  });
});
