import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Card, Input, Button, Banner } from '@/components/ui';
import { guardianApi } from '@/services/api.types';
import { Colors, FontSizes, FontWeights, Spacing, Radius, Shadows } from '@/theme';

type Stage = 'input' | 'submitting' | 'success' | 'error';

export default function InviteScreen() {
  const router = useRouter();
  const { inviteCode: initialCode } = useLocalSearchParams<{ inviteCode?: string }>();
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<Stage>('input');
  const [errorMsg, setErrorMsg] = useState('');
  const [guardianName, setGuardianName] = useState('');

  useEffect(() => {
    if (initialCode && initialCode.length >= 6) {
      setCode(initialCode);
      acceptInvite(initialCode);
    }
  }, [initialCode]);

  const acceptInvite = async (codeToUse: string) => {
    setStage('submitting');
    setErrorMsg('');
    try {
      const res = await guardianApi.acceptInvite(codeToUse);
      setGuardianName(res.guardian.guardianName);
      setStage('success');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? '邀请无效或已过期';
      setErrorMsg(msg);
      setStage('error');
    }
  };

  const handleSubmit = () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 6) {
      setErrorMsg('请输入完整的邀请码');
      setStage('error');
      return;
    }
    acceptInvite(trimmed);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← 返回</Text>
        </Pressable>
        <Text style={styles.title}>接受守护邀请</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {stage === 'success' ? (
          <>
            {/* Success illustration */}
            <View style={styles.hero}>
              <View style={styles.successCircle}>
                <Text style={styles.successEmoji}>OK</Text>
              </View>
              <Text style={styles.successTitle}>绑定成功</Text>
              <Text style={styles.successSub}>
                你已经加入 {guardianName} 的守护圈
              </Text>
            </View>

            {/* What happens next */}
            <Card variant="info" style={styles.infoCard}>
              <Text style={styles.infoTitle}>接下来会发生什么</Text>
              <Text style={styles.infoItem}>
                • 每晚在提醒时间段内回复"今天还好"，{guardianName} 可在 App 中看到你平安
              </Text>
              <Text style={styles.infoItem}>
                • 如果你超时未回复，TA 会收到通知（前提是 TA 已升级守护版）
              </Text>
              <Text style={styles.infoItem}>
                • 你随时可以在设置中解除守护关系
              </Text>
            </Card>

            <Button variant="primary" onPress={() => router.replace('/(tabs)')}>
              开始使用
            </Button>
          </>
        ) : stage === 'submitting' ? (
          <View style={styles.hero}>
            <View style={styles.loadingCircle}>
              <Text style={styles.loadingEmoji}>信</Text>
            </View>
            <Text style={styles.loadingTitle}>正在确认邀请...</Text>
          </View>
        ) : (
          <>
            {/* Welcome card */}
            <Card variant="warm" style={styles.welcomeCard}>
              <View style={styles.welcomeEmoji}>
                <Text style={styles.welcomeEmojiText}>邀</Text>
              </View>
              <Text style={styles.welcomeTitle}>加入家人的守护圈</Text>
              <Text style={styles.welcomeDesc}>
                输入家人发给你的邀请码，即可让 TA 在 App 中看到你每天是否平安
              </Text>
            </Card>

            {/* Code input */}
            <Input
              label="邀请码"
              value={code}
              onChangeText={(t) => {
                setCode(t.toUpperCase());
                setErrorMsg('');
                setStage('input');
              }}
              placeholder="例如 ABC123XYZ"
              maxLength={20}
            />

            {stage === 'error' && errorMsg && (
              <Banner variant="danger">{errorMsg}</Banner>
            )}

            {/* How to get code */}
            <Card style={styles.howCard}>
              <Text style={styles.howTitle}>如何获取邀请码？</Text>
              <Text style={styles.howItem}>
                1. 家人在「今天还好」App 中点击"添加守护"
              </Text>
              <Text style={styles.howItem}>
                2. 选择"生成邀请"并把链接发给你
              </Text>
              <Text style={styles.howItem}>
                3. 你点击链接会自动进入本页面，或手动输入 9 位邀请码
              </Text>
            </Card>

            <Button
              variant="primary"
              onPress={handleSubmit}
              disabled={code.length < 6}
            >
              确认接受邀请
            </Button>

            <Button variant="ghost" onPress={() => router.back()}>
              稍后再说
            </Button>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },
  header: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    marginBottom: Spacing.sm,
  },
  backText: {
    fontSize: FontSizes.base,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  successEmoji: {
    fontSize: 40,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
  },
  successTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    marginTop: Spacing.sm,
  },
  successSub: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
  },
  loadingCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.warmLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingEmoji: {
    fontSize: 36,
    fontWeight: FontWeights.bold,
    color: Colors.warmDark,
  },
  loadingTitle: {
    fontSize: FontSizes.base,
    color: Colors.gray700,
    fontWeight: FontWeights.medium,
    marginTop: Spacing.sm,
  },
  welcomeCard: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  welcomeEmoji: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FCE4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeEmojiText: {
    fontSize: 28,
    fontWeight: FontWeights.bold,
    color: '#E91E63',
  },
  welcomeTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.warmDark,
  },
  welcomeDesc: {
    fontSize: FontSizes.sm,
    color: Colors.warmDark,
    textAlign: 'center',
    lineHeight: FontSizes.sm * 1.5,
  },
  infoCard: {
    gap: Spacing.sm,
  },
  infoTitle: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  infoItem: {
    fontSize: FontSizes.sm,
    color: Colors.primaryDark,
    lineHeight: FontSizes.sm * 1.6,
  },
  howCard: {
    gap: Spacing.xs,
  },
  howTitle: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.gray700,
    marginBottom: 4,
  },
  howItem: {
    fontSize: FontSizes.xs,
    color: Colors.gray600,
    lineHeight: FontSizes.xs * 1.7,
  },
});
