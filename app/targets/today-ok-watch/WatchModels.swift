import Foundation

enum GuardState: String, Codable {
  case idle
  case waiting
  case replied
  case grace
  case alert
  case paused
}

struct WatchPhoneContext: Codable {
  let schemaVersion: Int
  let apiBaseURL: String
  var accessToken: String
  var refreshToken: String
  let isOnboarded: Bool
  let syncedAt: String
}

struct WatchReminderConfig: Codable {
  let startTime: String
  let endTime: String
  let gracePeriodMin: Int
  let timezone: String
}

struct WatchMonthlyStats: Codable {
  let repliedDays: Int
  let totalDays: Int
  let daysInMonth: Int
  let display: String
}

struct WatchReplyStatus: Codable {
  let status: GuardState
  let lastReplyAt: String?
  let todayReplied: Bool
  let todayRepliedAt: String?
  let reminderConfig: WatchReminderConfig
  let graceDeadlineAt: String?
  let monthlyStats: WatchMonthlyStats
}

struct WatchReplyResult: Codable {
  let message: String
  let repliedAt: String
  let guardStatus: GuardState
  let alertResolved: Bool
}

struct WatchRefreshResult: Codable {
  let accessToken: String
  let refreshToken: String
}

struct WatchServerError: Codable {
  let message: String?
}

enum WatchAPIError: LocalizedError {
  case notConfigured
  case invalidURL
  case invalidResponse
  case unauthorized
  case server(status: Int, message: String)

  var errorDescription: String? {
    switch self {
    case .notConfigured:
      return "请先在 iPhone 完成设置"
    case .invalidURL:
      return "iPhone 中的服务器地址无效"
    case .invalidResponse:
      return "暂时无法读取最新状态"
    case .unauthorized:
      return "登录已过期，请打开 iPhone App"
    case let .server(_, message):
      return message
    }
  }
}

extension WatchReplyStatus {
  static func demo(_ state: GuardState) -> WatchReplyStatus {
    let now = Date()
    let deadline = ISO8601DateFormatter().string(from: now.addingTimeInterval(12 * 60))
    return WatchReplyStatus(
      status: state,
      lastReplyAt: state == .alert
        ? ISO8601DateFormatter().string(from: now.addingTimeInterval(-24 * 60 * 60))
        : nil,
      todayReplied: state == .replied,
      todayRepliedAt: state == .replied ? ISO8601DateFormatter().string(from: now) : nil,
      reminderConfig: WatchReminderConfig(
        startTime: "20:00",
        endTime: "22:00",
        gracePeriodMin: 30,
        timezone: "Asia/Shanghai"
      ),
      graceDeadlineAt: state == .grace ? deadline : nil,
      monthlyStats: WatchMonthlyStats(
        repliedDays: state == .replied ? 12 : 11,
        totalDays: 31,
        daysInMonth: 31,
        display: state == .replied ? "本月平安 12/31 天" : "本月平安 11/31 天"
      )
    )
  }
}
