var fs = require('fs');
var Steam = require('steam');

// if we've saved a server list, use it
var SERVERS_FILE = __dirname + '/database/steamservers.json';
if (fs.existsSync(SERVERS_FILE)) {
  Steam.servers = JSON.parse(fs.readFileSync(SERVERS_FILE));
}

var steamClient = new Steam.SteamClient();
var steamUser = new Steam.SteamUser(steamClient);
var steamFriends = new Steam.SteamFriends(steamClient);

steamClient.connect();
steamClient.on('connected', function() {
  steamUser.logOn({
    account_name: 'steambot5527',
    password: '!@Razord1337@!',
    auth_code: '8V3TB'
  });
});

steamClient.on('logOnResponse', function(res) {
  if (res.eresult == Steam.EResult.OK) {
    console.log('Logged in Steam!');
    steamFriends.setPersonaState(Steam.EPersonaState.Online); // to display your bot's status as "Online"
    steamFriends.setPersonaName('Haruhi'); // to change its nickname
    steamFriends.joinChat('103582791431621417'); // the group's SteamID as a string
  } else {
      console.log('Something\'s wroooong!');
      console.log('Result: ', res.eresult);
      console.log('Possible results: ', Steam.EResult);
  }
});

steamClient.on('servers', function(servers) {
  fs.writeFile(SERVERS_FILE, JSON.stringify(servers));
});
/*
steamFriends.on('chatInvite', function(chatRoomID, chatRoomName, patronID) {
  console.log('Got an invite to ' + chatRoomName + ' from ' + steamFriends.personaStates[patronID].player_name);
  steamFriends.joinChat(chatRoomID); // autojoin on invite
});*/

steamFriends.on('message', function(source, message, type, chatter) {
  // respond to both chat room and private messages
  console.log('Received message: ' + message);
  if (message == 'ping') {
    steamFriends.sendMessage(source, 'pong', Steam.EChatEntryType.ChatMsg); // ChatMsg by default
  }
});
/*
steamFriends.on('chatStateChange', function(stateChange, chatterActedOn, steamIdChat, chatterActedBy) {
  if (stateChange == Steam.EChatMemberStateChange.Kicked && chatterActedOn == steamClient.steamID) {
    steamFriends.joinChat(steamIdChat);  // autorejoin!
  }
});*/

/*
steamFriends.on('clanState', function(clanState) {
  if (clanState.announcements.length) {
    console.log('Group with SteamID ' + clanState.steamid_clan + ' has posted ' + clanState.announcements[0].headline);
  }
});*/

var EventEmitter = require('events').EventEmitter;

var SteamOverlordBot = (function() {
    function SteamOverlordBot(options) {
        options = options || {};
        this.username = options.username;
        this.password = options.password;
        //this.
        // TODO
    }
    
    SteamOverlordBot.prototype = {
        constructor: SteamOverlordBot
    };
    
    return SteamOverlordBot;
})();

var SteamOverlord = (function() {
    var defaults = {
        bots: [],
        lazyLogin: true,
    };
    function SteamOverlord(options) {
        EventEmitter.call(this);
        options = options || {};
        this.bots = options.bots.map(function(bot_data) {
            return new SteamOverlordBot(bot_data);
        });
    }
    
    SteamOverlord.prototype = Object.create(EventEmitter.prototype);
    SteamOverlord.prototype.constructor = SteamOverlord;
    
    return SteamOverlord;
})();