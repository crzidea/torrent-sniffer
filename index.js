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

    const bt = this.bt = new WebTorrent({
      maxConns: 1,
      dht: false,
      tracker: false
      //dht: {
        //maxTables: 1,
        //maxValues: 1,
        //maxPeers: 1
      //}
    })

    const dht = new DHT({
      concurrency: this.options.dhtConcurrency,
      maxTables: 1,
      maxValues: 1,
      maxPeers: 1
    });
    this.dht = dht
    const rpc   = this.rpc    = dht._rpc
    const nodes = this.nodes  = rpc.nodes


    this.bt.on('error', (error) => {
      console.error(error.message);
    })

    this._maxTorrents = 0

    const locks = new Set

    const that = this

    dht.on('announce_peer', async function(infoHash, peer) {
      if (that.bt.torrents.length >= that.options.btConcurrency) {
        //console.log('bt client is busy, drop peer');
        return
      }

      if (that.bt.torrents.length > that._maxTorrents) {
        that._maxTorrents = that.bt.torrents.length
      }

      const lock = infoHash.toString('hex')
      if (locks.has(lock)) {
        return
      }
      locks.add(lock)

      const drop = await that._ignore(infoHash)
      //console.log(that.bt.torrents.length);
      if (drop) {
        return locks.delete(lock)
      }

      //const torrent = that.bt.add(infoHash, {store})
      const torrent = that.bt.add(infoHash, { store: ChunkStore })

      const timeout = setTimeout(() => {
        if (!that.bt.get(torrent)) {
          return
        }
        that.bt.remove(torrent)
      }, that.options.timeout);

      torrent.addPeer(`${peer.host}:${peer.port}`)
      torrent.once('metadata', () => {
        clearTimeout(timeout)
        that.bt.remove(torrent)
        torrent.done = true
        that.emit('metadata', torrent)
      })
      torrent.once('close', () => {
        locks.delete(lock)
      })
    })

    rpc.on('ping', (olders, newer) => {
      //const [older] = olders
      //rpc.nodes.remove(older.id)
      //for (const older of olders) {
        //rpc.nodes.remove(older.id)
      //}
      rpc.clear()
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

  getAndResetTorrentCounter() {
    const {_maxTorrents} = this
    this._maxTorrents = this.bt.torrents.length
    return _maxTorrents
  }

  ignore(callback) {
    this._ignore = callback;
  };

  start(...args) {
    this.dht.listen(...args)

    setInterval(() => {
      const rpc = this.dht._rpc
      rpc.bootstrap.forEach((node) => this.makeNeighbor(node, rpc.id))
    }, 10000)
  };

}

Sniffer.defaults = defaults

module.exports = Sniffer;
