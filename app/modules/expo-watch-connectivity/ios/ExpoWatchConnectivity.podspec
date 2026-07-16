Pod::Spec.new do |s|
  s.name           = 'ExpoWatchConnectivity'
  s.version        = '1.0.0'
  s.summary        = 'Securely syncs Today OK credentials to the paired Apple Watch.'
  s.description    = 'An Expo module that owns the iOS side of the WatchConnectivity session.'
  s.author         = 'Today OK'
  s.homepage       = 'https://github.com/zichengtang5-ux/are-you-ok-today-'
  s.platform       = :ios, '16.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WatchConnectivity', 'Security'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
