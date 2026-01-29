import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DoctorDashboard from "../screens/doctor/DoctorDashboard";
import ScanPatientScreen from "../screens/doctor/ScanPatientScreen";
import DoctorPatientView from "../screens/doctor/DoctorPatientView";

const Stack = createNativeStackNavigator();

export default function DoctorStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="DoctorHome" component={DoctorDashboard} />
      <Stack.Screen name="ScanPatient" component={ScanPatientScreen} />
      <Stack.Screen name="DoctorPatientView" component={DoctorPatientView} />
    </Stack.Navigator>
  );
}