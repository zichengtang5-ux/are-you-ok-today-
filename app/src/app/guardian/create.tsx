import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Share,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Card, Input, Button, Banner } from '@/components/ui';
import { guardianApi, type CreateGuardianResponse } from '@/services/api.types';
import { Colors, FontSizes, FontWeights, Spacing, Radius, Shadows } from '@/theme';

const RELATIONS = [
  { label: '子女', value: '子女' },
  { label: '父母', value: '父母' },
  { label: '配偶', value: '配偶' },
  { label: '兄弟姐妹', value: '兄弟姐妹' },
  { label: '朋友', value: '朋友' },
  { label: '其他', value: '其他' },
];

const APP_STORE_URL = 'https://apps.apple.com/app/today-ok/id000000000';

function validatePhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

export default function CreateGuardianScreen() {
  const router = useRouter();
  const [wardName, setWardName] = useState('');
  const [wardPhone, setWardPhone] = useState('');
  const [relation, setRelation] = useState('子女');
  const [phoneError, setPhoneError] = useState('');
  const [nameError, setNameError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState<CreateGuardianResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setNameError('');
    setPhoneError('');
    setSubmitError('');

    let valid = true;
    if (!wardName.trim()) {
      setNameError('请输入家人姓名');
      valid = false;
    }
    if (!validatePhone(wardPhone)) {
      setPhoneError('请输入有效的 11 位手机号');
      valid = false;
    }
    if (!valid) return;

    setSubmitting(true);
    try {
      const res = await guardianApi.create({
        wardName: wardName.trim(),
        wardPhone,
        relation,
      });
      setResult(res);
    } catch (e: any) {
      setSubmitError(e?.response?.data?.message ?? '创建失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result.inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!result) return;
    try {
      await Share.share({
        message: `我在「今天还好」为你开通了守护，下载 App 后打开以下链接即可绑定：\n${result.inviteLink}\n\nApp 下载：${APP_STORE_URL}`,
      });
    } catch (e) {
      Alert.alert('分享失败', '请稍后重试');
    }
  };

  // Success state
  if (result) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← 返回</Text>
          </Pressable>
          <Text style={styles.title}>邀请已生成</Text>
          <Text style={styles.subtitle}>把邀请发给 {result.wardName}，TA 打开即可绑定</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Success illustration */}
          <View style={styles.successHero}>
            <Text style={styles.successEmoji}>✉️</Text>
            <Text style={styles.successTitle}>邀请已生成</Text>
          </View>

          {/* Invite card */}
          <Card style={styles.inviteCard}>
            <Text style={styles.inviteLabel}>邀请码</Text>
            <Pressable onPress={handleCopy} style={styles.inviteCodeRow}>
              <Text style={styles.inviteCode}>{result.inviteCode}</Text>
              <Text style={styles.copyHint}>{copied ? '✓ 已复制' : '点击复制'}</Text>
            </Pressable>
            <View style={styles.inviteDivider} />
            <Text style={styles.inviteLabel}>邀请链接</Text>
            <Text style={styles.inviteLink} numberOfLines={1}>
              {result.inviteLink}
            </Text>
          </Card>

          {/* Info card */}
          <Card variant="info" style={styles.infoCard}>
            <Text style={styles.infoTitle}>绑定步骤</Text>
            <View style={styles.stepRow}>
              <Text style={styles.stepNum}>1</Text>
              <Text style={styles.stepText}>
                把邀请链接发给 {result.wardName}（微信 / 短信 均可）
              </Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepNum}>2</Text>
              <Text style={styles.stepText}>TA 下载「今天还好」App</Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepNum}>3</Text>
              <Text style={styles.stepText}>点击链接即可自动绑定</Text>
            </View>
          </Card>

          {/* Actions */}
          <Button variant="primary" onPress={handleShare}>
            {`发送邀请给 ${result.wardName}`}
          </Button>

          <Button variant="ghost" onPress={() => router.replace('/guardian')}>
            回到守护中心
          </Button>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Form state
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← 返回</Text>
        </Pressable>
        <Text style={styles.title}>添加守护</Text>
        <Text style={styles.subtitle}>为家人开通远程守护</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Preview card */}
        <Card variant="warm" style={styles.previewCard}>
          <View style={styles.previewRow}>
            <Text style={styles.previewEmoji}>👨‍👩‍👧</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewTitle}>远程守护家人</Text>
              <Text style={styles.previewDesc}>
                家人每天回复"今天还好"，你即可在 App 中查看 TA 的平安状态
              </Text>
            </View>
          </View>
        </Card>

        {/* Name */}
        <Input
          label="家人姓名"
          value={wardName}
          onChangeText={(t) => {
            setWardName(t);
            setNameError('');
          }}
          placeholder="例如：妈妈、爸爸"
          error={nameError}
        />

        {/* Phone */}
        <Input
          label="家人手机号"
          value={wardPhone}
          onChangeText={(t) => {
            setWardPhone(t);
            setPhoneError('');
          }}
          placeholder="11 位手机号"
          keyboardType="phone-pad"
          maxLength={11}
          error={phoneError}
        />

        {/* Relation */}
        <Text style={styles.fieldLabel}>关系</Text>
        <View style={styles.relationRow}>
          {RELATIONS.map((r) => {
            const active = relation === r.value;
            return (
              <Pressable
                key={r.value}
                onPress={() => setRelation(r.value)}
                style={[styles.relationChip, active && styles.relationChipActive]}
              >
                <Text style={[styles.relationText, active && styles.relationTextActive]}>
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {submitError ? (
          <Banner variant="danger">{submitError}</Banner>
        ) : null}

        {/* Tips */}
        <Card style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>温馨提示</Text>
          <Text style={styles.tipsItem}>• 创建后会生成一个邀请链接</Text>
          <Text style={styles.tipsItem}>• 把链接发给家人，TA 打开 App 即可绑定</Text>
          <Text style={styles.tipsItem}>• 免费版最多守护 1 人，升级解锁 5 人</Text>
        </Card>

        <Button
          variant="primary"
          onPress={handleCreate}
          loading={submitting}
          disabled={!wardName || !wardPhone}
        >
          生成邀请
        </Button>

        <Button variant="ghost" onPress={() => router.back()}>
          取消
        </Button>
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
  subtitle: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    marginTop: Spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  previewCard: {
    marginBottom: Spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
  },
  previewEmoji: {
    fontSize: 40,
  },
  previewTitle: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.warmDark,
    marginBottom: 4,
  },
  previewDesc: {
    fontSize: FontSizes.xs,
    color: Colors.warmDark,
    lineHeight: FontSizes.xs * 1.5,
  },
  fieldLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    color: Colors.gray700,
    marginBottom: Spacing.xs,
  },
  relationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  relationChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray300,
  },
  relationChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  relationText: {
    fontSize: FontSizes.sm,
    color: Colors.gray700,
    fontWeight: FontWeights.medium,
  },
  relationTextActive: {
    color: Colors.primaryDark,
    fontWeight: FontWeights.semibold,
  },
  tipsCard: {
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  tipsTitle: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.gray700,
    marginBottom: 4,
  },
  tipsItem: {
    fontSize: FontSizes.xs,
    color: Colors.gray600,
    lineHeight: FontSizes.xs * 1.6,
  },
  /* Success */
  successHero: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  successEmoji: {
    fontSize: 64,
    marginBottom: Spacing.sm,
  },
  successTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  inviteCard: {
    gap: Spacing.sm,
  },
  inviteLabel: {
    fontSize: FontSizes.xs,
    color: Colors.gray500,
    fontWeight: FontWeights.medium,
    textTransform: 'uppercase',
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.gray50,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  inviteCode: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    color: Colors.primary,
    letterSpacing: 3,
  },
  copyHint: {
    fontSize: FontSizes.xs,
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
  },
  inviteDivider: {
    height: 1,
    backgroundColor: Colors.gray200,
    marginVertical: Spacing.sm,
  },
  inviteLink: {
    fontSize: FontSizes.sm,
    color: Colors.gray700,
    backgroundColor: Colors.gray50,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
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
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    color: Colors.white,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
    lineHeight: 22,
    overflow: 'hidden',
  },
  stepText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.primaryDark,
    lineHeight: FontSizes.sm * 1.5,
  },
});
