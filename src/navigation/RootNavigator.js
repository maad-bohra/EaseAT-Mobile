import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Feather from '@expo/vector-icons/Feather';
import { colors, fonts } from '../theme';
import AcademicCalendar from '../screens/AcademicCalendar';
import Attendance from '../screens/Attendance';
import CalendarScreen from '../screens/CalendarScreen';
import Dashboard from '../screens/Dashboard';
import More from '../screens/More';
import Notifications from '../screens/Notifications';
import Profile from '../screens/Profile';
import Subjects from '../screens/Subjects';
import Timetable from '../screens/Timetable';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.navy,
    background: colors.paper,
    card: colors.paper,
    text: colors.ink,
    border: colors.line,
  },
};

function TabIcon({ name, focused }) {
  return (
    <View
      style={{
        width: 54,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? colors.skySoftStrong : 'transparent',
      }}
    >
      <Feather name={name} size={20} color={focused ? colors.navy : colors.muted} />
    </View>
  );
}

const tabs = [
  { name: 'Dashboard', component: Dashboard, icon: 'home' },
  { name: 'Attendance', component: Attendance, icon: 'check-square' },
  { name: 'Timetable', component: Timetable, icon: 'grid' },
  { name: 'Calendar', component: CalendarScreen, icon: 'calendar' },
  { name: 'More', component: More, icon: 'menu' },
];

function Tabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.muted,
        // Explicit height: room for the icon pill and label, plus the home-indicator inset.
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: colors.line,
          height: 66 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
      }}
    >
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon name={tab.icon} focused={focused} />,
            tabBarAccessibilityLabel: tab.name,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

const stackHeader = {
  headerStyle: { backgroundColor: colors.paper },
  headerShadowVisible: false,
  headerTintColor: colors.navy,
  headerTitleStyle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: colors.paper },
};

export default function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={stackHeader}>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Subjects" component={Subjects} options={{ title: 'Subjects' }} />
        <Stack.Screen name="AcademicCalendar" component={AcademicCalendar} options={{ title: 'Academic calendar' }} />
        <Stack.Screen name="Notifications" component={Notifications} options={{ title: 'Notifications' }} />
        <Stack.Screen name="Profile" component={Profile} options={{ title: 'Profile' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
