var config = require('./config');
var User = require('./models').User;

var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var SteamStrategy = require('passport-steam').Strategy;

function makeAuthAddress(strategy, postfix) {
    postfix = postfix || '';
    return config.schema + '://' + config.domain + '/auth/' + strategy + '/' + postfix;
}

function getRealm() {
    return config.schema + '://' + config.domain + '/';
}
module.exports = {
    initializeAuth: function(app) {
        // TODO: Register all this stuff in expressjs and socket.io

        // TODO: Hash passwords
        passport.use(new LocalStrategy(
            { passReqToCallback: true },
            function(req, username, password, cb) {
                console.log('Auth attempt: ', username, password);
                User.findOne({name: username}, function(err, user) {
                    if (err) cb(err);
                    if (!user) {console.log('No such user: ', username); return cb(null, false); }
                    if (user.password !== password) { console.log('Invalid password: ', password); return cb(null, false); }
                    return cb(null, user);
                });
            }
        ));

        function createUserFromSteamData(steamData, done) {
            var username = steamData.username;
            var avatarSmall = steamData.avatarSmall || undefined;
            var avatarMedium = steamData.avatarMedium || undefined;
            var avatarFull = steamData.avatarFull || undefined;
            var identifier = steamData.identifier;
                
            var user = new User({
                name: username,
                avatars: {
                    steamAvatarSmall: avatarSmall,
                    steamAvatarMedium: avatarMedium,
                    steamAvatarFull: avatarFull
                },
                authIdentifiers: {
                    steam: identifier
                },
                balance: {
                    money: 0
                },
                roles: ['user']
            });
            user.persist(function(err, createdUser) {
                if (err) {
                    done(err)
                } else { 
                    console.log('CREATED USER OBJECT: ', createdUser);
                    done(null, createdUser);
                }
            });
        }

        // TODO: This URL needs to be dynamic and either stored in config or generated authomatically
        passport.use(new SteamStrategy({
                returnURL: makeAuthAddress('steam', 'return'),
                realm: getRealm(),
                apiKey: config.steamAPIKey
            },
            function(identifier, profile, done) {
                console.log('STEAM PROFILE');
                console.log(identifier, profile);
                var steamData = {
                    username: profile._json.displayname || profile._json.personaname,
                    identifier: identifier,
                    avatarSmall: profile._json.avatarsmall,
                    avatarMedium: profile._json.avatarmedium,
                    avatarFull: profile._json.avatarfull
                };
                User.findOne({ $or: [{'authIdentifiers.steam': identifier}, {'authIdentifiers.steam': profile._json.steamid}] }, function(err, user) {
                    if (err) {
                        done(err);
                        return;
                    }
                    if (user) {
                        console.log('FOUND USER: ', user);
                        // TODO: Will fuck up if we allow to use non-steam usernames in the app. User { names: { steam: ..., local: ... } } would be a better solution.
                        // Alternatively, we could keep completely separate records with account data (steam, local, facebook and whatnot) and merge them on demand.
                        if (steamData.username !== user.name) {
                            user.name = steamData.username;
                        }
                        if (steamData.avatarFull !== user.avatars.steamAvatarFull) {
                            user.avatars.steamAvatarSmall = steamData.avatarSmall;
                            user.avatars.steamAvatarMedium = steamData.avatarMedium;
                            user.avatars.steamAvatarFull = steamData.avatarFull;
                        }
                        user.persist(function(err, user) {
                            if (err) {
                                done(err);
                                return;
                            }
                            done(null, user);
                        });
                    } else {
                        console.log('USER NOT FOUND, CREATING...');
                        createUserFromSteamData(steamData, done);
                    }
                });
            }
        ));

        passport.serializeUser(function(user, cb) {
            console.log('USER: ');
            console.log(user);
            cb(null, user._id);
        });

        passport.deserializeUser(function(id, cb) {
            User.findOne({ _id: id }, function(err, user) {
                if (err) { return cb(err); }
                if (!user) {
                    console.log('No user found!');
                    cb(null, false);
                } else {
                    cb(null, user);
                }
            });
        });



        app.get('/auth/steam',
            passport.authenticate('steam', {failureRedirect: '/auth/steam/fail'}),
            function(req, res) {
                console.log('/ Successfully authenticated through Steam!');
                console.log('/ User object:');
                console.log(req.user);
                res.redirect('/');
            }
        );

        app.get('/auth/steam/return',
            passport.authenticate('steam', {failureRedirect: '/auth/steam/fail'}),
            function(req, res) {
                console.log('/return Successfully authenticated through Steam!');
                console.log('/return User object:');
                console.log(req.user);
                res.redirect('/');
            }
        );

        app.get('/auth/steam/fail',
            function(req, res) {
                console.log('Failed to authenticate through Steam!');
                res.send('Failed to authenticate through Steam!');
            }
        );
    }
}