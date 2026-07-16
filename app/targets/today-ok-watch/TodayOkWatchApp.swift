import SwiftUI

@main
struct TodayOkWatchApp: App {
  @Environment(\.scenePhase) private var scenePhase
  @StateObject private var viewModel = WatchHomeViewModel()

  var body: some Scene {
    WindowGroup {
      WatchHomeView(viewModel: viewModel)
        .onChange(of: scenePhase) { phase in
          if phase == .active {
            Task { await viewModel.refresh() }
          }
        }
    }
  }
}
