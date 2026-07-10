import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Card, Input } from '@/components/ui';
import { StepDots } from '@/components/ui/StepDots';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';
import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { contactApi, userApi } from '@/services/api.types';
import { DEV_MOCK_CODE, isOfflineDevSession } from '@/services/devMock';

type ViewMode = 'list' | 'add';

export default function ContactSetupScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [contactId, setContactId] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const { contacts, subscription, user, addContact, setOnboardingStep } = useStore();
  const isPremium = !!subscription?.isPremium || !!user?.isPremium;
  const canAddContact = contacts.length === 0 || isPremium;

  const handleAddContact = () => {
    if (!canAddContact) {
      router.push('/subscription');
      return;
    }
    setViewMode('add');
    setLastAdded(null);
    setError('');
  };

  const handleSendCode = async () => {
    if (!contactName.trim()) { setError('请输入联系人姓名'); return; }
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

      if (sendResult.mockCode) {
        setVerifyCode(sendResult.mockCode);
      }

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      if (canAddContact && await isOfflineDevSession()) {
        setContactId(`dev-contact-${Date.now()}`);
        setCodeSent(true);
        setCountdown(0);
        setVerifyCode(DEV_MOCK_CODE);
        return;
      }
      const message = err.response?.data?.message || '发送验证码失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyCode || verifyCode.length < 4) { setError('请输入验证码'); return; }
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

      setLastAdded(verified.name);
      setViewMode('list');
      setContactName('');
      setContactPhone('');
      setRelation('');
      setVerifyCode('');
      setContactId(null);
      setCodeSent(false);
      setCountdown(0);
    } catch (err: any) {
      if (await isOfflineDevSession() && verifyCode === DEV_MOCK_CODE) {
        const verified = {
          id: contactId,
          name: contactName,
          phone: contactPhone,
          relation: relation || '家人',
          priority: 1,
          verified: true,
        };
        addContact(verified);
        setLastAdded(verified.name);
        setViewMode('list');
        setContactName('');
        setContactPhone('');
        setRelation('');
        setVerifyCode('');
        setContactId(null);
        setCodeSent(false);
        return;
      }
      const message = err.response?.data?.message || '验证码错误';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    try {
      await userApi.updateOnboarding({
        step: 'reminder-time',
        isOnboarded: false,
      });
      setOnboardingStep('reminder-time');
      router.replace('/onboarding/reminder-time');
    } catch (err: any) {
      if (await isOfflineDevSession()) {
        setOnboardingStep('reminder-time');
        router.replace('/onboarding/reminder-time');
        return;
      }
      const message = err.response?.data?.message || '保存失败，请重试';
      setError(message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="white" title="注册" showMascot={false} onBack={() => router.back()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <StepDots current={2} total={4} />
          <Text style={styles.title}>出事了通知谁？</Text>
        </View>

        {viewMode === 'list' ? (
          <>
            {/* Success banner after adding a contact */}
            {lastAdded && (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>
                  [OK] {lastAdded} 已添加，验证短信已发送
                </Text>
              </View>
            )}

            {/* Contact list */}
            {contacts.length > 0 ? (
              <Card style={styles.contactList}>
                {contacts.map((c, i) => (
                  <View key={c.id || i} style={styles.contactRow}>
                    <View style={styles.contactAvatarCircle}>
                      <Text style={styles.contactAvatarText}>{c.name?.[0] ?? '?'}</Text>
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>{c.name}</Text>
                      <Text style={styles.contactPhone}>
                        {c.phone.slice(0, 3)}****{c.phone.slice(-4)}
                        {c.relation ? ` · ${c.relation}` : ''}
                      </Text>
                    </View>
                    {c.verified ? (
                      <Text style={styles.verifiedBadge}>已验证</Text>
                    ) : (
                      <Text style={styles.pendingBadge}>待验证</Text>
                    )}
                  </View>
                ))}
              </Card>
            ) : (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  还没有添加紧急联系人{'\n'}至少需要 1 位联系人来守护你
                </Text>
              </Card>
            )}

            {/* Add more link */}
            <Pressable
              style={styles.addLink}
              onPress={handleAddContact}
            >
              <Text style={styles.addLinkText}>{canAddContact ? '＋ 添加更多联系人' : '升级后添加更多联系人'}</Text>
            </Pressable>

            {/* Free tier hint */}
            <Card variant="warm" style={styles.hintCard}>
              <Text style={styles.hintText}>
                免费版支持 1 位联系人，升级可添加最多 5 位
              </Text>
            </Card>

            {/* Continue button */}
            <Button
              variant="primary"
              size="lg"
              onPress={handleContinue}
              disabled={contacts.length === 0}
              style={styles.button}
            >
              下一步
            </Button>
          </>
        ) : (
          <>
            {/* Add contact form */}
            <Card style={styles.formCard}>
              <Text style={styles.formTitle}>添加紧急联系人</Text>
              <Input
                label="联系人姓名"
                value={contactName}
                onChangeText={(text) => { setContactName(text); setError(''); }}
                placeholder="如：妈妈"
                error={!codeSent ? error : undefined}
              />
              <Input
                label="手机号"
                value={contactPhone}
                onChangeText={(text) => { setContactPhone(text.replace(/\D/g, '')); setError(''); }}
                placeholder="13800138000"
                keyboardType="phone-pad"
                maxLength={11}
              />
              <Input
                label="与你的关系"
                value={relation}
                onChangeText={(text) => { setRelation(text); setError(''); }}
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
                    onChangeText={(text) => { setVerifyCode(text.replace(/\D/g, '')); setError(''); }}
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
                    验证并添加
                  </Button>
                </>
              )}
            </Card>

            {/* Back to list */}
            <Pressable
              style={styles.backLink}
              onPress={() => {
                setViewMode('list');
                setCodeSent(false);
                setVerifyCode('');
                setContactId(null);
                setError('');
              }}
            >
              <Text style={styles.backLinkText}>← 返回联系人列表</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  scroll: { flex: 1 },
  content: { flex: 1, padding: Spacing.lg },
  header: { marginBottom: Spacing.lg },
  title: { fontSize: FontSizes['2xl'], fontWeight: FontWeights.bold, color: Colors.gray900 },
  successBanner: {
    padding: 12,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
    marginBottom: Spacing.md,
  },
  successText: {
    fontSize: FontSizes.sm,
    color: Colors.primaryDark,
    fontWeight: FontWeights.semibold,
  },
  contactList: { gap: Spacing.sm, marginBottom: Spacing.md },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  contactAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  contactAvatarText: {
    fontSize: 14,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
  },
  contactInfo: { flex: 1 },
  contactName: { fontSize: FontSizes.base, fontWeight: FontWeights.semibold, color: Colors.gray900 },
  contactPhone: { fontSize: FontSizes.sm, color: Colors.gray500, marginTop: 2 },
  verifiedBadge: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: FontWeights.semibold },
  pendingBadge: { fontSize: FontSizes.xs, color: Colors.warmDark, fontWeight: FontWeights.semibold },
  emptyCard: { alignItems: 'center', padding: Spacing.xl, marginBottom: Spacing.md },
  emptyText: { fontSize: FontSizes.base, color: Colors.gray500, textAlign: 'center', lineHeight: 22 },
  addLink: { paddingVertical: Spacing.sm, marginBottom: Spacing.lg },
  addLinkText: { fontSize: FontSizes.base, color: Colors.primary, fontWeight: FontWeights.semibold },
  hintCard: { alignItems: 'center', marginBottom: Spacing.xl },
  hintText: { fontSize: FontSizes.sm, color: Colors.warmDark, textAlign: 'center' },
  button: { marginTop: 'auto' },
  formCard: { gap: Spacing.md, marginBottom: Spacing.md },
  formTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.gray900, marginBottom: Spacing.sm },
  backLink: { paddingVertical: Spacing.sm, marginTop: Spacing.md },
  backLinkText: { fontSize: FontSizes.base, color: Colors.primary, fontWeight: FontWeights.medium },
});
