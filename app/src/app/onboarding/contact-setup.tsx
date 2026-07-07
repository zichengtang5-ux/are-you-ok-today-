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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { addContact, setOnboardingStep } = useStore();

  const handleSubmit = async () => {
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
      addContact({
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        relation: contact.relation,
        priority: contact.priority,
        verified: contact.verified,
      });

      await userApi.updateOnboarding({
        step: 'reminder-time',
        isOnboarded: false,
      });

      setOnboardingStep('reminder-time');
      router.replace('/onboarding/reminder-time');
    } catch (err: any) {
      const message = err.response?.data?.message || '保存联系人失败';
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
	            error={error}
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
	            onPress={handleSubmit}
	            loading={loading}
	            disabled={loading || !contactName.trim() || contactPhone.length !== 11}
	          >
	            保存并继续
	          </Button>
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
