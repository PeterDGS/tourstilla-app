import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface Guide {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface Tour {
  id: string;
  guide_id: string;
  guide_name: string;
  guide_email: string;
  tour_name: string;
  location: string;
  date: string;
  time: string;
  accepted: boolean;
}

// Guides
export const getGuides = () => api.get<Guide[]>('/api/guides');
export const createGuide = (data: { email: string; password: string; name: string }) =>
  api.post<Guide>('/api/guides', { ...data, role: 'guide' });
export const updateGuide = (id: string, data: { email: string; password: string; name: string }) =>
  api.put(`/api/guides/${id}`, { ...data, role: 'guide' });
export const deleteGuide = (id: string) => api.delete(`/api/guides/${id}`);

// Tours
export const getTours = () => api.get<Tour[]>('/api/tours');
export const getMyTours = () => api.get<Tour[]>('/api/tours/my-tours');
export const createTour = (data: Omit<Tour, 'id' | 'accepted'>) =>
  api.post<Tour>('/api/tours', data);
export const updateTour = (id: string, data: Partial<Tour>) =>
  api.put(`/api/tours/${id}`, data);
export const deleteTour = (id: string) => api.delete(`/api/tours/${id}`);

// Excel upload
export const uploadExcel = async (fileUri: string, fileName: string) => {
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  } as any);
  
  const token = await AsyncStorage.getItem('token');
  return axios.post(`${API_URL}/api/tours/upload-excel`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${token}`,
    },
  });
};

export default api;
