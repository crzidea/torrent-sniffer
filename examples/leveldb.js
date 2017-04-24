#!/usr/bin/env node
/**
 * Sample of using leveldb to store sniffed torrent info.
 */
const Sniffer = require('../');
const level = require('level');
const path = require('path')

const {Max} = require('cycle-statistics')
const max = new Max()

const v8 = require('v8');
v8.setFlagsFromString('--optimize_for_size')

const db = level('/tmp/torrent-sniffer/leveldb');

const sniffer = new Sniffer({
  timeout: 20000,
  maxPending: 50,
});

sniffer.ignore(async function(infoHash) {
  return await new Promise((resolve ,reject) => {
    db.get(infoHash, (err, value) => {
      resolve(value);
    })
  })
})

sniffer.on('torrent', (torrent) => {
  max.push(sniffer.bt.torrents.length)
  torrent.once('close', () => {
    max.push(sniffer.bt.torrents.length)
  })
})

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
  db.put(torrent.infoHash, JSON.stringify(data), {sync: true}, (error) => {
  //db.put(torrent.infoHash, JSON.stringify(data), (error) => {
    if (error) {
      console.error(error.message);
      return
    }
    console.log(data.name);
    console.log(data.magnet);
  });
});

sniffer.start(20000, () => {
  const { address, port } = sniffer.dht.address()
  console.log('UDP Server listening on %s:%s', address, port);
  setInterval(() => {
    console.log('--------');
    console.log(`${max.restart()} torrents pending`);
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
