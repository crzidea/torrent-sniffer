#!/usr/bin/env node
/**
 * Sample of using leveldb to store sniffed torrent info.
 */
const Sniffer = require('../lib');
const level = require('level');
const path = require('path')

const db = level('./leveldb');

const sniffer = new Sniffer({
  nodesMaxSize: 200,
  maxConnections: 10,
  timeout: 5000
});

sniffer.ignore((infoHash, callback) => {
  db.get(infoHash, (err, value) => {
    callback(value);
  });
});

function lowerCaseExtname(_path) {
  return path.extname(_path).toLowerCase()
}

sniffer.on('metadata', (torrent, callback) => {
  const data = {};
  data.magnet = torrent.magnetURI;
  data.name = torrent.info.name ? torrent.info.name.toString() : '';
  if (torrent.info.files) {
    const extnames = new Set
    torrent.info.files.reduce((extnames, file) => {
      if (!file.path) {
        return extnames
      }
      const extname = lowerCaseExtname(file.path.toString())
      return extnames.add(extname)
    }, extnames)
    data.extnames = [...extnames].join()
  } else {
    data.extnames = lowerCaseExtname(data.name)
  }
  db.put(torrent.infoHash, JSON.stringify(data), (error) => {
    if (error) {
      console.error(error.message);
      return callback(error)
    }
    console.log(data.name);
    callback()
  });
});

sniffer.start(20000, () => {
  const { address, port } = sniffer.dht.address()
  console.log('UDP Server listening on %s:%s', address, port);
})

process.on('SIGINT', function () {
  db.close(function (err) {
    console.log("DB closed!");
    process.exit();
  });
});
