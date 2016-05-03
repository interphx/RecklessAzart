var nedb = require('nedb');
var fs = require('fs');
var util = require('./util');
var config = require('./config');
var EventEmitter = require('events').EventEmitter;

var BaseModel = (function() {
    function BaseModel() {
        throw new Error('You cannot instantiate abstract BaseModel class');
    }
    
    BaseModel.prototype = {
        constructor: BaseModel,
        $_errors: [],
        persist: function(cb) {
            var self = this;
            if (!this._id) {
                return this.constructor.insert(this, cb);
            } else {
                return this.constructor.update({ _id: self._id }, self.constructor.serializeToPOD(self), function(err) {
                    if (err) {
                        cb(err);
                        return;
                    }
                    cb(null, self);
                });
            }
        },
        serializeToPOD: function(options) {
            return this.constructor.serializeToPOD(this, options);
        }
    };
    
    BaseModel.serializeToPOD = function(obj, options) {
        options = options || {};
        var result = {};
        var fields_to_serialize = Object.keys(obj.constructor.modelParams ? obj.constructor.modelParams.fields : obj);
        for (var i = 0; i < fields_to_serialize.length; ++i) {
            var key = fields_to_serialize[i];
            if (key.startsWith('$_') || key.startsWith('_')) continue;
            if ((!options.only || options.only.indexOf(key) >= 0) && (!options.exclude || options.exclude.indexOf(key) < 0)) {
                result[key] = obj[key];
            }
        }
        if (options.include) {
            for (var i = 0; i < options.include.length; ++i) {
                result[options.include[i]] = obj[options.include[i]];
            }
        }
        return result;
    };
    
    // TODO: Валидаторы всё равно надо как-то иначе вызывать
    /*
    BaseModel.update = function(obj, data, cb) {
        var validators = obj.constructor.validators;
        for (var key in data) {
            var validation_result = validators[key] ? validators[key](data[key]) : true;
            if (validation_result !== true) {
                obj._errors.push(validation_result);
            } else {
                if (obj._errors.length > 0) continue;
                obj[key] = data[key];
            }
        }
        if (obj._errors.length === 0) {
            cb(null, obj);
        } else {
            cb(new Error('Validation error. ' + obj._errors.length + ' validation errors detected: ' obj._errors.join('; ')));
        }
    };*/
    
    return BaseModel;
})();

function createModel(name, params) {
    params = params || {};
    params.fields = params.fields || {};
    params.properties = params.properties || {};
    params.methods = params.methods || {};
    params.static = params.static || {};
    if (params.isEvenetEmitter == null) {
        params.isEventEmitter = false;
    }
    
    var constructor = function(options) {
        options = options || {};
        this._id = null || options._id;
        if (params.isEvenetEmitter) {
            EventEmitter.call(this);
        }
        for (var key in params.fields) {
            if (!params.fields.hasOwnProperty(key)) continue;
            // TODO: Make deep/shallow copy here if appropriate
            this[key] = params.fields[key] ? util.deepCopyPOD(params.fields[key].default) : undefined;
        }
        for (var key in options) {
            if (!options.hasOwnProperty(key)) continue;
            this[key] = options[key];
        }
        if (this.initialize) {
            this.initialize(options);
        }
    };
    
    constructor.modelParams = params;
    // :(
    // It's a shame we cannot just create a named function without eval/new Functon scopeless hacks
    Object.defineProperty(constructor, 'name', { value: name });
    constructor._dbFile = __dirname + '/database/' + util.camelCaseToUnderscore(name.trim()).toLowerCase() + '.db';
    constructor._db = new nedb({filename: constructor._dbFile, autoload: true});
    
    constructor.prototype = Object.create(BaseModel.prototype);
    constructor.prototype.constructor = constructor;
    
    if (params.isEventEmitter) {
        constructor.prototype = util.shallowMerge([
            EventEmitter.prototype,
            constructor.prototype
        ]);
    }
    
    for (var key in params.fields) {
        if (!params.properties.hasOwnProperty(key)) continue;
        constructor.prototype[key] = params.fields[key];
    }
    
    for (var key in params.properties) {
        if (!params.properties.hasOwnProperty(key)) continue;
        Object.defineProperty(constructor.prototype, key, util.shallowMerge([{enumerable: false}, params.properties[key]]));
    }
    
    for (var key in params.methods) {
        if (!params.methods.hasOwnProperty(key)) continue;
        constructor.prototype[key] = params.methods[key];
    }
    
    var db_methods = ['update', 'remove'];
    for (var i = 0; i < db_methods.length; ++i) {
        constructor[db_methods[i]] = constructor._db[db_methods[i]].bind(constructor._db);
    }
    
    constructor.find = function(query, cb) {
        return constructor._db.find(query, cb ? (function(err, results) {
            if (err) { 
                cb(err); 
            } else {
                cb(null, results.map(constructor.deserializeFromPOD));
            }
        }) : undefined);
    };
    
    constructor.findOne = function(query, cb) {
        return constructor._db.findOne(query, cb ? (function(err, result) {
            if (err) {
                cb(err);
                return;
            } else {
                cb(null, result ? constructor.deserializeFromPOD(result) : result);
            }
        }) : undefined);

    };
    
    constructor.insert = function(obj, cb) {
        return constructor._db.insert(constructor.serializeToPOD(obj), cb ? (function(err, result) {
            if (err) {
                cb(err);
                return;
            } else {
                obj._id = result._id;
                cb(null, obj);
            }
        }) : undefined);
    };
    
    constructor.serializeToPOD = BaseModel.serializeToPOD;
    constructor.deserializeFromPOD = function(data) {
        if (!data) {
            throw new Error('Tried to deserialize something falsey: ', data);
        }
        var result = new constructor(data);
        /*console.log('Deserialized from data: ', data);
        console.log('Deserialized object, PROTOTYPE: ', constructor.prototype);
        console.log('Deserialized object of ', constructor.name, ', has getClientSideData: ', result.getClientSideData != null);
        console.log('Result instanceof constructor: ', result instanceof constructor);
        console.log('Result keys: ', Object.keys(result));
        console.log('getClientSideData equality: ', result.getClientSideData, result.__proto__.getClientSideData, constructor.prototype.getClientSideData);*/
        //return new constructor(data);
        return result;
    };
    
    for (var key in params.static) {
        if (!params.static.hasOwnProperty(key)) continue;
        constructor[key] = params.static[key];
    }

    return constructor;
};


