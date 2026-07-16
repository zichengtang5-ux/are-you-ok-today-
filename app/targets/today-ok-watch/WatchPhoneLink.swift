import Foundation
import WatchConnectivity

final class WatchPhoneLink: NSObject, WCSessionDelegate {
  static let shared = WatchPhoneLink()

  var onConfigurationChange: ((WatchPhoneContext?) -> Void)?

  private override init() {
    super.init()
  }

  func start() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
    handle(session.applicationContext)
  }

  func requestConfiguration() {
    guard WCSession.isSupported(), WCSession.default.isReachable else { return }
    WCSession.default.sendMessage(
      ["request": "configuration"],
      replyHandler: { [weak self] response in self?.handle(response) },
      errorHandler: nil
    )
  }

  private func handle(_ context: [String: Any]) {
    if context["cleared"] as? Bool == true {
      WatchCredentialStore.shared.clear()
      WatchStatusCache.shared.clear()
      DispatchQueue.main.async { [weak self] in
        self?.onConfigurationChange?(nil)
      }
      return
    }

    guard let payload = context["payload"] as? String,
          let data = payload.data(using: .utf8),
          let phoneContext = try? JSONDecoder().decode(WatchPhoneContext.self, from: data),
          phoneContext.schemaVersion == 1,
          WatchCredentialStore.shared.save(phoneContext) else {
      return
    }

    DispatchQueue.main.async { [weak self] in
      self?.onConfigurationChange?(phoneContext)
    }
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    guard activationState == .activated, error == nil else { return }
    handle(session.applicationContext)
    requestConfiguration()
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    handle(applicationContext)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    handle(message)
  }
}
