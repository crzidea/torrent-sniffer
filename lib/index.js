const EventEmitter = require('events');
//const DHT = require('./dhtspider');
const DHT = require('bittorrent-dht')
const BTClient = require('./btclient');
const crypto = require('crypto');

class Spider extends EventEmitter {

  constructor(options) {
    super()

    this.options = options || {};

    this.bt = new BTClient({
      timeout: this.options.timeout || 1000 * 10,
      maxConnections: this.options.maxConnections
    });

    this.bt.on('complete', function (metadata, infohash, rinfo) {
      var _metadata = metadata;
      _metadata.address = rinfo.address;
      _metadata.port = rinfo.port;
      _metadata.infohash = infohash.toString('hex');
      _metadata.magnet = 'magnet:?xt=urn:btih:' + _metadata.infohash;
      this.emit('metadata', _metadata);
    }.bind(this));

    const dht = new DHT({concurrency: 30});
    this.dht = dht
    dht.on('announce_peer', (infoHash, peer) => {
      this.bt.add({
        address: peer.host,
        port: peer.port
      }, infoHash);
    })
    const rpc = dht._rpc
    function makeNeighbor(node) {
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
    this.bt.ignore = callback;
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
