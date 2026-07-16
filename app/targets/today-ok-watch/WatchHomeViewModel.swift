import Foundation
import WatchKit

@MainActor
final class WatchHomeViewModel: ObservableObject {
  @Published private(set) var status: WatchReplyStatus?
  @Published private(set) var isConfigured = false
  @Published private(set) var isLoading = false
  @Published private(set) var isCheckingIn = false
  @Published private(set) var isResumingGuard = false
  @Published var errorMessage: String?

  private let api: TodayOkWatchAPI
  private let credentialStore: WatchCredentialStore
  private let statusCache: WatchStatusCache
  private let phoneLink: WatchPhoneLink
  private let demoState: GuardState?
  private var hasStarted = false

  init(
    api: TodayOkWatchAPI = TodayOkWatchAPI(),
    credentialStore: WatchCredentialStore = .shared,
    statusCache: WatchStatusCache = .shared,
    phoneLink: WatchPhoneLink = .shared
  ) {
    self.api = api
    self.credentialStore = credentialStore
    self.statusCache = statusCache
    self.phoneLink = phoneLink
    self.demoState = Self.readDemoState()

    if let demoState {
      status = WatchReplyStatus.demo(demoState)
      isConfigured = true
    } else {
      let context = credentialStore.load()
      status = statusCache.load()
      isConfigured = context?.isOnboarded == true
    }

    phoneLink.onConfigurationChange = { [weak self] context in
      Task { @MainActor in
        guard let self, self.demoState == nil else { return }
        self.isConfigured = context?.isOnboarded == true
        if context == nil {
          self.status = nil
          self.errorMessage = nil
        } else {
          await self.refresh()
        }
      }
    }
    phoneLink.start()
  }

  func refresh() async {
    if demoState != nil || isLoading || isCheckingIn || isResumingGuard { return }
    guard credentialStore.load()?.isOnboarded == true else {
      isConfigured = false
      phoneLink.requestConfiguration()
      return
    }

    isConfigured = true
    isLoading = status == nil
    defer { isLoading = false }
    if isOfflineDevelopmentSession {
      let latest = status ?? WatchReplyStatus.demo(.idle)
      status = latest
      statusCache.save(latest)
      errorMessage = nil
      return
    }
    do {
      let latest = try await api.getStatus()
      status = latest
      statusCache.save(latest)
      if latest.status == .replied {
        WatchNotificationCoordinator.shared.clearGuardNotifications()
      }
      errorMessage = nil
    } catch {
      errorMessage = userMessage(for: error)
    }
  }

  func checkIn() async {
    guard !isCheckingIn, !isResumingGuard else { return }
    isCheckingIn = true
    errorMessage = nil
    defer { isCheckingIn = false }

    if demoState != nil {
      try? await Task.sleep(nanoseconds: 450_000_000)
      status = WatchReplyStatus.demo(.replied)
      WatchNotificationCoordinator.shared.clearGuardNotifications()
      WKInterfaceDevice.current().play(.success)
      return
    }

    if isOfflineDevelopmentSession {
      try? await Task.sleep(nanoseconds: 250_000_000)
      let latest = WatchReplyStatus.demo(.replied)
      status = latest
      statusCache.save(latest)
      WatchNotificationCoordinator.shared.clearGuardNotifications()
      WKInterfaceDevice.current().play(.success)
      return
    }

    do {
      _ = try await api.replyToday()
      let latest = try await api.getStatus()
      status = latest
      statusCache.save(latest)
      WatchNotificationCoordinator.shared.clearGuardNotifications()
      WKInterfaceDevice.current().play(.success)
    } catch {
      errorMessage = userMessage(for: error)
      WKInterfaceDevice.current().play(.failure)
      if case WatchAPIError.server(status: 409, _) = error {
        await refresh()
      }
    }
  }

  func resumeGuard() async {
    guard !isResumingGuard, !isCheckingIn else { return }
    isResumingGuard = true
    errorMessage = nil
    defer { isResumingGuard = false }

    if demoState != nil {
      try? await Task.sleep(nanoseconds: 450_000_000)
      status = status?.updating(status: .idle) ?? WatchReplyStatus.demo(.idle)
      WatchNotificationCoordinator.shared.clearGuardNotifications()
      WKInterfaceDevice.current().play(.success)
      return
    }

    if isOfflineDevelopmentSession {
      try? await Task.sleep(nanoseconds: 250_000_000)
      let latest = WatchReplyStatus.demo(.idle)
      status = latest
      statusCache.save(latest)
      WatchNotificationCoordinator.shared.clearGuardNotifications()
      WKInterfaceDevice.current().play(.success)
      return
    }

    do {
      let result = try await api.resumeGuard()

      if let current = status {
        let resumed = current.updating(status: result.guardStatus)
        status = resumed
        statusCache.save(resumed)
      }

      do {
        let latest = try await api.getStatus()
        status = latest
        statusCache.save(latest)
        WatchNotificationCoordinator.shared.clearGuardNotifications()
      } catch {
        errorMessage = "守护已恢复，最新状态稍后同步"
      }

      WKInterfaceDevice.current().play(.success)
    } catch {
      if case WatchAPIError.server(status: 400, _) = error {
        if let latest = try? await api.getStatus(), latest.status != .paused {
          status = latest
          statusCache.save(latest)
          errorMessage = nil
          WKInterfaceDevice.current().play(.success)
          return
        }
      }
      errorMessage = userMessage(for: error)
      WKInterfaceDevice.current().play(.failure)
    }
  }

  private func userMessage(for error: Error) -> String {
    if let localized = (error as? LocalizedError)?.errorDescription {
      return localized
    }
    let nsError = error as NSError
    if nsError.domain == NSURLErrorDomain {
      return "网络不可用，稍后重试"
    }
    return "操作失败，请稍后重试"
  }

  private var isOfflineDevelopmentSession: Bool {
    credentialStore.load()?.accessToken == "dev-access-token"
  }

  private static func readDemoState() -> GuardState? {
    let arguments = ProcessInfo.processInfo.arguments
    if let index = arguments.firstIndex(of: "-watchDemoStatus"),
       arguments.indices.contains(index + 1) {
      return GuardState(rawValue: arguments[index + 1])
    }
    if let argument = arguments.first(where: { $0.hasPrefix("--watch-demo-status=") }) {
      return GuardState(rawValue: String(argument.split(separator: "=").last ?? ""))
    }
    return nil
  }
}
