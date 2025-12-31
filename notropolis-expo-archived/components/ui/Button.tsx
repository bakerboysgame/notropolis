import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

interface ButtonProps {
  onPress: () => void;
  children: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
}

export function Button({
  onPress,
  children,
  loading = false,
  disabled = false,
  variant = 'primary',
}: ButtonProps) {
  const baseStyles = "py-3 px-6 rounded-lg flex-row items-center justify-center";

  const variantStyles = {
    primary: "bg-primary-500 active:bg-primary-600",
    secondary: "bg-neutral-700 active:bg-neutral-600",
    outline: "border border-neutral-600 bg-transparent",
  };

  const textStyles = {
    primary: "text-white font-semibold",
    secondary: "text-white font-semibold",
    outline: "text-neutral-300 font-semibold",
  };

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      className={`${baseStyles} ${variantStyles[variant]} ${isDisabled ? 'opacity-50' : ''}`}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <Text className={textStyles[variant]}>{children}</Text>
      )}
    </TouchableOpacity>
  );
}
