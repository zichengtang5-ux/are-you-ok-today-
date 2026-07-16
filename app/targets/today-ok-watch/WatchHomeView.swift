import SwiftUI

private enum WatchPalette {
  static let green = Color(red: 76 / 255, green: 175 / 255, blue: 80 / 255)
  static let greenSoft = Color(red: 232 / 255, green: 245 / 255, blue: 233 / 255)
  static let orange = Color(red: 245 / 255, green: 166 / 255, blue: 35 / 255)
  static let red = Color(red: 229 / 255, green: 72 / 255, blue: 77 / 255)
  static let redSoft = Color(red: 253 / 255, green: 232 / 255, blue: 233 / 255)
}

private enum WatchLayout {
  static let stateLogoSize: CGFloat = 24
  static let mainCircleSize: CGFloat = 88
  static let checkmarkSize: CGFloat = 28
  static let stateTitleSize: CGFloat = 17
}

struct WatchHomeView: View {
  @ObservedObject var viewModel: WatchHomeViewModel

  var body: some View {
    ScrollView {
      VStack(spacing: 6) {
        if !viewModel.isConfigured {
          setupRequiredView
        } else if viewModel.isLoading, viewModel.status == nil {
          loadingView
        } else if let status = viewModel.status {
          statusView(status)
        } else {
          retryView(message: viewModel.errorMessage ?? "暂时无法读取状态")
        }

        if let error = viewModel.errorMessage, viewModel.status != nil {
          Button {
            Task { await viewModel.refresh() }
          } label: {
            Label(error, systemImage: "arrow.clockwise")
              .font(.caption2)
              .multilineTextAlignment(.center)
          }
          .buttonStyle(.plain)
          .foregroundStyle(.secondary)
          .accessibilityLabel("刷新状态，\(error)")
        }
      }
      .padding(.horizontal, 8)
      .padding(.bottom, 8)
    }
    .refreshable {
      await viewModel.refresh()
    }
    .background(Color.black)
  }

  private var setupRequiredView: some View {
    VStack(spacing: 10) {
      Image(systemName: "iphone.and.arrow.forward")
        .font(.system(size: 34, weight: .semibold))
        .foregroundStyle(WatchPalette.green)
      Text("请先在 iPhone 完成设置")
        .font(.headline)
        .multilineTextAlignment(.center)
      Text("联系人和提醒时间只在 iPhone 管理，完成后会自动同步到手表。")
        .font(.caption2)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
      Button("重新连接") {
        Task { await viewModel.refresh() }
      }
      .buttonStyle(.bordered)
      .tint(WatchPalette.green)
    }
    .padding(.top, 15)
  }

  private var loadingView: some View {
    VStack(spacing: 10) {
      ProgressView()
        .tint(WatchPalette.green)
      Text("正在同步今日状态")
        .font(.caption)
        .foregroundStyle(.secondary)
    }
    .padding(.top, 28)
  }

  @ViewBuilder
  private func statusView(_ value: WatchReplyStatus) -> some View {
    switch value.status {
    case .idle:
      stateTitle("今天还不用签到", symbol: "moon.stars.fill", color: .secondary)
      disabledTimeCircle(time: value.reminderConfig.startTime)
    case .waiting:
      stateTitle("该报平安了", symbol: "hand.wave.fill", color: WatchPalette.green, assetName: "mascot")
      checkInButton(label: "今天还好", color: WatchPalette.green)
    case .replied:
      stateTitle("今天已报平安", symbol: "checkmark.circle.fill", color: WatchPalette.green, assetName: "mascot")
      successCircle
      Text("下次提醒 \(value.reminderConfig.startTime)")
        .font(.caption)
        .foregroundStyle(.secondary)
    case .grace:
      stateTitle("还没收到你的回复", symbol: "clock.badge.exclamationmark.fill", color: WatchPalette.orange)
      if let deadline = parseDate(value.graceDeadlineAt) {
        TimelineView(.periodic(from: .now, by: 1)) { context in
          Text(countdown(to: deadline, from: context.date))
            .font(.system(.title2, design: .rounded, weight: .bold))
            .monospacedDigit()
            .foregroundStyle(WatchPalette.orange)
            .accessibilityLabel("距离联系紧急联系人还有 \(countdown(to: deadline, from: context.date))")
        }
      }
      Text("超时后自动联系紧急联系人")
        .font(.caption2)
        .foregroundStyle(WatchPalette.orange)
        .multilineTextAlignment(.center)
        .padding(.horizontal, 4)
      checkInButton(label: "报平安", color: WatchPalette.orange, compact: true)
    case .alert:
      stateTitle("已自动联系紧急联系人", symbol: "person.2.badge.gearshape.fill", color: WatchPalette.red, assetName: "doubleBar")
      Text("联系人正在确认你的安全")
        .font(.caption)
        .foregroundStyle(WatchPalette.red)
        .multilineTextAlignment(.center)
        .padding(.vertical, 5)
        .padding(.horizontal, 8)
        .background(WatchPalette.redSoft.opacity(0.25), in: Capsule())
      checkInButton(label: "我没事", color: WatchPalette.red, compact: true)
    case .paused:
      stateTitle("守护已暂停", symbol: "pause.circle.fill", color: .secondary)
      Image(systemName: "iphone")
        .font(.system(size: 38))
        .foregroundStyle(.secondary)
      Text("请在 iPhone App 的设置中恢复守护")
        .font(.caption)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
        .padding(.horizontal, 8)
    }
  }

