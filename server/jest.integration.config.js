// 集成测试配置：只运行 *.integration.spec.ts，需要真实 Postgres + Redis
// （由 CI 的 service 容器或本地 docker-compose 提供）
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.integration\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  testTimeout: 30000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
