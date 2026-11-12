import { Text, View } from 'react-native';
import { editorial } from '../theme/editorial';

export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <View testID="editorial-intro" style={editorial.intro}>
      <Text style={editorial.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={editorial.title}>
        {title}
      </Text>
      {description ? (
        <Text style={editorial.description}>{description}</Text>
      ) : null}
    </View>
  );
}
