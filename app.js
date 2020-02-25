/**
 * Module dependencies.
 */

var settings = require('./settings');
var util = require('util');

var express = require("express");
var app = express();

var redis = require("redis");
var winston = require('winston');

// start.sh grabs console output to file anyway.
  // transports: [
  //   new (winston.transports.Console)(),
  //   new (winston.transports.File)({ filename: settings.logfile })
  // ]

var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)()
  ]
});

// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.cookieParser());

  // Don't need sessions at the moment.
  // app.use(express.session({secret: "yap8u7yhgytyab"
  //                         , cookie: { domain:'.' + settings.server.public_domain}
  //                         }));

  app.use(express.methodOverride());
  app.use(require('stylus').middleware({ src: __dirname + '/public' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});


app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  app.set('APP_ENV', 'development');
});

app.configure('staging', function(){
  app.use(express.errorHandler({showStack: true, dumpExceptions: true}));
  app.set('APP_ENV', 'staging');
});

app.configure('production', function(){
  app.use(express.errorHandler());
  app.set('APP_ENV', 'production');
});

app.get('/logout', function(req, res){
  req.logOut();
  res.redirect('/');
});


// Helpers

function dir(object)
{
    methods = [];
    for (z in object) {
        if (typeof(z) != 'number') {
            methods.push(z);
        }
        return methods.join(', ');
    }
}




function add_uuid(transactions) {
    // Just until we have the uuid in the API
    //console.log('length of transactions is ' + transactions.length);
    for(var i = transactions.length; i--;) {
      //console.log('i is ' + i);
      transactions[i].uuid = i;
      console.log(transactions[i]);
      //trans.uuid = i;
    }
    return transactions; // modified
}

// Routes

