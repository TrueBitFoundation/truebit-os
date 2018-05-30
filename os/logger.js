const winston = require('winston')
const { createLogger, format, transports } = winston
const { combine, timestamp, label, colorize, json, printf } = format

const logger = createLogger({
  format: format.combine(
    format.label({ label: 'console' }),
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    json()
  ),

  transports: [
    new winston.transports.File({
      filename: 'combined.log.json'
    })
  ]
})

// want json of all logs?
// console.log(logs)
// let logs = fs
//   .readFileSync('./combined.log.json')
//   .toString()
//   .split('\n')
//   .filter(defined => {
// 	return defined
//   })
//   .map(logLine => {
// 	if (logLine) {
// 	  return JSON.parse(logLine)
// 	}
//   })

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: combine(
        colorize(),
        label({ label: 'console' }),
        timestamp(),
        printf(info => {
          return `${info.timestamp} [${info.label}] ${info.level}: ${
            info.message
          }`
        })
      )
    })
  )
}

module.exports = logger
