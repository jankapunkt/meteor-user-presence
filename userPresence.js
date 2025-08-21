import { Random } from 'meteor/random';

// serverId - unique per server per restart
const serverId = Random.id();

// user connections
export const UserPresenceSessions = new Mongo.Collection('userpresencesessions');

// list of servers
export const UserPresenceServers = new Mongo.Collection('userpresenceservers');

let trackServerInterval = 30;
let trackServerIntervalId;

// keep track of which servers are online
const trackServer = async (id) => {
  let find = { serverId: id };
  let modifier = { $set: { ping: new Date() } };
  await UserPresenceServers.upsertAsync(find, modifier);
};

const setTrackServerInterval = (value) => {
  if (!value || value < 0) {
    throw new Error("Unsupported value:" + value);
  }
  if (trackServerIntervalId) {
    Meteor.clearInterval(trackServerIntervalId);
  }
  trackServerInterval = value;
  trackServerIntervalId = Meteor.setInterval(async () => {
    await trackServer(serverId);
  }, 1000 * trackServerInterval);
};

let updateStatusCutoff = 5;
let updateStatusInterval = 10;
let updateStatusIntervalId;

// remove old servers and sessions
// update status of users connected to that server
const updateStatus = async (cutoffValue) => {
  let cutoff = new Date();
  cutoff.setMinutes(new Date().getMinutes() - cutoffValue);
  const servers = await UserPresenceServers.find({
    ping: { $lt: cutoff }
  }, {
    fields: { _id: 1, serverId: 1 }
  }).fetchAsync()

  for (const server of servers) {
    await UserPresenceServers.removeAsync(server._id);
    await UserPresenceSessions.removeAsync({ serverId: server.serverId });
  }

  const serverIds = [...new Set(servers.map(server => server.serverId))];
  const users = await Meteor.users.find({
    'presence.serverId': { $in: serverIds }
  }, {
    fields: { _id: 1 }
  }).fetchAsync();

  for (const user of users) {
    await trackUserStatus(user._id);
  }
};

const setUpdateStatusInterval = (value) => {
  if (!value || value < 0) {
    throw new Error("Unsupported value:" + value);
  }
  if (updateStatusIntervalId) {
    Meteor.clearInterval(updateStatusIntervalId);
  }
  updateStatusInterval = value;
  updateStatusIntervalId = Meteor.setInterval(async () => {
    await updateStatus(updateStatusCutoff)
  }, 1000 * updateStatusInterval);
};

const userConnected = async (userId, connection) => {
  await UserPresenceSessions.insertAsync({
    serverId: serverId,
    userId: userId,
    connectionId: connection.id,
    createdAt: new Date()
  });
  await trackUserStatus(userId, connection);
}

const userDisconnected = async (userId, connection) => {
  await UserPresenceSessions.removeAsync({ userId: userId, connectionId: connection.id });
  await trackUserStatus(userId, connection);
}

const trackUserStatus = async (userId, connection) => {
  const presence = {
    updatedAt: new Date(),
    serverId: serverId
  }

  if (connection) {
    presence.clientAddress = connection.clientAddress;
    presence.httpHeaders = connection.httpHeaders;
  }

  const isOnline = await UserPresenceSessions.countDocuments({ userId });
  presence.status = isOnline
    ? 'online'
    : 'offline';

  await Meteor.users.updateAsync(userId, { $set: { presence: presence } });
}

//Helpers for testing / dev
export const UserPresenceHelpers = {};
if (Meteor.isDevelopment) {
  UserPresenceHelpers.userConnected = userConnected;
  UserPresenceHelpers.userDisconnected = userDisconnected;
  UserPresenceHelpers.trackUserStatus = trackUserStatus;
  UserPresenceHelpers.trackServer = trackServer;
  UserPresenceHelpers.updateStatus = updateStatus;
}

UserPresenceHelpers.setTrackServerInterval = setTrackServerInterval;
UserPresenceHelpers.trackServerInterval = () => ({
  value: trackServerInterval,
  id: trackServerIntervalId
});

UserPresenceHelpers.setUpdateStatusInterval = setUpdateStatusInterval;
UserPresenceHelpers.updateStatusInterval = () => ({
  value: updateStatusInterval,
  id: updateStatusIntervalId
});

export const initUserPresence = async () => {
  await UserPresenceServers.ensureIndexAsync({ ping: 1 });
  await UserPresenceServers.ensureIndexAsync({ serverId: 1 });
  await Meteor.users.ensureIndexAsync({ 'presence.serverId': 1 });
  await UserPresenceSessions.ensureIndexAsync({ userId: 1 });
  // set the default
  setTrackServerInterval(trackServerInterval);
  // set the default
  setUpdateStatusInterval(updateStatusInterval);
  // track user connection and disconnection
  Meteor.publish(null, async function () {
    const self = this;

    if (self.userId && self.connection && self.connection.id) {
      await userConnected(self.userId, self.connection);

      self.onStop(function () {
        userDisconnected(self.userId, self.connection);
      });
    }

    self.ready();
  });
}