app.get('/', function(req, res){

    var mock = req.param('mock', false);
    var bank_alias = req.param('bank_alias', 'postbank');
    var account_alias = req.param('account_alias', 'f9315a52-330a-470c-8146-c51292c68f9d');

    // Temp hack this should come from API
    var owner_description = req.param('owner_description', 'TESOBE / Music Pictures Ltd');

    var offset = req.param('offset', 0);
    var limit = req.param('limit', 200);
    var sort_dir = req.param('sort_dir', 'desc');
    var song_length = req.param('song_length', 30);

    logger.debug("Before create redis client");

    //var client = redis.createClient(null, settings.redis.host);

    var timeout = 5 * 60 * 60; //  5 hours


    // Temp hack bank_alias is not not normally in accounts
    var mock_accounts = {
    "accounts": [
        {
            "number": "1234",
            "account_alias": "f9315a52-330a-470c-8146-c51292c68f9d",
            "owner_description": "TESOBE / Music Pictures Ltd",
            "bank_alias": "postbank"
        },
        {
            "number": "12345",
            "account_alias": "fairnopoly-geschaftskonto",
            "owner_description": "Fairmondo",
            "bank_alias": "gls"
        },
        {
            "number": "4300-1-50180-8",
            "account_alias": "hackerbus",
            "owner_description": "Hacker Bus",
            "bank_alias": "banco-do-brasil"
        },
    ]
}

    var accounts = mock_accounts.accounts

    console.log('accounts is: ' + accounts)


    if (mock){
      console.log('Using mock API')
      var prefix = 'http://localhost:3000/mock/obp/v1.2.1/';
    } else {
      //console.log('Using OBP demo tesobe')
      var prefix = 'https://api.openbankproject.com/obp/v1.2.1/'
    }

    var uri = prefix + 'banks/' + bank_alias + '/accounts/' + account_alias + '/public/transactions'

    console.log('uri to get is: ' + uri);

    // Key for the cache is the uri plus a string for development
    var cache_key_prefix = '02'; // incase we want to bump the cache
    var key = cache_key_prefix + "-" + uri + "-offset:" + offset + "-limit:" + limit + "12";
    var transactions;

    console.log('create redis client port: ' + settings.redis.port + ' host: ' + settings.redis.host);
    var client = redis.createClient(settings.redis.port, settings.redis.host);
    if (settings.redis.auth){
      client.auth(settings.redis.auth, function(err) {
        if (err) {
          throw err;
        }
      });
    }
    client.on('ready', function () { // without this part, redis connection will fail
      // do stuff with your redis

    console.log('check redis cache for key: ' + key);
    client.get(key, function (err, transactions_string) {

        if (err){
          logger.error("We got an error trying to get cache " + err);
        }

        if (transactions_string){
          logger.debug("yes we found CACHED transactions_string");

          //logger.debug("yes we found CACHED transactions_string: " + transactions_string);
          //console.log("data is " + data.toString());

          // We store string in the cache, the template wants json objects


          logger.debug("before parse transactions_string");
          var transactions = JSON.parse(transactions_string);


          //console.log('CACHED transactions are')
          //console.log(transactions)

          console.log('before render')

              res.render('index.jade', {
                title: 'The Singing Bank!',
                transactions: transactions,
                cached: true,
                accounts: accounts,
                account_alias: account_alias,
                owner_description: owner_description,
                song_length: song_length
              })

        } else {
          logger.debug("cache key NOT found - will get data from API");
          logger.debug("uri is: " + uri)

          // See https://github.com/mikeal/request
          var request = require('request');

          var headers = {
            'obp_offset': offset,
            'obp_limit': limit
          };

          request({uri: uri, body: 'json', headers: headers}, function (error, response, body) {
            //if (!error && response.statusCode == 200) {
              // console.log('here is the error:')
              // console.log(error)
              // console.log('here is the response:')
              // console.log(response)
              // console.log('here is the body:')
              // console.log(body)

              // TODO add error handling (e.g. URL does not exist etc)

              logger.debug("before parse transactions");
              // Create JSON objects for Jade
              // (This checks its JSON before we cache it.)
              transactions = JSON.parse(body).transactions;

              // TODO - If the API server returns an error
              // (returns HTML error) we should not cache

              // Store the raw string json response
              var transactions_string = JSON.stringify(transactions);

              logger.debug("before set key: " + key);
              //logger.debug("before set transactions_string: " + transactions_string);

              client.set(key, transactions_string);
              logger.debug("before expire: " + key);
              client.expire(key, timeout);


              logger.debug("before render");

              res.render('index.jade', {
                title: 'The Singing Bank!',
                transactions: transactions,
                cached: false,
                accounts: accounts,
                account_alias: account_alias,
                owner_description: owner_description,
                song_length: song_length
              }
              )
          }) // End API request
        } // End not in cache test
  }); // End cache get


    }); // end of redis client.on

}); // End GET


///////

app.get('/test/redis', function(req, res){
    var redis = require("redis"),
        client = redis.createClient(null, settings.redis.host);

    var key = 'me8';
    var timeout = 5 * 60 * 60; //  5 hours

    // This will return a JavaScript String
    client.get(key, function (err, data) {

        if (data){
          console.log("yes we found data for the key: " + key + ":" + data.toString());
        } else {
          console.log("key not found");
          mock_data = [{"something":{"somekey":"4f574876876974c0eeead"}}];
          data = JSON.stringify(mock_data);
          client.set(key, data);
          client.expire(key, timeout);
        }

        res.writeHead(200, {'content-type': 'text/json' });
        res.write( data );
        res.end('\n');

        client.end();
    });
});




////////

