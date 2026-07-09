import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Button } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { MascotLogo } from '@/components/ui/MascotLogo';
import { useStore } from '@/store/useStore';
import { authApi } from '@/services/api.types';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState(__DEV__ ? '13800138000' : '');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setUser = useStore((s) => s.setUser);
  const setOnboardingStep = useStore((s) => s.setOnboardingStep);

  useEffect(() => {
    if (!__DEV__ || phone !== '13800138000' || codeSent) return;
    let cancelled = false;
    (async () => {
      try {
        const sendRes = await authApi.sendCode({ phone: '13800138000' });
        if (cancelled) return;
        const mc = sendRes.mockCode ?? '';
        setCodeSent(true);
        setCountdown(sendRes.cooldownSeconds);
        if (mc) setCode(mc);
        const loginRes = await authApi.verifyCode({ phone: '13800138000', code: mc });
        if (cancelled) return;
        await AsyncStorage.multiSet([
          ['access_token', loginRes.accessToken],
          ['refresh_token', loginRes.refreshToken],
        ]);
        setUser(loginRes.user);
        setOnboardingStep(loginRes.user.onboardingStep as any);
        if (loginRes.user.isOnboarded) {
          router.replace('/(tabs)');
        } else {
          router.replace(`/onboarding/${loginRes.user.onboardingStep}` as Href);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

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
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.message || '验证码发送失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!code || code.length < 4) { setError('请输入验证码'); return; }
    setError('');
    setLoading(true);
    try {
      const response = await authApi.verifyCode({ phone, code });
      await AsyncStorage.multiSet([
        ['access_token', response.accessToken],
        ['refresh_token', response.refreshToken],
      ]);
      setUser(response.user);
      setOnboardingStep(response.user.onboardingStep as any);
      if (response.user.isOnboarded) {
        router.replace('/(tabs)');
      } else {
        router.replace(`/onboarding/${response.user.onboardingStep}` as Href);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '登录失败，请检查验证码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="primary" title="今天还好" showMascot />
      <View style={styles.content}>
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

          <Button
            variant="primary"
            size="lg"
            onPress={handleLogin}
            loading={loading}
            disabled={!codeSent || !code || code.length < 4}
            style={styles.loginButton}
          >
            登录
          </Button>

          <Text style={styles.disclaimer}>
            登录即表示同意《用户协议》和《隐私政策》
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: { flex: 1, paddingHorizontal: Spacing.lg },
  hero: { alignItems: 'center', marginTop: Spacing.xl, marginBottom: Spacing.xl },
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
  formArea: { gap: Spacing.md },
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
  loginButton: { marginTop: Spacing.sm },
  disclaimer: {
    fontSize: FontSizes.xs,
    color: Colors.gray500,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
