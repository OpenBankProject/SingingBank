/**
 * Module dependencies.
 */

var settings = require('./settings');

var express = require('express');
RedisStore = require('connect-redis')(express)


var connect = require('connect');
var util = require('util');

var async = require('async');

var app = module.exports = express.createServer();



var passport = require('passport');
var TwitterStrategy = require('passport-twitter').Strategy;

var FacebookStrategy = require('passport-facebook').Strategy;


// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.cookieParser());



  app.use(express.session({secret: "yap8u7yhgytyab"
                          , store: new RedisStore
                          , cookie: { domain:'.' + settings.server.public_domain}
                          })); // should be before passport session
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(express.methodOverride());
  app.use(require('stylus').middleware({ src: __dirname + '/public' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('simon', function(){
  app.use(express.errorHandler({showStack: true, dumpExceptions: true}));
  // localhost facebook app
  app.set('APP_FACEBOOK_CLIENT_ID', '317322411676639');
  app.set('APP_FACEBOOK_APP_SECRET', '88965e9e1c6b287bfe56a1db4e2a4cca');

  app.set('APP_ENV', 'simon');

  // Note: Also see settings.js

});


app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));

  // Dev Polarize it
  app.set('APP_FACEBOOK_CLIENT_ID', '361088667286146');
  app.set('APP_FACEBOOK_APP_SECRET', 'f8b38dfb2177c7e5949a5656540c5a6a');

   app.set('APP_ENV', 'development');

 // Note: Also see settings.js

});

app.configure('production', function(){
  app.use(express.errorHandler());

  // Live Polarize it
  app.set('APP_FACEBOOK_CLIENT_ID', '106649586139795');
  app.set('APP_FACEBOOK_APP_SECRET', '0f21975188753da6131295105e901fb1');

  app.set('APP_ENV', 'production');

  // Note: Also see settings.js

});



passport.serializeUser(function(user, done) {
  console.log('this is serializeUser hello');
  var core_user = {
        provider: user.provider
        , id: user.id
        , username: user.username
        , displayName: user.displayName
        , _id: user._id
        , user_code: user.provider + '-' + user.id
      }
  done(null, core_user);
});

passport.deserializeUser(function(core_user, done) {
  console.log('this is deserializeUser hello');
  user_provider.findById(core_user._id, function (err, user) {
    done(err, user);
  });
});

passport.use(
    new TwitterStrategy({
    consumerKey: settings.twitter.consumer_key,
    consumerSecret: settings.twitter.consumer_secret,
    callbackURL: "http://" + settings.server.public_address + "/auth/twitter/callback"
  },
  function(token, tokenSecret, profile, done) {
    user_provider.findOrCreate(profile, function (error, user) {
      console.log('after findOrCreate ');
      if (error) { return done(error); }
      done(null, user);
    });
  }
));

// TODO probably have to create a facebook app just for using when testing on localhost?
passport.use(new FacebookStrategy({
    clientID: app.set('APP_FACEBOOK_CLIENT_ID'),
    clientSecret: app.set('APP_FACEBOOK_APP_SECRET'),
    callbackURL: "http://" + settings.server.public_address + "/auth/facebook/callback"
  },
  function(token, tokenSecret, profile, done) {
    user_provider.findOrCreate(profile, function (error, user) {
      if (error) { return done(error); }
      done(null, user);
    });
  }
));


app.get('/logout', function(req, res){
  req.logOut();
  res.redirect('/');
});




app.dynamicHelpers({
  session: function(req, res){
    return req.session;
  }
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

    console.log('public_address is ' + settings.server.public_address);

    req.session.visitCount = req.session.visitCount ? req.session.visitCount + 1 : 1;

    if (req.user){
      console.log('req.user.displayName is ' + req.user.displayName);
    } else {
      console.log('no user. you might want to login?')
    }

    if (req.session){
      console.log('session is ' + util.inspect(req.session));
    } else {
      console.log('no session')
    }


    console.log('before sending request to obp:')

    var request = require('request');

    var uri = 'https://demo.openbankproject.com/api/accounts/tesobe/anonymous';

    request({uri: uri, body: 'json'}, function (error, response, body) {
      //if (!error && response.statusCode == 200) {
        console.log('here is the error:')
        console.log(error) 
        console.log('here is the response:')
        console.log(response) 
        console.log('here is the body:')
        console.log(body)

        console.log('here is the body.obp_transaction:')
        console.log(body['obp_transaction'])

        var transactions;
        transactions = JSON.parse(body);


        res.render('index.jade', {
            locals: {
                title: 'The Singing Bank!',
                transactions: transactions,
                //user: req.user
            }
        })

    })


    
});


app.get('/test/session', function(req, res){

    console.log('public_address is ' + settings.server.public_address);

    req.session.test_session_visit_count = req.session.test_session_visit_count ? req.session.test_session_visit_count + 1 : 1;

    var test_session_visit_count = req.session.test_session_visit_count;

    if (req.user){
      console.log('req.user.displayName is ' + req.user.displayName);
    } else {
      console.log('no user. you might want to login?')
    }

    if (req.session){
      console.log('session is ' + util.inspect(req.session));
    } else {
      console.log('no session')
    }

    res.render('test_session.jade', {
        locals: {
            title: 'Test Session',
            test_session_visit_count: test_session_visit_count,
        }
    });
});



// Redirect the user to Twitter for authentication.  When complete, Twitter
// will redirect the user back to the application at
// /auth/twitter/callback
app.get('/auth/twitter', passport.authenticate('twitter'));

app.get('/auth/facebook', passport.authenticate('facebook'));

// Twitter will redirect the user to this URL after approval.  Finish the
// authentication process by attempting to obtain an access token.  If
// access was granted, the user will be logged in.  Otherwise,
// authentication has failed.
app.get('/auth/twitter/callback', 
    passport.authenticate('twitter', { successRedirect: '/',
                                     failureRedirect: '/error' }));

app.get('/auth/facebook/callback', 
    passport.authenticate('facebook', { successRedirect: '/',
                                     failureRedirect: '/error' }));



app.listen(settings.server.port, '127.0.0.1', function() {
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});