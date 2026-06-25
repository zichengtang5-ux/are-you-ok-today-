import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button, Banner, Dialog } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';
import { useState } from 'react';

export default function SettingsScreen() {
  const { user, reminder, contacts, notificationAuthorized } = useStore();
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleDeleteData = () => {
    if (deleteConfirmText === '确认删除') {
      // TODO: Call API to delete user data
      console.log('Deleting user data...');
      setDeleteDialogVisible(false);
      setDeleteConfirmText('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>设置</Text>

        {/* Guard settings */}
        <Card title="守护设置" style={styles.card}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>提醒时间</Text>
            <Text style={styles.settingValue}>
              {reminder.startTime} - {reminder.endTime}
            </Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>紧急联系人</Text>
            <Text style={styles.settingValue}>{contacts[0]?.name || '未设置'}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>订阅状态</Text>
            <View style={styles.freeTag}>
              <Text style={styles.freeTagText}>免费版</Text>
            </View>
          </View>
        </Card>

        {/* Family settings */}
        <Card title="家庭设置" style={styles.card}>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkText}>为家人开通守护 →</Text>
          </Pressable>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkText}>升级守护版 →</Text>
          </Pressable>
        </Card>

        {/* Legal & data */}
        <Card title="法律与数据" style={styles.card}>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkText}>查看协议</Text>
          </Pressable>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkText}>隐私政策</Text>
          </Pressable>
          <Pressable
            style={styles.dangerLinkRow}
            onPress={() => setDeleteDialogVisible(true)}
          >
            <Text style={styles.dangerLinkText}>删除我的数据</Text>
          </Pressable>
        </Card>

        {/* Subscription management */}
        <Card title="订阅管理" style={styles.card}>
          <View style={styles.planRow}>
            <Text style={styles.planLabel}>当前套餐</Text>
            <Text style={styles.planValue}>免费版</Text>
          </View>
          <Button variant="primary" onPress={() => {}}>
            升级守护版
          </Button>
        </Card>

        {/* Version */}
        <Text style={styles.version}>今天还好 v1.0</Text>
      </ScrollView>

      {/* Delete confirmation dialog */}
      <Dialog
        visible={deleteDialogVisible}
        title="确定删除所有数据吗？"
        message="删除后无法恢复，包括：回复记录、联系人信息、守护设置。你的紧急联系人将不再收到通知。"
        confirmText="确认删除"
        cancelText="取消"
        variant="danger"
        onConfirm={handleDeleteData}
        onCancel={() => {
          setDeleteDialogVisible(false);
          setDeleteConfirmText('');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    marginBottom: Spacing.md,
  },
  card: {
    gap: Spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  settingLabel: {
    fontSize: FontSizes.base,
    color: Colors.gray700,
  },
  settingValue: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.medium,
    color: Colors.gray900,
  },
  freeTag: {
    backgroundColor: Colors.gray100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  freeTagText: {
    fontSize: FontSizes.sm,
    color: Colors.gray700,
    fontWeight: FontWeights.medium,
  },
  linkRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  linkText: {
    fontSize: FontSizes.base,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
  dangerLinkRow: {
    paddingVertical: Spacing.sm,
  },
  dangerLinkText: {
    fontSize: FontSizes.base,
    color: Colors.danger,
    fontWeight: FontWeights.semibold,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  planLabel: {
    fontSize: FontSizes.base,
    color: Colors.gray700,
  },
  planValue: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  version: {
    fontSize: FontSizes.sm,
    color: Colors.gray500,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
});
