var nedb = require('nedb');
var fs = require('fs');
var util = require('./util');
var config = require('./config');
var EventEmitter = require('events').EventEmitter;

var BaseModel = (function() {
    function BaseModel() {}
    
    BaseModel.prototype = {
        constructor: BaseModel,
        $_errors: [],
        persist: function(cb) {
            var self = this;
            return this.constructor.update({ _id: self._id }, self.constructor.serializeToPOD(self), { upsert: true }, cb);
        },
        serializeToPOD: function(options) {
            return this.constructor.serializeToPOD(this, options);
        }
    };
    
    BaseModel.serializeToPOD = function(obj, options) {
        options = options || {};
        var result = {};
        for (var key in obj) {
            if (key.startsWith('$_') || key.startsWith('_')) continue;
            if ((!options.only || options.only.indexOf(key) >= 0) && (!options.exclude || options.exclude.indexOf(key) < 0)) {
                result[key] = obj[key];
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
        this._id = null;
        if (params.isEvenetEmitter) {
            EventEmitter.call(this);
        }
        for (var key in params.fields) {
            if (!params.fields.hasOwnProperty(key)) continue;
            this[key] = params.fields[key];
        }
        for (var key in options) {
            if (!options.hasOwnProperty(key)) continue;
            this[key] = options[key];
        }
        if (this.initialize) {
            this.initialize(options);
        }
    };
    
    constructor.name = name;
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
        Object.defineProperty(constructor.prototype, key, params.properties[key]);
    }
    
    for (var key in params.methods) {
        if (!params.methods.hasOwnProperty(key)) continue;
        constructor.prototype[key] = params.methods[key];
    }
    
    var db_methods = ['insert', 'update', 'remove'];
    for (var i = 0; i < db_methods.length; ++i) {
        constructor[db_methods[i]] = constructor._db[db_methods[i]].bind(constructor._db);
    }
    
    constructor.find = function(query, cb) {
        return constructor._db.find(query, cb ? (function(err, results) {
            if (err) cb(err);
            cb(null, results.map(constructor.deserializeFromPOD));
        }) : undefined);
    };
    
    constructor.findOne = function(query, cb) {
        return constructor._db.findOne(query, cb ? (function(err, result) {
            if (err) cb(err);
            cb(null, constructor.deserializeFromPOD(result));
        }) : undefined);
    };
    
    constructor.serializeToPOD = BaseModel.serializeToPOD;
    constructor.deserializeFromPOD = function(data) {
        return new constructor(data);
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
            balance: 0
        },
        
        methods: {
            deposit: function(amount) {
                this.balance += amount;
            },
            getClientSideData: function() {
                return this.serializeToPOD({
                    exclude: ['password', 'password_hash', 'password_salt', 'salt']
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
            initialize: function(options) {
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
                        console.log('Could not read polldata.json. If this is the first run, it\'s okay.');
                        return;
                    }
                    console.log('Loaded polldata.json');
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
                console.log('Error polling trade offers: ', err);
            },
            onTradeOffersNewOffer: function(offer) {
                console.log('New offer #', offer.id ,', partner: ', offer.partner.getSteam3RenderedID());
                if (offer.message) {
                    console.log('Offer message: ', offer.message);
                }
                
                // TODO: Check: if offer.itemsToGive.length > 0, second party must be admin or have rights for these items
                if (offer.isGlitched() || !offer.isOurOffer) {
                    console.log('Got glitched offer! Declining.');
                    offer.decline(function(err) {
                        if (err) { console.log('Failed to decline offer: ', err); } else {
                            console.log('Offer declined!');
                        }
                    });
                } else {
                    offer.accept(true, function(err, status) {
                        if (err) {
                            console.log('Error while accepting TradeOffer: ', err);
                        } else {
                            console.log('Accepting offer, status: ', status);
                        }
                    });
                }
            },
            onTradeOfferReceivedOfferChanged: function(offer, oldState) {
                console.log("Offer #" + offer.id + " changed: " + TradeOfferManager.getStateName(oldState) + " -> " + TradeOfferManager.getStateName(offer.state));

                if (offer.state == TradeOfferManager.ETradeOfferState.Accepted) {
                    offer.getReceivedItems(function(err, items) {
                        if (err) {
                            console.log("Couldn't get received items: " + err);
                        } else {
                            var names = items.map(function(item) {
                                return item.name;
                            });

                            console.log("Received: [" + names.join(', ') + "]");
                        }
                    });
                }
            },
            onLoggedOn: function(details) {
                console.log('Logged into Steam as ' + this._client.steamID.getSteam3RenderedID());
                this._status = SteamOverlordBot.Status.ONLINE;
            },
            onDisconnected: function(eresult) {
                this._status = SteamOverlordBot.Status.OFFLINE;
                console.log('Disconnected from Steam. EResult === ', eresult);
            },
            onError: function(err) {
                this._status = SteamOverlordBot.Status.OFFLINE;
                console.log('ERROR!');
                console.log(err);
                process.exit(1);
            },
            enable2FA: function() {
                var self = this;
                if (!this.twoFactorEnabled && !this.activationCode2FA) {
                    this._client.enableTwoFactor(function(response) {
                        try {
                            console.log('Got enable2fa response!');
                            console.log(JSON.stringify(response));
                            fs.writeFileSync(__dirname + 'response_' + (Math.random() * 100000).toString() + '.txt', JSON.stringify(response), 'utf8');
                        } catch(e) {
                            console.log('Error while trying to display enbale2fa response');
                            console.log(response);
                        }
                        
                        if (response.status !== SteamUser.Steam.EResult.OK) {
                            console.log('ERROR: Enabling 2FA failed: code = ', response.status);
                        } else {
                            self.sharedSecret2FA = response.shared_secret;
                            if (response.identity_secret) {
                                self.identitySecret2FA = response.identity_secret;
                                console.log('Yay, got identity_secret from Steam: ', self.identitySecret2FA);
                            } else {
                                console.log('FUCK! Steam response doesnt contain identity_secret!');
                            }
                            self.revocationCode2FA = response.revocation_code;
                            console.log('Enabling 2FA for ' + this._id + ' started. Please provide activationCode');
                            self.persist();
                        }
                    });
                } else if (!this.twoFactorEnabled && this.activationCode2FA) {
                    if (!this.sharedSecret2FA) {
                        console.log('WTF r u doin\' man? You provided activationCode2FA, but I have no shared secret!');
                    } else {
                        this._client.finalizeTwoFactor(this.sharedSecret2FA, this.activationCode2FA, function(err) {
                            if (err) {
                                console.log('ERROR: Unable to finalize 2FA enabling for ' + this._id);
                                console.log(err);
                            } else {
                                self.twoFactorEnabled = true;
                                console.log('Successfully enabled 2FA for ' + this._id);
                                self.persist();
                            }
                        });
                    }
                }
            },
            onWebSession: function(sessionID, cookies) {
                console.log('Got web session');
                var self = this;
                this._client.setPersona(SteamUser.Steam.EPersonaState.Online);
                this._steamcommunity.setCookies(cookies);
                
                if (this.twoFactorEnabled) {
                    this._steamcommunity.startConfirmationChecker(15000, this.identitySecret2FA);
                } else {
                    console.log('I will not poll offers: I have no two-factor auth codes!');
                }
                
                if (this.use2FA === 'enable' && !this.twoFactorEnabled) {
                    this.enable2FA();
                }
                
                this._offers.setCookies(cookies, function(err) {
                    if (err) {
                        console.log('ERROR: Unable to set trade offer cookies!');
                        console.log(err);
                        //process.exit(1);
                    } else {
                        console.log('Trade offer cookies set. Got API key: ', self._offers.apiKey);
                    }
                });
            },
            onNewItems: function(count) {
                console.log('Received ' + count + ' new items');
            },
            onEmailInfo: function(address, validated) {
                console.log('My email address is ' + address + ' and it is ' + (!validated ? 'not' : '') + 'validated');
            },
            onWallet: function(hasWallet, currency, balance) {
                if (hasWallet) {
                    console.log('I have ' + SteamUser.formatCurrency(balance, currency) + ' money!');
                } else {
                    console.log('I do not have a Steam wallet');
                }
            },
            onAccountLimitations: function(limited, communityBanned, locked, canInviteFriends) {
                if (limited) {
                    console.log('My account is limited. I cannot send friend invites, use the market, open group chat, or access the web API.');
                }
                if (communityBanned) {
                    console.log('I am banned from Steam Community!');
                }
                if (locked) {
                    console.log('My account is locked. I cannot trade/gift/purchase items, play on VAC servers, or access Steam Community.');
                }
                if (!canInviteFriends) {
                    console.log('I am unable to invite friends');
                }
            },
            isOnline: function() {
                return this._status === SteamOverlordBot.Status.ONLINE;
            },
            activate: function(options) {
                if (this.isOnline()) return;
                console.log('Logging in...');
                console.log(this.username, this.password, this.guardCode);
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
            balance: 100500,
            roles: ['user', 'admin']
        });
    }
});

module.exports = models;