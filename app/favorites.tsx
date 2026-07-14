import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../src/components/Text';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { ScalePressable } from '../src/components/ScalePressable';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart, PencilSimple } from 'phosphor-react-native';
import {
  init as initSaved,
  getSaved,
  getSavedSync,
  isStoreReady,
  subscribe as subscribeSaved,
  toggleSaved,
  updateNote,
  type SavedClinic,
} from '../src/store/savedClinics';
import { theme } from '../src/theme';

const { colors, radius, font, shadow } = theme;

const NOTE_LIMIT = 500;
type FilterMode  = 'all' | 'clinic' | 'mh';

export default function FavoritesScreen() {
  const { t }  = useTranslation();
  const router = useRouter();

  const [initialized, setInitialized] = useState(() => isStoreReady());
  const [clinics, setClinics]         = useState<SavedClinic[]>(() => isStoreReady() ? getSavedSync() : []);
  const [filter,  setFilter]          = useState<FilterMode>('all');

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem,  setEditingItem]  = useState<SavedClinic | null>(null);
  const [draftNote,    setDraftNote]    = useState('');
  const [saving,       setSaving]       = useState(false);

  useEffect(() => {
    initSaved()
      .then(() => getSaved().then(setClinics))
      .catch(() => {})
      .finally(() => setInitialized(true));

    return subscribeSaved(() => {
      getSaved().then(setClinics).catch(() => {});
    });
  }, []);

  const openModal = (item: SavedClinic) => {
    setEditingItem(item);
    setDraftNote(item.note ?? '');
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalVisible(false);
    setEditingItem(null);
    setDraftNote('');
  };

  const handleSave = async () => {
    if (!editingItem || saving) return;
    setSaving(true);
    const trimmed = draftNote.trim();
    await updateNote(editingItem.id, editingItem.source, trimmed || null).catch(() => {});
    // List refreshes via subscribeSaved — no manual setSaved needed
    setSaving(false);
    closeModal();
  };

  const handleDelete = async () => {
    if (!editingItem || saving) return;
    setSaving(true);
    await updateNote(editingItem.id, editingItem.source, null).catch(() => {});
    setSaving(false);
    closeModal();
  };

  if (!initialized) {
    return (
      <View style={styles.emptyFull}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (clinics.length === 0) {
    return (
      <View style={styles.emptyFull}>
        <Heart size={52} color={colors.muted} />
        <Text style={styles.emptyTitle}>{t('favorites.empty')}</Text>
        <Text style={styles.emptySub}>{t('favorites.emptySub')}</Text>
      </View>
    );
  }

  const clinicCount = clinics.filter((c) => c.source === 'clinic').length;
  const mhCount     = clinics.filter((c) => c.source === 'mh').length;
  const filtered    = filter === 'all' ? clinics : clinics.filter((c) => c.source === filter);

  const chips: { key: FilterMode; label: string }[] = [
    { key: 'all',    label: t('favorites.filterAll') },
    { key: 'clinic', label: `${t('favorites.filterClinics')} (${clinicCount})` },
    { key: 'mh',     label: `${t('favorites.filterMh')} (${mhCount})` },
  ];

  const renderItem = ({ item }: { item: SavedClinic }) => (
    <ScalePressable
      scale={0.98}
      style={styles.card}
      onPress={() => {
        const route = item.source === 'mh'
          ? `/mh/${encodeURIComponent(item.id)}`
          : `/clinic/${encodeURIComponent(item.id)}`;
        router.push(route as Parameters<typeof router.push>[0]);
      }}
    >
      <View style={styles.cardInner}>
        <View style={styles.cardText}>
          {item.source === 'mh' ? (
            <View style={styles.mhBadge}>
              <Text style={styles.mhBadgeText}>{t('mh.tabMh')}</Text>
            </View>
          ) : null}
          <Text style={styles.cardName}>{item.name}</Text>
          {item.address ? (
            <Text style={styles.cardAddress}>{item.address}</Text>
          ) : null}
          {item.note ? (
            <Text style={styles.cardNote} numberOfLines={2}>{item.note}</Text>
          ) : null}
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              openModal(item);
            }}
          >
            <PencilSimple
              size={18}
              color={item.note ? colors.primary : colors.iconIdle}
            />
          </TouchableOpacity>

          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleSaved(item.id, item.source).catch(() => {});
            }}
          >
            <Heart weight="fill" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </ScalePressable>
  );

  const ListHeader = (
    <View style={styles.filterRow}>
      {chips.map(({ key, label }) => (
        <Pressable
          key={key}
          onPress={() => setFilter(key)}
          style={[styles.chip, filter === key && styles.chipActive]}
        >
          <Text style={[styles.chipText, filter === key && styles.chipTextActive]}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const EmptyFiltered = (
    <View style={styles.emptyFiltered}>
      <Text style={styles.emptyFilteredText}>{t('favorites.emptyFiltered')}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t('favorites.title')} />

      <FlatList
        data={filtered}
        keyExtractor={(item) => `${item.source}:${item.id}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyFiltered}
        showsVerticalScrollIndicator={false}
      />

      {/* Note edit modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.overlay} onPress={closeModal}>
            {/* Inner Pressable stops tap-on-sheet from closing the modal */}
            <Pressable style={styles.sheet}>
              <Text style={styles.modalTitle}>
                {t(editingItem?.note ? 'favorites.noteEdit' : 'favorites.noteAdd')}
              </Text>

              <TextInput
                multiline
                value={draftNote}
                onChangeText={(txt) => setDraftNote(txt.slice(0, NOTE_LIMIT))}
                placeholder={t('favorites.notePlaceholder')}
                placeholderTextColor={colors.muted}
                style={styles.noteInput}
                autoFocus
                scrollEnabled
              />

              <Text style={styles.noteCounter}>{draftNote.length}/{NOTE_LIMIT}</Text>

              <View style={styles.modalButtons}>
                {editingItem?.note ? (
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnDanger]}
                    onPress={handleDelete}
                    disabled={saving}
                  >
                    <Text style={styles.modalBtnDangerText}>{t('favorites.noteDelete')}</Text>
                  </TouchableOpacity>
                ) : null}

                <View style={styles.modalBtnSpacer} />

                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={closeModal}
                  disabled={saving}
                >
                  <Text style={styles.modalBtnCancelText}>{t('favorites.noteCancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalBtn, styles.modalBtnSave,
                    saving && styles.modalBtnDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Text style={styles.modalBtnSaveText}>{t('favorites.noteSave')}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyFull: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.bg,
  },
  emptyTitle: { fontFamily: font.bold, fontSize: 17, color: colors.text, marginTop: 14, marginBottom: 6 },
  emptySub:   { fontFamily: font.regular, fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },

  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },

  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingVertical: 12 },
  chip: {
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadow,
  },
  chipActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText:       { fontFamily: font.semibold, fontSize: 13, color: colors.primaryDark },
  chipTextActive: { color: colors.onPrimary },

  card:      { backgroundColor: colors.card, borderRadius: radius.lg, ...shadow },
  cardInner: { flexDirection: 'row', alignItems: 'flex-start', padding: 16 },
  cardText:  { flex: 1, marginRight: 12 },
  cardName:    { fontFamily: font.semibold, fontSize: 15, color: colors.text, marginBottom: 3 },
  cardAddress: { fontFamily: font.regular, fontSize: 13, color: colors.muted, lineHeight: 18 },
  cardNote:    { fontFamily: font.regular, fontSize: 12, color: colors.textMuted, lineHeight: 17, marginTop: 6 },

  cardActions: { gap: 14, alignItems: 'center', paddingTop: 2 },

  mhBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tintLilac,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  mhBadgeText: { fontFamily: font.semibold, fontSize: 11, color: colors.tintLilacIcon },

  emptyFiltered:     { paddingVertical: 48, alignItems: 'center' },
  emptyFilteredText: { fontFamily: font.regular, fontSize: 14, color: colors.muted },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(19,78,74,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: { fontFamily: font.bold, fontSize: 16, color: colors.text, marginBottom: 14 },
  noteInput: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    minHeight: 100,
    maxHeight: 160,
    textAlignVertical: 'top',
    backgroundColor: colors.bg,
  },
  noteCounter: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  modalButtons:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalBtnSpacer: { flex: 1 },
  modalBtn:       { borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 18 },
  modalBtnDisabled: { opacity: 0.5 },

  modalBtnDanger:     { borderWidth: 1.5, borderColor: colors.dangerBorder },
  modalBtnDangerText: { fontFamily: font.semibold, fontSize: 14, color: colors.dangerText },

  modalBtnCancel:     { borderWidth: 1.5, borderColor: colors.border },
  modalBtnCancelText: { fontFamily: font.semibold, fontSize: 14, color: colors.text },

  modalBtnSave:     { backgroundColor: colors.primary },
  modalBtnSaveText: { fontFamily: font.semibold, fontSize: 14, color: colors.onPrimary },
});