var SteamData = {
    appid: {
        TF2: 440,
        DOTA2: 570,
        CSGO: 730,
        Steam: 753
    },
    
    contextid: {
        TF2: 2,
        DOTA2: 2,
        CSGO: 2,
        Steam: 6
    }
};

var SteamUser = require('steam-user');
var TradeOfferManager = require('steam-tradeoffer-manager');
var SteamCommunity = require('steamcommunity');
var SteamTOTP = require('steam-totp');

var models = {
    User: createModel('User', {
        fields: {
            name: undefined,
            password: undefined,
            avatars: {
                default: {
                    steamAvatarSmall: undefined,
                    steamAvatarMedium: undefined,
                    steamAvatarFull: undefined                    
                }
            },
            balance: {
                default: {money: 0}
            },
            authIdentifiers: {
                default: {}
            }
        },
        
        properties: {
            loggedIn: {
                get: function() { return true; }
            }
        },
        
        methods: {
            deposit: function(amount) {
                this.balance.money += amount;
            },
            getClientSideData: function() {
                return this.serializeToPOD({
                    exclude: ['password', 'password_hash', 'password_salt', 'salt'],
                    inlcude: ['loggedIn']
                });
            }
        }
    }),
    
    SteamOverlordBot: createModel('SteamOverlordBot', {
        isEventEmitter: true,
        fields: {
            username: undefined,
            password: undefined,
            guardCode: undefined,
            email: undefined,
            use2FA: undefined,
            twoFactorEnabled: undefined,
            sharedSecret2FA: undefined,
            identitySecret2FA: undefined,
            revocationCode2FA: undefined,
            activationCode2FA: undefined            
        },
        static: {
            Status: {
                OFFLINE: 0,
                ONLINE: 1
            }
        },
        methods: {
            say: function() {
                console.log.apply(console, [(this._id || 'A bot') + ':'].concat(Array.prototype.slice.call(arguments)));
            },
            initialize: function(options) {
                var self = this;
                this._client = new SteamUser({
                    dataDirectory: __dirname + '/database/steam-user/'
                });
                this._offers = new TradeOfferManager({
                    steam: this._client,
                    domain: config.domain,
                    language: "ru",
                    pollInterval: config.tradeOffers.pollInterval,
                    cancelTime: config.tradeOffers.cancelTime
                });
                this._steamcommunity = new SteamCommunity();               
                
                fs.readFile(__dirname + '/database/steam-tradeoffer-manager/polldata.json', function(err, data) {
                    if (err) {
                        self.say('Could not read polldata.json. If this is the first run, it\'s okay.');
                        return;
                    }
                    self.say('Loaded polldata.json');
                    offers.pollData = JSON.parse(data);
                });

                this._status = SteamOverlordBot.Status.OFFLINE;
                
                this._client.on('loggedOn', this.onLoggedOn.bind(this));
                this._client.on('disconnected', this.onDisconnected.bind(this));
                this._client.on('error', this.onError.bind(this));
                this._client.on('webSession', this.onWebSession.bind(this));
                this._client.on('newItems', this.onNewItems.bind(this));
                this._client.on('emailInfo', this.onEmailInfo.bind(this));
                this._client.on('wallet', this.onWallet.bind(this));
                this._client.on('accountLimitations', this.onAccountLimitations.bind(this));
                
                this._offers.on('pollFailure', this.onTradeOffersPollFailure.bind(this));
                this._offers.on('pollData', this.onTradeOffersPollData.bind(this));
                this._offers.on('newOffer', this.onTradeOffersNewOffer.bind(this));
                this._offers.on('receivedOfferChanged', this.onTradeOfferReceivedOfferChanged.bind(this));
                
                this._steamcommunity.on('confKeyNeeded', this.onCommunityConfKeyNeeded.bind(this));
            },
            onCommunityConfKeyNeeded: function(tag, callback) {
                var time = Math.floor(Data.now() / 1000);
                if (this.twoFactorEnabled) {
                    callback(null, time, SteamTOTP.getConfirmationKey(this.identitySecret2FA, time, tag));
                } else {
                    callback(new Error('Unable to generate confirmation key: twoFactorEnabled is false'));
                }
            },
            onTradeOffersPollData: function(data) {
                fs.writeFile(__dirname + '/database/steam-trade-offers/polldata.json', JSON.stringify(data));
            },
            onTradeOffersPollFailure: function(err) {
                this.say('Error polling trade offers: ', err);
            },
            onTradeOffersNewOffer: function(offer) {
                var self = this;
                this.say('New offer #', offer.id ,', partner: ', offer.partner.getSteam3RenderedID());
                if (offer.message) {
                    this.say('Offer message: ', offer.message);
                }
                
                // TODO: Check: if offer.itemsToGive.length > 0, second party must be admin or have rights for these items
                if (offer.isGlitched() || !offer.isOurOffer) {
                    self.say('Got glitched offer! Declining.');
                    offer.decline(function(err) {
                        if (err) { self.say('Failed to decline offer: ', err); } else {
                            self.say('Offer declined!');
                        }
                    });
                } else {
                    offer.accept(true, function(err, status) {
                        if (err) {
                            self.say('Error while accepting TradeOffer: ', err);
                        } else {
                            self.say('Accepting offer, status: ', status);
                        }
                    });
                }
            },
            onTradeOfferReceivedOfferChanged: function(offer, oldState) {
                var self = this;
                self.say("Offer #" + offer.id + " changed: " + TradeOfferManager.getStateName(oldState) + " -> " + TradeOfferManager.getStateName(offer.state));

                if (offer.state == TradeOfferManager.ETradeOfferState.Accepted) {
                    offer.getReceivedItems(function(err, items) {
                        if (err) {
                            self.say("Couldn't get received items: " + err);
                        } else {
                            var names = items.map(function(item) {
                                return item.name;
                            });

                            self.say("Received: [" + names.join(', ') + "]");
                        }
                    });
                }
            },
            onLoggedOn: function(details) {
                this.say('Logged into Steam as ' + this._client.steamID.getSteam3RenderedID());
                this._status = SteamOverlordBot.Status.ONLINE;
            },
            onDisconnected: function(eresult) {
                this._status = SteamOverlordBot.Status.OFFLINE;
                this.say('Disconnected from Steam. EResult === ', eresult);
            },
            onError: function(err) {
                this._status = SteamOverlordBot.Status.OFFLINE;
                this.say('ERROR!');
                this.say(err);
                //process.exit(1);
            },
            enable2FA: function() {
                var self = this;
                if (!this.twoFactorEnabled && !this.activationCode2FA) {
                    this._client.enableTwoFactor(function(response) {
                        try {
                            self.say('Got enable2fa response!');
                            self.say(JSON.stringify(response));
                            fs.writeFileSync(__dirname + 'response_' + (Math.random() * 100000).toString() + '.txt', JSON.stringify(response), 'utf8');
                        } catch(e) {
                            self.say('Error while trying to display enbale2fa response');
                            self.say(response);
                        }
                        
                        if (response.status !== SteamUser.Steam.EResult.OK) {
                            self.say('ERROR: Enabling 2FA failed: code = ', response.status);
                        } else {
                            self.sharedSecret2FA = response.shared_secret;
                            if (response.identity_secret) {
                                self.identitySecret2FA = response.identity_secret;
                                self.say('Yay, got identity_secret from Steam: ', self.identitySecret2FA);
                            } else {
                                self.say('FUCK! Steam response doesnt contain identity_secret!');
                            }
                            self.revocationCode2FA = response.revocation_code;
                            self.say('Enabling 2FA for ' + this._id + ' started. Please provide activationCode');
                            self.persist();
                        }
                    });
                } else if (!this.twoFactorEnabled && this.activationCode2FA) {
                    if (!this.sharedSecret2FA) {
                        self.say('WTF r u doin\' man? You provided activationCode2FA, but I have no shared secret!');
                    } else {
                        this._client.finalizeTwoFactor(this.sharedSecret2FA, this.activationCode2FA, function(err) {
                            if (err) {
                                self.say('ERROR: Unable to finalize 2FA enabling for ' + this._id);
                                self.say(err);
                            } else {
                                self.twoFactorEnabled = true;
                                self.say('Successfully enabled 2FA for ' + this._id);
                                self.persist();
                            }
                        });
                    }
                }
            },
            onWebSession: function(sessionID, cookies) {
                var self = this;
                self.say('Got web session');
                this._client.setPersona(SteamUser.Steam.EPersonaState.Online);
                this._steamcommunity.setCookies(cookies);
                
                if (this.twoFactorEnabled) {
                    this._steamcommunity.startConfirmationChecker(15000, this.identitySecret2FA);
                } else {
                    self.say('I will not poll offers: I have no two-factor auth codes!');
                }
                
                if (this.use2FA === 'enable' && !this.twoFactorEnabled) {
                    this.enable2FA();
                }
                
                this._offers.setCookies(cookies, function(err) {
                    if (err) {
                        self.say('ERROR: Unable to set trade offer cookies!');
                        self.say(err);
                        //process.exit(1);
                    } else {
                        self.say('Trade offer cookies set. Got API key: ', self._offers.apiKey);
                    }
                });
            },
            onNewItems: function(count) {
                self.say('Received ' + count + ' new items');
            },
            onEmailInfo: function(address, validated) {
                self.say('My email address is ' + address + ' and it is ' + (!validated ? 'not' : '') + 'validated');
            },
            onWallet: function(hasWallet, currency, balance) {
                if (hasWallet) {
                    self.say('I have ' + SteamUser.formatCurrency(balance, currency) + ' money!');
                } else {
                    self.say('I do not have a Steam wallet');
                }
            },
            onAccountLimitations: function(limited, communityBanned, locked, canInviteFriends) {
                if (limited) {
                    self.say('My account is limited. I cannot send friend invites, use the market, open group chat, or access the web API.');
                }
                if (communityBanned) {
                    self.say('I am banned from Steam Community!');
                }
                if (locked) {
                    self.say('My account is locked. I cannot trade/gift/purchase items, play on VAC servers, or access Steam Community.');
                }
                if (!canInviteFriends) {
                    self.say('I am unable to invite friends');
                }
            },
            isOnline: function() {
                return this._status === SteamOverlordBot.Status.ONLINE;
            },
            activate: function(options) {
                if (this.isOnline()) return;
                self.say('Logging in...');
                self.say(this.username, this.password, this.guardCode);
                var logOnData = {
                    accountName: this.username,
                    password: this.password,
                    authCode: this.guardCode
                };
                if (this.twoFactorEnabled) {
                    logOnData.twoFactorCode = SteamTOTP.getAuthCode(this.sharedSecret2FA);
                }
                this._client.logOn(logOnData);
            }
        }
    }),
    
    ChatEntry: createModel('ChatEntry', {
        fields: {
            createdAt: undefined,
            authorName: undefined,
            text: undefined
        }
    })
};

var SteamOverlordBot = models.SteamOverlordBot;
var User = models.User;
var ChatEntry = models.ChatEntry;

models.User.findOne({ roles: { $elemMatch: 'admin' } }, function(err, user) {
    if (err) throw err;
    if (!user) {
        models.User.insert({
            name: 'User',
            password: '1234',
            balance: {
                money: 100500
            },
            roles: ['user', 'admin']
        });
    }
});

module.exports = models;