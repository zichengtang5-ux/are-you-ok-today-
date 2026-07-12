import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Card } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { useStore } from '@/store/useStore';
import { contactApi } from '@/services/api.types';
import { isOfflineDevSession } from '@/services/devMock';
import {
  canAddMoreContacts,
  getContactLimit,
} from '@/utils/contactLimits';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';

type ViewMode = 'list' | 'form';

export default function EditContactScreen() {
  const router = useRouter();
  const {
    contacts,
    subscription,
    user,
    removeContact,
    addContact,
    updateContact,
  } = useStore();
  const isPremium = !!subscription?.isPremium || !!user?.isPremium;
  const contactLimit = getContactLimit(isPremium);

  const [viewMode, setViewMode] = useState<ViewMode>(contacts.length > 0 ? 'list' : 'form');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const editingContact = editingId
    ? contacts.find((contact) => contact.id === editingId) ?? null
    : null;

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPhone('');
    setRelation('');
    setError('');
  };

  const openEditor = (contactId?: string) => {
    if (!contactId) {
      if (!canAddMoreContacts(contacts.length, isPremium)) {
        if (isPremium) {
          Alert.alert('已达上限', '守护版最多可添加 5 位紧急联系人。');
        } else {
          router.push('/subscription');
        }
        return;
      }
      resetForm();
      setViewMode('form');
      return;
    }

    const contact = contacts.find((item) => item.id === contactId);
    if (!contact) return;
    setEditingId(contact.id);
    setName(contact.name);
    setPhone(contact.phone);
    setRelation(contact.relation);
    setError('');
    setSuccess('');
    setViewMode('form');
  };

  const finishEditing = (message: string) => {
    resetForm();
    setSuccess(message);
    setViewMode('list');
  };

  const handleSave = async () => {
    const nextName = name.trim();
    const nextPhone = phone.trim();
    const nextRelation = relation.trim() || '家人';
    if (!nextName) {
      setError('请输入联系人姓名');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(nextPhone)) {
      setError('请输入正确的手机号');
      return;
    }
    if (!editingContact && !canAddMoreContacts(contacts.length, isPremium)) {
      openEditor();
      return;
    }

    const payload = { name: nextName, phone: nextPhone, relation: nextRelation };
    setError('');
    setLoading(true);
    try {
      if (editingContact) {
        const saved = await contactApi.update(editingContact.id, payload);
        updateContact(editingContact.id, saved);
        finishEditing('联系人已更新');
      } else {
        const saved = await contactApi.create(payload);
        addContact(saved);
        finishEditing('联系人已添加');
      }
    } catch (err: any) {
      if (await isOfflineDevSession()) {
        if (editingContact) {
          updateContact(editingContact.id, payload);
          finishEditing('联系人已更新');
        } else {
          addContact({
            id: `dev-contact-${Date.now()}`,
            ...payload,
            priority: contacts.length + 1,
            verified: true,
          });
          finishEditing('联系人已添加');
        }
        return;
      }
      setError(err.response?.data?.message || '保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const performDelete = async () => {
    if (!editingContact) return;
    setLoading(true);
    setError('');
    try {
      await contactApi.delete(editingContact.id);
      removeContact(editingContact.id);
      finishEditing('联系人已删除');
    } catch (err: any) {
      if (await isOfflineDevSession()) {
        removeContact(editingContact.id);
        finishEditing('联系人已删除');
        return;
      }
      setError(err.response?.data?.message || '删除失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!editingContact) return;
    if (contacts.length <= 1) {
      Alert.alert(
        '需要保留 1 位联系人',
        '守护服务至少需要 1 位紧急联系人。你可以直接修改当前联系人；守护版也可以先添加新联系人再删除。',
      );
      return;
    }
    Alert.alert('删除联系人', `确定删除“${editingContact.name}”吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => void performDelete() },
    ]);
  };

  const handleBack = () => {
    if (viewMode === 'form' && contacts.length > 0) {
      resetForm();
      setViewMode('list');
      return;
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar
        variant="white"
        title="紧急联系人"
        showMascot={false}
        onBack={handleBack}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {viewMode === 'list' ? (
          <>
            <View style={styles.listHeading}>
              <View>
                <Text style={styles.pageTitle}>联系人管理</Text>
                <Text style={styles.pageSubtitle}>紧急时会同时通知所有已验证联系人</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{contacts.length}/{contactLimit}</Text>
              </View>
            </View>

            {success ? <Text style={styles.successText}>{success}</Text> : null}

            <Card style={styles.contactList}>
              {contacts.map((contact, index) => (
                <Pressable
                  key={contact.id}
                  onPress={() => openEditor(contact.id)}
                  style={({ pressed }) => [
                    styles.contactRow,
                    index < contacts.length - 1 && styles.contactRowBorder,
                    pressed && styles.contactRowPressed,
                  ]}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{contact.name[0] || '?'}</Text>
                  </View>
                  <View style={styles.contactCopy}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <Text style={styles.contactMeta}>
                      {contact.phone.slice(0, 3)}****{contact.phone.slice(-4)} · {contact.relation || '家人'}
                    </Text>
                  </View>
                  <Text style={styles.editText}>编辑</Text>
                </Pressable>
              ))}
            </Card>

            <Button
              variant={canAddMoreContacts(contacts.length, isPremium) ? 'primary' : 'outline'}
              size="lg"
              onPress={() => openEditor()}
            >
              {canAddMoreContacts(contacts.length, isPremium)
                ? '添加联系人'
                : isPremium
                  ? '已达 5 位上限'
                  : '升级后添加更多联系人'}
            </Button>

            {!isPremium ? (
              <Card variant="info" style={styles.planHint}>
                <Text style={styles.planHintText}>免费版支持 1 位，守护版最多支持 5 位联系人</Text>
              </Card>
            ) : null}
          </>
        ) : (
          <>
            <View>
              <Text style={styles.pageTitle}>{editingContact ? '编辑联系人' : '添加联系人'}</Text>
              <Text style={styles.pageSubtitle}>保存后立即用于守护告警和 SOS 通知</Text>
            </View>

            <Card style={styles.formCard}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>姓名</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={(value) => { setName(value); setError(''); }}
                  placeholder="联系人姓名"
                  placeholderTextColor={Colors.gray400}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>手机号</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={(value) => { setPhone(value.replace(/\D/g, '')); setError(''); }}
                  placeholder="13800138000"
                  keyboardType="phone-pad"
                  maxLength={11}
                  placeholderTextColor={Colors.gray400}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>关系</Text>
                <TextInput
                  style={styles.input}
                  value={relation}
                  onChangeText={(value) => { setRelation(value); setError(''); }}
                  placeholder="如：母亲、父亲、朋友"
                  placeholderTextColor={Colors.gray400}
                />
              </View>
            </Card>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Button variant="primary" size="lg" onPress={handleSave} loading={loading}>
              保存
            </Button>

            {editingContact ? (
              <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={loading}>
                <Text style={styles.deleteText}>删除联系人</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing['2xl'] },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.gray900 },
  pageSubtitle: { marginTop: 4, fontSize: FontSizes.sm, color: Colors.gray600 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.sm, backgroundColor: Colors.primaryLight },
  countText: { fontSize: FontSizes.sm, color: Colors.primaryDark, fontWeight: FontWeights.semibold },
  successText: { fontSize: FontSizes.sm, color: Colors.primaryDark, textAlign: 'center' },
  contactList: { paddingVertical: 4, paddingHorizontal: Spacing.md },
  contactRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12 },
  contactRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray200 },
  contactRowPressed: { opacity: 0.65 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSizes.base, color: Colors.primaryDark, fontWeight: FontWeights.bold },
  contactCopy: { flex: 1, gap: 3 },
  contactName: { fontSize: FontSizes.base, color: Colors.gray900, fontWeight: FontWeights.semibold },
  contactMeta: { fontSize: FontSizes.xs, color: Colors.gray500 },
  editText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: FontWeights.medium },
  planHint: { alignItems: 'center' },
  planHintText: { fontSize: FontSizes.sm, color: Colors.gray700, textAlign: 'center' },
  formCard: { gap: Spacing.md },
  field: { gap: 6 },
  fieldLabel: { fontSize: FontSizes.sm, color: Colors.gray600, fontWeight: FontWeights.medium },
  input: { borderWidth: 1, borderColor: Colors.gray300, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 11, fontSize: FontSizes.base, color: Colors.gray900, backgroundColor: Colors.white },
  errorText: { fontSize: FontSizes.sm, color: Colors.danger, textAlign: 'center' },
  deleteButton: { alignItems: 'center', paddingVertical: Spacing.sm },
  deleteText: { fontSize: FontSizes.base, color: Colors.danger, fontWeight: FontWeights.medium },
});
