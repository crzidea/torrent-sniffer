const EventEmitter = require('events');
//const DHT = require('./dhtspider');
const DHT = require('bittorrent-dht')
const BTClient = require('./btclient');
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

class Spider extends EventEmitter {

  constructor(options) {
    super()

    this.options = options || {};

    this.bt = new WebTorrent({maxConns: 2})

    this.bt.on('error', (error) => {
      console.error(error.message);
    })

    const dht = new DHT({concurrency: 30});
    this.dht = dht
    dht.on('announce_peer', (infoHash, peer) => {
      if (this.bt.torrents.length > 10) {
        //console.log('bt client is busy, drop peer');
        return
      }
      if (this.bt.get(infoHash)) {
        return
      }
      this._ignore(infoHash, (drop) => {
        //console.log(this.bt.torrents.length);
        if (drop) {
          return
        }
        //const torrent = this.bt.add(infoHash, {store})
        const torrent = this.bt.add(infoHash, { store: ChunkStore })
        torrent.addPeer(`${peer.host}:${peer.port}`)
        torrent.once('metadata', () => {
          this.bt.remove(torrent)
          torrent.done = true
          this.emit('metadata', torrent)
        })
      })
    })

    const rpc = dht._rpc
    rpc.on('ping', (older, newer) => {
      rpc.clear()
    })
    function makeNeighbor(node) {
      // prevent memleak
      if (rpc.pending.length) {
        return
      }
      const query = {
        t: crypto.randomBytes(4),
        y: 'q',
        q: 'find_node',
        a: {
          id: Buffer.concat([node.id.slice(0, 10), rpc.id.slice(10)]),
          target: crypto.randomBytes(20)
        }
      };
      rpc.query(node, query)
    }
    dht.on('node', makeNeighbor)
  }

  ignore(callback) {
    this._ignore = callback;
  };

  start(...args) {
    this.dht.listen(...args)
    //this.dht.start(...args)
  };

  sniff() {
    //this.dht._bootstrap(true)
    //if (this.bt.isIdle()) {
      //this.dht.joinDHTNetwork();
      //this.dht.makeNeighbours();
    //}
  }

}

module.exports = Spider;
