import SwiftUI

@main
@MainActor
struct TodayOkWatchApp: App {
  @Environment(\.scenePhase) private var scenePhase
  @StateObject private var viewModel = WatchHomeViewModel()
  @StateObject private var notificationCoordinator = WatchNotificationCoordinator.shared

  init() {
    // Register the delegate before the first scene appears so a cold-launch
    // notification tap cannot be missed.
    WatchNotificationCoordinator.shared.start()
  }

  var body: some Scene {
    WindowGroup {
      WatchHomeView(viewModel: viewModel)
        .onChange(of: scenePhase) { phase in
          if phase == .active {
            Task { await viewModel.refresh() }
          }
        }
        .onReceive(notificationCoordinator.$openedState.compactMap { $0 }) { _ in
          // Notification taps always enter the single-purpose check-in page.
          // A refresh makes the server's waiting/grace/alert state authoritative.
          Task { await viewModel.refresh() }
        }
    }
  }
}
