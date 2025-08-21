Package.describe({
  name: 'jkuester:userpresence',
  version: '2.0.0',
  summary: 'Track user online status across multiple servers.',
  git: 'https://github.com/dan335/meteor-user-presence',
  documentation: 'README.md'
});

Package.onUse(function (api) {
  api.versionsFrom(['1.3', '2.3', '3.0.1']);
  api.use([
    'ecmascript',
    'mongo',
    'random'
  ]);

  api.mainModule('userPresence.js', 'server');
});

Package.onTest(function (api) {
  Npm.depends({
    'chai': '5.1.1',
  })
  api.versionsFrom(['1.3', '2.3', '3.0.1']);
  api.use([
    'ecmascript',
    'mongo',
    'random',
    'accounts-base',
    'accounts-password',
    'meteortesting:mocha',
    'communitypackages:publication-collector',
    'dburles:mongo-collection-instances',
    'jkuester:userpresence'
  ]);
  api.mainModule('userPresence.tests.js', 'server');
});