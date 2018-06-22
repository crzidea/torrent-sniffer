const EventEmitter = require('events');
const DHT = require('bittorrent-dht')
const crypto = require('crypto');
const WebTorrent = require('webtorrent')
const ChunkStore = require('memory-chunk-store')

const defaults = {}
defaults.timeout = 60e3 * 10
defaults.maxPending = 200

class Sniffer extends EventEmitter {

  constructor(options) {
    super()

    this.options = Object.assign({}, defaults, options)

    const bt = this.bt = new WebTorrent({
      //maxConns: 1,
      //dht: false,
      tracker: false,
      dht: {
        maxTables: 10,
        maxValues: 10,
        maxPeers: 100
      }
    })

    const dht = new DHT({
      maxTables: 10,
      maxValues: 10,
      maxPeers: 100
    });
    this.dht = dht
    const rpc   = this.rpc    = dht._rpc
    const nodes = this.nodes  = rpc.nodes


    this.bt.on('error', (error) => {
      console.error(error.message);
    })

    this.locks = new Set

    dht.on('announce_peer', async (infoHash, peer) => {
      if (this.bt.torrents.length >= this.options.maxPending) {
        this.emit('busy', infoHash, peer)
        return
      }

      this.add(infoHash, peer)
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

  async add(infoHash, peer, magnet) {
    const locks = this.locks
    const lock = infoHash.toString('hex')
    if (locks.has(lock)) {
      return
    }
    locks.add(lock)

    const ignore = await this._ignore(infoHash)
    if (ignore) {
      return locks.delete(lock)
    }

    const torrent = this.bt.add(magnet || infoHash, { store: ChunkStore })

    const timeout = setTimeout(() => {
      if (!this.bt.get(torrent)) {
        return
      }
      this.bt.remove(torrent)
    }, this.options.timeout);

    if (peer) {
      torrent.addPeer(`${peer.host}:${peer.port}`)
    }

    torrent.once('metadata', () => {
      clearTimeout(timeout)
      this.bt.remove(torrent)
      torrent.done = true
      this.emit('metadata', torrent)
    })
    torrent.once('close', () => {
      locks.delete(lock)
    })

    this.emit('torrent', torrent)
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
    }, 10000)
  };

}

Sniffer.defaults = defaults

module.exports = Sniffer;
