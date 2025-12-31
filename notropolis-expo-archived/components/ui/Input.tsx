import { View, Text, TextInput, TextInputProps } from 'react-native';
import { useState } from 'react';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, ...props }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-neutral-300 text-sm mb-1.5 font-medium">
          {label}
        </Text>
      )}
      <TextInput
        className={`
          bg-neutral-800 border rounded-lg px-4 py-3 text-white text-base
          ${isFocused ? 'border-primary-500' : 'border-neutral-700'}
          ${error ? 'border-red-500' : ''}
        `}
        placeholderTextColor="#737373"
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />
      {error && (
        <Text className="text-red-500 text-sm mt-1">{error}</Text>
      )}
    </View>
  );
}
