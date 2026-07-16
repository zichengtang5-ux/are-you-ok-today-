import Foundation

final class TodayOkWatchAPI {
  private let credentialStore: WatchCredentialStore
  private let session: URLSession

  init(
    credentialStore: WatchCredentialStore = .shared,
    session: URLSession = .shared
  ) {
    self.credentialStore = credentialStore
    self.session = session
  }

  func getStatus() async throws -> WatchReplyStatus {
    try await authorizedRequest(path: "/reply/status", method: "GET", body: nil)
  }

  func replyToday() async throws -> WatchReplyResult {
    let body = try JSONSerialization.data(withJSONObject: ["replyMethod": "apple_watch"])
    return try await authorizedRequest(path: "/reply/today", method: "POST", body: body)
  }

  func resumeGuard() async throws -> WatchResumeResult {
    try await authorizedRequest(path: "/pause/resume", method: "POST", body: nil)
  }

  private func authorizedRequest<Response: Decodable>(
    path: String,
    method: String,
    body: Data?,
    mayRefresh: Bool = true
  ) async throws -> Response {
    guard let context = credentialStore.load(), context.isOnboarded else {
      throw WatchAPIError.notConfigured
    }
    guard let url = URL(string: context.apiBaseURL + path) else {
      throw WatchAPIError.invalidURL
    }

    var request = URLRequest(url: url)
    request.httpMethod = method
    request.httpBody = body
    request.timeoutInterval = 12
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(context.accessToken)", forHTTPHeaderField: "Authorization")

    let (data, response) = try await session.data(for: request)
    guard let http = response as? HTTPURLResponse else {
      throw WatchAPIError.invalidResponse
    }

    if http.statusCode == 401, mayRefresh {
      try await refresh(using: context)
      return try await authorizedRequest(path: path, method: method, body: body, mayRefresh: false)
    }
    guard (200..<300).contains(http.statusCode) else {
      let message = (try? JSONDecoder().decode(WatchServerError.self, from: data).message)
        ?? "操作失败，请稍后重试"
      if http.statusCode == 401 {
        throw WatchAPIError.unauthorized
      }
      throw WatchAPIError.server(status: http.statusCode, message: message)
    }

    guard let decoded = try? JSONDecoder().decode(Response.self, from: data) else {
      throw WatchAPIError.invalidResponse
    }
    return decoded
  }

  private func refresh(using context: WatchPhoneContext) async throws {
    guard let url = URL(string: context.apiBaseURL + "/auth/refresh") else {
      throw WatchAPIError.invalidURL
    }
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.timeoutInterval = 12
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONSerialization.data(
      withJSONObject: ["refreshToken": context.refreshToken]
    )

    let (data, response) = try await session.data(for: request)
    guard let http = response as? HTTPURLResponse,
          (200..<300).contains(http.statusCode),
          let tokens = try? JSONDecoder().decode(WatchRefreshResult.self, from: data) else {
      throw WatchAPIError.unauthorized
    }
    credentialStore.updateTokens(
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    )
  }
}
