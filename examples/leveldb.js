#!/usr/bin/env node
/**
 * Sample of using leveldb to store sniffed torrent info.
 */
const Sniffer = require('../');
const level = require('level');
const path = require('path')
const v8 = require('v8');
v8.setFlagsFromString('--optimize_for_size')

const db = level('/tmp/torrent-sniffer/leveldb');

const sniffer = new Sniffer({
  timeout: 10000,
  btConcurrency: 50,
  dhtConcurrency: 200
});

sniffer.ignore((infoHash, callback) => {
  db.get(infoHash, (err, value) => {
    callback(value);
  });
});

function lowerCaseExtname(_path) {
  return path.extname(_path).toLowerCase()
}

sniffer.on('metadata', (torrent) => {
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
  //db.put(torrent.infoHash, JSON.stringify(data), {sync: true}, (error) => {
  db.put(torrent.infoHash, JSON.stringify(data), (error) => {
    if (error) {
      console.error(error.message);
      return
    }
    console.log('--------');
    console.log(data.name);
    console.log(data.magnet);
  });
});

sniffer.start(20000, () => {
  const { address, port } = sniffer.dht.address()
  console.log('UDP Server listening on %s:%s', address, port);
  setInterval(() => {
    console.log(`${sniffer.getAndResetTorrentCounter()} torrents pending`);
    if (!sniffer.bt.torrents.length) {
      console.log(`${sniffer.nodes.count()} nodes in contact`);
    }
  }, 10000)
})

process.on('SIGINT', function () {
  db.close(function (err) {
    console.log("DB closed!");
    process.exit();
  });
});
