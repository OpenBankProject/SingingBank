var settings = {}

settings.mongodb = {};
settings.server = {};
settings.redis = {};
settings.logfile = "singingbank.log";

// heroku config:add NODE_ENV=development

if (process.env.NODE_ENV === undefined){
  console.log('NODE_ENV not set. Setting it to development.')
  process.env.NODE_ENV = 'development'
}




if (process.env.NODE_ENV == 'development'){
  settings.server.port = 3000;
  settings.server.public_address = 'localhost:3000';
  settings.server.public_domain = 'localhost';
  settings.redis.host = 'redishost';
} else if (process.env.NODE_ENV == 'staging') {
  settings.server.port = 3005;
  settings.server.public_address =  'dev.singingbank.com';
  settings.server.public_domain =  'dev.singingbank.com';
  settings.redis.host = 'localhost';
  settings.logfile = '/var/log/singingbank.com/dev/singingbank-dev.log';
} else if (process.env.NODE_ENV == 'production'){
  settings.server.port = 3006;
  settings.server.public_address =  'singingbank.com';
  settings.server.public_domain =  'singingbank.com';
  settings.redis.host = 'localhost';
  settings.logfile = '/var/log/singingbank.com/live/singingbank-live.log';
} else {
  throw new Error('NODE_ENV not set to something we like. It is set to: ' + process.env.NODE_ENV);
}

console.log(process.env.NODE_ENV);

module.exports = settings;
