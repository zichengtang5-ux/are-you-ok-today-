import Combine
import Foundation
import UserNotifications

/// Owns the Watch notification categories and the safe, simulator-friendly demo flow.
/// Production delivery can reuse `schedule(_:at:)` once the server or paired iPhone
/// provides an authoritative fire date. We deliberately do not infer emergency
/// notifications locally from a cached status because that could create a false alarm.
@MainActor
final class WatchNotificationCoordinator: NSObject, ObservableObject {
  static let shared = WatchNotificationCoordinator()

  @Published private(set) var openedState: GuardState?

  private enum Identifier {
    static let checkInAction = "TODAY_OK_OPEN_CHECK_IN"
    static let demoPrefix = "today-ok.watch.demo"

    static func category(for state: GuardState) -> String {
      switch state {
      case .waiting:
        return "daily_reminder"
      case .grace:
        return "safety_grace"
      case .alert:
        return "safety_alert"
      default:
        return "daily_reminder"
      }
    }

    static func request(for state: GuardState) -> String {
      "\(demoPrefix).\(state.rawValue)"
    }
  }

  private let center: UNUserNotificationCenter
  private var hasStarted = false

  init(center: UNUserNotificationCenter = .current()) {
    self.center = center
    super.init()
  }

  func start() {
    guard !hasStarted else { return }
    hasStarted = true
    center.delegate = self
    registerCategories()

    guard let demo = Self.demoRequestFromLaunchArguments() else { return }
    Task {
      do {
        let granted = try await requestAuthorization()
        guard granted else { return }
        try await schedule(demo.state, after: demo.delay)
      } catch {
        // The main app remains usable if notification permission or scheduling fails.
      }
    }
  }

  /// Schedules a notification from a verified server/iPhone date.
  func schedule(_ state: GuardState, at date: Date) async throws {
    let interval = max(1, date.timeIntervalSinceNow)
    try await schedule(state, after: interval)
  }

  func schedule(_ state: GuardState, after delay: TimeInterval) async throws {
    guard Self.notificationStates.contains(state) else { return }

    let content = Self.content(for: state)
    let request = UNNotificationRequest(
      identifier: Identifier.request(for: state),
      content: content,
      trigger: UNTimeIntervalNotificationTrigger(timeInterval: max(1, delay), repeats: false)
    )

    center.removePendingNotificationRequests(withIdentifiers: [request.identifier])
    try await add(request)
  }

  func clearGuardNotifications() {
    let identifiers = Self.notificationStates.map(Identifier.request(for:))
    center.removePendingNotificationRequests(withIdentifiers: identifiers)
    center.getDeliveredNotifications { [center] notifications in
      let delivered = notifications.compactMap { notification -> String? in
        let state = notification.request.content.userInfo["guardState"] as? String
        let isGuardState = state.flatMap(GuardState.init(rawValue:)).map {
          Self.notificationStates.contains($0)
        } ?? false
        let isGuardCategory = Self.notificationStates
          .map(Identifier.category(for:))
          .contains(notification.request.content.categoryIdentifier)
        return isGuardState || isGuardCategory ? notification.request.identifier : nil
      }
      center.removeDeliveredNotifications(withIdentifiers: delivered)
    }
  }

  private func registerCategories() {
    let open = UNNotificationAction(
      identifier: Identifier.checkInAction,
      title: "打开报平安",
      options: [.foreground]
    )

    let categories = Set(Self.notificationStates.map { state in
      UNNotificationCategory(
        identifier: Identifier.category(for: state),
        actions: [open],
        intentIdentifiers: [],
        options: [.customDismissAction]
      )
    })
    center.setNotificationCategories(categories)
  }

  private func requestAuthorization() async throws -> Bool {
    try await withCheckedThrowingContinuation { continuation in
      center.requestAuthorization(options: [.alert, .sound]) { granted, error in
        if let error {
          continuation.resume(throwing: error)
        } else {
          continuation.resume(returning: granted)
        }
      }
    }
  }

  private func add(_ request: UNNotificationRequest) async throws {
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      center.add(request) { error in
        if let error {
          continuation.resume(throwing: error)
        } else {
          continuation.resume(returning: ())
        }
      }
    }
  }

  private static let notificationStates: [GuardState] = [.waiting, .grace, .alert]

  private static func content(for state: GuardState) -> UNMutableNotificationContent {
    let content = UNMutableNotificationContent()
    content.sound = .default
    content.categoryIdentifier = Identifier.category(for: state)
    content.threadIdentifier = "today-ok-daily-safety"
    content.userInfo = ["guardState": state.rawValue]

    switch state {
    case .waiting:
      content.title = "该报平安了"
      content.body = "今天还好？点击进入手表报平安。"
      content.interruptionLevel = .active
    case .grace:
      content.title = "还没收到你的回复"
      content.body = "超时后将自动联系紧急联系人，点击立即报平安。"
      content.interruptionLevel = .timeSensitive
    case .alert:
      content.title = "已自动联系紧急联系人"
      content.body = "联系人正在确认你的安全，点击告诉他们你没事。"
      content.interruptionLevel = .timeSensitive
    default:
      break
    }
    return content
  }

  private static func demoRequestFromLaunchArguments() -> (state: GuardState, delay: TimeInterval)? {
    let arguments = ProcessInfo.processInfo.arguments
    let stateValue = value(after: "-watchDemoNotification", in: arguments)
      ?? value(forPrefix: "--watch-demo-notification=", in: arguments)
    guard let stateValue,
          let state = GuardState(rawValue: stateValue),
          notificationStates.contains(state) else {
      return nil
    }

    let delayValue = value(after: "-watchDemoNotificationDelay", in: arguments)
      ?? value(forPrefix: "--watch-demo-notification-delay=", in: arguments)
    return (state, max(1, TimeInterval(delayValue ?? "6") ?? 6))
  }

  private static func value(after flag: String, in arguments: [String]) -> String? {
    guard let index = arguments.firstIndex(of: flag), arguments.indices.contains(index + 1) else {
      return nil
    }
    return arguments[index + 1]
  }

  private static func value(forPrefix prefix: String, in arguments: [String]) -> String? {
    arguments.first(where: { $0.hasPrefix(prefix) }).map { String($0.dropFirst(prefix.count)) }
  }
}

extension WatchNotificationCoordinator: UNUserNotificationCenterDelegate {
  nonisolated func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .sound])
  }

  nonisolated func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let value = response.notification.request.content.userInfo["guardState"] as? String
    Task { @MainActor [weak self] in
      self?.openedState = value.flatMap(GuardState.init(rawValue:))
      completionHandler()
    }
  }
}
