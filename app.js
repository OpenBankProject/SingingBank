/**
 * Module dependencies.
 */

var settings = require('./settings');
var express = require('express');
var util = require('util');

var app = module.exports = express.createServer();

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
    var account_alias = req.param('account_alias', 'tesobe');

    // Temp hack this should come from API
    var owner_description = req.param('owner_description', 'TESOBE / Music Pictures Ltd');

    var offset = req.param('offset', 0);
    var limit = req.param('offset', 50);
    var sort_dir = req.param('sort-dir', 'desc');


    logger.debug("Before create redis client");

    var client = redis.createClient(null, settings.redis.host);

    var timeout = 5 * 60 * 60; //  5 hours


    // Temp hack bank_alias is not not normally in accounts
    var mock_accounts = {
    "accounts": [
        {
            "number": "1234",
            "account_alias": "tesobe",
            "owner_description": "TESOBE / Music Pictures Ltd",
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

    var accounts = mock_accounts.accounts



    if (mock){
      console.log('Using mock API')
      var prefix = 'http://localhost:3000/mock/obp/v1.0/';
    } else {
      //console.log('Using OBP demo tesobe')
      //var uri = 'https://demo.openbankproject.com/api/accounts/tesobe/anonymous';
      var prefix = 'https://demo.openbankproject.com/obp/v1.0/'
    }

// host = 'http://localhost:3000/mock/obp';
//       var host = 'https://demo.openbankproject.com/obp/v1.0/postbank/accounts/tesobe/transactions/anonymous'


    var uri = prefix + bank_alias + '/accounts/' + account_alias + '/transactions/anonymous'


    console.log('uri is: ' + uri)

    // Key for the cache is the uri plus a string for development
    var key = uri + "11";
    var transactions;



    client.get(key, function (err, data) {

        if (err){
          logger.error("We got an error trying to get cache " + err);
        }
        
        if (data){
          logger.debug("yes we found CACHED data for the key: " + key);
          console.log("data is " + data.toString()); 

          // We store string in the cache, the template wants json objects

          transactions = JSON.parse(data).transactions;


          console.log('CACHED transactions are')
          console.log(transactions)

          // TEMP untill we have uuid from the API
          transactions = add_uuid(transactions)

          console.log('before render')

              res.render('index.jade', {
              locals: {
                title: 'The Singing Bank!',
                transactions: transactions,
                cached: true,
                accounts: accounts,
                account_alias: account_alias,
                owner_description: owner_description
                }
              })

        } else {
          logger.debug("cache key NOT found - will get data from API");
          logger.debug("uri is: " + uri)

          var request = require('request');
          request({uri: uri, body: 'json'}, function (error, response, body) {
            //if (!error && response.statusCode == 200) {
              // console.log('here is the error:')
              // console.log(error) 
              // console.log('here is the response:')
              // console.log(response) 
              // console.log('here is the body:')
              // console.log(body)

              // Store the raw string json response
              client.set(key, body);
              client.expire(key, timeout); 
              
              // Create JSON objects for Jade
              transactions = JSON.parse(body).transactions;

              // TEMP until we have uuid in the API
              transactions = add_uuid(transactions)

              res.render('index.jade', {
              locals: {
                title: 'The Singing Bank!',
                transactions: transactions,
                cached: false,
                accounts: accounts,
                account_alias: account_alias,
                owner_description: owner_description
                }
              })
          }) // End API request
        } // End not in cache test
  }); // End cache get
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

app.get('/mock/obp/v1.0/postbank/accounts/tesobe/transactions/anonymous', function(req, res){

    console.log('Mock data: public_address is ' + settings.server.public_address);

    // old api mock_data = [{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeead","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"DEUTSCHE POST AG, SSC ACC S","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Lastschrift","posted":"2012-03-07T00:00:00.001Z","completed":"2012-03-07T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-1.45"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeae","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"HETZNER ONLINE AG","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Lastschrift","posted":"2012-03-06T00:00:00.001Z","completed":"2012-03-06T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-207.99"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeaf","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Christiania e.V.","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung Spende","posted":"2012-03-05T00:00:00.001Z","completed":"2012-03-05T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"3000.00"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb0","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"HOST EUROPE GMBH","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Lastschrift","posted":"2012-03-05T00:00:00.001Z","completed":"2012-03-05T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-12.99"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb1","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"TECHNIKER KRANKENKASSE","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Lastschrift","posted":"2012-03-05T00:00:00.001Z","completed":"2012-03-05T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-879.87"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb2","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Software Dev D","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-2273.35"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb3","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Software Developer X2","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"1260.31"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb4","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Developer O","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-1730.39"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb5","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Software Dev X","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-1414.89"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb6","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Music Pictures Staff 1","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-185.69"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb7","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Marketing Consultant 1","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-423.12"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb8","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Accounts Genius","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"1087.27"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb9","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Developer C","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-1083.32"}}},"obp_comments":[]},]

    mock_data = {"transactions":[{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_-51895","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-11-01T01:00:00.001+0100","completed":"2012-11-01T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-139.19}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_609261","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-31T01:00:00.001+0100","completed":"2012-10-31T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-5.45}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"TECHNIKER KRANKENKASSE","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-31T01:00:00.001+0100","completed":"2012-10-31T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-190.53}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_710324","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-31T01:00:00.001+0100","completed":"2012-10-31T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-151.72}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"QSC AG                     MATHIAS-BRUEGGEN-STR. 55","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-30T01:00:00.001+0100","completed":"2012-10-30T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-23.56}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"QSC AG                     MATHIAS-BRUEGGEN-STR. 55","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-30T01:00:00.001+0100","completed":"2012-10-30T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-84.36}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"BARMER GEK","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-29T01:00:00.001+0100","completed":"2012-10-29T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-762.66}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"DAK","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-29T01:00:00.001+0100","completed":"2012-10-29T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-830.34}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_511685","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-29T01:00:00.001+0100","completed":"2012-10-29T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-77.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"TECHNIKER KRANKENKASSE","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-29T01:00:00.001+0100","completed":"2012-10-29T01:00:00.001+0100","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-3144.98}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Client WAPOFG","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-26T02:00:00.001+0200","completed":"2012-10-26T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":3559.59}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Software Developer X2","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-26T02:00:00.001+0200","completed":"2012-10-26T02:00:00.001+0200","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-1260.31}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Software Developer 10","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-26T02:00:00.001+0200","completed":"2012-10-26T02:00:00.001+0200","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-1414.89}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Administration Staff MD","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-26T02:00:00.001+0200","completed":"2012-10-26T02:00:00.001+0200","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-780.92}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Software Dev X","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-26T02:00:00.001+0200","completed":"2012-10-26T02:00:00.001+0200","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-1414.89}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Developer O","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-26T02:00:00.001+0200","completed":"2012-10-26T02:00:00.001+0200","new_balance":{"currency":"\u20ac","amount":"+"},"value":{"currency":"\u20ac","amount":-1730.39}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_-62517","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-24T02:00:00.001+0200","completed":"2012-10-24T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-11.9}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Accounts Genius","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-24T02:00:00.001+0200","completed":"2012-10-24T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-400.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Simon Redfern","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-23T02:00:00.001+0200","completed":"2012-10-23T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-1000.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"TELEKOM DEUTSCHLAND GMBH","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-22T02:00:00.001+0200","completed":"2012-10-22T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-24.76}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"VODAFONE D2 - MOBILFUNK","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-22T02:00:00.001+0200","completed":"2012-10-22T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-165.76}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"DEUTSCHE POST AG, SSC ACC S","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-22T02:00:00.001+0200","completed":"2012-10-22T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-4.4}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Lawyer 1","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-18T02:00:00.001+0200","completed":"2012-10-18T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-321.3}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Administration Staff MD","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-18T02:00:00.001+0200","completed":"2012-10-18T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-80.92}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Software Dev X","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-18T02:00:00.001+0200","completed":"2012-10-18T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-275.86}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Ismail","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-18T02:00:00.001+0200","completed":"2012-10-18T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-356.49}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"VARIOMEDIA AG","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-18T02:00:00.001+0200","completed":"2012-10-18T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-130.2}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"FINANZAMT F.KOERPERSCH.III","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-18T02:00:00.001+0200","completed":"2012-10-18T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-2857.34}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"DAK","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-16T02:00:00.001+0200","completed":"2012-10-16T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-112.59}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_-72819","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-15T02:00:00.001+0200","completed":"2012-10-15T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":6333.76}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_794109","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-15T02:00:00.001+0200","completed":"2012-10-15T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-17.28}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_453928","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-12T02:00:00.001+0200","completed":"2012-10-12T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":3487.14}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Client X","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-12T02:00:00.001+0200","completed":"2012-10-12T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":1948.63}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"DEUTSCHE POST AG, SSC ACC S","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-12T02:00:00.001+0200","completed":"2012-10-12T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-6.95}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"ALIAS_453928","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-11T02:00:00.001+0200","completed":"2012-10-11T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":1725.6}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Instructor A","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-11T02:00:00.001+0200","completed":"2012-10-11T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-160.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Software Developer 2","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-11T02:00:00.001+0200","completed":"2012-10-11T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-448.5}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Finanzamt für Körpersch III","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-11T02:00:00.001+0200","completed":"2012-10-11T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-940.67}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Software Developer 10","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-11T02:00:00.001+0200","completed":"2012-10-11T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-341.65}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"FINANZAMT F.KOERPERSCH.III","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-10T02:00:00.001+0200","completed":"2012-10-10T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-1374.17}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Simon Redfern","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-10T02:00:00.001+0200","completed":"2012-10-10T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-1000.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Client X","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-09T02:00:00.001+0200","completed":"2012-10-09T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":952.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"TESOBE Client WAPOFG","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-09T02:00:00.001+0200","completed":"2012-10-09T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":2375.17}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"TECHNIKER KRANKENKASSE","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-09T02:00:00.001+0200","completed":"2012-10-09T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-3088.98}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"AOK NORDOST/BERLIN","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-10-08T02:00:00.001+0200","completed":"2012-10-08T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":94.89}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"AOK NORDOST/BERLIN","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-09-26T02:00:00.001+0200","completed":"2012-09-26T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-142.91}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"DAK","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-09-26T02:00:00.001+0200","completed":"2012-09-26T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-717.75}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Accounts Genius","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-09-25T02:00:00.001+0200","completed":"2012-09-25T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-1087.27}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Simon Redfern","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-09-24T02:00:00.001+0200","completed":"2012-09-24T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-1000.0}}},{"this_account":{"holder":{"name":"","alias":"no"},"number":"0580591101","kind":"","bank":{"IBAN":"","national_identifier":"","name":"POSTBANK"}},"other_account":{"holder":{"name":"Developer C","alias":"yes"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"","posted":"2012-09-24T02:00:00.001+0200","completed":"2012-09-24T02:00:00.001+0200","new_balance":{"currency":"EUR","amount":"+"},"value":{"currency":"EUR","amount":-918.75}}}]}

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

app.listen(settings.server.port, '127.0.0.1', function() {
  console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});
