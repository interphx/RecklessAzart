var nedb = require('nedb');

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
    
    var constructor = function(options) {
        options = options || {};
        this._id = null;
        for (var key in params.fields) {
            if (!params.fields.hasOwnProperty(key)) continue;
            this[key] = params.fields[key];
        }
        for (var key in options) {
            if (!options.hasOwnProperty(key)) continue;
            this[key] = options[key];
        }
    };
    
    constructor.name = name;
    constructor._dbFile = __dirname + '/database/' + name.trim().toLowerCase() + '.db';
    constructor._db = new nedb({filename: constructor._dbFile, autoload: true});
    
    constructor.prototype = Object.create(BaseModel.prototype);
    constructor.prototype.constructor = constructor;
    
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
        constructor._db.find(query, function(err, results) {
            if (err) cb(err);
            cb(null, results.map(constructor.deserializeFromPOD));
        });
    };
    
    constructor.findOne = function(query, cb) {
        constructor._db.findOne(query, function(err, result) {
            if (err) cb(err);
            cb(null, constructor.deserializeFromPOD(result));
        });
    };
    
    constructor.serializeToPOD = BaseModel.serializeToPOD;
    constructor.deserializeFromPOD = function(data) {
        return new constructor(data);
    };
    
    return constructor;
};

var User = createModel('User', {
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
});

var models = {
    //Session: new nedb({filename: __dirname + '/database/session.db', autoload: true})
    //User: new nedb({filename: __dirname + '/database/user.db', autoload: true})
    User: User
};

models.User.findOne({ roles: { $elemMatch: 'admin' } }, function(err, user) {
    if (err) throw err;
    if (!user) {
        User.insert({
            name: 'User',
            password: '1234',
            balance: 100500,
            roles: ['user', 'admin']
        });
    }
});

module.exports = models;