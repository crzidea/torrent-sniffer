const fetch = require('node-fetch')
const magnet = require('magnet-uri')
const base = 'https://thepiratebay.org/top'
const urls = [
  '/48h200',
  '/48h500'
]
async function $fetch() {
  const promises = urls.map(async (url) => {
    const response = await fetch(`${base}${url}`)
    const text = await response.text()
    const magnets = text.match(/"(magnet:.+?)"/g).map((string) => {
      return string.replace(/^"|"$/g, '')
    })
    return magnets
  })
  const lists = await Promise.all(promises)
  const magnets = lists.reduce((set, list) => {
    for (const item of list) {
      set.add(item)
    }
    return set
  }, new Set)
  return [...magnets].map((uri) => {
    const parsed = magnet.decode(uri)
    return {
      infoHash: parsed.infoHashBuffer,
      magnet: uri
    }
  })
}

module.exports = $fetch