app.get('/mock/obp/v1.2.1/banks/:bankId/accounts/:accountId/public/transactions', function(req, res){

    console.log('Mock data: public_address is ' + settings.server.public_address);
    console.log('Mock data: bankId is ' + req.params.bankId);
    console.log('Mock data: accountId is ' + req.params.accountId);

    // old api mock_data = [{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeead","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"DEUTSCHE POST AG, SSC ACC S","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Lastschrift","posted":"2012-03-07T00:00:00.001Z","completed":"2012-03-07T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-1.45"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeae","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"HETZNER ONLINE AG","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Lastschrift","posted":"2012-03-06T00:00:00.001Z","completed":"2012-03-06T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-207.99"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeaf","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Christiania e.V.","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung Spende","posted":"2012-03-05T00:00:00.001Z","completed":"2012-03-05T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"3000.00"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb0","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"HOST EUROPE GMBH","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Lastschrift","posted":"2012-03-05T00:00:00.001Z","completed":"2012-03-05T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-12.99"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb1","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"TECHNIKER KRANKENKASSE","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Lastschrift","posted":"2012-03-05T00:00:00.001Z","completed":"2012-03-05T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-879.87"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb2","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Software Dev D","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-2273.35"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb3","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Software Developer X2","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"1260.31"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb4","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Developer O","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-1730.39"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb5","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Software Dev X","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-1414.89"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb6","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Music Pictures Staff 1","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-185.69"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb7","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Marketing Consultant 1","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-423.12"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb8","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Accounts Genius","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"1087.27"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb9","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Developer C","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-1083.32"}}},"obp_comments":[]},]

    // mock_data = {"transactions":[{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_-51895","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-11-01T01:00:00.001+0100","completed":"2012-11-01T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-139.19}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_609261","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-31T01:00:00.001+0100","completed":"2012-10-31T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-5.45}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"TECHNIKER KRANKENKASSE","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-31T01:00:00.001+0100","completed":"2012-10-31T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-190.53}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_710324","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-31T01:00:00.001+0100","completed":"2012-10-31T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-151.72}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"QSC AG                     MATHIAS-BRUEGGEN-STR. 55","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-30T01:00:00.001+0100","completed":"2012-10-30T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-23.56}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"QSC AG                     MATHIAS-BRUEGGEN-STR. 55","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-30T01:00:00.001+0100","completed":"2012-10-30T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-84.36}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"BARMER GEK","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-29T01:00:00.001+0100","completed":"2012-10-29T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-762.66}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"DAK","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-29T01:00:00.001+0100","completed":"2012-10-29T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-830.34}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_511685","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-29T01:00:00.001+0100","completed":"2012-10-29T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-77.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"TECHNIKER KRANKENKASSE","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-29T01:00:00.001+0100","completed":"2012-10-29T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-3144.98}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Client WAPOFG","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-26T02:00:00.001+0200","completed":"2012-10-26T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":3559.59}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Software Developer X2","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-26T02:00:00.001+0200","completed":"2012-10-26T02:00:00.001+0200","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-1260.31}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Software Developer 10","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-26T02:00:00.001+0200","completed":"2012-10-26T02:00:00.001+0200","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-1414.89}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Administration Staff MD","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-26T02:00:00.001+0200","completed":"2012-10-26T02:00:00.001+0200","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-780.92}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Software Dev X","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-26T02:00:00.001+0200","completed":"2012-10-26T02:00:00.001+0200","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-1414.89}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Developer O","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-26T02:00:00.001+0200","completed":"2012-10-26T02:00:00.001+0200","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-1730.39}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_-62517","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-24T02:00:00.001+0200","completed":"2012-10-24T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-11.9}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Accounts Genius","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-24T02:00:00.001+0200","completed":"2012-10-24T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-400.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Simon Redfern","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-23T02:00:00.001+0200","completed":"2012-10-23T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-1000.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"TELEKOM DEUTSCHLAND GMBH","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-22T02:00:00.001+0200","completed":"2012-10-22T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-24.76}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"VODAFONE D2 - MOBILFUNK","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-22T02:00:00.001+0200","completed":"2012-10-22T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-165.76}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"DEUTSCHE POST AG, SSC ACC S","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-22T02:00:00.001+0200","completed":"2012-10-22T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-4.4}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Lawyer 1","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-18T02:00:00.001+0200","completed":"2012-10-18T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-321.3}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Administration Staff MD","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-18T02:00:00.001+0200","completed":"2012-10-18T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-80.92}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Software Dev X","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-18T02:00:00.001+0200","completed":"2012-10-18T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-275.86}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Ismail","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-18T02:00:00.001+0200","completed":"2012-10-18T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-356.49}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"VARIOMEDIA AG","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-18T02:00:00.001+0200","completed":"2012-10-18T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-130.2}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"FINANZAMT F.KOERPERSCH.III","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-18T02:00:00.001+0200","completed":"2012-10-18T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-2857.34}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"DAK","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-16T02:00:00.001+0200","completed":"2012-10-16T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-112.59}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_-72819","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-15T02:00:00.001+0200","completed":"2012-10-15T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":6333.76}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_794109","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-15T02:00:00.001+0200","completed":"2012-10-15T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-17.28}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_453928","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-12T02:00:00.001+0200","completed":"2012-10-12T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":3487.14}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Client X","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-12T02:00:00.001+0200","completed":"2012-10-12T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":1948.63}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"DEUTSCHE POST AG, SSC ACC S","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-12T02:00:00.001+0200","completed":"2012-10-12T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-6.95}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_453928","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-11T02:00:00.001+0200","completed":"2012-10-11T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":1725.6}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Instructor A","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-11T02:00:00.001+0200","completed":"2012-10-11T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-160.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Software Developer 2","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-11T02:00:00.001+0200","completed":"2012-10-11T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-448.5}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Finanzamt für Körpersch III","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-11T02:00:00.001+0200","completed":"2012-10-11T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-940.67}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Software Developer 10","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-11T02:00:00.001+0200","completed":"2012-10-11T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-341.65}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"FINANZAMT F.KOERPERSCH.III","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-10T02:00:00.001+0200","completed":"2012-10-10T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-1374.17}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Simon Redfern","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-10T02:00:00.001+0200","completed":"2012-10-10T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-1000.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Client X","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-09T02:00:00.001+0200","completed":"2012-10-09T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":952.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"TESOBE Client WAPOFG","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-09T02:00:00.001+0200","completed":"2012-10-09T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":2375.17}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"TECHNIKER KRANKENKASSE","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-09T02:00:00.001+0200","completed":"2012-10-09T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-3088.98}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"AOK NORDOST/BERLIN","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-08T02:00:00.001+0200","completed":"2012-10-08T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":94.89}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"AOK NORDOST/BERLIN","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-09-26T02:00:00.001+0200","completed":"2012-09-26T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-142.91}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"DAK","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-09-26T02:00:00.001+0200","completed":"2012-09-26T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-717.75}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Accounts Genius","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-09-25T02:00:00.001+0200","completed":"2012-09-25T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-1087.27}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Simon Redfern","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-09-24T02:00:00.001+0200","completed":"2012-09-24T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-1000.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Developer C","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-09-24T02:00:00.001+0200","completed":"2012-09-24T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-918.75}}}]}
    // old data 2, no transaction.id there..
    // mock_data = {"transactions":[{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_-51895","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-11-01T01:00:00.001+0100","completed":"2012-11-01T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-139.19}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_609261","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-31T01:00:00.001+0100","completed":"2012-10-31T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-5.45}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"TECHNIKER KRANKENKASSE","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-31T01:00:00.001+0100","completed":"2012-10-31T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-190.53}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_710324","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-31T01:00:00.001+0100","completed":"2012-10-31T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-151.72}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"QSC AG                     MATHIAS-BRUEGGEN-STR. 55","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-30T01:00:00.001+0100","completed":"2012-10-30T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-23.56}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"QSC AG                     MATHIAS-BRUEGGEN-STR. 55","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-30T01:00:00.001+0100","completed":"2012-10-30T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-84.36}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"BARMER GEK","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-29T01:00:00.001+0100","completed":"2012-10-29T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-762.66}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"DAK","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-29T01:00:00.001+0100","completed":"2012-10-29T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-830.34}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_511685","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-29T01:00:00.001+0100","completed":"2012-10-29T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-77.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"TECHNIKER KRANKENKASSE","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-29T01:00:00.001+0100","completed":"2012-10-29T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-3144.98}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Client WAPOFG","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-26T02:00:00.001+0200","completed":"2012-10-26T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":3559.59}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Software Developer X2","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-26T02:00:00.001+0200","completed":"2012-10-26T02:00:00.001+0200","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-1260.31}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Software Developer 10","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-26T02:00:00.001+0200","completed":"2012-10-26T02:00:00.001+0200","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-1414.89}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Administration Staff MD","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-26T02:00:00.001+0200","completed":"2012-10-26T02:00:00.001+0200","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-780.92}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Software Dev X","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-26T02:00:00.001+0200","completed":"2012-10-26T02:00:00.001+0200","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-1414.89}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Developer O","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-26T02:00:00.001+0200","completed":"2012-10-26T02:00:00.001+0200","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-1730.39}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_-62517","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-24T02:00:00.001+0200","completed":"2012-10-24T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-11.9}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Accounts Genius","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-24T02:00:00.001+0200","completed":"2012-10-24T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-400.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Simon Redfern","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-23T02:00:00.001+0200","completed":"2012-10-23T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-1000.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"TELEKOM DEUTSCHLAND GMBH","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-22T02:00:00.001+0200","completed":"2012-10-22T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-24.76}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"VODAFONE D2 - MOBILFUNK","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-22T02:00:00.001+0200","completed":"2012-10-22T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-165.76}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"DEUTSCHE POST AG, SSC ACC S","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-22T02:00:00.001+0200","completed":"2012-10-22T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-4.4}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Lawyer 1","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-18T02:00:00.001+0200","completed":"2012-10-18T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-321.3}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Administration Staff MD","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-18T02:00:00.001+0200","completed":"2012-10-18T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-80.92}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Software Dev X","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-18T02:00:00.001+0200","completed":"2012-10-18T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-275.86}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Ismail","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-18T02:00:00.001+0200","completed":"2012-10-18T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-356.49}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"VARIOMEDIA AG","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-18T02:00:00.001+0200","completed":"2012-10-18T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-130.2}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"FINANZAMT F.KOERPERSCH.III","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-18T02:00:00.001+0200","completed":"2012-10-18T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-2857.34}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"DAK","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-16T02:00:00.001+0200","completed":"2012-10-16T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-112.59}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_-72819","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-15T02:00:00.001+0200","completed":"2012-10-15T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":6333.76}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_794109","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-15T02:00:00.001+0200","completed":"2012-10-15T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-17.28}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_453928","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-12T02:00:00.001+0200","completed":"2012-10-12T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":3487.14}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Client X","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-12T02:00:00.001+0200","completed":"2012-10-12T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":1948.63}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"DEUTSCHE POST AG, SSC ACC S","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-12T02:00:00.001+0200","completed":"2012-10-12T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-6.95}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_453928","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-11T02:00:00.001+0200","completed":"2012-10-11T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":1725.6}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Instructor A","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-11T02:00:00.001+0200","completed":"2012-10-11T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-160.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Software Developer 2","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-11T02:00:00.001+0200","completed":"2012-10-11T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-448.5}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Finanzamt für Körpersch III","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-11T02:00:00.001+0200","completed":"2012-10-11T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-940.67}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Software Developer 10","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-11T02:00:00.001+0200","completed":"2012-10-11T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-341.65}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"FINANZAMT F.KOERPERSCH.III","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-10T02:00:00.001+0200","completed":"2012-10-10T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-1374.17}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Simon Redfern","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-10T02:00:00.001+0200","completed":"2012-10-10T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-1000.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Client X","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-09T02:00:00.001+0200","completed":"2012-10-09T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":952.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"TESOBE Client WAPOFG","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-09T02:00:00.001+0200","completed":"2012-10-09T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":2375.17}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"TECHNIKER KRANKENKASSE","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-09T02:00:00.001+0200","completed":"2012-10-09T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-3088.98}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"AOK NORDOST/BERLIN","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-08T02:00:00.001+0200","completed":"2012-10-08T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":94.89}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"AOK NORDOST/BERLIN","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-09-26T02:00:00.001+0200","completed":"2012-09-26T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-142.91}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"DAK","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-09-26T02:00:00.001+0200","completed":"2012-09-26T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-717.75}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Accounts Genius","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-09-25T02:00:00.001+0200","completed":"2012-09-25T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-1087.27}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Simon Redfern","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-09-24T02:00:00.001+0200","completed":"2012-09-24T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-1000.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Developer C","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-09-24T02:00:00.001+0200","completed":"2012-09-24T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-918.75}}}]}
   
    mock_data = {
        "transactions": [
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7901",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "ALIAS_-51895",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-11-01T01:00:00.001+0100",
                    "completed": "2012-11-01T01:00:00.001+0100",
                    "new_balance": {
                        "currency": "\u20ac",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "\u20ac",
                        "amount": -139.19
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7946",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "ALIAS_609261",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-31T01:00:00.001+0100",
                    "completed": "2012-10-31T01:00:00.001+0100",
                    "new_balance": {
                        "currency": "\u20ac",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "\u20ac",
                        "amount": -5.45
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7947",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "TECHNIKER KRANKENKASSE",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-31T01:00:00.001+0100",
                    "completed": "2012-10-31T01:00:00.001+0100",
                    "new_balance": {
                        "currency": "\u20ac",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "\u20ac",
                        "amount": -190.53
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7948",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "ALIAS_710324",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-31T01:00:00.001+0100",
                    "completed": "2012-10-31T01:00:00.001+0100",
                    "new_balance": {
                        "currency": "\u20ac",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "\u20ac",
                        "amount": -151.72
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7949",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "QSC AG                     MATHIAS-BRUEGGEN-STR. 55",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-30T01:00:00.001+0100",
                    "completed": "2012-10-30T01:00:00.001+0100",
                    "new_balance": {
                        "currency": "\u20ac",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "\u20ac",
                        "amount": -23.56
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7910",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "QSC AG                     MATHIAS-BRUEGGEN-STR. 55",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-30T01:00:00.001+0100",
                    "completed": "2012-10-30T01:00:00.001+0100",
                    "new_balance": {
                        "currency": "\u20ac",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "\u20ac",
                        "amount": -84.36
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7911",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "BARMER GEK",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-29T01:00:00.001+0100",
                    "completed": "2012-10-29T01:00:00.001+0100",
                    "new_balance": {
                        "currency": "\u20ac",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "\u20ac",
                        "amount": -762.66
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7912",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "DAK",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-29T01:00:00.001+0100",
                    "completed": "2012-10-29T01:00:00.001+0100",
                    "new_balance": {
                        "currency": "\u20ac",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "\u20ac",
                        "amount": -830.34
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7913",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "ALIAS_511685",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-29T01:00:00.001+0100",
                    "completed": "2012-10-29T01:00:00.001+0100",
                    "new_balance": {
                        "currency": "\u20ac",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "\u20ac",
                        "amount": -77.0
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7914",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "TECHNIKER KRANKENKASSE",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-29T01:00:00.001+0100",
                    "completed": "2012-10-29T01:00:00.001+0100",
                    "new_balance": {
                        "currency": "\u20ac",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "\u20ac",
                        "amount": -3144.98
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7915",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Client WAPOFG",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-26T02:00:00.001+0200",
                    "completed": "2012-10-26T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": 3559.59
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7916",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Software Developer X2",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-26T02:00:00.001+0200",
                    "completed": "2012-10-26T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "\u20ac",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "\u20ac",
                        "amount": -1260.31
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7917",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Software Developer 10",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-26T02:00:00.001+0200",
                    "completed": "2012-10-26T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "\u20ac",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "\u20ac",
                        "amount": -1414.89
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7918",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Administration Staff MD",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-26T02:00:00.001+0200",
                    "completed": "2012-10-26T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "\u20ac",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "\u20ac",
                        "amount": -780.92
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7919",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Software Dev X",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-26T02:00:00.001+0200",
                    "completed": "2012-10-26T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "\u20ac",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "\u20ac",
                        "amount": -1414.89
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7920",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Developer O",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-26T02:00:00.001+0200",
                    "completed": "2012-10-26T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "\u20ac",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "\u20ac",
                        "amount": -1730.39
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7921",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "ALIAS_-62517",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-24T02:00:00.001+0200",
                    "completed": "2012-10-24T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -11.9
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7922",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Accounts Genius",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-24T02:00:00.001+0200",
                    "completed": "2012-10-24T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -400.0
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7923",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Simon Redfern",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-23T02:00:00.001+0200",
                    "completed": "2012-10-23T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -1000.0
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7924",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "TELEKOM DEUTSCHLAND GMBH",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-22T02:00:00.001+0200",
                    "completed": "2012-10-22T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -24.76
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7925",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "VODAFONE D2 - MOBILFUNK",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-22T02:00:00.001+0200",
                    "completed": "2012-10-22T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -165.76
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7926",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "DEUTSCHE POST AG, SSC ACC S",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-22T02:00:00.001+0200",
                    "completed": "2012-10-22T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -4.4
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7927",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Lawyer 1",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-18T02:00:00.001+0200",
                    "completed": "2012-10-18T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -321.3
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7928",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Administration Staff MD",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-18T02:00:00.001+0200",
                    "completed": "2012-10-18T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -80.92
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7929",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Software Dev X",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-18T02:00:00.001+0200",
                    "completed": "2012-10-18T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -275.86
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7930",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Ismail",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-18T02:00:00.001+0200",
                    "completed": "2012-10-18T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -356.49
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7931",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "VARIOMEDIA AG",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-18T02:00:00.001+0200",
                    "completed": "2012-10-18T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -130.2
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7932",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "FINANZAMT F.KOERPERSCH.III",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-18T02:00:00.001+0200",
                    "completed": "2012-10-18T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -2857.34
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7933",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "DAK",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-16T02:00:00.001+0200",
                    "completed": "2012-10-16T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -112.59
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7934",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "ALIAS_-72819",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-15T02:00:00.001+0200",
                    "completed": "2012-10-15T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": 6333.76
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7935",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "ALIAS_794109",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-15T02:00:00.001+0200",
                    "completed": "2012-10-15T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -17.28
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7936",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "ALIAS_453928",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-12T02:00:00.001+0200",
                    "completed": "2012-10-12T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": 3487.14
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7937",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Client X",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-12T02:00:00.001+0200",
                    "completed": "2012-10-12T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": 1948.63
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7938",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "DEUTSCHE POST AG, SSC ACC S",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-12T02:00:00.001+0200",
                    "completed": "2012-10-12T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -6.95
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7939",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "ALIAS_453928",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-11T02:00:00.001+0200",
                    "completed": "2012-10-11T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": 1725.6
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7940",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Instructor A",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-11T02:00:00.001+0200",
                    "completed": "2012-10-11T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -160.0
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7941",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Software Developer 2",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-11T02:00:00.001+0200",
                    "completed": "2012-10-11T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -448.5
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7942",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Finanzamt für Körpersch III",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-11T02:00:00.001+0200",
                    "completed": "2012-10-11T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -940.67
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7943",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Software Developer 10",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-11T02:00:00.001+0200",
                    "completed": "2012-10-11T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -341.65
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7944",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "FINANZAMT F.KOERPERSCH.III",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-10T02:00:00.001+0200",
                    "completed": "2012-10-10T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -1374.17
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7945",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Simon Redfern",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-10T02:00:00.001+0200",
                    "completed": "2012-10-10T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -1000.0
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7946",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Client X",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-09T02:00:00.001+0200",
                    "completed": "2012-10-09T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": 952.0
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7947",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "TESOBE Client WAPOFG",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-09T02:00:00.001+0200",
                    "completed": "2012-10-09T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": 2375.17
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7948",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "TECHNIKER KRANKENKASSE",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-09T02:00:00.001+0200",
                    "completed": "2012-10-09T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -3088.98
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7949",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "AOK NORDOST/BERLIN",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-10-08T02:00:00.001+0200",
                    "completed": "2012-10-08T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": 94.89
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7950",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "AOK NORDOST/BERLIN",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-09-26T02:00:00.001+0200",
                    "completed": "2012-09-26T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -142.91
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a7951",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "DAK",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-09-26T02:00:00.001+0200",
                    "completed": "2012-09-26T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -717.75
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a79552",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Accounts Genius",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-09-25T02:00:00.001+0200",
                    "completed": "2012-09-25T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -1087.27
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a79553",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Simon Redfern",
                        "alias": "no"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-09-24T02:00:00.001+0200",
                    "completed": "2012-09-24T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -1000.0
                    }
                }
            },
            {
                "id": "9d429899-24f5-42c8-8565-943ffa6a795554",
                "this_account": {
                    "holder": {
                        "name": "",
                        "alias": "no"
                    },
                    "number": "0580591101",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": "POSTBANK"
                    }
                },
                "other_account": {
                    "holder": {
                        "name": "Developer C",
                        "alias": "yes"
                    },
                    "number": "",
                    "kind": "",
                    "bank": {
                        "IBAN": "",
                        "national_identifier": "",
                        "name": ""
                    }
                },
                "details": {
                    "type_en": "",
                    "type_de": "",
                    "posted": "2012-09-24T02:00:00.001+0200",
                    "completed": "2012-09-24T02:00:00.001+0200",
                    "new_balance": {
                        "currency": "EUR",
                        "amount": "+"
                    },
                    "value": {
                        "currency": "EUR",
                        "amount": -918.75
                    }
                }
            }
        ]
    }

    res.writeHead(200, {'content-type': 'text/json' });
    res.write( JSON.stringify(mock_data) );
    res.end('\n');

});

app.get('/mock/obp/v1.0/postbank/accounts', function(req, res){

    console.log('Mock data: public_address is ' + settings.server.public_address);


// NOT USED CURRENTLY
// note: hacked in bank_alias which is not in real API

    mock_data = {
    "accounts": [
        {
            "number": "1234",
            "account_alias": "tesobe",
            "owner_description": "Music Pictures Ltd / TESOBE main account",
            "bank_alias": "postbank"
        },
        {
            "number": "12345",
            "account_alias": "fairnopoly",
            "owner_description": "Fairnopoly",
            "bank_alias": "gls"
        },
        {
            "number": "4300-1-50180-8",
            "account_alias": "hackerbus",
            "owner_description": "Hacker Bus",
            "bank_alias": "banco-do-brasil"
        },
    ]
}



    res.writeHead(200, {'content-type': 'text/json' });
    res.write( JSON.stringify(mock_data) );
    res.end('\n');
});



app.get('/about', function(req, res) {
    res.render('about.jade', { locals: {
        title: "About"
        , app_env: app.set('APP_ENV')
    }
    });
});


var port = settings.server.port || 3000;
var host = settings.server.listen_host || "0.0.0.0";
app.listen(port, host, function() {
  //console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
  console.log("Express server listening in %s mode on %s:%s", app.settings.env, host, port);

});
