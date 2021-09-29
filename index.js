require('dotenv-safe').config()
const Discord = require('discord.js')
const client = new Discord.Client({
  intents: Discord.Intents.FLAGS.GUILD_MESSAGES | Discord.Intents.FLAGS.GUILDS | Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
})
const fs = require('fs')

class StringReader {
  #text = ''

  constructor(s) {
    this.#text = s
    this.index = 0
  }

  peek(amount = 0) {
    return this.#text.charAt(this.index + amount)
  }

  skip(amount = 1) {
    this.index += amount
    return this
  }

  isEOF() {
    return this.index >= this.#text.length
  }
}

const processTime = (s) => {
  let time = 0
  let rawNumber = ""
  const reader = new StringReader(s)
  while (!reader.isEOF()) {
    const c = reader.peek()
    reader.skip()
    if (c >= '0' && c <= '9') {
      rawNumber += c
    } else {
      if (rawNumber.length === 0) throw Error(`Unexpected non-digit character: '${c}' at index ${reader.index}`)
      // mo
      if (c === '月' || (/[ヵカヶケか]/.test(c) && !reader.isEOF() && reader.peek() == '月') || (c === 'm' && !reader.isEOF() && reader.peek() == 'o')) {
        reader.skip()
        time += (1000 * 60 * 60 * 24 * 30) * parseInt(rawNumber)
        rawNumber = ""
        continue
      }
      // y(ear), d(ay), h(our), m(inute), s(econd)
      if (c === '年' || c === 'y') {
        time += (1000 * 60 * 60 * 24 * 365) * parseInt(rawNumber)
      } else if (c === '日' || c === 'd') {
        time += (1000 * 60 * 60 * 24) * parseInt(rawNumber)
      } else if ((c === '時' && !reader.isEOF() && reader.peek() == '間') || c === 'h') {
        if (c === '時') reader.skip()
        time += (1000 * 60 * 60) * parseInt(rawNumber)
      } else if (c === '分' || c === 'm') {
        time += (1000 * 60) * parseInt(rawNumber)
      } else if (c === '秒' || c === 's') {
        time += 1000 * parseInt(rawNumber)
      } else {
        throw Error(`Unexpected character: '${c}' at index ${reader.index}`)
      }
      rawNumber = ""
    }
  }
  if (rawNumber.length > 0) throw Error('Encountered unexpected EOF: ' + rawNumber)
  return time
}

client.on('ready', () => {
  console.log('hi')
})

let arr = []

const saveData = Boolean(process.env.SAVE_DATA)
if (saveData && fs.existsSync('./data.json')) {
  arr = JSON.parse(fs.readFileSync('./data.json', 'utf-8'))
}

const save = () => {
  if (!saveData) return
  fs.writeFileSync('./data.json', JSON.stringify(arr), 'utf-8')
}

client.on('messageCreate', async msg => {
  if (msg.system || msg.author.bot || msg.author.system) return
  if (msg.content.startsWith(`<@${client.user.id}> `) || msg.content.startsWith(`<@!${client.user.id}> `)) {
    const e = msg.content.replace(`<@${client.user.id}> `, '').replace(`<@!${client.user.id}> `, '')
    try {
      const match = e.match(/(.*?) (.*)/)
      if (!match) {
        msg.channel.send(`Invalid date: \`${e}\``)
        return
      }
      const time = processTime(match[1].trim())
      const theDate = new Date(Date.now() + time)
      const sentMessage = await msg.channel.send(':timer: ' + theDate.toLocaleString('ja-jp'))
      arr.push({
        date: theDate.getTime(),
        msg: match[2],
        channel: msg.channelId,
        author: msg.author.id,
        messageId: msg.id,
        sentMessageId: sentMessage.id,
      })
      save()
    } catch (ex) {
      const date = new Date().toDateString()
      const time = new Date().toTimeString()
      let d = ''
      const match = e.match(/(\d{2,4}\/\d{1,2}\/\d{1,2})?( ?(\d{1,2}:\d{1,2}:\d{1,2})? (.+))/)
      if (!match) {
        msg.channel.send(`Invalid date: \`${e}\``)
        return
      }
      if (e.includes('/') || e.includes('.')) {
        d += match[1]
      } else {
        d += date
      }
      d += ' '
      if (e.includes(':')) {
        d += match[3]
      } else {
        d += time
      }
      const theDate = new Date(d)
      if (isNaN(theDate.getTime())) {
        msg.channel.send(`Invalid date: \`${d}\``)
        return
      }
      const sentMessage = await msg.channel.send(':timer: ' + theDate.toLocaleString('ja-jp'))
      const message = match[5] || match[4]
      arr.push({
        date: theDate.getTime(),
        msg: message,
        channel: msg.channelId,
        author: msg.author.id,
        messageId: msg.id,
        sentMessageId: sentMessage.id,
      })
      save()
    }
  }
})

setInterval(async () => {
  const now = Date.now()
  for (const obj of arr) {
    if (obj.date <= now) {
      try {
        (await client.channels.fetch(obj.channel)).send(
          {
            content: `<@${obj.author}>\n${obj.msg}`,
            reply: {
              messageReference: obj.messageId,
              failIfNotExists: false,
            },
          },
        )
      } catch (e) {
        console.warn(e.stack || e)
      }
    }
  }
  const l1 = arr.length
  arr = arr.filter(obj => obj.date > now)
  if (l1 !== arr.length) save()
}, 1000)

client.on('messageReactionAdd', (reaction, user) => {
  const oldLength = arr.length
  // removeIf
  arr = arr.filter(obj => !((obj.messageId === reaction.message.id || obj.sentMessageId === reaction.message.id) && obj.author == user.id))
  if (arr.length < oldLength) {
    reaction.message.reply('このリマインドをキャンセルしました。')
    save()
  }
})

console.log('trying to say hello to discord')
client.login(process.env.TOKEN)
