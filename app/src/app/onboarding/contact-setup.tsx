import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Card, Input } from '@/components/ui';
import { Colors, FontSizes, FontWeights, Spacing } from '@/theme';
import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { contactApi, userApi } from '@/services/api.types';

export default function ContactSetupScreen() {
  const router = useRouter();
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [contactId, setContactId] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { addContact, setOnboardingStep } = useStore();

  const handleSendCode = async () => {
    if (!contactName.trim()) {
      setError('请输入联系人姓名');
      return;
    }
    if (contactPhone.length !== 11 || !/^1[3-9]\d{9}$/.test(contactPhone)) {
      setError('请输入正确的手机号');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const contact = await contactApi.create({
        name: contactName,
        phone: contactPhone,
        relation: relation || '家人',
      });
      setContactId(contact.id);

      const sendResult = await contactApi.sendVerifyCode(contact.id);
      setCodeSent(true);
      setCountdown(60);

      // 开发环境：自动填充 mockCode
      if (sendResult.mockCode) {
        setVerifyCode(sendResult.mockCode);
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
      const message = err.response?.data?.message || '发送验证码失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyCode || verifyCode.length < 4) {
      setError('请输入验证码');
      return;
    }
    if (!contactId) return;

    setError('');
    setLoading(true);

    try {
      const result = await contactApi.verify(contactId, verifyCode);
      const verified = result.contact;
      addContact({
        id: verified.id,
        name: verified.name,
        phone: verified.phone,
        relation: verified.relation,
        priority: verified.priority,
        verified: verified.verified,
      });

      await userApi.updateOnboarding({
        step: 'reminder-time',
        isOnboarded: false,
      });

      setOnboardingStep('reminder-time');
      router.replace('/onboarding/reminder-time');
    } catch (err: any) {
      const message = err.response?.data?.message || '验证码错误';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.stepIndicator}>3 / 5</Text>
          <Text style={styles.title}>出事了通知谁？</Text>
        </View>

        {/* Contact form */}
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>添加紧急联系人</Text>
          <Input
            label="联系人姓名"
            value={contactName}
            onChangeText={(text) => {
              setContactName(text);
              setError('');
            }}
            placeholder="如：妈妈"
            error={!codeSent ? error : undefined}
          />
          <Input
            label="手机号"
            value={contactPhone}
            onChangeText={(text) => {
              setContactPhone(text.replace(/\D/g, ''));
              setError('');
            }}
            placeholder="13800138000"
            keyboardType="phone-pad"
            maxLength={11}
          />
          <Input
            label="与你的关系"
            value={relation}
            onChangeText={(text) => {
              setRelation(text);
              setError('');
            }}
            placeholder="母亲 / 父亲 / 朋友 / 其他"
          />
          <Button
            variant="primary"
            size="md"
            onPress={handleSendCode}
            loading={loading && !codeSent}
            disabled={countdown > 0}
          >
            {countdown > 0 ? `重新发送 (${countdown}s)` : '发送验证码'}
          </Button>

          {codeSent && (
            <>
              <Input
                label="验证码"
                value={verifyCode}
                onChangeText={(text) => {
                  setVerifyCode(text.replace(/\D/g, ''));
                  setError('');
                }}
                placeholder="请输入验证码"
                keyboardType="numeric"
                maxLength={6}
                error={codeSent ? error : undefined}
              />
              <Button
                variant="primary"
                size="md"
                onPress={handleVerify}
                loading={loading && codeSent}
                disabled={!verifyCode || verifyCode.length < 4}
              >
                验证并继续
              </Button>
            </>
          )}
        </Card>

        {/* Free tier hint */}
        <Card variant="warm" style={styles.hintCard}>
          <Text style={styles.hintText}>
            免费版支持 1 位联系人，升级可添加最多 5 位
          </Text>
        </Card>
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
  },
  header: {
    marginBottom: Spacing.lg,
  },
  stepIndicator: {
    fontSize: FontSizes.sm,
    color: Colors.gray500,
    fontWeight: FontWeights.medium,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
  },
  formCard: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  formTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
    marginBottom: Spacing.sm,
  },
  hintCard: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  hintText: {
    fontSize: FontSizes.sm,
    color: Colors.warmDark,
    textAlign: 'center',
  },
  button: {
    marginTop: 'auto',
  },
});
