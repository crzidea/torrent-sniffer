const fetch = require('node-fetch')
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
    console.log(magnets);
  })
  await Promise.all(promises)
}

$fetch()
