var settings = {}

settings.mongodb = {};
settings.server = {};
settings.redis = {};
settings.logfile = "singingbank.log";



// if (process.env.NODE_ENV === undefined){
//   console.log('NODE_ENV not set. Setting it to development.')
//   process.env.NODE_ENV = 'development'
// }

if (process.env.NODE_ENV == 'development'){
  settings.server.port = 3000;
  settings.server.public_address = 'localhost:3000';
  settings.server.public_domain = 'localhost';
  settings.redis.host = 'localhost';
  settings.redis.port = 6379;
} else if (process.env.NODE_ENV == 'staging') {
  settings.server.port = 3005;
  settings.server.public_address =  'dev.singingbank.com';
  settings.server.public_domain =  'dev.singingbank.com';
  settings.redis.host = 'localhost';
  settings.redis.port = 6379;
  settings.logfile = '/var/log/singingbank.com/dev/singingbank-dev.log';
} else if (process.env.NODE_ENV == 'production'){
  settings.server.port = 3006;
  settings.server.public_address =  'singingbank.com';
  settings.server.public_domain =  'singingbank.com';
  settings.redis.host = 'localhost';
  settings.redis.port = 6379;
  settings.logfile = '/var/log/singingbank.com/live/singingbank-live.log';
} else {
  throw new Error('NODE_ENV is NOT set to something we like. It is set to: ' + process.env.NODE_ENV);
}

// Running on Heroku
// Use heroku config to see
if (process.env.REDISTOGO_URL){
  console.log('Yes we have REDISTOGO_URL')

  var rtg = require("url").parse(process.env.REDISTOGO_URL);

  settings.redis.host = rtg.hostname;
  settings.redis.port = rtg.port;
  settings.redis.auth = rtg.auth.split(":")[1];

} else {
  console.log('No REDISTOGO_URL')
}

console.log(process.env.NODE_ENV);

module.exports = settings;
