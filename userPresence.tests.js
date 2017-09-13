/* eslint-env mocha */
import {Meteor} from 'meteor/meteor';
import {Random} from 'meteor/random';
import {chai, assert} from 'meteor/practicalmeteor:chai';
import {PublicationCollector} from 'meteor/johanbrook:publication-collector';


describe('User Presence', function () {


	const exists = function (value) {
		assert.isDefined(value);
		assert.isNotNull(value);
	};

	const isOnline = function (userId, expect) {
		const user = Meteor.users.findOne(userId);
		exists(user);
		const presence = user.presence;
		exists(presence);

		if (expect)
			assert.equal(presence.status, "online");
		else
			assert.equal(presence.status, "offline");
	};

	const connect = function (userId, connection) {
		UserPresenceHelpers.userConnected(userId, connection);
		UserPresenceHelpers.trackUserStatus(userId, connection);
	};

	const disconnect = function (userId, connection) {
		UserPresenceHelpers.userDisconnected(userId, connection);
		UserPresenceHelpers.trackUserStatus(userId, connection);
	};

	const checkIndices = function (collection, indices, done) {
		collection.rawCollection().indexes(function (err, res) {

			if (err) done(err);

			const mapped = res.map(function (el) {
				const keyProps = Object.keys(el.key);
				return keyProps[0];
			});

			for (let index of indices) {
				if (mapped.indexOf(index) === -1)
					done(new Error("Index not present: " + index));
			}

			done();
		});
	};


	let testsConnection;

	Meteor.onConnection(function (connection) {
		testsConnection = connection;
	});

	describe("UserPresenceSessions", function () {

		it("is globally accessible on the server", function () {

			const instanceRef = Mongo.Collection.get('userpresencesessions');
			exists(instanceRef);

			const globalRef = UserPresenceSessions;
			exists(globalRef);

			assert.equal(instanceRef, globalRef);
		});

		it("has ensured indices", function (done) {
			checkIndices(UserPresenceSessions, ["userId"], done);
		});

	});

	describe("UserPresenceServers", function () {

		it("is globally accessible on the server", function () {
			const instanceRef = Mongo.Collection.get('userpresenceservers');
			exists(instanceRef);

			const globalRef = UserPresenceServers;
			exists(globalRef);

			assert.equal(instanceRef, globalRef);
		});

		it("has ensured indices", function (done) {
			checkIndices(UserPresenceServers, ["ping", "serverId"], done);
		});
	});

	describe("Meteor.Users", function () {

		it("has ensured indices", function (done) {
			checkIndices(Meteor.users, ['presence.serverId'], done)
		});
	});

	describe("UserpresenceHelpers", function () {

		let userId;
		let userName;
		let password;

		beforeEach(function () {
			// no user mock required on a package test...
			// collection is cleared after test anyway...
			userName = Random.id();
			password = Random.id();
		});

		this.timeout(15000);

		it("trackUserStatus", function (done) {
			userId = Accounts.createUser({username: userName, password: password});

			assert.throws(function () {
				isOnline(userId, false);
			});

			UserPresenceHelpers.trackUserStatus(userId, testsConnection);
			isOnline(userId, false);

			done();
		});

		it("userConnected", function (done) {

			userId = Accounts.createUser({username: userName, password: password});
			connect(userId, testsConnection);
			isOnline(userId, true);
			done();
		});

		it("userDisconnected", function (done) {
			userId = Accounts.createUser({username: userName, password: password});
			connect(userId, testsConnection);
			isOnline(userId, true);
			disconnect(userId, testsConnection);
			isOnline(userId, false);
			done();
		});
	});

	describe("Core Functionality", function () {


		let userId;
		let userName;
		let password;

		beforeEach(function () {
			// no user mock required on a package test...
			// collection is cleared after test anyway...
			userName = Random.id();
			password = Random.id();
		});

		this.timeout(20000);

		it("keeps track of which servers are online", function (done) {
			const initialServers = UserPresenceServers.find().count();
			UserPresenceHelpers.trackServer(Random.id());
			assert.isAbove(UserPresenceServers.find().count(), initialServers);
			done();
		});


		it("removes old servers and sessions", function (done) {
			const initialServers = UserPresenceServers.find().count();
			UserPresenceHelpers.trackServer(Random.id());
			const afterAddServers = UserPresenceServers.find().count();
			assert.isAbove(afterAddServers, initialServers);
			UserPresenceHelpers.updateStatus(0);
			assert.isBelow(UserPresenceServers.find().count(), afterAddServers);
			done();
		});

		it("stores connection info in the presence object", function (done) {
			userId = Accounts.createUser({username: userName, password: password});
			connect(userId, testsConnection);

			const user = Meteor.users.findOne(userId);

			assert.equal(user.presence.clientAddress, testsConnection.clientAddress);
			assert.deepEqual(user.presence.httpHeaders, testsConnection.httpHeaders);
			done();
		})

	});

});

