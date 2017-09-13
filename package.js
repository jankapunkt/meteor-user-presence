Package.describe({
  name: 'danimal:userpresence',
  version: '1.0.2',
  summary: 'Track user online status across multiple servers.',
  git: 'https://github.com/dan335/meteor-user-presence',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.2');
  api.use([
    'ecmascript',
    'mongo',
    'random'
  ]);
  api.addFiles('userPresence.js', 'server');
  api.export([
    'UserPresenceSessions',
    'UserPresenceServers',
    'UserPresenceHelpers',
  ], 'server');
});

Package.onTest(function (api) {

  api.use([
    'meteor',
    'ecmascript',
    'mongo',
    'random',
	'accounts-base',
	'accounts-password',
    'johanbrook:publication-collector',
    'dburles:mongo-collection-instances',
    'practicalmeteor:chai',
    'danimal:userpresence',
  ]);
  api.mainModule('userPresence.tests.js', 'server');
});