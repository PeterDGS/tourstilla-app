import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getGuides, createGuide, updateGuide, deleteGuide, Guide } from '../../src/api/api';

export default function AdminGuidesScreen() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGuide, setEditingGuide] = useState<Guide | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loadGuides = useCallback(async () => {
    try {
      const response = await getGuides();
      setGuides(response.data);
    } catch (error) {
      console.error('Error loading guides:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadGuides();
  }, [loadGuides]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadGuides();
  };

  const handleOpenModal = (guide?: Guide) => {
    if (guide) {
      setEditingGuide(guide);
      setName(guide.name);
      setEmail(guide.email);
      setPassword('');
    } else {
      setEditingGuide(null);
      resetForm();
    }
    setModalVisible(true);
  };

  const handleSaveGuide = async () => {
    if (!name || !email || (!editingGuide && !password)) {
      Alert.alert('Error', 'Por favor completa todos los campos requeridos');
      return;
    }

    try {
      if (editingGuide) {
        await updateGuide(editingGuide.id, { name, email, password: password || 'unchanged' });
        Alert.alert('Éxito', 'Guía actualizado correctamente');
      } else {
        await createGuide({ name, email, password });
        Alert.alert('Éxito', 'Guía creado correctamente');
      }
      setModalVisible(false);
      resetForm();
      loadGuides();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Error al guardar el guía');
    }
  };

  const handleDeleteGuide = (guide: Guide) => {
    Alert.alert(
      'Eliminar Guía',
      `¿Eliminar a ${guide.name}? Esto también eliminará todos sus tours.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGuide(guide.id);
              loadGuides();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar el guía');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setEditingGuide(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d9c0" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Guías</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => handleOpenModal()}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#00d9c0" />
        }
      >
        {guides.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#444" />
            <Text style={styles.emptyText}>No hay guías registrados</Text>
            <Text style={styles.emptySubtext}>Presiona + para agregar un guía</Text>
          </View>
        ) : (
          guides.map((guide) => (
            <View key={guide.id} style={styles.guideCard}>
              <View style={styles.guideAvatar}>
                <Text style={styles.avatarText}>
                  {guide.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.guideInfo}>
                <Text style={styles.guideName}>{guide.name}</Text>
                <Text style={styles.guideEmail}>{guide.email}</Text>
              </View>
              <View style={styles.guideActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleOpenModal(guide)}
                >
                  <Ionicons name="pencil" size={18} color="#00d9c0" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDeleteGuide(guide)}
                >
                  <Ionicons name="trash" size={18} color="#ff6b6b" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Create/Edit Guide Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingGuide ? 'Editar Guía' : 'Nuevo Guía'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={styles.inputLabel}>Nombre</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Nombre del guía"
                placeholderTextColor="#666"
              />

              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="email@ejemplo.com"
                placeholderTextColor="#666"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>
                Contraseña {editingGuide ? '(dejar vacío para mantener)' : ''}
              </Text>
              <TextInput
                style={styles.textInput}
                value={password}
                onChangeText={setPassword}
                placeholder={editingGuide ? '••••••••' : 'Contraseña'}
                placeholderTextColor="#666"
                secureTextEntry
              />

              <TouchableOpacity style={styles.submitButton} onPress={handleSaveGuide}>
                <Text style={styles.submitButtonText}>
                  {editingGuide ? 'Guardar Cambios' : 'Crear Guía'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    backgroundColor: '#00d9c0',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#888',
    fontSize: 18,
    marginTop: 16,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  guideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  guideAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00d9c0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  guideInfo: {
    flex: 1,
    marginLeft: 16,
  },
  guideName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  guideEmail: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  guideActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2a2a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalForm: {
    padding: 20,
  },
  inputLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  submitButton: {
    backgroundColor: '#00d9c0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  submitButtonText: {
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
