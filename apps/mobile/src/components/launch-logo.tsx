import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

export type LaunchLogoProps = {
  played: boolean;
  onComplete: (drawn?: boolean) => void;
  onStart: () => void;
};

export default function LaunchLogo(_props: LaunchLogoProps) {
  return (
    <Image
      source={require('../../assets/images/grow-together-logo.png')}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      accessible={false}
    />
  );
}
