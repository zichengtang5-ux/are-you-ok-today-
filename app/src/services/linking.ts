import { Alert, Linking } from 'react-native';
import { reportError } from './errorReporter';

export async function openExternalUrl(url: string, fallbackMessage = '当前设备无法打开该链接') {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('无法打开', fallbackMessage);
      return false;
    }
    await Linking.openURL(url);
    return true;
  } catch (error) {
    reportError(error, { scope: 'openExternalUrl', url });
    Alert.alert('无法打开', fallbackMessage);
    return false;
  }
}