  private func stateTitle(
    _ title: String,
    symbol: String,
    color: Color,
    assetName: String? = nil
  ) -> some View {
    VStack(spacing: 3) {
      if let assetName {
        Image(assetName)
          .resizable()
          .scaledToFill()
          .frame(width: WatchLayout.stateLogoSize, height: WatchLayout.stateLogoSize)
          .clipShape(Circle())
      } else {
        Image(systemName: symbol)
          .font(.system(size: 20, weight: .semibold))
          .foregroundStyle(color)
      }
      Text(title)
        .font(.system(size: WatchLayout.stateTitleSize, weight: .bold, design: .rounded))
        .lineLimit(1)
        .multilineTextAlignment(.center)
    }
    .padding(.top, 1)
  }

  private func checkInButton(label: String, color: Color, compact: Bool = false) -> some View {
    Button {
      Task { await viewModel.checkIn() }
    } label: {
      ZStack {
        Circle()
          .fill(color.gradient)
          .shadow(color: color.opacity(0.35), radius: 7, y: 3)
        if viewModel.isCheckingIn {
          ProgressView()
            .tint(.white)
        } else {
          VStack(spacing: 2) {
            Image(systemName: "checkmark")
              .font(.system(size: WatchLayout.checkmarkSize, weight: .bold))
            Text(label)
              .font(compact ? .caption : .body)
              .fontWeight(.bold)
          }
          .foregroundStyle(.white)
        }
      }
      .frame(
        width: compact ? 68 : WatchLayout.mainCircleSize,
        height: compact ? 68 : WatchLayout.mainCircleSize
      )
    }
    .buttonStyle(.plain)
    .disabled(viewModel.isCheckingIn)
    .accessibilityLabel(label)
    .accessibilityHint("完成今天的报平安签到")
  }

  private var successCircle: some View {
    ZStack {
      Circle()
        .fill(WatchPalette.greenSoft.opacity(0.25))
      Image(systemName: "checkmark")
        .font(.system(size: WatchLayout.checkmarkSize, weight: .bold))
        .foregroundStyle(WatchPalette.green)
    }
    .frame(width: WatchLayout.mainCircleSize, height: WatchLayout.mainCircleSize)
    .accessibilityLabel("今日签到成功")
  }

  private func disabledTimeCircle(time: String) -> some View {
    ZStack {
      Circle().fill(Color.secondary.opacity(0.16))
      VStack(spacing: 1) {
        Text("下次提醒")
          .font(.caption2)
        Text(time)
          .font(.title3.bold())
          .monospacedDigit()
      }
      .foregroundStyle(.secondary)
    }
    .frame(width: 78, height: 78)
  }

  private func retryView(message: String) -> some View {
    VStack(spacing: 10) {
      Image(systemName: "wifi.exclamationmark")
        .font(.title2)
        .foregroundStyle(.secondary)
      Text(message)
        .font(.caption)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
      Button("重试") {
        Task { await viewModel.refresh() }
      }
      .buttonStyle(.bordered)
      .tint(WatchPalette.green)
    }
    .padding(.top, 18)
  }

  private func parseDate(_ value: String?) -> Date? {
    guard let value else { return nil }
    return ISO8601DateFormatter().date(from: value)
  }

  private func countdown(to deadline: Date, from now: Date) -> String {
    let remaining = max(0, Int(deadline.timeIntervalSince(now)))
    return String(format: "%02d:%02d", remaining / 60, remaining % 60)
  }
}
