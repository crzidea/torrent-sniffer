const EventEmitter = require('events');
const DHT = require('bittorrent-dht')
const crypto = require('crypto');
const WebTorrent = require('webtorrent')
const ChunkStore = require('memory-chunk-store')

const defaults = {}
defaults.timeout = 5000
defaults.btConcurrency = 200
defaults.dhtConcurrency = 30

class Sniffer extends EventEmitter {

  constructor(options) {
    super()

    this.options = Object.assign({}, defaults, options)

    this.bt = new WebTorrent({
      maxConns: 1,
      dht: false,
      tracker: false
      //dht: {
        //maxTables: 1,
        //maxValues: 1,
        //maxPeers: 1
      //}
    })

    this.bt.on('error', (error) => {
      console.error(error.message);
    })

    const locks = new Set

    const dht = new DHT({
      concurrency: this.options.dhtConcurrency,
      maxTables: 1,
      maxValues: 1,
      maxPeers: 1
    });
    this.dht = dht
    dht.on('announce_peer', (infoHash, peer) => {
      if (this.bt.torrents.length >= this.options.btConcurrency) {
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

        const timeout = setTimeout(() => {
          if (!this.bt.get(torrent)) {
            return
          }
          this.bt.remove(torrent)
        }, this.options.timeout);

        torrent.addPeer(`${peer.host}:${peer.port}`)
        torrent.once('metadata', () => {
          clearTimeout(timeout)
          this.bt.remove(torrent)
          torrent.done = true
          this.emit('metadata', torrent)
        })
        torrent.once('close', () => {
          locks.delete(lock)
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
      const rpc = this.dht._rpc
      rpc.bootstrap.forEach((node) => this.makeNeighbor(node, rpc.id))
    }, 1000)
  };

}

Sniffer.defaults = defaults

module.exports = Sniffer;
