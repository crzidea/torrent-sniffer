const EventEmitter = require('events');
const DHT = require('bittorrent-dht')
const crypto = require('crypto');
const WebTorrent = require('webtorrent')
const ChunkStore = require('memory-chunk-store')

function NoopChunkStore(chunkLength, options) {
  console.log(options);
}

function callbackImmediate(...args) {
  const callback = args.pop()
  if ('function' === typeof callback) {
    callback()
  }
}

['get', 'put', 'close', 'destroy'].forEach((method) => {
  NoopChunkStore.prototype[method] = callbackImmediate
})

class Sniffer extends EventEmitter {

  constructor(options) {
    super()

    this.options = options || {};

    this.bt = new WebTorrent({maxConns: 1})

    this.bt.on('error', (error) => {
      console.error(error.message);
    })

    const locks = new Set

    const dht = new DHT({concurrency: 30});
    this.dht = dht
    dht.on('announce_peer', (infoHash, peer) => {
      if (this.bt.torrents.length >= 200) {
        //console.log('bt client is busy, drop peer');
        return
      }
      const lock = infoHash.toString('hex')
      if (locks.has(lock)) {
        return
      }
      locks.add(lock)
      this._ignore(infoHash, (drop) => {
        //console.log(this.bt.torrents.length);
        if (drop) {
          return locks.delete(lock)
        }
        //const torrent = this.bt.add(infoHash, {store})
        const torrent = this.bt.add(infoHash, { store: ChunkStore })
        torrent.addPeer(`${peer.host}:${peer.port}`)
        torrent.once('metadata', () => {
          this.bt.remove(torrent)
          torrent.done = true
          this.emit('metadata', torrent, () => locks.delete(lock))
        })
      })
    })

    const rpc = dht._rpc
    rpc.on('ping', (olders, newer) => {
      for (const older of olders) {
        rpc.nodes.remove(older.id)
      }
      //rpc.clear()
    })
    dht.on('node', (node) => this.makeNeighbor(node))
  }

  makeNeighbor(node, id) {
    const rpc = this.dht._rpc
    // prevent memleak
    if (rpc.pending.length) {
      return
    }
    const query = {
      t: crypto.randomBytes(4),
      y: 'q',
      q: 'find_node',
      a: {
        id: id || Buffer.concat([node.id.slice(0, 10), rpc.id.slice(10)]),
        target: crypto.randomBytes(20)
      }
    };
    rpc.query(node, query)
  }

  ignore(callback) {
    this._ignore = callback;
  };

  start(...args) {
    this.dht.listen(...args)

    setInterval(() => {
      console.log(`${this.bt.torrents.length} torrents pending`);
    }, 10000)

    setInterval(() => {
      const rpc = this.dht._rpc
      rpc.bootstrap.forEach((node) => this.makeNeighbor(node, rpc.id))
    }, 1000)
  };

  sniff() {
    //this.dht._bootstrap(true)
    //if (this.bt.isIdle()) {
      //this.dht.joinDHTNetwork();
      //this.dht.makeNeighbours();
    //}
  }

}

module.exports = Sniffer;
