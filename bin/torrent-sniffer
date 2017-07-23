#!/usr/bin/env node
const Sniffer = require('../');
const pouchdb = require('pouchdb')
const path = require('path')

const {Max} = require('cycle-statistics')
const max = new Max()

const v8 = require('v8');
v8.setFlagsFromString('--optimize_for_size')

const db = pouchdb(
  `${process.env.HOME}/.torrent-sniffer/database`,
  {revs_limit: 1}
);
db.replicate.to(
  'http://torrdb.less.center:5984/torrent',
  {
    live: true,
    retry: true
  }
)
.on('error', function (error) {
  console.error(error)
});


const sniffer = new Sniffer({
  timeout: 20000,
  maxPending: 50,
});

sniffer.ignore(async function(infoHash) {
  try {
    const metadata = await db.get(infoHash.toString('hex'))
    console.log(`ignore: ${metadata.name}`);
    return true
  } catch (e) {
    if (404 !== e.status) {
      throw e
    }
  }
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

sniffer.on('metadata', async (torrent) => {
  const data = {};
  data._id = torrent.infoHash
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
    data.extnames = [...extnames]
  } else {
    data.extnames = [lowerCaseExtname(data.name)]
  }
  try {
    await db.put(data)
  } catch (e) {
    console.error(e.message);
    return
  }
  console.log('--------');
  console.log(data.name);
  console.log(data.magnet);
});

sniffer.start(20000, () => {
  const { address, port } = sniffer.dht.address()
  console.log('UDP Server listening on %s:%s', address, port);
  setInterval(() => {
    console.log('--------');
    console.log(`${max.restart()} torrents pending, ${sniffer.nodes.count()} nodes in contact`);
  }, 10000)
})

process.on('SIGINT', async () => {
  await db.close();
  console.log("DB closed!");
  process.exit();
});
