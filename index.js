module.exports = {
  Crawler: require('./src/Crawler'),

  CheerioLoader: require('./src/loaders/CheerioLoader'),

  Blacklist: require('./src/middlewares/Blacklist'),
  HttpLinkExpander: require('./src/middlewares/HttpLinkExpander'),
  OnlyDownloadSpecificTypes: require('./src/middlewares/OnlyDownloadSpecificTypes'),
  RobotsTxtAdvisor: require('./src/middlewares/RobotsTxtAdvisor'),
  RotateUserAgent: require('./src/middlewares/RotateUserAgent'),
  ThrottleRequests: require('./src/middlewares/ThrottleRequests'),

  JSONReporter: require('./src/reporters/JSONReporter'),
  JSONStreamReporter: require('./src/reporters/JSONStreamReporter'),
  HttpPostReporter: require('./src/reporters/HttpPostReporter'),
  ZeroMqReporter: require('./src/reporters/ZeroMqReporter'),

  checkContentType: require('./src/utils/checkContentType'),
  dataExtractor: require('./src/utils/dataExtractor'),
  linkExtractor: require('./src/utils/linkExtractor'),

  SimpleURLQueue: require('./src/queues/SimpleURLQueue'),
  RedisURLQueue: require('./src/queues/RedisURLQueue'),
  NoQueue: require('./src/queues/NoQueue'),

  Requester: require('./src/requesters/Requester'),
  TestRunRequester: require('./src/requesters/TestRunRequester'),

  URL: require('./src/URL'),
  UninterestingError: require('./src/UninterestingError')

}
