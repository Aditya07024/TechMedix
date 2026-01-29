import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DashboardScreen from "../screens/patient/DashboardScreen";
import AddEhrScreen from "../screens/patient/AddEhrScreen";
import AiInsightScreen from "../screens/patient/AiInsightScreen";
import HistoryScreen from "../screens/patient/HistoryScreen";

import QrCodeScreen from "../screens/patient/QrCodeScreen";
import MedicineSearchScreen from "../screens/medicine/MedicineSearchScreen";
import MedicineCompareScreen from "../screens/medicine/MedicineCompareScreen";

// import ChartsScreen from "../screens/patient/ChartsScreen";
const Stack = createNativeStackNavigator();

export default function AppStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="AddEhr" component={AddEhrScreen} />
      <Stack.Screen name="AiInsight" component={AiInsightScreen} options={{ title: "AI Health Insights" }}/>
      <Stack.Screen name="History" component={HistoryScreen} />
{/* <Stack.Screen name="Charts" component={ChartsScreen} /> */}
<Stack.Screen name="MyQR" component={QrCodeScreen} />
<Stack.Screen name="MedicineSearch" component={MedicineSearchScreen} />
<Stack.Screen name="MedicineCompare" component={MedicineCompareScreen} />
    </Stack.Navigator>
    
  );
}
