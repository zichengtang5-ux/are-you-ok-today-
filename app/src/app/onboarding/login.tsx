import { useState } from 'react';
import { Alert, View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Button } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { MascotLogo } from '@/components/ui/MascotLogo';
import { useStore } from '@/store/useStore';
import { authApi } from '@/services/api.types';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEV_MOCK_CODE = '123456';
const AGREEMENT_TEXT = '今天还好是一款辅助守护工具，用于记录每日报平安状态，并在用户未按时回应时尝试通知紧急联系人。本产品不替代专业医疗、急救、报警或其他线下救助服务，也不保证所有情况下都能成功通知联系人。使用本服务即表示你理解并接受相关限制。';
const PRIVACY_TEXT = '我们会为守护服务保存手机号、回复时间、紧急联系人、提醒时间、短信或通知记录等必要信息。这些信息仅用于登录、每日提醒、报平安、紧急通知和基础服务维护，不会用于无关用途。';

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState(__DEV__ ? '13800138000' : '');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState(__DEV__ ? `开发环境可直接使用模拟验证码 ${DEV_MOCK_CODE}` : '');

  const setUser = useStore((s) => s.setUser);
  const setOnboardingStep = useStore((s) => s.setOnboardingStep);

  const showAgreement = () => {
    Alert.alert('用户协议', AGREEMENT_TEXT, [{ text: '我知道了' }]);
  };

  const showPrivacy = () => {
    Alert.alert('隐私政策', PRIVACY_TEXT, [{ text: '我知道了' }]);
  };

  const handleSendCode = async () => {
    if (phone.length !== 11 || !/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await authApi.sendCode({ phone });
      setCodeSent(true);
      setCountdown(response.cooldownSeconds);
      if (response.mockCode) setCode(response.mockCode);
      setHint(response.mockCode ? `模拟验证码已填入：${response.mockCode}` : '验证码已发送，请注意查收');
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      if (__DEV__) {
        setCodeSent(true);
        setCountdown(0);
        setCode(DEV_MOCK_CODE);
        setHint(`短信发送失败，已启用模拟验证码 ${DEV_MOCK_CODE}`);
      } else {
        setError(err.response?.data?.message || '验证码发送失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (phone.length !== 11 || !/^1[3-9]\d{9}$/.test(phone)) { setError('请输入正确的手机号'); return; }
    if (!code || code.length < 4) { setError('请输入验证码'); return; }
    if (!agreed) { setError('请先阅读并同意相关条款'); return; }
    setError('');
    setLoading(true);
    try {
      const response = await authApi.verifyCode({ phone, code });
      await AsyncStorage.multiSet([
        ['access_token', response.accessToken],
        ['refresh_token', response.refreshToken],
      ]);
      setUser(response.user);
      if (response.user.isOnboarded) {
        setOnboardingStep('complete');
        router.replace('/(tabs)');
      } else {
        const nextStep = response.user.onboardingStep === 'agreement'
          ? 'basic-info'
          : response.user.onboardingStep;
        setOnboardingStep(nextStep as any);
        router.replace(`/onboarding/${nextStep}` as Href);
      }
    } catch (err: any) {
      if (__DEV__ && code === DEV_MOCK_CODE) {
        const mockUser = {
          id: `dev-${phone}`,
          phone,
          nickname: '',
          createdAt: new Date().toISOString(),
          isPremium: false,
          isOnboarded: false,
          onboardingStep: 'basic-info',
        };
        await AsyncStorage.multiSet([
          ['access_token', 'dev-access-token'],
          ['refresh_token', 'dev-refresh-token'],
        ]);
        setUser(mockUser);
        setOnboardingStep('basic-info');
        router.replace('/onboarding/basic-info');
        return;
      }
      setError(err.response?.data?.message || '登录失败，请检查验证码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="primary" title="今天还好" showMascot />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <MascotLogo size="lg" pulse />
          <Text style={styles.appName}>今天还好</Text>
          <Text style={styles.description}>
            一次点击报平安{'\n'}没回应时，自动通知你的紧急联系人
          </Text>
        </View>

        <View style={styles.formArea}>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>手机号</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(t) => { setPhone(t.replace(/\D/g, '')); setError(''); }}
              placeholder="13800138000"
              keyboardType="phone-pad"
              maxLength={11}
              placeholderTextColor={Colors.gray400}
            />
          </View>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>验证码</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={code}
                onChangeText={(t) => { setCode(t.replace(/\D/g, '')); setError(''); }}
                placeholder="验证码"
                keyboardType="numeric"
                maxLength={6}
                placeholderTextColor={Colors.gray400}
              />
              <TouchableOpacity
                style={[styles.sendBtn, phone.length !== 11 && styles.sendBtnDisabled]}
                onPress={handleSendCode}
                disabled={phone.length !== 11 || countdown > 0 || loading}
              >
                <Text style={styles.sendBtnText}>
                  {countdown > 0 ? `${countdown}s` : '发送'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}

          <View style={styles.checkboxRow}>
            <Pressable
              onPress={() => setAgreed((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              style={[styles.checkbox, agreed && styles.checkboxChecked]}
            >
              {agreed && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
            <Text style={styles.checkboxLabel}>
              我已阅读并同意
              <Text style={styles.policyLink} onPress={showAgreement}>《用户协议》</Text>
              和
              <Text style={styles.policyLink} onPress={showPrivacy}>《隐私政策》</Text>
            </Text>
          </View>

          <Button
            variant="primary"
            size="lg"
            onPress={handleLogin}
            loading={loading}
            disabled={(!codeSent && !__DEV__) || !code || code.length < 4 || !agreed}
            style={styles.loginButton}
          >
            登录
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  hero: { alignItems: 'center', marginTop: Spacing.lg, marginBottom: Spacing.lg },
  appName: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    letterSpacing: 2,
    marginTop: Spacing.sm,
  },
  description: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 22,
  },
  formArea: { gap: Spacing.sm },
  inputWrap: {},
  inputLabel: { fontSize: 13, color: Colors.gray700, marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray300,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.gray900,
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.gray300 },
  sendBtnText: { color: Colors.white, fontSize: 13, fontWeight: '600' },
  error: { color: Colors.danger, fontSize: 12 },
  hint: { color: Colors.primaryDark, fontSize: 12 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { color: Colors.white, fontSize: 15, fontWeight: FontWeights.bold },
  checkboxLabel: { flex: 1, fontSize: 12, color: Colors.gray700, lineHeight: 17 },
  policyLink: { color: '#1677FF', fontWeight: FontWeights.semibold },
  loginButton: { marginTop: Spacing.sm },
});
