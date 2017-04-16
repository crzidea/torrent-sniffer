#!/usr/bin/env node
/**
 * Sample of using leveldb to store sniffed torrent info.
 */
const Spider = require('../lib');
const level = require('level');
const path = require('path')

const db = level('./leveldb');

const spider = new Spider({
  nodesMaxSize: 200,
  maxConnections: 10,
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

function lowerCaseExtname(_path) {
  return path.extname(_path).toLowerCase()
}

spider.on('metadata', function (metadata) {
  const data = {};
  data.magnet = metadata.magnet;
  data.name = metadata.info.name ? metadata.info.name.toString() : '';
  if (metadata.info.files) {
    const extnames = new Set
    metadata.info.files.reduce((extnames, file) => {
      const extname = lowerCaseExtname(file.path.toString())
      return extnames.add(extname)
    }, extnames)
    data.extnames = [...extnames].join()
  } else {
    data.extnames = lowerCaseExtname(data.name)
  }
  db.put(metadata.infohash, JSON.stringify(data), function (err) {
    if (!err) {
      console.log(data.name);
    }
    //console.log(`holding ${spider.dht.nodes.count()} nodes`);
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
