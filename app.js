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



// Routes

app.get('/', function(req, res){

    var mock = req.param('mock', false);




    logger.debug("Before create redis client");

    var client = redis.createClient(null, settings.redis.host);

    var timeout = 5 * 60 * 60; //  5 hours

    if (mock){
      console.log('Using mock API')
      var uri = 'http://localhost:3000/mock/obp';
    } else {
      //console.log('Using OBP demo tesobe')
      var uri = 'https://demo.openbankproject.com/api/accounts/tesobe/anonymous';
    }

    // Key for the cache is the uri plus a string for development
    var key = uri + "05";
    var transactions;

    client.get(key, function (err, data) {

        if (err){
          logger.error("We got an error trying to get cache " + err);
        }
        
        if (data){
          logger.debug("yes we found data for the key: " + key);
          // concole.log("data is " + data.toString()); 

          // We store string in the cache, the template wants json objects
          transactions = JSON.parse(data);

              res.render('index.jade', {
              locals: {
                title: 'The Singing Bank!',
                transactions: transactions,
                cached: true,
                }
              })

        } else {
          logger.debug("key not found - will get data from API");

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
              transactions = JSON.parse(body);

              res.render('index.jade', {
              locals: {
                title: 'The Singing Bank!',
                transactions: transactions,
                cached: false,
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

app.get('/mock/obp', function(req, res){

    console.log('public_address is ' + settings.server.public_address);

    mock_data = [{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeead","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"DEUTSCHE POST AG, SSC ACC S","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Lastschrift","posted":"2012-03-07T00:00:00.001Z","completed":"2012-03-07T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-1.45"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeae","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"HETZNER ONLINE AG","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Lastschrift","posted":"2012-03-06T00:00:00.001Z","completed":"2012-03-06T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-207.99"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeaf","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Christiania e.V.","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung Spende","posted":"2012-03-05T00:00:00.001Z","completed":"2012-03-05T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"3000.00"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb0","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"HOST EUROPE GMBH","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Lastschrift","posted":"2012-03-05T00:00:00.001Z","completed":"2012-03-05T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-12.99"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb1","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"TECHNIKER KRANKENKASSE","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Lastschrift","posted":"2012-03-05T00:00:00.001Z","completed":"2012-03-05T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-879.87"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb2","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Software Dev D","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-2273.35"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb3","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Software Developer X2","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"1260.31"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb4","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Developer O","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-1730.39"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb5","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Software Dev X","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-1414.89"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb6","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Music Pictures Staff 1","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-185.69"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb7","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Marketing Consultant 1","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-423.12"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb8","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Accounts Genius","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"1087.27"}}},"obp_comments":[]},{"obp_transaction":{"obp_transaction_uuid":"4f5745f4e4b095974c0eeeb9","this_account":{"holder":{"holder":"MUSIC PICTURES LIMITED","alias":"no"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"other_account":{"holder":{"holder":"Developer C","alias":"public"},"number":"","kind":"","bank":{"IBAN":"","national_identifier":"","name":""}},"details":{"type_en":"","type_de":"Überweisung","posted":"2012-03-01T00:00:00.001Z","completed":"2012-03-01T00:00:00.001Z","other_data":"","new_balance":{"currency":"","amount":"+"},"value":{"currency":"EUR","amount":"-1083.32"}}},"obp_comments":[]},]
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
