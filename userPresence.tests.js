/* eslint-env mocha */
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { chai, assert } from 'chai';
// import { PublicationCollector } from 'meteor/communitypackages:publication-collector';
import {
  UserPresenceSessions,
  UserPresenceServers,
  UserPresenceHelpers,
  initUserPresence
} from 'meteor/jkuester:userpresence';

const connectMeteor = () => {
  return new Promise((resolve) => {
    Meteor.onConnection((connection) => resolve(connection));
  })
}

describe('User Presence', () => {
  let testsConnection;

  before(async function () {
    this.timeout(20000);
    await initUserPresence()
    testsConnection = await connectMeteor()
  })

  const exists = (value) => {
    assert.isDefined(value);
    assert.isNotNull(value);
  };

  const isOnline = async (userId, expect) => {
    const user = await Meteor.users.findOneAsync(userId);
    exists(user);
    const presence = user.presence;
    exists(presence);

    if (expect)
      assert.equal(presence.status, 'online');
    else
      assert.equal(presence.status, 'offline');
  };

  const connect = async (userId, connection) => {
    await UserPresenceHelpers.userConnected(userId, connection);
    await UserPresenceHelpers.trackUserStatus(userId, connection);
  };

  const disconnect = async (userId, connection) => {
    await UserPresenceHelpers.userDisconnected(userId, connection);
    await UserPresenceHelpers.trackUserStatus(userId, connection);
  };

  const checkIndices = async (collection, indices) => {
    const raw = collection.rawCollection()
    const indexes = await raw.indexes()
    const mapped = indexes.map((el) => {
      const keyProps = Object.keys(el.key);
      return keyProps[0];
    });

    for (let index of indices) {
      if (mapped.indexOf(index) === -1) {
        throw new Error("Index not present: " + index)
      }
    }
  };

  describe('UserPresenceSessions', () => {

    it('is globally accessible on the server', () => {
      const instanceRef = Mongo.Collection.get('userpresencesessions');
      exists(instanceRef);

      const globalRef = UserPresenceSessions;
      exists(globalRef);
      assert.equal(instanceRef, globalRef);
    });

    it('has ensured indices', async () => {
      await checkIndices(UserPresenceSessions, ['userId']);
    });

  });

  describe('UserPresenceServers', () => {

    it('is globally accessible on the server', () => {
      const instanceRef = Mongo.Collection.get('userpresenceservers');
      exists(instanceRef);

      const globalRef = UserPresenceServers;
      exists(globalRef);

      assert.equal(instanceRef, globalRef);
    });

    it('has ensured indices', async () => {
      await checkIndices(UserPresenceServers, ['ping', 'serverId']);
    });
  });

  describe('Meteor.Users', () => {

    it('has ensured indices', async () => {
      await checkIndices(Meteor.users, ['presence.serverId'])
    });
  });

  describe('UserpresenceHelpers', function () {

    let userId;
    let username;
    let password;

    beforeEach(() => {
      // no user mock required on a package test...
      // collection is cleared after test anyway...
      username = Random.id();
      password = Random.id();
    });

    this.timeout(15000);

    it('trackUserStatus', async () => {
      userId = await Accounts.createUserAsync({ username, password });
      try {
        await isOnline(userId, false);
        assert.fail('expected error not thrown');
      } catch {
      }

      await UserPresenceHelpers.trackUserStatus(userId, testsConnection);
      await isOnline(userId, false);
    });

    it('userConnected', async () => {
      userId = await Accounts.createUserAsync({ username, password });
      await connect(userId, testsConnection);
      await isOnline(userId, true);
    });

    it('userDisconnected', async () => {
      userId = await Accounts.createUserAsync({ username, password });
      await connect(userId, testsConnection);
      await isOnline(userId, true);
      await disconnect(userId, testsConnection);
      await isOnline(userId, false);
    });

    it('trackServerInterval', () => {
      // get default values
      const currentInterval = UserPresenceHelpers.trackServerInterval();
      exists(currentInterval.id);
      assert.equal(currentInterval.value, 30);

      // change values
      UserPresenceHelpers.setTrackServerInterval(1);
      const newInterval = UserPresenceHelpers.trackServerInterval();
      exists(newInterval.id);
      assert.notEqual(newInterval.id, currentInterval.id);
      assert.notEqual(newInterval.value, currentInterval.value);

      assert.throws(() => {
        UserPresenceHelpers.setTrackServerInterval(0);
      });

      assert.throws(() => {
        UserPresenceHelpers.setTrackServerInterval(-1);
      });

      assert.throws(() => {
        UserPresenceHelpers.setTrackServerInterval();
      })
    });

    it('updateStatusInterval', () => {
      // get default values
      const currentInterval = UserPresenceHelpers.updateStatusInterval();
      exists(currentInterval.id);
      assert.equal(currentInterval.value, 10);

      // change values
      UserPresenceHelpers.setUpdateStatusInterval(1);
      const newInterval = UserPresenceHelpers.updateStatusInterval();
      exists(newInterval.id);
      assert.notEqual(newInterval.id, currentInterval.id);
      assert.notEqual(newInterval.value, currentInterval.value);

      assert.throws(() => {
        UserPresenceHelpers.setUpdateStatusInterval(0);
      });

      assert.throws(() => {
        UserPresenceHelpers.setUpdateStatusInterval(-1);
      });

      assert.throws(() => {
        UserPresenceHelpers.setUpdateStatusInterval();
      })
    });
  });

  describe('Core Functionality', function () {

    let userId;
    let userName;
    let password;

    beforeEach(() => {
      // no user mock required on a package test...
      // collection is cleared after test anyway...
      userName = Random.id();
      password = Random.id();
    });

    this.timeout(20000);

    it('keeps track of which servers are online', async () => {
      const initialServers = await UserPresenceServers.countDocuments({});
      await UserPresenceHelpers.trackServer(Random.id());
      assert.isAbove(await UserPresenceServers.countDocuments({}), initialServers);
    });

    it('removes old servers and sessions', async () => {
      const initialServers = await UserPresenceServers.countDocuments({});
      await UserPresenceHelpers.trackServer(Random.id());
      const afterAddServers = await UserPresenceServers.countDocuments({});
      assert.isAbove(afterAddServers, initialServers);
      await UserPresenceHelpers.updateStatus(0);
      assert.isBelow(await UserPresenceServers.countDocuments({}), afterAddServers);
    });

    it('stores connection info in the presence object', async () => {
      userId = Accounts.createUser({ username: userName, password: password });
      await connect(userId, testsConnection);

      const user = await Meteor.users.findOneAsync(userId);

      assert.equal(user.presence.clientAddress, testsConnection.clientAddress);
      assert.deepEqual(user.presence.httpHeaders, testsConnection.httpHeaders);
    })
  });
});

