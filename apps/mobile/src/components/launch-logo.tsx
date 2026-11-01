import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

export type LaunchLogoProps = {
  played: boolean;
  onComplete: (drawn?: boolean) => void;
  onStart: () => void;
};

// Expo Image renders the same vector statically on native; no path animation dependency.
export default function LaunchLogo(_props: LaunchLogoProps) {
  return (
    <Image
      source={require('../../assets/images/brand/emblem.svg')}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      accessible={false}
    />
  );
}
