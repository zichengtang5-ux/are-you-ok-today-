import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Button, Input, Card } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { authApi } from '@/services/api.types';
import { Colors, FontSizes, FontWeights, Spacing } from '@/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setUser = useStore((s) => s.setUser);
  const setOnboardingStep = useStore((s) => s.setOnboardingStep);

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

      // 开发环境：自动填充 mockCode
      if (response.mockCode) {
        setCode(response.mockCode);
      }

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      const message = err.response?.data?.message || '验证码发送失败，请重试';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!code || code.length < 4) {
      setError('请输入验证码');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await authApi.verifyCode({ phone, code });

      // 存储 tokens
      await AsyncStorage.multiSet([
        ['access_token', response.accessToken],
        ['refresh_token', response.refreshToken],
      ]);

      // 更新 store
      setUser(response.user);
      setOnboardingStep(response.user.onboardingStep as any);

      // 跳转
      if (response.user.isOnboarded) {
        router.replace('/(tabs)');
      } else {
        router.replace(`/onboarding/${response.user.onboardingStep}` as Href);
      }
    } catch (err: any) {
      const message = err.response?.data?.message || '登录失败，请检查验证码';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.illustration}>🏠</Text>
          <Text style={styles.appName}>今天还好</Text>
          <Text style={styles.tagline}>每天一句平安，守护独居的你</Text>
        </View>

        {/* Form */}
        <Card style={styles.formCard}>
          <Input
            label="手机号"
            value={phone}
            onChangeText={(text) => {
              setPhone(text.replace(/\D/g, ''));
              setError('');
            }}
            placeholder="13800138000"
            keyboardType="phone-pad"
            maxLength={11}
            error={error && !codeSent ? error : undefined}
          />

          {codeSent ? (
            <View style={styles.codeSection}>
              <Input
                label="验证码"
                value={code}
                onChangeText={(text) => {
                  setCode(text.replace(/\D/g, ''));
                  setError('');
                }}
                placeholder="请输入验证码"
                keyboardType="numeric"
                maxLength={6}
                error={error && codeSent ? error : undefined}
              />
              <Button
                variant="ghost"
                size="sm"
                onPress={handleSendCode}
                disabled={countdown > 0}
                style={styles.resendButton}
              >
                {countdown > 0 ? `重新发送 (${countdown}s)` : '重新发送验证码'}
              </Button>
            </View>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onPress={handleSendCode}
              loading={loading}
              disabled={phone.length !== 11}
            >
              发送验证码
            </Button>
          )}

          {codeSent && (
            <Button
              variant="primary"
              size="lg"
              onPress={handleLogin}
              loading={loading}
              disabled={!code || code.length < 4}
              style={styles.loginButton}
            >
              登录
            </Button>
          )}
        </Card>

        {/* Legal disclaimer */}
        <Text style={styles.disclaimer}>
          登录即表示同意《用户协议》和《隐私政策》
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  illustration: {
    fontSize: 80,
    marginBottom: Spacing.md,
  },
  appName: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    marginBottom: Spacing.sm,
  },
  tagline: {
    fontSize: FontSizes.base,
    color: Colors.gray600,
    textAlign: 'center',
  },
  formCard: {
    gap: Spacing.md,
  },
  codeSection: {
    gap: Spacing.sm,
  },
  resendButton: {
    alignSelf: 'flex-start',
  },
  loginButton: {
    marginTop: Spacing.sm,
  },
  disclaimer: {
    fontSize: FontSizes.xs,
    color: Colors.gray500,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
