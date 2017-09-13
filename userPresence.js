// serverId - unique per server per restart
var serverId = Random.id();


// user connections
UserPresenceSessions = new Mongo.Collection('userpresencesessions');

// list of servers
UserPresenceServers = new Mongo.Collection('userpresenceservers');


UserPresenceServers._ensureIndex({ping:1});
UserPresenceServers._ensureIndex({serverId:1});
Meteor.users._ensureIndex({'presence.serverId':1});
UserPresenceSessions._ensureIndex({userId:1});



var trackServerInterval = 30;
var trackServerIntervalId;

// keep track of which servers are online
var trackServer = function(id) {
  let find = {serverId:id};
  let modifier = {$set: {ping:new Date()}};
  UserPresenceServers.upsert(find, modifier);
};

var setTrackServerInterval = function (value) {
  if (!value || value < 0) throw new Error("Unsupported value:"+value);
  if (trackServerIntervalId) {
    Meteor.clearInterval(trackServerIntervalId);
  }
  trackServerInterval = value;
  trackServerIntervalId = Meteor.setInterval(function () {
    trackServer(serverId);
  }, 1000 * trackServerInterval);
};

// set the default
setTrackServerInterval(trackServerInterval);



var updateStatusCutoff = 5;
var updateStatusInterval = 10;
var updateStatusIntervalId;

// remove old servers and sessions
// update status of users connected to that server
var updateStatus = function(cutoffValue) {
  let cutoff = new Date();
  cutoff.setMinutes(new Date().getMinutes() - cutoffValue);
  UserPresenceServers.find({ping: {$lt:cutoff}}).forEach(function(server) {
    UserPresenceServers.remove(server._id);
    UserPresenceSessions.remove({serverId:server.serverId});
    Meteor.users.find({'presence.serverId':server.serverId}).forEach(function(user) {
      trackUserStatus(user._id);
    })
  })
};

var setUpdateStatusInterval = function (value) {
  if (!value || value < 0) throw new Error("Unsupported value:"+value);
  if (updateStatusIntervalId) {
    Meteor.clearInterval(updateStatusIntervalId);
  }
  updateStatusInterval = value;
  updateStatusIntervalId = Meteor.setInterval(function () {
    updateStatus(updateStatusCutoff)
  }, 1000 * updateStatusInterval);
};

// set the defaul
setUpdateStatusInterval(updateStatusInterval);



// track user connection and disconnection
Meteor.publish(null, function(){
  var self = this;

  if(self.userId && self.connection && self.connection.id){
    userConnected(self.userId, self.connection);

    self.onStop(function(){
      userDisconnected(self.userId, self.connection);
    });
  }

  self.ready();
});



var userConnected = function(userId, connection) {
  UserPresenceSessions.insert({serverId:serverId, userId:userId, connectionId:connection.id, createdAt:new Date()});
  trackUserStatus(userId, connection);
}



var userDisconnected = function(userId, connection) {
  UserPresenceSessions.remove({userId:userId, connectionId:connection.id});
  trackUserStatus(userId, connection);
}



var trackUserStatus = function(userId, connection) {
  let presence = {
    updatedAt: new Date(),
    serverId: serverId
  }

  if (connection) {
    presence.clientAddress = connection.clientAddress;
    presence.httpHeaders = connection.httpHeaders;
  }

  let isOnline = UserPresenceSessions.find({userId:userId}).count();

  if (isOnline) {
    presence.status = 'online';
  } else {
    presence.status = 'offline';
  }

  Meteor.users.update(userId, {$set: {presence:presence}});
}

//Helpers for testing / dev
UserPresenceHelpers = {};
if (Meteor.isDevelopment) {
  UserPresenceHelpers.userConnected = userConnected;
  UserPresenceHelpers.userDisconnected = userDisconnected;
  UserPresenceHelpers.trackUserStatus = trackUserStatus;
  UserPresenceHelpers.trackServer = trackServer;
  UserPresenceHelpers.updateStatus = updateStatus;
}

UserPresenceHelpers.setTrackServerInterval = setTrackServerInterval;
UserPresenceHelpers.trackServerInterval = function(){
	return {
		value:trackServerInterval,
		id:trackServerIntervalId
	};
};

UserPresenceHelpers.setUpdateStatusInterval = setUpdateStatusInterval;
UserPresenceHelpers.updateStatusInterval = function(){
	return {
		value:updateStatusInterval,
		id:updateStatusIntervalId
	};
};