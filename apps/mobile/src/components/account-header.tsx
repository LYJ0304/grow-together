import { AppHeader } from './app-header';
// Keep account screens' existing navigation callbacks and accessible back label.
export function AccountHeader({
  title,
  onBack,
  disabled = false,
}: {
  title: string;
  onBack(): void;
  disabled?: boolean;
}) {
  return (
    <AppHeader
      title={title}
      onBack={onBack}
      disabled={disabled}
      backLabel="이전 화면으로"
    />
  );
}
