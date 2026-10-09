import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const [fontsLoaded, fontError] = useFonts({
    Jua: require('../assets/fonts/Jua-Regular.ttf'),
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoSection}>
          <Image
            source={require('../assets/images/grow-together-logo.png')}
            style={styles.logo}
            contentFit="contain"
            accessible={false}
          />
        </View>
        <View style={styles.footer}>
          {(fontsLoaded || fontError) && (
            <>
              <Text accessibilityRole="header" style={styles.title}>
                같이 키우기
              </Text>
              <Text accessibilityLabel="Version 1.0" style={styles.version}>
                Version<Text style={styles.versionNumber}> 1.0</Text>
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F9',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 21,
  },
  logoSection: {
    flex: 1,
    minHeight: 253,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 84,
    paddingBottom: 24,
  },
  logo: {
    width: 145,
    height: 145,
    transform: [{ translateX: -2 }],
  },
  footer: {
    alignItems: 'center',
    gap: 24,
  },
  title: {
    fontFamily: 'Jua',
    fontSize: 35,
    letterSpacing: -0.7,
    color: '#D26A5C',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.08)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  version: {
    fontFamily: 'Jua',
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.28,
    color: '#C2C3CB',
  },
  versionNumber: {
    fontSize: 14,
  },
});
