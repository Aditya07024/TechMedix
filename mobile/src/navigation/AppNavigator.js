import React from "react";
import { ActivityIndicator, StyleSheet, Text, View, Platform, TouchableOpacity, PanResponder } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PatientLoginScreen from "../screens/auth/PatientLoginScreen";
import DoctorLoginScreen from "../screens/auth/DoctorLoginScreen";
import StaffLoginScreen from "../screens/auth/StaffLoginScreen";
import AdminLoginScreen from "../screens/auth/AdminLoginScreen";
import MobileLandingScreen from "../screens/auth/MobileLandingScreen";
import StaffDashboardScreen from "../screens/staff/StaffDashboardScreen";
import AdminDashboardScreen from "../screens/admin/AdminDashboardScreen";
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
  PatientAddMedicineScreen,
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
import { colors, radii, spacing, typography } from "../theme/tokens";
import MedicineDetailScreen from "../screens/patient/MedicineDetailScreen";

const RootStack = createNativeStackNavigator();
const PatientTab = createBottomTabNavigator();
const DoctorTab = createBottomTabNavigator();

function CustomTabBar({ state, descriptors, navigation, isDoctor = false }) {
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx } = gestureState;
        if (dx < -50) {
          // Swipe Left -> Next Tab
          const nextIndex = state.index + 1;
          if (nextIndex < state.routes.length) {
            const nextRoute = state.routes[nextIndex];
            navigation.navigate(nextRoute.name, nextRoute.params);
          }
        } else if (dx > 50) {
          // Swipe Right -> Previous Tab
          const prevIndex = state.index - 1;
          if (prevIndex >= 0) {
            const prevRoute = state.routes[prevIndex];
            navigation.navigate(prevRoute.name, prevRoute.params);
          }
        }
      },
    })
  ).current;

  return (
    <View style={navStyles.tabContainer} {...panResponder.panHandlers}>
      <View style={navStyles.tabBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            options.title !== undefined
              ? options.title
              : route.name === "DoctorProfileTab"
              ? "Profile"
              : route.name === "DoctorHome"
              ? "Home"
              : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          const iconName = isDoctor
            ? {
                DoctorHome: "view-dashboard-outline",
                Queue: "clipboard-list-outline",
                Appointments: "calendar-month-outline",
                Schedule: "calendar-outline",
                DoctorProfileTab: "account-circle-outline",
              }[route.name]
            : {
                Home: "home-variant",
                Appointments: "calendar-heart",
                Prescriptions: "pill",
                Wallet: "file-document-outline",
                Profile: "account-outline",
              }[route.name];

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[
                navStyles.tabItem,
                isFocused && navStyles.tabItemActive
              ]}
            >
              <MaterialCommunityIcons
                name={iconName}
                size={20}
                color={isFocused ? colors.onPrimary : colors.outline}
              />
              {isFocused && (
                <Text style={navStyles.tabLabel}>
                  {label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
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
    <PatientTab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <PatientTab.Screen name="Home" component={PatientDashboardScreen} />
      <PatientTab.Screen name="Appointments" component={BookAppointmentScreen} />
      <PatientTab.Screen name="Prescriptions" component={AnalyzePrescriptionScreen} />
      <PatientTab.Screen name="Wallet" component={HealthWalletScreen} />
      <PatientTab.Screen name="Profile" component={PatientProfileScreen} />
    </PatientTab.Navigator>
  );
}

function DoctorTabs() {
  return (
    <DoctorTab.Navigator
      tabBar={(props) => <CustomTabBar {...props} isDoctor />}
      screenOptions={{ headerShown: false }}
    >
      <DoctorTab.Screen name="DoctorHome" component={DoctorDashboardScreen} options={{ title: "Home" }} />
      <DoctorTab.Screen name="Queue" component={QueueManagerScreen} />
      <DoctorTab.Screen name="Appointments" component={DoctorAppointmentsScreen} />
      <DoctorTab.Screen name="Schedule" component={DoctorScheduleScreen} />
      <DoctorTab.Screen name="DoctorProfileTab" component={DoctorProfileScreen} options={{ title: "Profile" }} />
    </DoctorTab.Navigator>
  );
}

function PatientRootNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="PatientApp" component={PatientTabs} />
      <RootStack.Screen
        name="AppointmentPayment"
        component={AppointmentPaymentScreen}
      />
      <RootStack.Screen name="PaymentWallet" component={PaymentWalletScreen} />
      <RootStack.Screen name="HealthWallet" component={HealthWalletScreen} />
      <RootStack.Screen
        name="PrescriptionResults"
        component={PrescriptionResultsScreen}
      />
      <RootStack.Screen
        name="MedicalTimeline"
        component={MedicalTimelineScreen}
      />
      <RootStack.Screen name="AIHealthChat" component={AIHealthChatScreen} />
      <RootStack.Screen name="XRayAnalyzer" component={XRayAnalyzerScreen} />
      <RootStack.Screen name="XRayHistory" component={XRayHistoryScreen} />
      <RootStack.Screen name="PatientQueue" component={PatientQueueScreen} />
      <RootStack.Screen name="HealthMetrics" component={HealthMetricsScreen} />
      <RootStack.Screen name="Notifications" component={NotificationsScreen} />
      <RootStack.Screen
        name="PatientRecordings"
        component={PatientRecordingsScreen}
      />
      <RootStack.Screen name="PatientQR" component={PatientQRScreen} />
      <RootStack.Screen
        name="MedicineSearch"
        component={MedicineSearchScreen}
      />
      <RootStack.Screen
        name="MedicineDetail"
        component={MedicineDetailScreen}
      />
      <RootStack.Screen
        name="PatientAddMedicine"
        component={PatientAddMedicineScreen}
      />
    </RootStack.Navigator>
  );
}

function DoctorRootNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="DoctorApp" component={DoctorTabs} />
      <RootStack.Screen name="DoctorProfile" component={DoctorProfileScreen} />
      <RootStack.Screen
        name="DoctorPatientLookup"
        component={DoctorPatientLookupScreen}
      />
      <RootStack.Screen
        name="DoctorManualPrescription"
        component={DoctorManualPrescriptionScreen}
      />
      <RootStack.Screen
        name="DoctorRecordingUpload"
        component={DoctorRecordingUploadScreen}
      />
    </RootStack.Navigator>
  );
}

function AuthNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen
        name="MobileLanding"
        component={MobileLandingScreen}
      />
      <RootStack.Screen
        name="PatientLogin"
        component={PatientLoginScreen}
      />
      <RootStack.Screen
        name="DoctorLogin"
        component={DoctorLoginScreen}
      />
      <RootStack.Screen
        name="StaffLogin"
        component={StaffLoginScreen}
      />
      <RootStack.Screen
        name="AdminLogin"
        component={AdminLoginScreen}
      />
    </RootStack.Navigator>
  );
}

function StaffRootNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen
        name="StaffDashboard"
        component={StaffDashboardScreen}
      />
    </RootStack.Navigator>
  );
}

function AdminRootNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
      />
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

  if (role === "staff") {
    return <StaffRootNavigator />;
  }

  if (role === "admin") {
    return <AdminRootNavigator />;
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

const navStyles = StyleSheet.create({
  tabContainer: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.surfaceLowest, // White
    borderRadius: radii.pill, // fully rounded
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.outline,
    justifyContent: "space-around",
    alignItems: "center",
    width: "100%",
    // Web shadow
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0px 8px 24px rgba(18, 20, 43, 0.08)",
        }
      : {
          shadowColor: "rgba(18, 20, 43, 0.08)",
          shadowOpacity: 1,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 5,
        }),
  },
  tabItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: colors.primary, // Brand Primary
  },
  tabLabel: {
    color: colors.onPrimary,
    fontWeight: "700",
    fontSize: 12,
  }
});
