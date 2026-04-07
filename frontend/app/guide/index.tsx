import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../../src/context/AuthContext';
import { getMyTours, updateTour, Tour } from '../../src/api/api';
import { registerForPushNotifications, addNotificationListener } from '../../src/utils/notifications';

export default function GuideHomeScreen() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  const loadTours = useCallback(async () => {
    try {
      const response = await getMyTours();
      setTours(response.data);
    } catch (error) {
      console.error('Error loading tours:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTours();
    // Register for push notifications
    registerForPushNotifications();
    
    // Listen for notifications
    const subscription = addNotificationListener((notification) => {
      loadTours(); // Reload tours when notification received
    });

    return () => subscription.remove();
  }, [loadTours]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTours();
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('¿Estás seguro de que deseas cerrar sesión?');
      if (confirmed) {
        await logout();
        router.replace('/');
      }
    } else {
      const { Alert } = require('react-native');
      Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas salir?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          },
        },
      ]);
    }
  };

  const handleAcceptTour = async (tour: Tour) => {
    try {
      await updateTour(tour.id, { accepted: !tour.accepted });
      loadTours();
      if (selectedTour?.id === tour.id) {
        setSelectedTour({ ...selectedTour, accepted: !tour.accepted });
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el tour');
    }
  };

  const handleTourPress = (tour: Tour) => {
    setSelectedTour(tour);
    setDetailModalVisible(true);
  };

  const getDates = () => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  };

  const filteredTours = tours.filter((tour) => {
    try {
      const tourDate = parseISO(tour.date);
      return isSameDay(tourDate, selectedDate);
    } catch {
      return false;
    }
  });

  const hasTours = (date: Date) => {
    return tours.some((tour) => {
      try {
        return isSameDay(parseISO(tour.date), date);
      } catch {
        return false;
      }
    });
  };

  const goToPreviousWeek = () => {
    setWeekStart(addDays(weekStart, -7));
  };

  const goToNextWeek = () => {
    setWeekStart(addDays(weekStart, 7));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF8C00" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola, {user?.name}</Text>
          <Text style={styles.subtitle}>Tours Asignados</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#ff6b6b" />
        </TouchableOpacity>
      </View>

      {/* Calendar Strip */}
      <View style={styles.calendarContainer}>
        <TouchableOpacity onPress={goToPreviousWeek} style={styles.arrowButton}>
          <Ionicons name="chevron-back" size={24} color="#FF8C00" />
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.calendarStrip}>
          {getDates().map((date, index) => {
            const isSelected = isSameDay(date, selectedDate);
            const hasToursOnDay = hasTours(date);
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dateItem,
                  isSelected && styles.dateItemSelected,
                ]}
                onPress={() => setSelectedDate(date)}
              >
                <Text style={[styles.monthText, isSelected && styles.dateTextSelected]}>
                  {format(date, 'MMM', { locale: es }).toUpperCase()}
                </Text>
                <Text style={[styles.dayNumber, isSelected && styles.dateTextSelected]}>
                  {format(date, 'd')}
                </Text>
                <Text style={[styles.dayName, isSelected && styles.dateTextSelected]}>
                  {format(date, 'EEE', { locale: es }).toUpperCase()}
                </Text>
                {hasToursOnDay && <View style={[styles.tourIndicator, isSelected && styles.tourIndicatorSelected]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity onPress={goToNextWeek} style={styles.arrowButton}>
          <Ionicons name="chevron-forward" size={24} color="#FF8C00" />
        </TouchableOpacity>
      </View>

      {/* Tours List */}
      <ScrollView
        style={styles.toursList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FF8C00" />
        }
      >
        {filteredTours.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#444" />
            <Text style={styles.emptyText}>No hay tours para este día</Text>
          </View>
        ) : (
          filteredTours.map((tour) => (
            <TouchableOpacity key={tour.id} style={styles.tourCard} onPress={() => handleTourPress(tour)}>
              <View style={styles.timeContainer}>
                <Text style={styles.tourTime}>{tour.time}</Text>
                {tour.participant_count > 0 && (
                  <View style={styles.participantBadge}>
                    <Ionicons name="people" size={12} color="#fff" />
                    <Text style={styles.participantCount}>{tour.participant_count}</Text>
                  </View>
                )}
              </View>
              <View style={styles.tourInfo}>
                <Text style={styles.tourName}>{tour.tour_name}</Text>
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color="#888" />
                  <Text style={styles.tourLocation}>{tour.location}</Text>
                </View>
                {tour.duration && (
                  <View style={styles.locationRow}>
                    <Ionicons name="time-outline" size={14} color="#888" />
                    <Text style={styles.tourLocation}>{tour.duration}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    styles.acceptButton,
                    tour.accepted && styles.acceptedButton,
                  ]}
                  onPress={() => handleAcceptTour(tour)}
                >
                  <Ionicons
                    name={tour.accepted ? 'checkmark-circle' : 'checkmark-circle-outline'}
                    size={18}
                    color={tour.accepted ? '#FFF8E1' : '#FF8C00'}
                  />
                  <Text
                    style={[
                      styles.acceptButtonText,
                      tour.accepted && styles.acceptedButtonText,
                    ]}
                  >
                    {tour.accepted ? 'Aceptado' : 'Aceptar'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Stats Footer */}
      <View style={styles.footer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{tours.length}</Text>
          <Text style={styles.statLabel}>Total Tours</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{tours.filter((t) => t.accepted).length}</Text>
          <Text style={styles.statLabel}>Aceptados</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{tours.filter((t) => !t.accepted).length}</Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </View>
      </View>

      {/* Tour Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalles del Tour</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {selectedTour && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Tour</Text>
                  <Text style={styles.detailValue}>{selectedTour.tour_name}</Text>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailHalf}>
                    <Text style={styles.detailLabel}>Fecha</Text>
                    <Text style={styles.detailValue}>
                      {format(parseISO(selectedTour.date), "d MMM yyyy", { locale: es })}
                    </Text>
                  </View>
                  <View style={styles.detailHalf}>
                    <Text style={styles.detailLabel}>Hora</Text>
                    <Text style={styles.detailValue}>{selectedTour.time}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailHalf}>
                    <Text style={styles.detailLabel}>Ubicación</Text>
                    <Text style={styles.detailValue}>{selectedTour.location}</Text>
                  </View>
                  <View style={styles.detailHalf}>
                    <Text style={styles.detailLabel}>Duración</Text>
                    <Text style={styles.detailValue}>{selectedTour.duration || 'N/A'}</Text>
                  </View>
                </View>

                {selectedTour.meeting_point && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Punto de Encuentro</Text>
                    <Text style={styles.detailValue}>{selectedTour.meeting_point}</Text>
                  </View>
                )}

                {selectedTour.notes && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Notas</Text>
                    <Text style={styles.detailValue}>{selectedTour.notes}</Text>
                  </View>
                )}

                {/* Participants Section */}
                <View style={styles.participantsSection}>
                  <View style={styles.participantsHeader}>
                    <Text style={styles.participantsTitle}>Participantes</Text>
                    <View style={styles.participantCountBadge}>
                      <Text style={styles.participantCountText}>{selectedTour.participant_count}</Text>
                    </View>
                  </View>

                  {selectedTour.participants && selectedTour.participants.length > 0 ? (
                    selectedTour.participants.map((participant, index) => (
                      <View key={index} style={styles.participantCard}>
                        <View style={styles.participantAvatar}>
                          <Text style={styles.participantInitial}>
                            {participant.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.participantInfo}>
                          <Text style={styles.participantName}>{participant.name}</Text>
                          {participant.phone && (
                            <View style={styles.participantDetail}>
                              <Ionicons name="call-outline" size={12} color="#888" />
                              <Text style={styles.participantDetailText}>{participant.phone}</Text>
                            </View>
                          )}
                          {participant.email && (
                            <View style={styles.participantDetail}>
                              <Ionicons name="mail-outline" size={12} color="#888" />
                              <Text style={styles.participantDetailText}>{participant.email}</Text>
                            </View>
                          )}
                          {participant.notes && (
                            <Text style={styles.participantNotes}>{participant.notes}</Text>
                          )}
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.noParticipants}>
                      <Ionicons name="people-outline" size={40} color="#444" />
                      <Text style={styles.noParticipantsText}>No hay participantes registrados</Text>
                    </View>
                  )}
                </View>

                {/* Accept Button */}
                <TouchableOpacity
                  style={[
                    styles.modalAcceptButton,
                    selectedTour.accepted && styles.modalAcceptedButton,
                  ]}
                  onPress={() => handleAcceptTour(selectedTour)}
                >
                  <Ionicons
                    name={selectedTour.accepted ? 'checkmark-circle' : 'checkmark-circle-outline'}
                    size={24}
                    color={selectedTour.accepted ? '#FFF8E1' : '#FF8C00'}
                  />
                  <Text
                    style={[
                      styles.modalAcceptButtonText,
                      selectedTour.accepted && styles.modalAcceptedButtonText,
                    ]}
                  >
                    {selectedTour.accepted ? 'Aceptado' : 'Aceptar Tour'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8E1',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  greeting: {
    fontSize: 14,
    color: '#888',
  },
  subtitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutButton: {
    padding: 8,
  },
  calendarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  arrowButton: {
    padding: 8,
  },
  calendarStrip: {
    flex: 1,
  },
  dateItem: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#FFECB3',
    minWidth: 60,
  },
  dateItemSelected: {
    backgroundColor: '#FF8C00',
  },
  monthText: {
    fontSize: 10,
    color: '#888',
    marginBottom: 2,
  },
  dayNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  dayName: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
  dateTextSelected: {
    color: '#FFF8E1',
  },
  tourIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF8C00',
    marginTop: 4,
  },
  tourIndicatorSelected: {
    backgroundColor: '#FFF8E1',
  },
  toursList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  tourCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFECB3',
    borderRadius: 16,
    marginVertical: 8,
    overflow: 'hidden',
  },
  timeContainer: {
    backgroundColor: '#FFE082',
    paddingHorizontal: 16,
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  tourTime: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  participantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF8C00',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 6,
  },
  participantCount: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 3,
  },
  tourInfo: {
    flex: 1,
    padding: 16,
  },
  tourName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF8C00',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tourLocation: {
    fontSize: 14,
    color: '#888',
    marginLeft: 4,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF8C00',
    marginTop: 8,
  },
  acceptedButton: {
    backgroundColor: '#FF8C00',
    borderColor: '#FF8C00',
  },
  acceptButtonText: {
    color: '#FF8C00',
    marginLeft: 6,
    fontWeight: '600',
  },
  acceptedButtonText: {
    color: '#FFF8E1',
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: '#FFECB3',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF8C00',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#FFE082',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF8E1',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE082',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  detailHalf: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  participantsSection: {
    marginTop: 8,
    marginBottom: 20,
  },
  participantsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  participantsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  participantCountBadge: {
    backgroundColor: '#FF8C00',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 10,
  },
  participantCountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF8E1',
  },
  participantCard: {
    flexDirection: 'row',
    backgroundColor: '#FFECB3',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  participantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF8C00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantInitial: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF8E1',
  },
  participantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  participantDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  participantDetailText: {
    fontSize: 13,
    color: '#888',
    marginLeft: 6,
  },
  participantNotes: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  noParticipants: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#FFECB3',
    borderRadius: 12,
  },
  noParticipantsText: {
    color: '#666',
    fontSize: 14,
    marginTop: 10,
  },
  modalAcceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF8C00',
    marginBottom: 40,
  },
  modalAcceptedButton: {
    backgroundColor: '#FF8C00',
  },
  modalAcceptButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF8C00',
    marginLeft: 8,
  },
  modalAcceptedButtonText: {
    color: '#FFF8E1',
  },
});
