import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginRoleSelectionScreen from "../screens/auth/LoginRoleSelectionScreen";
import {
  AIHealthChatScreen,
  AnalyzePrescriptionScreen,
  AppointmentPaymentScreen,
  BookAppointmentScreen,
  HealthMetricsScreen,
  HealthWalletScreen,
  MedicalTimelineScreen,
  MedicineSearchScreen,
  NotificationsScreen,
  PatientDashboardScreen,
  PatientProfileScreen,
  PatientQRScreen,
  PatientQueueScreen,
  PatientRecordingsScreen,
  PaymentWalletScreen,
  PrescriptionResultsScreen,
  XRayAnalyzerScreen,
  XRayHistoryScreen,
} from "../screens/patient/PatientScreens";
import {
  DoctorAppointmentsScreen,
  DoctorDashboardScreen,
  DoctorManualPrescriptionScreen,
  DoctorPatientLookupScreen,
  DoctorProfileScreen,
  DoctorRecordingUploadScreen,
  DoctorScheduleScreen,
  QueueManagerScreen,
} from "../screens/doctor/DoctorScreens";
import { useAuth } from "../context/AuthContext";
import { colors, typography } from "../theme/tokens";
import MedicineDetailScreen from "../screens/patient/MedicineDetailScreen";

const RootStack = createNativeStackNavigator();
const PatientTab = createBottomTabNavigator();
const DoctorTab = createBottomTabNavigator();

function tabOptions() {
  return {
    headerShown: false,
    tabBarStyle: {
      height: 76,
      paddingTop: 10,
      paddingBottom: 12,
      borderTopWidth: 0,
      backgroundColor: colors.surfaceLowest,
    },
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.outline,
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: "700",
      marginTop: 4,
    },
  };
}

function patientTabIcon(name, focused) {
  const icons = {
    Home: "home-variant",
    Care: "calendar-heart",
    Prescriptions: "pill",
    Wallet: "wallet-outline",
    Profile: "account-outline",
  };
  return (
    <MaterialCommunityIcons
      name={icons[name]}
      size={22}
      color={focused ? colors.primary : colors.outline}
    />
  );
}

function doctorTabIcon(name, focused) {
  const icons = {
    DoctorHome: "view-dashboard-outline",
    Queue: "clipboard-list-outline",
    Appointments: "calendar-month-outline",
    Schedule: "calendar-outline",
    DoctorProfileTab: "account-circle-outline",
  };
  return (
    <MaterialCommunityIcons
      name={icons[name]}
      size={22}
      color={focused ? colors.primary : colors.outline}
    />
  );
}

function AppLoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.loadingText}>Loading TechMedix...</Text>
    </View>
  );
}

function PatientTabs() {
  return (
    <PatientTab.Navigator screenOptions={tabOptions()}>
      <PatientTab.Screen
        name="Home"
        component={PatientDashboardScreen}
        options={{ tabBarIcon: ({ focused }) => patientTabIcon("Home", focused) }}
      />
      <PatientTab.Screen
        name="Care"
        component={BookAppointmentScreen}
        options={{ tabBarIcon: ({ focused }) => patientTabIcon("Care", focused) }}
      />
      <PatientTab.Screen
        name="Prescriptions"
        component={AnalyzePrescriptionScreen}
        options={{ tabBarIcon: ({ focused }) => patientTabIcon("Prescriptions", focused) }}
      />
      <PatientTab.Screen
        name="Wallet"
        component={HealthWalletScreen}
        options={{ tabBarIcon: ({ focused }) => patientTabIcon("Wallet", focused) }}
      />
      <PatientTab.Screen
        name="Profile"
        component={PatientProfileScreen}
        options={{ tabBarIcon: ({ focused }) => patientTabIcon("Profile", focused) }}
      />
    </PatientTab.Navigator>
  );
}

function DoctorTabs() {
  return (
    <DoctorTab.Navigator screenOptions={tabOptions()}>
      <DoctorTab.Screen
        name="DoctorHome"
        component={DoctorDashboardScreen}
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => doctorTabIcon("DoctorHome", focused),
        }}
      />
      <DoctorTab.Screen
        name="Queue"
        component={QueueManagerScreen}
        options={{ tabBarIcon: ({ focused }) => doctorTabIcon("Queue", focused) }}
      />
      <DoctorTab.Screen
        name="Appointments"
        component={DoctorAppointmentsScreen}
        options={{ tabBarIcon: ({ focused }) => doctorTabIcon("Appointments", focused) }}
      />
      <DoctorTab.Screen
        name="Schedule"
        component={DoctorScheduleScreen}
        options={{ tabBarIcon: ({ focused }) => doctorTabIcon("Schedule", focused) }}
      />
      <DoctorTab.Screen
        name="DoctorProfileTab"
        component={DoctorProfileScreen}
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => doctorTabIcon("DoctorProfileTab", focused),
        }}
      />
    </DoctorTab.Navigator>
  );
}

function PatientRootNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="PatientApp" component={PatientTabs} />
      <RootStack.Screen name="AppointmentPayment" component={AppointmentPaymentScreen} />
      <RootStack.Screen name="PaymentWallet" component={PaymentWalletScreen} />
      <RootStack.Screen name="PrescriptionResults" component={PrescriptionResultsScreen} />
      <RootStack.Screen name="MedicalTimeline" component={MedicalTimelineScreen} />
      <RootStack.Screen name="AIHealthChat" component={AIHealthChatScreen} />
      <RootStack.Screen name="XRayAnalyzer" component={XRayAnalyzerScreen} />
      <RootStack.Screen name="XRayHistory" component={XRayHistoryScreen} />
      <RootStack.Screen name="PatientQueue" component={PatientQueueScreen} />
      <RootStack.Screen name="HealthMetrics" component={HealthMetricsScreen} />
      <RootStack.Screen name="Notifications" component={NotificationsScreen} />
      <RootStack.Screen name="PatientRecordings" component={PatientRecordingsScreen} />
      <RootStack.Screen name="PatientQR" component={PatientQRScreen} />
      <RootStack.Screen name="MedicineSearch" component={MedicineSearchScreen} />
      <RootStack.Screen name="MedicineDetail" component={MedicineDetailScreen} />
    </RootStack.Navigator>
  );
}

function DoctorRootNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="DoctorApp" component={DoctorTabs} />
      <RootStack.Screen name="DoctorProfile" component={DoctorProfileScreen} />
      <RootStack.Screen name="DoctorPatientLookup" component={DoctorPatientLookupScreen} />
      <RootStack.Screen name="DoctorManualPrescription" component={DoctorManualPrescriptionScreen} />
      <RootStack.Screen name="DoctorRecordingUpload" component={DoctorRecordingUploadScreen} />
    </RootStack.Navigator>
  );
}

function AuthNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="RoleSelection" component={LoginRoleSelectionScreen} />
    </RootStack.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, isLoading, role } = useAuth();

  if (isLoading) {
    return <AppLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <AuthNavigator />;
  }

  if (role === "doctor") {
    return <DoctorRootNavigator />;
  }

  return <PatientRootNavigator />;
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    gap: 14,
  },
  loadingText: {
    color: colors.onSurfaceVariant,
    fontSize: typography.body,
  },
});
