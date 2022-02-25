const config = require('./config.json')
const Discord = require('discord.js')
const { LinearClient } = require('bybit-api')

const discordClient = new Discord.Client()
const bybitClient = new LinearClient(config.bybit_API_KEY, config.bybit_API_SECRET, true)

/** Init Bybit API & check availability */
bybitClient.getApiKeyInfo().then(result => {
  console.log(`Bybit API Status: ${result.ret_msg}`)
}).catch(err => {
  console.error(err)
  process.exit()
})

discordClient.on('ready', () => {
  console.log(`Logged in as ${discordClient.user.tag}`)
})

discordClient.on('message', message => {
  if (message.channel.id === config.channel && message.author.username === 'Copy-Trade-Bot') {
    const trade = tradeconverter(message)
    console.log(`
    New trade found: ${trade.side} ${trade.contract} (${trade.title})`)
    executeOrder(bybitClient, trade)
  }
})

const tradesetup = {
  title: '', // Trade Opened / Trade Closed
  contract: '', // BTCUSDT
  qty: 0, // in asset (ex. 0.13 BTC)
  side: '', // Buy or Sell
  reduce: false // for closing trades
}

/** Excuse the messy code...
 * could be cleaned up but it works as is */
function tradeconverter (message) {
  const title = message.embeds[0].title
  tradesetup.title = title
  let entryPrice = 0
  let positionValue = 0
  let positionType = ''
  message.embeds[0].fields.forEach(field => {
    if (field.name === 'Contract') { tradesetup.contract = field.value }
    if (field.name === 'Entry Price') { entryPrice = field.value }
    if (field.name === 'Position Value') { positionValue = field.value }
    if (field.name === 'Position Type') { positionType = field.value }
  })
  tradesetup.qty = +((positionValue / entryPrice).toFixed(3))

  switch (title) {
    case 'Trade Opened':
      if (positionType === 'Long') {
        tradesetup.side = 'Buy'
      } else {
        tradesetup.side = 'Sell'
      }
      tradesetup.reduce = false
      break
    case 'Trade Closed':
      if (positionType === 'Long') {
        tradesetup.side = 'Sell'
      } else {
        tradesetup.side = 'Buy'
      }
      tradesetup.reduce = true
      break
    default:
      break
  }
  return tradesetup
}

function executeOrder (client, setup) {
  return client.placeActiveOrder({
    side: setup.side,
    symbol: setup.contract,
    order_type: 'Market',
    qty: setup.qty,
    time_in_force: 'GoodTillCancel',
    reduce_only: setup.reduce,
    close_on_trigger: setup.reduce
  }).then(ret => {
    console.log(`Order created @${ret.result.created_time}`)
  }).catch(err => {
    console.log(err)
  })
}

discordClient.login(config.discord_token)
