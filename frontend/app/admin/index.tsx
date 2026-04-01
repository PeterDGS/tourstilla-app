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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { getTours, createTour, deleteTour, uploadExcel, getGuides, Guide, Tour } from '../../src/api/api';

export default function AdminToursScreen() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [tourName, setTourName] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [showGuideSelector, setShowGuideSelector] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [toursRes, guidesRes] = await Promise.all([getTours(), getGuides()]);
      setTours(toursRes.data);
      setGuides(guidesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handlePickExcel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setUploading(true);
        try {
          const response = await uploadExcel(file.uri, file.name);
          Alert.alert(
            'Éxito',
            `Tours creados: ${response.data.tours_created}\nGuías creados: ${response.data.guides_created}`
          );
          loadData();
        } catch (error: any) {
          Alert.alert('Error', error.response?.data?.detail || 'Error al cargar el archivo');
        } finally {
          setUploading(false);
        }
      }
    } catch (error) {
      console.error('Document picker error:', error);
    }
  };

  const handleCreateTour = async () => {
    if (!selectedGuide || !tourName || !location || !date || !time) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    try {
      await createTour({
        guide_id: selectedGuide.id,
        guide_name: selectedGuide.name,
        guide_email: selectedGuide.email,
        tour_name: tourName,
        location: location,
        date: date,
        time: time,
      });
      setModalVisible(false);
      resetForm();
      loadData();
      Alert.alert('Éxito', 'Tour creado correctamente');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Error al crear el tour');
    }
  };

  const handleDeleteTour = (tour: Tour) => {
    Alert.alert('Eliminar Tour', `¿Eliminar ${tour.tour_name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTour(tour.id);
            loadData();
          } catch (error) {
            Alert.alert('Error', 'No se pudo eliminar el tour');
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setSelectedGuide(null);
    setTourName('');
    setLocation('');
    setDate('');
    setTime('');
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
        <Text style={styles.title}>Gestión de Tours</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.headerButton, uploading && styles.buttonDisabled]}
            onPress={handlePickExcel}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="document" size={18} color="#fff" />
                <Text style={styles.headerButtonText}>Excel</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.headerButtonText}>Nuevo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#00d9c0" />
        }
      >
        {tours.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#444" />
            <Text style={styles.emptyText}>No hay tours</Text>
            <Text style={styles.emptySubtext}>Carga un Excel o crea tours manualmente</Text>
          </View>
        ) : (
          tours.map((tour) => (
            <View key={tour.id} style={styles.tourCard}>
              <View style={styles.tourHeader}>
                <Text style={styles.tourName}>{tour.tour_name}</Text>
                <TouchableOpacity onPress={() => handleDeleteTour(tour)}>
                  <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
                </TouchableOpacity>
              </View>
              <View style={styles.tourDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="person-outline" size={14} color="#888" />
                  <Text style={styles.detailText}>{tour.guide_name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={14} color="#888" />
                  <Text style={styles.detailText}>
                    {format(parseISO(tour.date), "d MMM yyyy", { locale: es })} - {tour.time}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={14} color="#888" />
                  <Text style={styles.detailText}>{tour.location}</Text>
                </View>
              </View>
              <View style={[styles.statusBadge, tour.accepted && styles.statusAccepted]}>
                <Text style={styles.statusText}>
                  {tour.accepted ? 'Aceptado' : 'Pendiente'}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Create Tour Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Tour</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={styles.inputLabel}>Guía</Text>
              <TouchableOpacity
                style={styles.selectInput}
                onPress={() => setShowGuideSelector(true)}
              >
                <Text style={selectedGuide ? styles.selectText : styles.selectPlaceholder}>
                  {selectedGuide ? selectedGuide.name : 'Selecciona un guía'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#888" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Nombre del Tour</Text>
              <TextInput
                style={styles.textInput}
                value={tourName}
                onChangeText={setTourName}
                placeholder="Ej: AUSTRIAS/ES"
                placeholderTextColor="#666"
              />

              <Text style={styles.inputLabel}>Ubicación</Text>
              <TextInput
                style={styles.textInput}
                value={location}
                onChangeText={setLocation}
                placeholder="Ej: PTA.SOL"
                placeholderTextColor="#666"
              />

              <Text style={styles.inputLabel}>Fecha (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.textInput}
                value={date}
                onChangeText={setDate}
                placeholder="2025-07-15"
                placeholderTextColor="#666"
              />

              <Text style={styles.inputLabel}>Hora (HH:MM)</Text>
              <TextInput
                style={styles.textInput}
                value={time}
                onChangeText={setTime}
                placeholder="10:00"
                placeholderTextColor="#666"
              />

              <TouchableOpacity style={styles.submitButton} onPress={handleCreateTour}>
                <Text style={styles.submitButtonText}>Crear Tour</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Guide Selector Modal */}
      <Modal
        visible={showGuideSelector}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowGuideSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.selectorContent}>
            <Text style={styles.selectorTitle}>Selecciona un Guía</Text>
            <ScrollView>
              {guides.map((guide) => (
                <TouchableOpacity
                  key={guide.id}
                  style={styles.selectorItem}
                  onPress={() => {
                    setSelectedGuide(guide);
                    setShowGuideSelector(false);
                  }}
                >
                  <Text style={styles.selectorItemText}>{guide.name}</Text>
                  <Text style={styles.selectorItemSubtext}>{guide.email}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.selectorCancel}
              onPress={() => setShowGuideSelector(false)}
            >
              <Text style={styles.selectorCancelText}>Cancelar</Text>
            </TouchableOpacity>
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
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00d9c0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  headerButtonText: {
    color: '#fff',
    fontWeight: '600',
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
  tourCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  tourHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tourName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00d9c0',
  },
  tourDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    color: '#ccc',
    fontSize: 14,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#ff6b6b33',
    marginTop: 12,
  },
  statusAccepted: {
    backgroundColor: '#00d9c033',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  selectInput: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  selectText: {
    color: '#fff',
    fontSize: 16,
  },
  selectPlaceholder: {
    color: '#666',
    fontSize: 16,
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
  selectorContent: {
    backgroundColor: '#16213e',
    margin: 20,
    borderRadius: 16,
    maxHeight: '60%',
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  selectorItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  selectorItemText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  selectorItemSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  selectorCancel: {
    padding: 16,
    alignItems: 'center',
  },
  selectorCancelText: {
    color: '#ff6b6b',
    fontSize: 16,
  },
});
