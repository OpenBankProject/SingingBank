var settings = {}

settings.mongodb = {};
settings.server = {};

if (process.env.NODE_ENV == 'development'){
  settings.server.port = 3000;
  settings.server.public_address = 'localhost:3000';
  settings.server.public_domain = 'localhost';

} else if (process.env.NODE_ENV == 'staging') {
  settings.server.port = 3005;
  settings.server.public_address =  'dev.singingbank.com';
  settings.server.public_domain =  'dev.singingbank.com';

} else if (process.env.NODE_ENV == 'production'){
  settings.server.port = 3006;
  settings.server.public_address =  'singingbank.com';
  settings.server.public_domain =  'singingbank.com';
} else {
  throw new Error('NODE_ENV not set to something we like. It is set to: ' + process.env.NODE_ENV);
}

console.log(process.env.NODE_ENV);

module.exports = settings;
