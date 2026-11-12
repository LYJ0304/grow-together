import { Image, type ImageSource } from 'expo-image';

// Selection belongs to the whole tab; icons no longer paint a second oval.
export function TabIcon({
  source,
  color,
}: {
  source: ImageSource;
  color: string;
}) {
  return (
    <Image
      source={source}
      tintColor={color}
      style={{ width: 22, height: 22 }}
      accessible={false}
    />
  );
}
